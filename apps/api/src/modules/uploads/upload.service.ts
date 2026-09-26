import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

export const UPLOADS_DIR = path.resolve(env.uploadsDir);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
};
const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const FILE_NAME = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

// Images jointes aux publications programmées : servies publiquement sur /uploads (Instagram les télécharge)
export async function saveImage(body: unknown, contentType: string | undefined) {
  const type = TYPES[(contentType ?? "").split(";")[0].trim()];
  if (!type) throw new AppError("Format non pris en charge : JPG, PNG ou WebP", 415);
  if (!Buffer.isBuffer(body) || body.length === 0) throw new AppError("Image vide", 422);
  if (body.length > MAX_UPLOAD_BYTES) throw new AppError("Image trop lourde (8 Mo maximum)", 413);
  if (!type.magic(body)) throw new AppError("Le fichier ne correspond pas à une image valide", 422);

  const name = `${crypto.randomBytes(16).toString("hex")}.${type.ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, name), body);
  return { url: `${env.publicApiUrl}/uploads/${name}`, name };
}

// Image téléversée sur ReplyKA (et non une URL externe) : nom de fichier, sinon null.
// L'origine est ignorée : l'adresse publique de l'API peut changer entre la programmation et l'envoi.
export function localUploadName(url: string | null | undefined): string | null {
  const name = url?.match(/\/uploads\/([^/?#]+)$/)?.[1];
  return name && FILE_NAME.test(name) ? name : null;
}

// Adresse actuelle d'une image téléversée (ou l'URL externe telle quelle)
export const publicImageUrl = (url: string) => {
  const name = localUploadName(url);
  return name ? `${env.publicApiUrl}/uploads/${name}` : url;
};

export async function readUpload(name: string) {
  if (!FILE_NAME.test(name)) throw new AppError("Image introuvable", 404);
  const data = await fs.readFile(path.join(UPLOADS_DIR, name)).catch(() => {
    throw new AppError("Image introuvable sur le serveur : ajoutez-la de nouveau", 404);
  });
  return { data, type: MIME_BY_EXT[name.split(".").pop()!], name };
}

export async function deleteUpload(name: string) {
  if (FILE_NAME.test(name)) await fs.unlink(path.join(UPLOADS_DIR, name)).catch(() => {});
}

// Instagram doit télécharger l'image lui-même : impossible depuis une adresse locale
export const isPublicAddress = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host) && !/^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
  } catch {
    return false;
  }
};
