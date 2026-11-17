import dns from "node:dns/promises";
import net from "node:net";
import { AppError } from "../../utils/AppError.js";
import { MAX_UPLOAD_BYTES } from "../uploads/upload.service.js";
import { MAX_SHEET_BYTES } from "./import.logic.js";

// Lecture d'un tableur ou d'une image à partir d'un lien collé par l'utilisateur.
// Le serveur va chercher une adresse qu'on lui donne : on refuse tout ce qui n'est pas une adresse publique (SSRF),
// à chaque redirection, avec une taille et une durée limitées.

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;

// Adresses non publiques : boucle locale, réseaux privés, lien-local (dont métadonnées cloud 169.254.x), CGNAT, multicast
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

export type Lookup = (host: string) => Promise<string[]>;
const systemLookup: Lookup = async (host) => (await dns.lookup(host, { all: true })).map((a) => a.address);

export async function assertPublicUrl(raw: string, lookup: Lookup = systemLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("Adresse invalide", 422);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new AppError("Seules les adresses http(s) sont acceptées", 422);
  if (url.username || url.password) throw new AppError("Adresse avec identifiants refusée", 422);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [host] : await lookup(host).catch(() => []);
  if (!addresses.length) throw new AppError(`Adresse introuvable : ${url.hostname}`, 422);
  if (addresses.some(isPrivateIp)) throw new AppError("Cette adresse n'est pas publique : elle ne peut pas être lue", 422);
  return url;
}

export interface FetchDeps {
  fetchImpl?: typeof fetch;
  lookup?: Lookup;
  timeoutMs?: number;
}

// Télécharge en suivant les redirections à la main (chacune est revérifiée) et en coupant au-delà de maxBytes
export async function fetchLimited(raw: string, maxBytes: number, deps: FetchDeps = {}): Promise<{ body: Buffer; contentType: string; url: string }> {
  const doFetch = deps.fetchImpl ?? fetch;
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current, deps.lookup);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), deps.timeoutMs ?? TIMEOUT_MS);
    try {
      const res = await doFetch(url, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": "SuiteFlow-Import/1.0", Accept: "*/*" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, url).toString();
        continue;
      }
      if (!res.ok) throw new AppError(`Le lien répond « ${res.status} » : vérifiez qu'il est public`, 422);
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > maxBytes) throw new AppError(`Fichier trop lourd (${Math.round(maxBytes / 1024 / 1024)} Mo maximum)`, 413);
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.length;
        if (size > maxBytes) throw new AppError(`Fichier trop lourd (${Math.round(maxBytes / 1024 / 1024)} Mo maximum)`, 413);
        chunks.push(Buffer.from(chunk));
      }
      return { body: Buffer.concat(chunks), contentType: res.headers.get("content-type") ?? "", url: url.toString() };
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(ctl.signal.aborted ? "Le lien met trop de temps à répondre" : "Le lien ne peut pas être lu", 422);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new AppError("Trop de redirections", 422);
}

const looksLikeHtml = (b: Buffer) => /^\s*<(!doctype html|html)/i.test(b.subarray(0, 200).toString("utf8"));

// Tableur au format CSV ; une page HTML à la place signifie presque toujours « tableur non partagé »
export async function fetchSheetText(url: string, deps?: FetchDeps): Promise<string> {
  const r = await fetchLimited(url, MAX_SHEET_BYTES, deps);
  if (looksLikeHtml(r.body)) {
    throw new AppError(
      "Le tableur n'est pas lisible : dans Google Sheets, cliquez sur Partager puis « Accès général : Toute personne disposant du lien » (lecteur), et recollez le lien.",
      422,
      "SHEET_NOT_PUBLIC",
    );
  }
  return r.body.toString("utf8");
}

// Image : le type est lu dans le contenu du fichier (voir sniffImageType), pas dans l'en-tête
export async function fetchImage(url: string, deps?: FetchDeps): Promise<Buffer> {
  const r = await fetchLimited(url, MAX_UPLOAD_BYTES, deps);
  if (looksLikeHtml(r.body)) throw new AppError("Ce lien mène à une page web, pas à une image : le fichier doit être partagé publiquement (Drive : « Toute personne disposant du lien »)", 422);
  return r.body;
}
