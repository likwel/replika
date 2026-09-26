import { useState, type FormEvent } from "react";
import { FlaskConical, Loader2, CheckCircle2, CircleSlash } from "lucide-react";
import { theme } from "@/theme";
import { Title } from "@/components/ui/Title";
import { Button } from "@/components/ui/Button";
import type { SocialAccount } from "@/lib/account.api";
import { automationApi, type TestResult } from "@/lib/automation.api";

const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

// Simule un message entrant pour vérifier quelle règle répondrait — rien n'est publié
export function RuleTester({ accounts }: { accounts: SocialAccount[] }) {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"COMMENT" | "DIRECT">("COMMENT");
  const [accountId, setAccountId] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      setResult(await automationApi.test({ text, kind, accountId: accountId || undefined }));
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <div className="mb-1 flex items-center gap-2">
        <FlaskConical size={16} style={{ color: theme.gold }} />
        <Title className="text-base">Tester vos Règles</Title>
      </div>
      <p className="mb-3 text-[11px]" style={{ color: theme.textMuted }}>
        Simulez un message reçu : rien n'est publié.
      </p>

      <form onSubmit={run} className="flex flex-col gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex. Bonjour, c'est combien ?"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          style={inputStyle}
        />
        <div className="flex gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "COMMENT" | "DIRECT")}
            className="flex-1 rounded-xl px-2.5 py-2 text-xs outline-none"
            style={inputStyle}
          >
            <option value="COMMENT">Commentaire</option>
            <option value="DIRECT">Message privé</option>
          </select>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-xs outline-none"
            style={inputStyle}
          >
            <option value="">Tous les comptes</option>
            {accounts.filter((a) => a.platform !== "TIKTOK").map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" variant="dark" className="justify-center" disabled={loading || !text.trim()}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          Tester
        </Button>
      </form>

      {result && (
        <div className="mt-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
          {result.matched ? (
            <>
              <p className="flex items-start gap-1.5 text-xs font-semibold" style={{ color: theme.goldDark }}>
                <CheckCircle2 size={14} className="mt-px flex-shrink-0" />
                <span>
                  Règle « {result.rule.name} »{" "}
                  <span className="font-normal" style={{ color: theme.textMuted }}>
                    · {result.rule.autoSend ? "envoi automatique" : "à valider"}
                  </span>
                </span>
              </p>
              <p className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: theme.goldSoft, color: theme.text }}>
                {result.reply}
              </p>
              {result.privateReply && (
                <p className="mt-2 text-xs" style={{ color: theme.textMuted }}>
                  <strong>En privé :</strong> {result.privateReply}
                </p>
              )}
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
              <CircleSlash size={14} /> Aucune règle ne correspond : l'assistant IA répondra s'il est activé,
              sinon le message ira dans la file d'attente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
