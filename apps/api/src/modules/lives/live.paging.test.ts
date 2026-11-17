import { test } from "node:test";
import assert from "node:assert/strict";
import { collectSince, type Page } from "./live.paging.js";

// npx tsx --test src/modules/lives/live.paging.test.ts

const at = (min: number) => new Date(Date.UTC(2026, 10, 18, 10, 0) + min * 60_000);
// 25 commentaires, un par minute, servis du plus récent au plus ancien par pages de 10
const all = Array.from({ length: 25 }, (_, i) => ({ id: `c${24 - i}`, createdAt: at(24 - i) }));
const server = (calls: string[]) => async (after?: string): Promise<Page<(typeof all)[number]>> => {
  calls.push(after ?? "début");
  const from = after ? Number(after) : 0;
  return { items: all.slice(from, from + 10), next: from + 10 < all.length ? String(from + 10) : undefined };
};

test("lit toutes les pages jusqu'au point de reprise : aucun commentaire intermédiaire n'est perdu", async () => {
  const calls: string[] = [];
  const r = await collectSince(server(calls), at(8).getTime());
  assert.equal(r.complete, true);
  assert.equal(r.pages, 2); // les commentaires 24 à 5 suffisent : le 5e est plus ancien que le point de reprise
  assert.ok(["c24", "c10", "c9"].every((id) => r.items.some((c) => c.id === id)));
  assert.deepEqual(calls, ["début", "10"]);
});

test("rien de nouveau : une seule page lue", async () => {
  const r = await collectSince(server([]), at(30).getTime());
  assert.equal(r.pages, 1);
});

test("sans point de reprise : tout est lu jusqu'à la dernière page", async () => {
  const r = await collectSince(server([]), null);
  assert.equal(r.items.length, 25);
  assert.equal(r.complete, true);
});

test("plafond atteint : le passage est signalé incomplet", async () => {
  const r = await collectSince(server([]), at(-100).getTime(), 2);
  assert.equal(r.complete, false);
  assert.equal(r.pages, 2);
  assert.equal(r.items.length, 20);
});
