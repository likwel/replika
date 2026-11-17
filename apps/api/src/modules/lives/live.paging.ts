// Lecture des commentaires d'un live par pages (du plus récent au plus ancien) jusqu'au dernier commentaire déjà traité.
// Sans cela, seuls les 100 derniers commentaires seraient lus : après un arrêt du serveur ou une pause, les JP
// intermédiaires seraient perdus.

export interface Page<T> { items: T[]; next?: string }

export const CATCHUP_MAX_PAGES = 60; // ≈ 6 000 commentaires Facebook par passage

export async function collectSince<T extends { createdAt: Date }>(
  fetchPage: (after?: string) => Promise<Page<T>>,
  sinceMs: number | null,
  maxPages = CATCHUP_MAX_PAGES,
): Promise<{ items: T[]; complete: boolean; pages: number }> {
  const items: T[] = [];
  let after: string | undefined;
  for (let pages = 1; pages <= maxPages; pages++) {
    const page = await fetchPage(after);
    items.push(...page.items);
    const oldest = page.items.reduce((min, c) => Math.min(min, c.createdAt.getTime()), Infinity);
    // Un commentaire plus ancien que le point de reprise : tout ce qui nous manque est déjà lu
    if (sinceMs !== null && oldest < sinceMs) return { items, complete: true, pages };
    if (!page.next || page.items.length === 0) return { items, complete: true, pages };
    after = page.next;
  }
  return { items, complete: false, pages: maxPages };
}
