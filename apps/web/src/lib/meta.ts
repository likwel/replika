// Libellés lisibles des permissions Facebook demandées par ReplyKA
const PERMISSION_LABELS: Record<string, string> = {
  pages_read_user_content: "lire les commentaires",
  pages_manage_engagement: "répondre aux commentaires",
  pages_messaging: "messages privés Messenger",
  pages_manage_metadata: "notifications en temps réel",
  pages_read_engagement: "lire les publications",
  pages_show_list: "liste des Pages",
  instagram_basic: "compte Instagram",
  instagram_manage_comments: "commentaires Instagram",
  instagram_manage_messages: "messages Instagram",
  read_insights: "statistiques",
  business_management: "Business Manager",
};

export const permissionLabel = (p: string) => PERMISSION_LABELS[p] ?? p;

// Erreurs Graph dues à une autorisation manquante ou retirée : la solution est de reconnecter Facebook
export const isPermissionError = (message: string) =>
  /\(#(200|10|190)\)|permission|autoris|access token|expir|reconnect/i.test(message);
