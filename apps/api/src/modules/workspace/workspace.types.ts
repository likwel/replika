// Formats unifiés Facebook + Instagram renvoyés au navigateur par l'espace de gestion

export type MetaPlatform = "FACEBOOK" | "INSTAGRAM";

export interface AccountRef {
  accountId: string;
  platform: MetaPlatform;
  accountName: string;
  accountAvatar: string | null;
}

export interface WorkspacePost extends AccountRef {
  id: string;
  text: string;
  image: string | null;
  permalink: string | null;
  time: string;
  kind: string; // text, image, video, reel, carousel, event
  isVideo: boolean;
  reactions: number;
  comments: number;
  shares: number | null; // non disponible sur Instagram
  pending: number; // éléments à traiter dans la file d'attente de l'automatisation
}

export interface InboxLink {
  id: string;
  status: string;
  suggestion: string | null;
  intent: string | null;
}

export interface WorkspaceComment {
  id: string;
  author: string;
  authorId: string | null;
  text: string;
  time: string;
  likes: number;
  hidden: boolean;
  isOwn: boolean; // écrit par la Page / le compte
  canHide: boolean;
  canDelete: boolean;
  inbox: InboxLink | null; // suggestion préparée par l'automatisation, le cas échéant
  replies: WorkspaceComment[];
}

export interface WorkspaceConversation extends AccountRef {
  id: string;
  participant: { id: string; name: string };
  snippet: string;
  lastFromPage: boolean;
  updatedAt: string;
  unread: number;
  pending: number;
}

export interface WorkspaceMessage {
  id: string;
  text: string;
  time: string;
  isOwn: boolean;
}

// Compte dont la lecture a échoué : affiché au lieu d'une liste silencieusement vide
export interface AccountError {
  accountId: string;
  accountName: string;
  message: string;
}
