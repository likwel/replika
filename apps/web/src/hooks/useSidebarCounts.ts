import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAccess } from "@/hooks/useAccess";
import { accountApi } from "@/lib/account.api";
import { automationApi } from "@/lib/automation.api";
import { pipelineApi } from "@/lib/pipeline.api";
import { liveApi } from "@/lib/live.api";
import { marketplaceApi } from "@/lib/marketplace.api";
import { leadApi } from "@/lib/lead.api";
import { scheduleApi } from "@/lib/schedule.api";
import { teamApi } from "@/lib/team.api";

export interface SidebarCount {
  n: number;
  label: string; // infobulle : « 5 règles actives »
  tone?: "warn";
}
// Clé = id du menu (data/menus.ts) ; « team » pour la ligne Équipe du groupe Compte
export type SidebarCounts = Partial<Record<"conn" | "live" | "market" | "leads" | "plan" | "rules" | "auto" | "team", SidebarCount>>;

const REFRESH_EVENT = "suiteflow:counts-refresh";
// À appeler après une modification qui change un compteur (règle activée, pipeline créé…) : la barre se met à jour aussitôt
export const refreshSidebarCounts = () => window.dispatchEvent(new Event(REFRESH_EVENT));

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

// Statistiques en badge à droite de chaque entrée de la barre latérale : ce qui est actif ou à faire dans le module.
// Chaque compteur n'est demandé que si le module est accessible ; un échec d'API laisse simplement le badge absent.
export function useSidebarCounts(): SidebarCounts {
  const { canMenu } = useAccess();
  const loc = useLocation();
  const [counts, setCounts] = useState<SidebarCounts>({});
  const last = useRef(0);
  const allowed = useRef(canMenu);
  allowed.current = canMenu;

  const load = useCallback(() => {
    last.current = Date.now();
    const can = allowed.current;
    const next: SidebarCounts = {};
    const job = (ok: boolean, fn: () => Promise<void>) => (ok ? fn().catch(() => undefined) : Promise.resolve());
    Promise.all([
      job(can("conn"), async () => {
        const list = await accountApi.list();
        const active = list.filter((a) => a.isActive);
        const broken = active.filter((a) => a.syncError).length;
        next.conn = { n: active.length, label: `${plural(active.length, "compte actif", "comptes actifs")}${broken ? ` · ${plural(broken, "à vérifier", "à vérifier")}` : ""}`, tone: broken ? "warn" : undefined };
      }),
      job(can("live"), async () => {
        const n = (await liveApi.sessions()).filter((s) => s.status === "ACTIVE").length;
        next.live = { n, label: plural(n, "session en capture", "sessions en capture") };
      }),
      job(can("market"), async () => {
        const n = (await marketplaceApi.stats()).activeListings;
        next.market = { n, label: plural(n, "annonce en ligne", "annonces en ligne") };
      }),
      job(can("leads"), async () => {
        const n = (await leadApi.stats()).toContact;
        next.leads = { n, label: plural(n, "lead à contacter", "leads à contacter") };
      }),
      job(can("plan"), async () => {
        const n = (await scheduleApi.list({ status: ["SCHEDULED"] })).length;
        next.plan = { n, label: plural(n, "envoi programmé", "envois programmés") };
      }),
      job(can("rules"), async () => {
        const n = (await automationApi.list()).filter((r) => r.isActive).length;
        next.rules = { n, label: plural(n, "règle active", "règles actives") };
      }),
      job(can("auto"), async () => {
        const n = (await pipelineApi.list()).filter((p) => p.isActive).length;
        next.auto = { n, label: plural(n, "pipeline actif", "pipelines actifs") };
      }),
      job(can("set", 3), async () => {
        const n = (await teamApi.overview()).members.length;
        next.team = { n, label: plural(n, "membre d'équipe", "membres d'équipe") };
      }),
    ]).then(() => setCounts(next));
  }, []);

  // Au montage, toutes les minutes, au retour sur l'onglet, à la demande, et après un changement de page (au plus toutes les 15 s)
  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onFocus = () => Date.now() - last.current > 15_000 && load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(REFRESH_EVENT, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(REFRESH_EVENT, load);
    };
  }, [load]);
  useEffect(() => {
    if (Date.now() - last.current > 15_000) load();
  }, [loc.pathname, load]);

  return counts;
}
