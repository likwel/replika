import { useState } from "react";
import { CheckCircle2, Copy, ExternalLink, Loader2, Pencil, RefreshCw, Send, Trash2, XCircle, Clock, Tag } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { scheduleApi, type Schedule } from "@/lib/schedule.api";
import { KIND_META, STATUS_META, TAG_OPTIONS, formatSlot, isEditable } from "./planner";

interface Props {
  schedule: Schedule;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onChanged: (s: Schedule | null) => void; // null : supprimée
}

export function ScheduleDetails({ schedule: s, onClose, onEdit, onDuplicate, onChanged }: Props) {
  const [busy, setBusy] = useState<"publish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = KIND_META[s.kind];
  const status = STATUS_META[s.status];
  const failed = s.targets.some((t) => t.status === "FAILED");

  const run = async (action: "publish" | "delete") => {
    if (action === "delete" && !window.confirm("Supprimer cette programmation ? Ce qui est déjà publié reste en ligne.")) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "delete") {
        await scheduleApi.remove(s.id);
        onChanged(null);
      } else {
        onChanged(await scheduleApi.publish(s.id));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const canPublish = ["DRAFT", "SCHEDULED", "FAILED", "PARTIAL"].includes(s.status);

  return (
    <Modal
      title="Détail de la Programmation"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 font-medium" style={{ color: kind.color }}><kind.icon size={12} /> {kind.label}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: status.bg, color: status.color }}>{status.label}</span>
          {s.status === "DONE" || s.status === "PARTIAL" ? (s.publishedAt ? `Envoyée le ${formatDateTime(s.publishedAt)}` : "") : formatSlot(s.scheduledAt)}
        </span>
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          {error && <p className="mr-auto text-xs" style={{ color: theme.red }}>{error}</p>}
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => run("delete")} disabled={busy !== null || s.status === "PUBLISHING"}>
            Supprimer
          </Button>
          <Button variant="ghost" size="sm" icon={Copy} onClick={onDuplicate}>Dupliquer</Button>
          {isEditable(s) && (
            <Button variant="soft" size="sm" icon={Pencil} onClick={onEdit}>Modifier</Button>
          )}
          {canPublish && (
            <Button size="sm" onClick={() => run("publish")} disabled={busy !== null}>
              {busy === "publish" ? <Loader2 size={15} className="animate-spin" /> : failed ? <RefreshCw size={15} /> : <Send size={15} />}
              {failed ? "Relancer les échecs" : "Envoyer maintenant"}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-3.5" style={{ background: theme.bg }}>
          <p className="whitespace-pre-line break-words text-sm" style={{ color: theme.text }}>{s.text}</p>
          {s.imageUrl && <img src={s.imageUrl} alt="" className="mt-3 max-h-64 rounded-lg object-contain" />}
          {s.link && (
            <a href={s.link} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs underline" style={{ color: theme.goldDark }}>
              {s.link}
            </a>
          )}
          {s.messageTag && (
            <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: theme.textMuted }}>
              <Tag size={11} /> Étiquette : {TAG_OPTIONS.find((t) => t.value === s.messageTag)?.label}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>
            {s.kind === "POST" ? "Pages et comptes" : s.kind === "COMMENT" ? "Publications commentées" : "Destinataires"}
          </p>
          <ul className="flex flex-col gap-2">
            {s.targets.map((t) => (
              <li key={t.id} className="flex items-start gap-3 rounded-xl p-3" style={{ border: `1px solid ${theme.border}` }}>
                <AccountAvatar name={t.account.name} src={t.account.avatarUrl} platform={t.account.platform} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: theme.text }}>{t.account.name}</p>
                  {t.label && <p className="truncate text-xs" style={{ color: theme.textMuted }}>{s.kind === "MESSAGE" ? `À ${t.label}` : `« ${t.label} »`}</p>}
                  {t.error && <p className="mt-1 text-xs" style={{ color: theme.red }}>{t.error}</p>}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  {t.status === "DONE" ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#15803d" }}><CheckCircle2 size={13} /> Envoyé</span>
                  ) : t.status === "FAILED" ? (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: theme.red }}><XCircle size={13} /> Échec</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs" style={{ color: theme.textMuted }}><Clock size={13} /> En attente</span>
                  )}
                  {t.permalink && (
                    <a href={t.permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: theme.goldDark }}>
                      Voir <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
