import { useEffect, useState } from "react";

// Pagination en mémoire d'une liste déjà filtrée/triée : revient à la page 1 si la taille change
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => setPage(1), [items.length]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * pageSize;
  return { page, setPage, pageCount, pageItems: items.slice(start, start + pageSize), total: items.length };
}
