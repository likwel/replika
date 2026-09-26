import { api } from "./api";
import type { Post } from "@/types";

// Publication renvoyée par le backend (étend Post + champs Facebook)
export type FbPost = Post & {
  pageAvatar?: string | null;
  views?: number;
  permalink?: string;
};

// Commentaire d'une publication
export interface FbComment {
  id: string;
  author: string;
  text: string;
  time?: string;
}

export const facebookApi = {
  // Récupère l'URL OAuth puis redirige le navigateur
  connect: async () => {
    const res = await api.get<{ status: string; data: { url: string } }>("/facebook/connect");
    window.location.href = res.data.url;
  },

  // Toutes les publications agrégées des Pages connectées
  posts: () =>
    api.get<{ status: string; data: FbPost[] }>("/facebook/posts").then((r) => r.data),

  // Commentaires d'une publication
  comments: (postId: string) =>
    api
      .get<{ status: string; data: FbComment[] }>(`/facebook/posts/${postId}/comments`)
      .then((r) => r.data),

  // Génère et publie une réponse IA à un commentaire
  aiReply: (postId: string, commentId: string) =>
    api.post<{ status: string; data: { reply: string } }>(
      `/facebook/posts/${postId}/comments/${commentId}/ai-reply`
    ),
};