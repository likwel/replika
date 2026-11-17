import { useCallback, useEffect, useRef, useState } from "react";
import { messageApi, type Notifications } from "@/lib/message.api";

const POLL_MS = 45_000;
const EVENT = "suiteflow:notifications-refresh";

// À appeler quand l'état « vu » change ailleurs (page À traiter, réponse envoyée) : la bulle se met à jour aussitôt
export const refreshNotifications = () => window.dispatchEvent(new Event(EVENT));

// Notifications « À traiter » : total en attente, nouveautés non vues et derniers messages.
// Rafraîchi toutes les 45 s, au retour sur l'onglet et sur demande (refreshNotifications).
export function useNotifications(enabled: boolean) {
  const [data, setData] = useState<Notifications | null>(null);
  const alive = useRef(true);

  const load = useCallback(() => {
    if (!enabled) return;
    messageApi.notifications().then((d) => alive.current && setData(d)).catch(() => undefined);
  }, [enabled]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(EVENT, load);
    return () => {
      alive.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(EVENT, load);
    };
  }, [load]);

  // Marque comme vus (mise à jour immédiate de la bulle, puis confirmation serveur)
  const markSeen = useCallback(
    async (input: { ids: string[] } | { all: true }) => {
      setData((d) => {
        if (!d) return d;
        const ids = "all" in input ? null : new Set(input.ids);
        const items = d.items.map((i) => (ids === null || ids.has(i.id) ? { ...i, seen: true } : i));
        const newlySeen = d.items.filter((i, k) => !i.seen && items[k].seen).length;
        return { ...d, items, unseen: ids === null ? 0 : Math.max(0, d.unseen - newlySeen) };
      });
      await messageApi.markSeen(input).catch(() => undefined);
      load();
    },
    [load],
  );

  return { data, reload: load, markSeen };
}
