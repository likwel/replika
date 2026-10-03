import { useEffect, useState } from "react";
import { Check, FlaskConical, Info } from "lucide-react";
import { theme } from "@/theme";
import { Toggle } from "@/components/ui/Toggle";
import { liveApi, type ContactField, type Detection, type LiveProduct, type LiveSettings } from "@/lib/live.api";
import { FIELD_OPTIONS, VARIABLES } from "./live";

interface Props {
  value: LiveSettings;
  onChange: (v: LiveSettings) => void;
  products: LiveProduct[];
}

const input = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold" style={{ color: theme.text }}>{title}</p>
        {hint && <p className="text-xs" style={{ color: theme.textMuted }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// Essai de la détection avec les mots-clés et le catalogue en cours de saisie (rien n'est envoyé)
function DetectionTester({ keywords, products }: { keywords: string; products: LiveProduct[] }) {
  const [text, setText] = useState("jp A3 x2");
  const [result, setResult] = useState<Detection | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!text.trim()) return setResult(null);
      liveApi.detect(text, keywords, products).then(setResult).catch(() => setResult(null));
    }, 300);
    return () => clearTimeout(t);
  }, [text, keywords, JSON.stringify(products)]);

  return (
    <div className="rounded-xl p-3" style={{ background: theme.goldSoft }}>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: theme.goldDark }}>
        <FlaskConical size={13} /> Tester un commentaire
      </p>
      <input value={text} onChange={(e) => setText(e.target.value)} className={input} style={{ ...inputStyle, background: theme.bgCard }} aria-label="Commentaire à tester" />
      {result && (
        <p className="mt-1.5 text-xs" style={{ color: result.isJp ? "#15803d" : theme.textMuted }}>
          {result.isJp
            ? `✔ JP détecté — ${result.product ? `${result.product.code} · ${result.product.name}` : result.code ? `code ${result.code}` : result.label ? `« ${result.label} »` : "article non précisé"}${result.quantity > 1 ? ` · quantité ${result.quantity}` : ""}`
            : "✘ Pas un JP : ce commentaire sera seulement affiché."}
        </p>
      )}
    </div>
  );
}

export function SessionSettingsForm({ value: v, onChange, products }: Props) {
  const [recapDefaults, setRecapDefaults] = useState<{ recapMessage: string; recapUpdateMessage: string } | null>(null);
  useEffect(() => {
    liveApi.defaults().then((d) => setRecapDefaults({ recapMessage: d.recapMessage, recapUpdateMessage: d.recapUpdateMessage }));
  }, []);

  const set = <K extends keyof LiveSettings>(k: K, val: LiveSettings[K]) => onChange({ ...v, [k]: val });
  const toggleField = (f: ContactField) =>
    set("requiredFields", v.requiredFields.includes(f) ? v.requiredFields.filter((x) => x !== f) : [...v.requiredFields, f]);

  const template = (k: "firstMessage" | "missingMessage" | "confirmMessage" | "soldOutMessage", label: string, hint: string) => (
    <label className="block">
      <span className="block text-xs font-medium" style={{ color: theme.text }}>{label}</span>
      <span className="mb-1 block text-[11px]" style={{ color: theme.textMuted }}>{hint}</span>
      <textarea value={v[k]} onChange={(e) => set(k, e.target.value)} rows={k === "firstMessage" ? 5 : 2} className={input} style={inputStyle} />
    </label>
  );

  return (
    <div className="flex flex-col gap-5">
      <Section title="Détection des JP" hint="Mots-clés séparés par des virgules. Le code article est lu juste après (« jp A3 », « jp 12 x2 »).">
        <input value={v.keywords} onChange={(e) => set("keywords", e.target.value)} className={input} style={inputStyle} aria-label="Mots-clés" />
        <DetectionTester keywords={v.keywords} products={products} />
      </Section>

      <Section title="Informations à collecter" hint="Demandées en message privé ; la commande est confirmée quand tout est reçu.">
        <div className="flex flex-wrap gap-2">
          {FIELD_OPTIONS.map((f) => {
            const on = v.requiredFields.includes(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => toggleField(f.value)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
                style={{ background: on ? theme.goldSoft : theme.bg, border: `1px solid ${on ? theme.gold : theme.border}`, color: theme.text }}
                aria-pressed={on}
              >
                {on && <Check size={13} style={{ color: theme.goldDark }} />} {f.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Envoi automatique">
        <label className="flex items-start justify-between gap-3 rounded-xl p-3" style={{ background: theme.bg }}>
          <span>
            <span className="block text-sm font-medium" style={{ color: theme.text }}>Message privé à chaque JP</span>
            <span className="block text-xs" style={{ color: theme.textMuted }}>
              Désactivé : les JP sont seulement listés, vous contactez les clients vous-même.
            </span>
          </span>
          <Toggle checked={v.autoMessage} onChange={(x) => set("autoMessage", x)} label="Message privé automatique" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium" style={{ color: theme.text }}>Réponse publique sous le commentaire</span>
          <span className="mb-1 block text-[11px]" style={{ color: theme.textMuted }}>Laissez vide pour ne pas répondre publiquement.</span>
          <input value={v.replyPublic ?? ""} onChange={(e) => set("replyPublic", e.target.value || null)} className={input} style={inputStyle} />
        </label>
      </Section>

      <Section title="Messages privés">
        {template("firstMessage", "Premier message", "Envoyé à chaque JP : il demande les informations à collecter.")}
        {template("missingMessage", "Informations manquantes", "Quand la réponse du client est incomplète (3 relances au plus).")}
        {template("confirmMessage", "Confirmation", "Quand tout est reçu, ou dès le JP si le client est déjà connu.")}
        {template("soldOutMessage", "Article épuisé", "Quand le stock du catalogue est atteint : le client passe en liste d'attente.")}
        <div className="flex items-start gap-2 rounded-xl p-3 text-[11px]" style={{ background: theme.bg, color: theme.textMuted }}>
          <Info size={13} className="mt-0.5 flex-shrink-0" />
          <p>
            Variables :{" "}
            {VARIABLES.map(([k, label], i) => (
              <span key={k}>
                <code style={{ color: theme.goldDark }}>{k}</code> {label}
                {i < VARIABLES.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </div>
      </Section>

      <Section title="Récapitulatif de fin de live" hint="Envoyé automatiquement à la fin du live à chaque participant ayant au moins un JP confirmé. Visible et imprimable dans l'onglet « Factures ».">
        <label className="block">
          <span className="block text-xs font-medium" style={{ color: theme.text }}>Frais de livraison (Ar)</span>
          <span className="mb-1 block text-[11px]" style={{ color: theme.textMuted }}>Ajoutés une fois par client dans le total du récapitulatif. Modifiable facture par facture si besoin.</span>
          <input
            type="number"
            min={0}
            value={v.deliveryFee}
            onChange={(e) => set("deliveryFee", Math.max(0, Number(e.target.value) || 0))}
            className={`${input} !w-40`}
            style={inputStyle}
          />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: theme.text }}>Message récapitulatif (premier envoi)</span>
            {recapDefaults && (
              <button
                type="button"
                onClick={() => set("recapMessage", recapDefaults.recapMessage)}
                className="text-[11px] font-medium hover:underline"
                style={{ color: theme.goldDark }}
              >
                Rétablir le message par défaut
              </button>
            )}
          </div>
          <span className="mb-1 block text-[11px]" style={{ color: theme.textMuted }}>Envoyé la première fois qu'un récapitulatif est transmis à ce client.</span>
          <textarea value={v.recapMessage} onChange={(e) => set("recapMessage", e.target.value)} rows={6} className={input} style={inputStyle} />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: theme.text }}>Message de mise à jour</span>
            {recapDefaults && (
              <button
                type="button"
                onClick={() => set("recapUpdateMessage", recapDefaults.recapUpdateMessage)}
                className="text-[11px] font-medium hover:underline"
                style={{ color: theme.goldDark }}
              >
                Rétablir le message par défaut
              </button>
            )}
          </div>
          <span className="mb-1 block text-[11px]" style={{ color: theme.textMuted }}>
            Envoyé à la place du précédent si le récapitulatif avait déjà été transmis (commande modifiée) : évite de redire « Bonjour » à chaque relance.
          </span>
          <textarea value={v.recapUpdateMessage} onChange={(e) => set("recapUpdateMessage", e.target.value)} rows={4} className={input} style={inputStyle} />
        </label>
        <div className="rounded-xl p-3" style={{ background: theme.bg }}>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: theme.text }}>
            <Info size={13} /> Variables disponibles pour ces deux messages
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {[
              ["{articles}", "liste détaillée des articles"],
              ["{sousTotal}", "total des articles, hors livraison"],
              ["{livraison}", "frais de livraison"],
              ["{total}", "total à payer (articles + livraison)"],
              ["{nom}", "prénom du client"],
              ["{live}", "nom de la session (facultatif)"],
            ].map(([k, label]) => (
              <div key={k} className="flex items-baseline gap-1.5 text-[11px]">
                <dt><code className="rounded px-1 py-0.5" style={{ background: theme.goldSoft, color: theme.goldDark }}>{k}</code></dt>
                <dd style={{ color: theme.textMuted }}>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>
    </div>
  );
}
