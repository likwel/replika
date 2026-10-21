import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { theme } from "@/theme";
import { authApi } from "@/lib/auth.api";

// Cloudflare Turnstile : vérification anti-robot discrète (le plus souvent sans clic).
// La clé du site vient de l'API (GET /auth/config) ; sans clé, rien ne s'affiche et onToken reçoit null.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
let siteKeyPromise: Promise<string | null> | null = null;

function loadScript() {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export const turnstileSiteKey = () => (siteKeyPromise ??= authApi.config().then((c) => c.turnstileSiteKey).catch(() => null));

export interface TurnstileHandle {
  reset: () => void;
}

interface Props {
  onToken: (token: string | null) => void;
  onEnabled?: (enabled: boolean) => void; // false : pas de vérification sur ce serveur
}

export const Turnstile = forwardRef<TurnstileHandle, Props>(function Turnstile({ onToken, onEnabled }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onToken, onEnabled });
  cb.current = { onToken, onEnabled };

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current.onToken(null);
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = await turnstileSiteKey();
      cb.current.onEnabled?.(Boolean(key));
      if (!key || cancelled) return cb.current.onToken(null);
      try {
        await loadScript();
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled || !box.current || !window.turnstile) return;
      const dark = document.documentElement.getAttribute("data-theme") === "dark";
      widget.current = window.turnstile.render(box.current, {
        sitekey: key,
        theme: dark ? "dark" : "light",
        language: "fr",
        size: "flexible",
        callback: (t: string) => cb.current.onToken(t),
        "expired-callback": () => cb.current.onToken(null),
        "error-callback": () => cb.current.onToken(null),
      });
    })();
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-xl px-3 py-2 text-[12.5px]" style={{ background: theme.amberSoft, color: theme.amber }}>
        La vérification anti-robot Cloudflare n'a pas pu se charger : vérifiez votre connexion ou désactivez le bloqueur de contenu, puis rechargez la page.
      </p>
    );
  }
  return <div ref={box} className="min-h-[65px] w-full" aria-label="Vérification anti-robot Cloudflare" />;
});
