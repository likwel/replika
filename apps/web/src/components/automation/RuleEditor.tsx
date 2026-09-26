import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { X, Layers, MessageCircle, Mail, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { theme } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { ApiError } from "@/lib/api";
import type { SocialAccount } from "@/lib/account.api";
import { EMPTY_RULE, splitKeywords, splitVariants } from "./rules";
import {
  automationApi,
  type AutomationRule,
  type MatchType,
  type RuleChannel,
  type RuleInput,
} from "@/lib/automation.api";

const CHANNELS: Array<{ value: RuleChannel; label: string; icon: LucideIcon }> = [
  { value: "ALL", label: "Tout", icon: Layers },
  { value: "COMMENT", label: "Commentaires", icon: MessageCircle },
  { value: "DIRECT", label: "Messages privés", icon: Mail },
];

const MATCHES: Array<{ value: MatchType; label: string }> = [
  { value: "CONTAINS", label: "Contient un mot-clé" },
  { value: "EXACT", label: "Message exact" },
  { value: "ANY", label: "Tout message" },
];

const inputClass = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-[13px] font-semibold" style={{ color: theme.text }}>{children}</p>
      {hint && <p className="text-[11px]" style={{ color: theme.textMuted }}>{hint}</p>}
    </div>
  );
}

interface Props {
  rule: AutomationRule | null; // null = création
  preset?: Partial<RuleInput>;
  accounts: SocialAccount[];
  onClose: () => void;
  onSaved: (rule: AutomationRule) => void;
}

export function RuleEditor({ rule, preset, accounts, onClose, onSaved }: Props) {
  const [form, setForm] = useState<RuleInput>(() =>
    rule
      ? {
          name: rule.name,
          channel: rule.channel,
          matchType: rule.matchType,
          trigger: rule.trigger,
          response: rule.response,
          privateReply: rule.privateReply,
          autoSend: rule.autoSend,
          isActive: rule.isActive,
          priority: rule.priority,
          accountId: rule.accountId,
        }
      : { ...EMPTY_RULE, ...preset }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RuleInput>(key: K, value: RuleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Fermeture au clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const keywords = splitKeywords(form.trigger);
  const variants = splitVariants(form.response);
  const replyAccounts = accounts.filter((a) => a.platform !== "TIKTOK");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Donnez un nom à la règle.");
    if (form.matchType !== "ANY" && keywords.length === 0) return setError("Ajoutez au moins un mot-clé.");
    if (!form.response.trim()) return setError("Écrivez la réponse à envoyer.");

    const body: RuleInput = {
      ...form,
      trigger: form.matchType === "ANY" ? "" : keywords.join(", "),
      privateReply: form.channel === "DIRECT" ? null : form.privateReply?.trim() || null,
    };
    setSaving(true);
    try {
      onSaved(rule ? await automationApi.update(rule.id, body) : await automationApi.create(body));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(28,24,19,0.55)" }}
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-3xl sm:rounded-2xl"
        style={{ background: theme.bgCard }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: theme.border }}>
          <h3 className="font-semibold" style={{ color: theme.text }}>
            {rule ? "Modifier la règle" : "Nouvelle règle"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Fermer">
            <X size={18} style={{ color: theme.textMuted }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div>
            <Label>Nom</Label>
            <input
              className={inputClass}
              style={inputStyle}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex. Demande de prix"
              autoFocus
            />
          </div>

          <div>
            <Label>S'applique à</Label>
            <Segmented options={CHANNELS} value={form.channel} onChange={(v) => set("channel", v)} />
          </div>

          <div>
            <Label>Compte</Label>
            <select
              className={inputClass}
              style={inputStyle}
              value={form.accountId ?? ""}
              onChange={(e) => set("accountId", e.target.value || null)}
            >
              <option value="">Tous les comptes</option>
              {replyAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Déclencheur</Label>
            <Segmented options={MATCHES} value={form.matchType} onChange={(v) => set("matchType", v)} />
            {form.matchType === "ANY" ? (
              <p className="mt-2 text-[11px]" style={{ color: theme.textMuted }}>
                Répond à tout message qu'aucune règle à mots-clés ni l'assistant IA n'a pris en charge. En message
                privé, elle n'est envoyée qu'une fois par personne toutes les 24 h.
              </p>
            ) : (
              <>
                <input
                  className={`${inputClass} mt-2`}
                  style={inputStyle}
                  value={form.trigger}
                  onChange={(e) => set("trigger", e.target.value)}
                  placeholder="prix, combien, tarif"
                />
                <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>
                  Séparés par des virgules. Majuscules et accents ignorés
                  {form.matchType === "CONTAINS" ? " ; le mot doit apparaître entier." : "."}
                </p>
                {keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {keywords.map((k) => (
                      <span key={k} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: theme.goldSoft, color: theme.goldDark }}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <Label hint="Variables : {nom} (prénom de l'auteur), {page}. Séparez plusieurs variantes par || : l'une sera choisie au hasard.">
              Réponse
            </Label>
            <textarea
              className={inputClass}
              style={inputStyle}
              rows={3}
              value={form.response}
              onChange={(e) => set("response", e.target.value)}
              placeholder="Bonjour {nom} ! Nous vous envoyons le prix en message privé 📩"
            />
            {variants.length > 1 && (
              <p className="mt-1 text-[11px]" style={{ color: theme.goldDark }}>{variants.length} variantes</p>
            )}
          </div>

          {form.channel !== "DIRECT" && (
            <div>
              <Label hint="Commentaires uniquement : envoyé en plus, en privé, à l'auteur du commentaire (une fois par commentaire).">
                Message privé à l'auteur (optionnel)
              </Label>
              <textarea
                className={inputClass}
                style={inputStyle}
                rows={2}
                value={form.privateReply ?? ""}
                onChange={(e) => set("privateReply", e.target.value)}
                placeholder="Bonjour {nom}, voici nos tarifs : …"
              />
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Envoi automatique</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                {form.autoSend
                  ? "La réponse est publiée immédiatement, sans validation."
                  : "La réponse est proposée dans la file d'attente : vous la validez avant envoi."}
              </p>
            </div>
            <Toggle checked={form.autoSend} onChange={(v) => set("autoSend", v)} label="Envoi automatique" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[13px] font-semibold" style={{ color: theme.text }}>Priorité</p>
              <p className="text-[11px]" style={{ color: theme.textMuted }}>
                Si plusieurs règles correspondent, la plus haute l'emporte.
              </p>
            </div>
            <input
              type="number"
              min={-100}
              max={100}
              className={`${inputClass} !w-20 text-center`}
              style={inputStyle}
              value={form.priority}
              onChange={(e) => set("priority", Math.max(-100, Math.min(100, Number(e.target.value) || 0)))}
            />
          </div>

          {error && (
            <p className="rounded-xl px-3 py-2 text-sm" style={{ background: "#FDECEC", color: theme.red }}>{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3" style={{ borderColor: theme.border }}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
