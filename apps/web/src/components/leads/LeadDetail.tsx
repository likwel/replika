import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Mail, MessageCircle, MessagesSquare, Phone, Radio, Save, Send, ShoppingBag, Trash2 } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ApiError } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";
import { leadApi, type Lead, type LeadDetail as Detail, type LeadStatus } from "@/lib/lead.api";
import { LEAD_STATUS, LEAD_STATUSES, SOURCE_LABEL, TEMPERATURE, temperatureOf } from "./leads";

interface Props {
  leadId: string;
  onClose: () => void;
  onChanged: (lead: Lead | null) => void; // null : supprimé
}

const input = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40";
const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };

export function LeadDetail({ leadId, onClose, onChanged }: Props) {
  const [lead, setLead] = useState<Detail | null>(null);
  const [form, setForm] = useState({ status: "NEW" as LeadStatus, phone: "", email: "", value: "", note: "" });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"save" | "send" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = () =>
    leadApi.get(leadId).then((l) => {
      setLead(l);
      setForm({ status: l.status, phone: l.phone ?? "", email: l.email ?? "", value: l.value === null ? "" : String(l.value), note: l.note ?? "" });
    });

  useEffect(() => {
    load().catch(() => setError("Lead introuvable."));
  }, [leadId]);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setOk(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      const value = form.value.trim() ? Math.max(0, Math.round(Number(form.value.replace(/\s/g, "")))) : null;
      const updated = await leadApi.update(leadId, {
        status: form.status,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        value: Number.isFinite(value) ? value : null,
        note: form.note.trim() || null,
      });
      onChanged(updated);
      onClose();
    });

  const send = () =>
    run("send", async () => {
      const updated = await leadApi.message(leadId, text.trim());
      setText("");
      setOk("Message envoyé.");
      onChanged(updated);
      await load();
    });

  const remove = () => {
    if (!window.confirm("Retirer ce lead de la liste ? Il réapparaîtra s'il montre de nouveau un intérêt.")) return;
    void run("delete", async () => {
      await leadApi.remove(leadId);
      onChanged(null);
      onClose();
    });
  };

  if (!lead) {
    return (
      <Modal title="Fiche du Lead" onClose={onClose} size="lg">
        {error ? <p className="text-sm" style={{ color: theme.red }}>{error}</p> : <div className="h-40 animate-pulse rounded-xl" style={{ background: theme.bg }} />}
      </Modal>
    );
  }

  const temp = TEMPERATURE[temperatureOf(lead.score)];
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      title="Fiche du Lead"
      subtitle={
        <span className="flex items-center gap-1.5">
          <AccountAvatar name={lead.account.name} src={lead.account.avatarUrl} platform={lead.account.platform} size={16} />
          {lead.account.name} · détecté {timeAgo(lead.createdAt)} · {lead.messageCount} message{lead.messageCount > 1 ? "s" : ""} d'intérêt
        </span>
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto flex items-center gap-1 text-xs" style={{ color: theme.red }}><AlertTriangle size={12} /> {error}</p>}
          {ok && !error && <p className="mr-auto text-xs" style={{ color: "#15803d" }}>{ok}</p>}
          <Button variant="ghost" size="sm" icon={Trash2} onClick={remove} disabled={busy !== null}>Retirer</Button>
          <Button size="sm" onClick={save} disabled={busy !== null}>
            {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Note et signaux */}
        <div className="rounded-xl p-3.5" style={{ background: temp.bg }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>{temp.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold" style={{ color: theme.text }}>{lead.name}</p>
              <p className="text-xs font-medium" style={{ color: temp.color }}>Lead {temp.label.toLowerCase()} · {lead.score}/100</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: `${lead.score}%`, background: temp.color }} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {lead.signals.map((s) => (
              <span key={s} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: theme.bgCard, color: theme.text }}>{s}</span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: theme.textMuted }}>Statut</span>
            <select value={form.status} onChange={set("status")} className={input} style={inputStyle}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium" style={{ color: theme.textMuted }}>Montant estimé (Ar)</span>
            <input value={form.value} onChange={set("value")} inputMode="numeric" placeholder="25000" className={input} style={inputStyle} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: theme.textMuted }}><Phone size={11} /> Téléphone</span>
            <input value={form.phone} onChange={set("phone")} inputMode="tel" className={input} style={inputStyle} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium" style={{ color: theme.textMuted }}><Mail size={11} /> E-mail</span>
            <input value={form.email} onChange={set("email")} inputMode="email" className={input} style={inputStyle} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium" style={{ color: theme.textMuted }}>Note interne</span>
            <input value={form.note} onChange={set("note")} placeholder="Intéressée par la taille M, rappeler samedi…" className={input} style={inputStyle} />
          </label>
        </div>

        {/* Réponse */}
        <div className="rounded-xl p-3" style={{ border: `1px solid ${theme.border}` }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder={`Écrire à ${lead.name} en privé…`} className={input} style={inputStyle} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="soft" icon={Send} onClick={send} disabled={busy !== null || !text.trim()}>
              {busy === "send" ? "Envoi…" : "Envoyer"}
            </Button>
            <p className="flex-1 text-[11px]" style={{ color: theme.textMuted }}>
              {lead.psid
                ? "Dans sa conversation (sous 24 h après son dernier message)."
                : "En réponse privée à son dernier commentaire : une seule fois, puis attendez sa réponse."}
            </p>
          </div>
        </div>

        {/* Historique */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>Historique</p>
          <ul className="flex flex-col gap-2">
            {lead.orders.map((o) => (
              <li key={o.id} className="flex items-start gap-2 rounded-xl p-2.5 text-sm" style={{ background: theme.goldSoft }}>
                <ShoppingBag size={14} className="mt-0.5 flex-shrink-0" style={{ color: theme.goldDark }} />
                <div className="min-w-0 flex-1">
                  <p style={{ color: theme.text }}>
                    JP {o.code ?? ""} {o.productName ?? ""} {o.quantity > 1 && `x${o.quantity}`} {o.unitPrice !== null && `· ${(o.unitPrice * o.quantity).toLocaleString("fr-FR")} Ar`}
                  </p>
                  <p className="text-[11px]" style={{ color: theme.textMuted }}>{o.session.title} · {formatDateTime(o.createdAt)}</p>
                </div>
              </li>
            ))}
            {lead.messages.map((m) => (
              <li key={m.id} className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: theme.bg }}>
                {m.kind === "DIRECT" ? (
                  <MessagesSquare size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#0d9488" }} />
                ) : (
                  <MessageCircle size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#7c3aed" }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line break-words text-sm" style={{ color: theme.text }}>{m.content}</p>
                  <p className="text-[11px]" style={{ color: theme.textMuted }}>
                    {m.kind === "DIRECT" ? "Message privé" : "Commentaire"} · {formatDateTime(m.createdAt)}
                    {m.leadScore ? ` · signal ${m.leadScore}` : ""}
                  </p>
                  {m.aiReply && m.status === "REPLIED" && <p className="mt-1 text-xs" style={{ color: theme.goldDark }}>↳ {m.aiReply}</p>}
                </div>
              </li>
            ))}
            {lead.messages.length === 0 && lead.orders.length === 0 && (
              <li className="flex items-center gap-2 text-sm" style={{ color: theme.textMuted }}>
                <Radio size={14} /> {SOURCE_LABEL[lead.lastSource]} : « {lead.lastMessage} »
              </li>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
