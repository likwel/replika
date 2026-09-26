import { useEffect, useRef, useState } from "react";
import { automationApi } from "@/lib/automation.api";
import { plural } from "@/lib/format";
import { showNotification } from "@/lib/notify";

const POLL_MS = 60_000;

// Nombre de messages à traiter (file d'attente : en attente + escaladés), rafraîchi chaque minute,
// au retour sur l'onglet et à chaque navigation. Notifie le navigateur quand il augmente.
export function useAttention(notify: boolean, onOpenQueue: () => void, refreshKey: string) {
  const [count, setCount] = useState(0);
  const previous = useRef<number | null>(null);
  const check = useRef<() => void>(() => {});
  const latest = useRef({ notify, onOpenQueue });
  latest.current = { notify, onOpenQueue };

  useEffect(() => {
    let alive = true;
    check.current = () => {
      automationApi
        .settings()
        .then((s) => {
          if (!alive) return;
          const n = s.stats.pending + s.stats.escalated;
          const prev = previous.current;
          // Onglet en arrière-plan uniquement : au premier plan, la cloche suffit
          if (prev !== null && n > prev && latest.current.notify && document.hidden) {
            showNotification(
              `${plural(n - prev, "nouveau message", "nouveaux messages")} à traiter`,
              latest.current.onOpenQueue
            );
          }
          previous.current = n;
          setCount(n);
        })
        .catch(() => {});
    };
    check.current();
    const timer = setInterval(() => check.current(), POLL_MS);
    const onFocus = () => check.current();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    check.current();
  }, [refreshKey]);

  return count;
}
