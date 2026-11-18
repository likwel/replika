import { useEffect, useState, type FormEvent } from "react";
import { Select } from "@/components/ui/Select";
import { FlaskConical, Loader2, CheckCircle2, CircleSlash } from "lucide-react";
import { theme } from "@/theme";
import { CardTitle } from "@/components/ui/Dash";
import { Button } from "@/components/ui/Button";
import type { SocialAccount } from "@/lib/account.api";
import { automationApi, type AutomationRule, type TestResult } from "@/lib/automation.api";
import { splitKeywords } from "./rules";

const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

// Simule un message entrant pour vérifier quelle règle répondrait — rien n'est publié
// Avec `rule` : essai d'une règle précise, pré-rempli avec son premier mot-clé et lancé tout de suite
export function RuleTester({ accounts, bare = false, rule }: { accounts: SocialAccount[]; bare?: boolean; rule?: AutomationRule }) {
  const [text, setText] = useState(rule && rule.matchType !== "ANY" ? splitKeywords(rule.trigger)[0] ?? "" : "");
  const [kind, setKind] = useState<"COMMENT" | "DIRECT">(rule?.channel === "DIRECT" ? "DIRECT" : "COMMENT");
  const [accountId, setAccountId] = useState(rule?.accountIds[0] ?? "");
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
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

  useEffect(() => {
    if (rule && text.trim()) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={bare ? "" : "rounded-2xl p-5 card-x"}>
      {!bare && <CardTitle title="Tester vos Règles" subtitle="Simulez un message reçu : rien n'est publié." icon={FlaskConical} tint="#8B5CF6" />}

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
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as "COMMENT" | "DIRECT")}
            className="flex-1 rounded-xl px-2.5 py-2 text-xs outline-none"
            style={inputStyle}
          >
            <option value="COMMENT">Commentaire</option>
            <option value="DIRECT">Message privé</option>
          </Select>
          {(!rule || rule.accountIds.length !== 1) && <Select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="flex-1 min-w-0 rounded-xl px-2.5 py-2 text-xs outline-none"
            style={inputStyle}
          >
            {!rule?.accountIds.length && <option value="">Tous les comptes</option>}
            {accounts.filter((a) => a.platform !== "TIKTOK" && (!rule?.accountIds.length || rule.accountIds.includes(a.id))).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>}
        </div>
        <Button type="submit" size="sm" variant="dark" className={`justify-center ${loading ? "[&>svg]:animate-spin" : ""}`} disabled={loading || !text.trim()} icon={loading ? Loader2 : FlaskConical}>Tester</Button>
      </form>

      {result && (
        <div className="mt-3 rounded-xl p-3" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
          {result.matched ? (
            <>
              <p className="flex items-start gap-1.5 text-xs font-semibold" style={{ color: theme.goldDark }}>
                <CheckCircle2 size={14} className="mt-px flex-shrink-0" />
                <span>
                  {rule ? (result.rule.id === rule.id ? "Cette règle répond. " : "Une autre règle passe avant : ") : ""}Règle « {result.rule.name} »{" "}
                  <span className="font-normal" style={{ color: theme.textMuted }}>
                    · {result.rule.autoSend ? "envoi automatique" : "à valider"}
                  </span>
                </span>
              </p>
              <p
                className="mt-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: theme.goldSoft, color: theme.text, fontStyle: result.rule.useAi ? "italic" : "normal" }}
              >
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
              <CircleSlash size={14} /> {rule ? "Cette règle ne correspond pas à ce message. Aucune autre non plus" : "Aucune règle ne correspond"} : l'assistant IA répondra s'il est activé,
              sinon le message ira dans la file d'attente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
