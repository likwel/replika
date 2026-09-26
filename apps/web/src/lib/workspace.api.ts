import { api } from "./api";
import type { AiReply, Intent } from "./ai.api";

export type MetaPlatform = "FACEBOOK" | "INSTAGRAM";

interface AccountRef {
  accountId: string;
  platform: MetaPlatform;
  accountName: string;
  accountAvatar: string | null;
}

export interface WsAccount extends AccountRef {
  id: string;
  syncError: string | null;
  pending: number;
}

export interface WsPost extends AccountRef {
  id: string;
  text: string;
  image: string | null;
  permalink: string | null;
  time: string;
  kind: string;
  isVideo: boolean;
  reactions: number;
  comments: number;
  shares: number | null;
  pending: number;
}

export interface WsComment {
  id: string;
  author: string;
  authorId: string | null;
  text: string;
  time: string;
  likes: number;
  hidden: boolean;
  isOwn: boolean;
  canHide: boolean;
  canDelete: boolean;
  inbox: { id: string; status: string; suggestion: string | null; intent: Intent | null } | null;
  replies: WsComment[];
}

export interface WsConversation extends AccountRef {
  id: string;
  participant: { id: string; name: string };
  snippet: string;
  lastFromPage: boolean;
  updatedAt: string;
  unread: number;
  pending: number;
}

export interface WsMessage {
  id: string;
  text: string;
  time: string;
  isOwn: boolean;
}

export interface AccountError {
  accountId: string;
  accountName: string;
  message: string;
}

type Res<T> = { status: string; data: T };
const enc = encodeURIComponent;
const acc = (accountId: string) => `/workspace/accounts/${enc(accountId)}`;
const filter = (ids?: string[]) => (ids?.length ? `?accounts=${ids.map(enc).join(",")}` : "");

export const workspaceApi = {
  accounts: () => api.get<Res<WsAccount[]>>("/workspace/accounts").then((r) => r.data),

  posts: (accountIds?: string[]) =>
    api.get<Res<{ posts: WsPost[]; errors: AccountError[] }>>(`/workspace/posts${filter(accountIds)}`).then((r) => r.data),

  // Une publication précise (ex. ouverte depuis « À traiter »)
  post: (accountId: string, postId: string) =>
    api.get<Res<WsPost>>(`${acc(accountId)}/posts/${enc(postId)}`).then((r) => r.data),

  comments: (accountId: string, postId: string) =>
    api.get<Res<WsComment[]>>(`${acc(accountId)}/posts/${enc(postId)}/comments`).then((r) => r.data),

  commentOnPost: (accountId: string, postId: string, message: string) =>
    api.post<Res<{ id: string | null }>>(`${acc(accountId)}/posts/${enc(postId)}/comments`, { message }).then((r) => r.data),

  replyToComment: (accountId: string, commentId: string, message: string) =>
    api.post<Res<{ id: string | null }>>(`${acc(accountId)}/comments/${enc(commentId)}/replies`, { message }).then((r) => r.data),

  setHidden: (accountId: string, commentId: string, hidden: boolean) =>
    api.patch<Res<{ hidden: boolean }>>(`${acc(accountId)}/comments/${enc(commentId)}`, { hidden }),

  deleteComment: (accountId: string, commentId: string) => api.delete<void>(`${acc(accountId)}/comments/${enc(commentId)}`),

  conversations: (accountIds?: string[]) =>
    api
      .get<Res<{ conversations: WsConversation[]; errors: AccountError[] }>>(`/workspace/conversations${filter(accountIds)}`)
      .then((r) => r.data),

  // Conversation avec une personne (identifiant Messenger / Instagram)
  conversationWith: (accountId: string, personId: string) =>
    api.get<Res<WsConversation>>(`${acc(accountId)}/people/${enc(personId)}/conversation`).then((r) => r.data),

  conversation: (accountId: string, conversationId: string) =>
    api
      .get<Res<{ participant: { id: string; name: string }; messages: WsMessage[]; suggestion: string | null }>>(
        `${acc(accountId)}/conversations/${enc(conversationId)}`
      )
      .then((r) => r.data),

  sendMessage: (accountId: string, conversationId: string, message: string) =>
    api.post<Res<{ sent: boolean }>>(`${acc(accountId)}/conversations/${enc(conversationId)}/messages`, { message }),

  // Suggestions IA (rien n'est envoyé)
  suggestComment: (accountId: string, body: { text: string; authorName: string; postId?: string }) =>
    api.post<Res<AiReply>>(`${acc(accountId)}/suggest`, { kind: "COMMENT", ...body }).then((r) => r.data),

  suggestDirect: (accountId: string, conversationId: string) =>
    api.post<Res<AiReply>>(`${acc(accountId)}/suggest`, { kind: "DIRECT", conversationId }).then((r) => r.data),
};
