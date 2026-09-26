import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, ImagePlus, Link2, Loader2, Search, Send, Trash2, Save, AlertTriangle, Tag, CalendarClock } from "lucide-react";
import { theme } from "@/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { AccountAvatar } from "@/components/workspace/AccountAvatar";
import { ApiError } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { toPublishableJpeg } from "@/lib/image";
import { scheduleApi, uploadImage, type MessageTag, type Schedule, type ScheduleInput, type ScheduleKind } from "@/lib/schedule.api";
import { workspaceApi, type WsAccount, type WsConversation, type WsPost } from "@/lib/workspace.api";
import { KIND_META, TAG_OPTIONS, nextSlot, toDateInput, toTimeInput } from "./planner";

interface Props {
  initial?: Schedule | null; // modification
  duplicate?: boolean; // copie d'une programmation existante
  defaultDate?: Date | null; // clic sur un jour du calendrier
  defaultKind?: ScheduleKind;
  onClose: () => void;
  onSaved: (schedule: Schedule, warnings: string[]) => void;
}

type Choice = { id: string; label: string };
const LIMIT = { POST: 63206, COMMENT: 8000, MESSAGE: 2000 } as const;
const IG_CAPTION = 2200;
const DAY_MS = 86400000;

const inputStyle = { background: theme.bg, border: `1px solid ${theme.border}`, color: theme.text };
const Label = ({ children }: { children: string }) => (
  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>{children}</p>
);

export function ScheduleComposer({ initial, duplicate, defaultDate, defaultKind = "POST", onClose, onSaved }: Props) {
  const editing = Boolean(initial && !duplicate);
  const start = initial?.scheduledAt && (!duplicate || new Date(initial.scheduledAt) > new Date()) ? new Date(initial.scheduledAt) : (defaultDate ?? nextSlot());

  const [accounts, setAccounts] = useState<WsAccount[] | null>(null);
  const [kind, setKind] = useState<ScheduleKind>(initial?.kind ?? defaultKind);
  const [accountIds, setAccountIds] = useState<string[]>(() => [...new Set(initial?.targets.map((t) => t.accountId) ?? [])]);
  const [refs, setRefs] = useState<Choice[]>(() => initial?.targets.filter((t) => t.refId).map((t) => ({ id: t.refId!, label: t.label ?? t.refId! })) ?? []);
  const [text, setText] = useState(initial?.text ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [link, setLink] = useState(initial?.link ?? "");
  const [tag, setTag] = useState<MessageTag | "">(initial?.messageTag ?? "");
  const [timing, setTiming] = useState<"now" | "later">("later");
  const [date, setDate] = useState(toDateInput(start));
  const [time, setTime] = useState(toTimeInput(start));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<"draft" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Publications / conversations du compte choisi (commentaire, message)
  const [options, setOptions] = useState<Array<WsPost | WsConversation> | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    workspaceApi.accounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const single = kind !== "POST";
  const accountId = single ? accountIds[0] : undefined;
  const selected = (accounts ?? []).filter((a) => accountIds.includes(a.id));
  const hasInstagram = selected.some((a) => a.platform === "INSTAGRAM");
  const hasFacebook = selected.some((a) => a.platform === "FACEBOOK");

  useEffect(() => {
    if (!single || !accountId) {
      setOptions(null);
      return;
    }
    setOptions(null);
    setOptionsError(null);
    const load =
      kind === "COMMENT"
        ? workspaceApi.posts([accountId]).then((d) => ({ list: d.posts as Array<WsPost | WsConversation>, err: d.errors[0]?.message }))
        : workspaceApi.conversations([accountId]).then((d) => ({ list: d.conversations as Array<WsPost | WsConversation>, err: d.errors[0]?.message }));
    load
      .then(({ list, err }) => {
        setOptions(list);
        setOptionsError(err ?? null);
      })
      .catch(() => {
        setOptions([]);
        setOptionsError("Chargement impossible.");
      });
  }, [kind, accountId]);

  const changeKind = (k: ScheduleKind) => {
    setKind(k);
    setRefs([]);
    if (k !== "POST") setAccountIds((ids) => ids.slice(0, 1));
  };

  const toggleAccount = (id: string) => {
    if (single) {
      setAccountIds([id]);
      if (id !== accountId) setRefs([]);
    } else {
      setAccountIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    }
  };

  const toggleRef = (p: Choice) => setRefs((list) => (list.some((x) => x.id === p.id) ? list.filter((x) => x.id !== p.id) : [...list, p]));

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadImage(await toPublishableJpeg(file));
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi de l'image impossible");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const limit = kind === "POST" && hasInstagram ? IG_CAPTION : LIMIT[kind];
  const when = new Date(`${date}T${time}`);

  const problem = (mode: "draft" | "send"): string | null => {
    if (!accountIds.length) return kind === "POST" ? "Choisissez au moins une Page ou un compte." : "Choisissez le compte.";
    if (!text.trim()) return "Le texte est vide.";
    if (text.length > limit) return `Texte trop long (${limit} caractères maximum).`;
    if (single && !refs.length) return kind === "COMMENT" ? "Choisissez la publication à commenter." : "Choisissez au moins une conversation.";
    if (mode === "send" && kind === "POST" && hasInstagram && !imageUrl) return "Instagram exige une image.";
    if (mode === "send" && timing === "later") {
      if (Number.isNaN(when.getTime())) return "Choisissez la date et l'heure.";
      if (when.getTime() < Date.now() - 60000) return "Cette date est déjà passée.";
    }
    return null;
  };

  const submit = async (mode: "draft" | "send") => {
    const issue = problem(mode);
    if (issue) return setError(issue);
    setSaving(mode);
    setError(null);
    const body: ScheduleInput = {
      kind,
      text: text.trim(),
      imageUrl: kind === "POST" ? imageUrl : null,
      link: kind === "POST" && hasFacebook && link.trim() ? link.trim() : null,
      messageTag: kind === "MESSAGE" && hasFacebook && tag ? tag : null,
      status: mode === "draft" ? "DRAFT" : "SCHEDULED",
      publishNow: mode === "send" && timing === "now",
      scheduledAt: timing === "later" && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
      targets: single ? refs.map((r) => ({ accountId: accountId!, refId: r.id, label: r.label })) : accountIds.map((id) => ({ accountId: id })),
    };
    try {
      const res = editing ? await scheduleApi.update(initial!.id, body) : await scheduleApi.create(body);
      onSaved(res.schedule, res.warnings);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(null);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (options ?? []).filter((o) =>
        !q ? true : "text" in o ? o.text.toLowerCase().includes(q) : o.participant.name.toLowerCase().includes(q) || o.snippet.toLowerCase().includes(q)
      ),
    [options, q]
  );

  const quick = (label: string, d: Date) => (
    <button
      type="button"
      onClick={() => {
        setDate(toDateInput(d));
        setTime(toTimeInput(d));
      }}
      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.textMuted }}
    >
      {label}
    </button>
  );
  const tomorrowAt = (h: number) => {
    const d = new Date(Date.now() + DAY_MS);
    d.setHours(h, 0, 0, 0);
    return d;
  };

  const tagHint = TAG_OPTIONS.find((t) => t.value === tag)?.hint;
  const oldConversations = kind === "MESSAGE" && refs.some((r) => {
    const c = (options ?? []).find((o) => "participant" in o && o.id === r.id) as WsConversation | undefined;
    return c && Date.now() - new Date(c.updatedAt).getTime() > DAY_MS;
  });
  const sendLabel = timing === "now" ? (kind === "POST" ? "Publier maintenant" : "Envoyer maintenant") : "Programmer";

  return (
    <Modal
      title={editing ? "Modifier la Programmation" : duplicate ? "Dupliquer la Programmation" : "Nouvelle Programmation"}
      subtitle="Publication, commentaire ou message privé, envoyé automatiquement à l'heure choisie."
      onClose={onClose}
      size="xl"
      footer={
        <>
          {error && (
            <p className="mr-auto flex items-center gap-1.5 text-xs" style={{ color: theme.red }}>
              <AlertTriangle size={13} /> {error}
            </p>
          )}
          <Button variant="ghost" size="sm" icon={Save} onClick={() => submit("draft")} disabled={saving !== null || uploading}>
            {saving === "draft" ? "Enregistrement…" : "Brouillon"}
          </Button>
          <Button size="sm" onClick={() => submit("send")} disabled={saving !== null || uploading}>
            {saving === "send" ? <Loader2 size={15} className="animate-spin" /> : timing === "now" ? <Send size={15} /> : <CalendarClock size={15} />}
            {sendLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Segmented
            options={(["POST", "COMMENT", "MESSAGE"] as const).map((k) => ({ value: k, label: KIND_META[k].label, icon: KIND_META[k].icon }))}
            value={kind}
            onChange={changeKind}
          />

          <div>
            <Label>{kind === "POST" ? "Publier sur" : "Compte"}</Label>
            {accounts === null ? (
              <div className="h-9 animate-pulse rounded-xl" style={{ background: theme.bg }} />
            ) : accounts.length === 0 ? (
              <p className="text-sm" style={{ color: theme.textMuted }}>Aucun compte connecté : ajoutez-en depuis Connexions.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const on = accountIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAccount(a.id)}
                      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium"
                      style={{ background: on ? theme.goldSoft : theme.bg, border: `1px solid ${on ? theme.gold : theme.border}`, color: theme.text }}
                      aria-pressed={on}
                      title={a.syncError ?? undefined}
                    >
                      <AccountAvatar name={a.accountName} src={a.accountAvatar} platform={a.platform} size={24} />
                      <span className="max-w-[150px] truncate">{a.accountName}</span>
                      {a.syncError && <AlertTriangle size={12} style={{ color: theme.red }} />}
                      {on && <Check size={13} style={{ color: theme.goldDark }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {single && accountId && (
            <div>
              <Label>{kind === "COMMENT" ? "Publications à commenter" : "Destinataires"}</Label>
              <div className="rounded-xl" style={{ border: `1px solid ${theme.border}` }}>
                <div className="relative border-b" style={{ borderColor: theme.border }}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={kind === "COMMENT" ? "Rechercher une publication…" : "Rechercher une personne…"}
                    className="w-full rounded-t-xl bg-transparent py-2 pl-8 pr-3 text-sm outline-none"
                    style={{ color: theme.text }}
                  />
                </div>
                <ul className="max-h-52 overflow-y-auto">
                  {options === null ? (
                    <li className="flex items-center gap-2 px-3 py-4 text-sm" style={{ color: theme.textMuted }}>
                      <Loader2 size={14} className="animate-spin" /> Chargement…
                    </li>
                  ) : filtered.length === 0 ? (
                    <li className="px-3 py-4 text-sm" style={{ color: optionsError ? theme.red : theme.textMuted }}>
                      {optionsError ?? "Aucun résultat."}
                    </li>
                  ) : (
                    filtered.map((o) => {
                      const post = "text" in o ? o : null;
                      const conv = "participant" in o ? o : null;
                      const label = post ? post.text.slice(0, 80) || "Publication sans texte" : conv!.participant.name;
                      const on = refs.some((r) => r.id === o.id);
                      const stale = conv && Date.now() - new Date(conv.updatedAt).getTime() > DAY_MS;
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => toggleRef({ id: o.id, label })}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/[0.03]"
                            style={{ background: on ? theme.goldSoft : undefined }}
                          >
                            <span
                              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
                              style={{ border: `1.5px solid ${on ? theme.gold : theme.border}`, background: on ? theme.gold : "transparent" }}
                            >
                              {on && <Check size={11} color="#1A1410" />}
                            </span>
                            {post?.image && <img src={post.image} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm" style={{ color: theme.text }}>{label}</span>
                              <span className="block truncate text-[11px]" style={{ color: stale ? "#b45309" : theme.textMuted }}>
                                {post ? `${timeAgo(post.time)} · ${post.comments} commentaires` : `${timeAgo(conv!.updatedAt)} · ${conv!.snippet}`}
                              </span>
                            </span>
                            {stale && <Clock size={13} style={{ color: "#b45309" }} aria-label="Plus de 24 h" />}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
              {refs.length > 0 && (
                <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>
                  {refs.length} sélectionné{refs.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          <div>
            <Label>{kind === "POST" ? "Texte de la publication" : kind === "COMMENT" ? "Commentaire" : "Message"}</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={kind === "POST" ? 6 : 4}
              placeholder={kind === "POST" ? "Rédigez votre publication…" : kind === "COMMENT" ? "Votre commentaire…" : "Votre message…"}
              className="w-full resize-y rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              style={inputStyle}
            />
            <p className="text-right text-[11px]" style={{ color: text.length > limit ? theme.red : theme.textMuted }}>
              {text.length} / {limit.toLocaleString("fr-FR")}
            </p>
          </div>

          {kind === "POST" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Image</Label>
                {imageUrl ? (
                  <div className="relative overflow-hidden rounded-xl" style={{ border: `1px solid ${theme.border}` }}>
                    <img src={imageUrl} alt="" className="h-32 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="absolute right-2 top-2 rounded-full p-1.5"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                      aria-label="Retirer l'image"
                    >
                      <Trash2 size={13} color="#fff" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl text-sm"
                    style={{ border: `1.5px dashed ${theme.border}`, color: theme.textMuted, background: theme.bg }}
                  >
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                    {uploading ? "Envoi…" : hasInstagram ? "Ajouter une image (obligatoire)" : "Ajouter une image"}
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
              </div>
              <div>
                <Label>Lien (Facebook)</Label>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                    disabled={!hasFacebook}
                    className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none disabled:opacity-50"
                    style={inputStyle}
                  />
                </div>
                <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>
                  {hasFacebook ? "Facultatif : aperçu du lien sous la publication." : "Disponible pour les Pages Facebook."}
                </p>
              </div>
            </div>
          )}

          {kind === "MESSAGE" && hasFacebook && (
            <div>
              <Label>Hors fenêtre de 24 h (Messenger)</Label>
              <div className="relative">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: theme.textMuted }} />
                <select value={tag} onChange={(e) => setTag(e.target.value as MessageTag | "")} className="w-full rounded-xl py-2 pl-8 pr-3 text-sm outline-none" style={inputStyle}>
                  {TAG_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[11px]" style={{ color: theme.textMuted }}>{tagHint}</p>
            </div>
          )}
          {oldConversations && !tag && (
            <p className="flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs" style={{ background: "#FEF3C7", color: "#92400e" }}>
              <Clock size={13} className="mt-0.5 flex-shrink-0" />
              Certaines personnes ne vous ont pas écrit depuis plus de 24 h : Messenger et Instagram refuseront l'envoi,
              sauf avec une étiquette adaptée (Messenger uniquement).
            </p>
          )}
        </div>

        {/* Envoi + aperçu */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-xl p-3.5" style={{ background: theme.bg, border: `1px solid ${theme.border}` }}>
            <Label>Envoi</Label>
            <Segmented
              options={[
                { value: "later" as const, label: "Programmer", icon: CalendarClock },
                { value: "now" as const, label: "Maintenant", icon: Send },
              ]}
              value={timing}
              onChange={setTiming}
            />
            {timing === "later" && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-w-0 rounded-lg px-2 py-1.5 text-sm outline-none" style={{ ...inputStyle, background: theme.bgCard }} aria-label="Date" />
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="min-w-0 rounded-lg px-2 py-1.5 text-sm outline-none" style={{ ...inputStyle, background: theme.bgCard }} aria-label="Heure" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quick("Dans 1 h", new Date(Date.now() + 3600000))}
                  {quick("Demain 9 h", tomorrowAt(9))}
                  {quick("Demain 18 h", tomorrowAt(18))}
                </div>
              </>
            )}
          </div>

          <div>
            <Label>Aperçu</Label>
            <div className="overflow-hidden rounded-xl" style={{ background: theme.bgCard, border: `1px solid ${theme.border}` }}>
              {kind === "POST" ? (
                <>
                  <div className="flex items-center gap-2 px-3 pt-3">
                    {selected[0] ? (
                      <AccountAvatar name={selected[0].accountName} src={selected[0].accountAvatar} platform={selected[0].platform} size={28} />
                    ) : (
                      <span className="h-7 w-7 rounded-full" style={{ background: theme.bg }} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: theme.text }}>
                      {selected[0]?.accountName ?? "Votre Page"}
                      {selected.length > 1 && <span style={{ color: theme.textMuted }}> +{selected.length - 1}</span>}
                    </span>
                  </div>
                  <p className="line-clamp-6 whitespace-pre-line px-3 py-2 text-xs" style={{ color: text ? theme.text : theme.textMuted }}>
                    {text || "Votre texte apparaîtra ici."}
                  </p>
                  {imageUrl && <img src={imageUrl} alt="" className="max-h-44 w-full object-cover" />}
                  {link && hasFacebook && (
                    <p className="truncate px-3 py-2 text-[11px]" style={{ background: theme.bg, color: theme.textMuted }}>{link}</p>
                  )}
                </>
              ) : (
                <div className="p-3" style={{ background: theme.bg }}>
                  {kind === "COMMENT" && refs[0] && (
                    <p className="mb-2 truncate text-[11px]" style={{ color: theme.textMuted }}>Sur « {refs[0].label} »</p>
                  )}
                  <div
                    className={`max-w-[90%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-xs ${kind === "MESSAGE" ? "ml-auto" : ""}`}
                    style={{ background: kind === "MESSAGE" ? theme.gold : theme.bgCard, color: kind === "MESSAGE" ? "#1A1410" : theme.text }}
                  >
                    {text || "Votre texte apparaîtra ici."}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
