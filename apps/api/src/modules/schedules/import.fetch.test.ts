import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicUrl, fetchImage, fetchSheetText, isPrivateIp } from "./import.fetch.js";

// npx tsx --test src/modules/schedules/import.fetch.test.ts

const publicDns = async () => ["93.184.216.34"];
const reply = (body: string | Buffer, init: ResponseInit = {}) => new Response(body, { status: 200, ...init });

test("adresses privées refusées, publiques acceptées", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) assert.equal(isPrivateIp(ip), false, ip);
});

test("SSRF : localhost, IP privée, DNS vers le réseau interne, protocole et identifiants refusés", async () => {
  await assert.rejects(assertPublicUrl("http://127.0.0.1:4000/api"), /pas publique/);
  await assert.rejects(assertPublicUrl("http://[::1]/x"), /pas publique/);
  await assert.rejects(assertPublicUrl("https://interne.exemple/x", async () => ["10.0.0.8"]), /pas publique/);
  await assert.rejects(assertPublicUrl("https://metadata/x", async () => ["93.184.216.34", "169.254.169.254"]), /pas publique/);
  await assert.rejects(assertPublicUrl("file:///etc/passwd", publicDns), /http/);
  await assert.rejects(assertPublicUrl("https://user:pw@exemple.com/", publicDns), /identifiants/);
  assert.equal((await assertPublicUrl("https://exemple.com/a", publicDns)).hostname, "exemple.com");
});

test("une redirection vers une adresse privée est refusée", async () => {
  const fetchImpl = (async (u: URL | string) =>
    String(u).includes("exemple.com") ? reply("", { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }) : reply("secret")) as typeof fetch;
  await assert.rejects(fetchSheetText("https://exemple.com/s.csv", { fetchImpl, lookup: publicDns }), /pas publique/);
});

test("tableur : CSV lu ; page HTML = tableur non partagé ; erreur HTTP expliquée", async () => {
  const ok = (async () => reply("Date,Texte\n1,2")) as typeof fetch;
  assert.equal(await fetchSheetText("https://exemple.com/s.csv", { fetchImpl: ok, lookup: publicDns }), "Date,Texte\n1,2");
  const html = (async () => reply("<!DOCTYPE html><html><body>Connexion</body></html>")) as typeof fetch;
  await assert.rejects(fetchSheetText("https://docs.google.com/x", { fetchImpl: html, lookup: publicDns }), /Partager/);
  const nf = (async () => reply("", { status: 404 })) as typeof fetch;
  await assert.rejects(fetchSheetText("https://exemple.com/s.csv", { fetchImpl: nf, lookup: publicDns }), /404/);
});

test("taille limitée, déclarée ou réelle", async () => {
  const big = Buffer.alloc(9 * 1024 * 1024, 1);
  await assert.rejects(fetchImage("https://exemple.com/a.jpg", { fetchImpl: (async () => reply(big)) as typeof fetch, lookup: publicDns }), /trop lourd/);
  const declared = (async () => reply("x", { headers: { "content-length": String(99 * 1024 * 1024) } })) as typeof fetch;
  await assert.rejects(fetchImage("https://exemple.com/a.jpg", { fetchImpl: declared, lookup: publicDns }), /trop lourd/);
});

test("image : octets renvoyés ; page web à la place = lien non public", async () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  assert.deepEqual(await fetchImage("https://exemple.com/a.jpg", { fetchImpl: (async () => reply(jpg)) as typeof fetch, lookup: publicDns }), jpg);
  await assert.rejects(fetchImage("https://drive.google.com/uc?id=1", { fetchImpl: (async () => reply("<html>Virus scan</html>")) as typeof fetch, lookup: publicDns }), /page web/);
});
