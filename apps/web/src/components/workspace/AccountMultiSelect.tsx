import { useState } from "react";
import { ChevronDown, Layers, Search, X } from "lucide-react";
import { theme } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { PlatIcon } from "@/components/ui/PlatIcon";
import { AccountAvatar } from "./AccountAvatar";
import type { MetaPlatform } from "@/lib/workspace.api";

interface Account {
  id: string;
  name: string;
  platform: MetaPlatform | "TIKTOK";
  avatarUrl: string | null;
}

interface Props {
  accounts: Account[];
  value: string[]; // vide = tous les comptes
  onChange: (ids: string[]) => void;
  label?: string;
}

// Choix de plusieurs Pages / comptes : « Tous les comptes », ou une sélection (au-delà de 6 comptes, avec recherche)
export function AccountMultiSelect({ accounts, value, onChange, label = "Comptes concernés" }: Props) {
  const list = accounts.filter((a): a is Account & { platform: MetaPlatform } => a.platform !== "TIKTOK");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const all = value.length === 0;
  const picked = list.filter((a) => value.includes(a.id));
  const shown = list.filter((a) => !q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase()));

  const set = (ids: string[]) => onChange(ids.length === list.length ? [] : ids); // tout cocher revient à « tous les comptes »
  const toggle = (id: string) => set(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const ofPlatform = (p: MetaPlatform) => list.filter((a) => a.platform === p).map((a) => a.id);
  const platformOn = (p: MetaPlatform) => {
    const ids = ofPlatform(p);
    return !all && ids.length > 0 && value.length === ids.length && ids.every((id) => value.includes(id));
  };
  const hasBoth = ofPlatform("FACEBOOK").length > 0 && ofPlatform("INSTAGRAM").length > 0;

  const summary = all ? "Tous les comptes" : picked.length === 1 ? picked[0].name : `${picked.length} comptes sélectionnés`;
  const chip = (on: boolean) => ({ background: on ? theme.bgDark : "var(--surface-3)", color: on ? "#fff" : theme.text });

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className="field-in flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left"
      >
        {all || picked.length === 0 ? (
          <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full" style={{ background: "var(--surface-3)" }}><Layers size={13} style={{ color: theme.textMuted }} /></span>
        ) : (
          <span className="flex flex-shrink-0 -space-x-2">
            {picked.slice(0, 3).map((a) => (
              <span key={a.id} className="rounded-full" style={{ boxShadow: "0 0 0 2px var(--surface-2)" }}><Avatar name={a.name} src={a.avatarUrl} size={24} /></span>
            ))}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium" style={{ color: theme.text }} title={picked.map((a) => a.name).join(", ") || undefined}>{summary}</span>
        <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: theme.textMuted, transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div className="animate-fade-in mt-1.5 flex flex-col gap-2 rounded-xl p-2" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px var(--line-2)" }}>
          {/* Raccourcis */}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onChange([])} aria-pressed={all} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={chip(all)}>Tous</button>
            {hasBoth && (
              <>
                <button type="button" onClick={() => onChange(platformOn("FACEBOOK") ? [] : ofPlatform("FACEBOOK"))} aria-pressed={platformOn("FACEBOOK")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={chip(platformOn("FACEBOOK"))}><PlatIcon p="fb" size={12} /> Facebook</button>
                <button type="button" onClick={() => onChange(platformOn("INSTAGRAM") ? [] : ofPlatform("INSTAGRAM"))} aria-pressed={platformOn("INSTAGRAM")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={chip(platformOn("INSTAGRAM"))}><PlatIcon p="ig" size={12} /> Instagram</button>
              </>
            )}
            {!all && <button type="button" onClick={() => onChange([])} className="ml-auto text-[11.5px] font-semibold underline-offset-2 hover:underline" style={{ color: theme.textMuted }}>Effacer</button>}
          </div>

          {list.length > 6 && (
            <label className="field-bare flex h-8 items-center gap-2 rounded-lg px-2.5">
              <Search size={13} style={{ color: theme.textMuted }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une Page…" aria-label="Chercher une Page" className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium outline-none" style={{ color: theme.text }} />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche"><X size={13} style={{ color: theme.textMuted }} /></button>}
            </label>
          )}

          <ul className="flex max-h-56 flex-col overflow-y-auto" role="group" aria-label={label}>
            {shown.length === 0 && <li className="px-2 py-3 text-center text-[12.5px]" style={{ color: theme.textMuted }}>Aucune Page ne correspond.</li>}
            {shown.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-black/5">
                  <input type="checkbox" checked={value.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 flex-shrink-0 cursor-pointer accent-[var(--color-gold)]" />
                  <AccountAvatar name={a.name} src={a.avatarUrl} platform={a.platform} size={26} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] font-semibold" style={{ color: theme.text }}>{a.name}</b>
                    <small className="block text-[11px]" style={{ color: theme.textMuted }}>{a.platform === "INSTAGRAM" ? "Compte Instagram" : "Page Facebook"}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="px-1 text-[11.5px]" style={{ color: theme.textMuted }}>
            {all ? "Le pipeline s'applique à tous vos comptes, y compris ceux que vous associerez plus tard." : `Le pipeline ne s'applique qu'à ${picked.length > 1 ? "ces comptes" : "ce compte"}.`}
          </p>
        </div>
      )}
    </div>
  );
}
