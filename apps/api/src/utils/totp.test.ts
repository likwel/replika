import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, hotp, verifyTotp } from "./totp.js";

// npx tsx --test src/**/*.test.ts

// Vecteurs de référence RFC 6238 (SHA-1, secret ASCII « 12345678901234567890 »)
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

test("base32 aller-retour", () => {
  assert.equal(SECRET, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(base32Decode(SECRET).toString(), "12345678901234567890");
});

test("codes RFC 6238 (6 derniers chiffres)", () => {
  assert.equal(hotp(SECRET, Math.floor(59 / 30)), "287082");
  assert.equal(hotp(SECRET, Math.floor(1111111109 / 30)), "081804");
  assert.equal(hotp(SECRET, Math.floor(1234567890 / 30)), "005924");
  assert.equal(hotp(SECRET, Math.floor(2000000000 / 30)), "279037");
});

test("vérification : tolérance d'un pas, rejet sinon", () => {
  const t = 1234567890_000;
  assert.equal(verifyTotp(SECRET, "005924", t), Math.floor(1234567890 / 30));
  assert.notEqual(verifyTotp(SECRET, "005924", t + 30_000), null); // horloge en avance de 30 s
  assert.equal(verifyTotp(SECRET, "005924", t + 120_000), null);
  assert.equal(verifyTotp(SECRET, "12345", t), null);
  assert.equal(verifyTotp(SECRET, "abcdef", t), null);
});
