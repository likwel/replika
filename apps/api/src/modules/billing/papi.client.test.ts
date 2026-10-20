import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { verifySignature } from "./papi.client.js";

// npx tsx --test src/modules/billing/*.test.ts

const secret = `pwhsec_${randomBytes(32).toString("hex")}`;
const body = Buffer.from(
  JSON.stringify({ paymentStatus: "SUCCESS", amount: 129000, merchantPaymentReference: "SF-TEST-1", notificationToken: "tok" }),
);
const nowMs = 1_790_000_000_000;
const t = Math.floor(nowMs / 1000);

function sign(ts: number, raw: Buffer, key = secret) {
  return createHmac("sha256", key).update(`${ts}.`).update(raw).digest("hex");
}

test("signature valide acceptée", () => {
  assert.equal(verifySignature(body, `t=${t},v1=${sign(t, body)}`, secret, nowMs), true);
  assert.equal(verifySignature(body, `t=${t}, v1=${sign(t, body)}`, secret, nowMs), true); // espaces tolérés
});

test("corps modifié refusé", () => {
  const tampered = Buffer.from(body.toString().replace("129000", "1000"));
  assert.equal(verifySignature(tampered, `t=${t},v1=${sign(t, body)}`, secret, nowMs), false);
});

test("horodatage hors de la fenêtre de 5 minutes refusé", () => {
  const old = t - 301;
  assert.equal(verifySignature(body, `t=${old},v1=${sign(old, body)}`, secret, nowMs), false);
  const ok = t - 299;
  assert.equal(verifySignature(body, `t=${ok},v1=${sign(ok, body)}`, secret, nowMs), true);
});

test("mauvaise clé et en-têtes mal formés refusés", () => {
  assert.equal(verifySignature(body, `t=${t},v1=${sign(t, body, "pwhsec_autre")}`, secret, nowMs), false);
  assert.equal(verifySignature(body, undefined, secret, nowMs), false);
  assert.equal(verifySignature(body, "", secret, nowMs), false);
  assert.equal(verifySignature(body, `v1=${sign(t, body)}`, secret, nowMs), false);
  assert.equal(verifySignature(body, `t=${t},v1=abc`, secret, nowMs), false);
  assert.equal(verifySignature(body, `t=abc,v1=${sign(t, body)}`, secret, nowMs), false);
  assert.equal(verifySignature(body, `t=${t},v1=${sign(t, body)}`, "", nowMs), false);
});
