// Aides communes aux onglets de Gestion

// Élément à ouvrir depuis « À traiter » : la publication d'un commentaire ou la conversation d'une personne
export type PostFocus = { kind: "post"; accountId: string; postId: string; commentId?: string };
export type ConversationFocus = { kind: "conversation"; accountId: string; personId: string };
export type Focus = PostFocus | ConversationFocus;

// Sur grand écran, on ouvre directement le premier élément ; sur mobile, la liste reste affichée
export const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

// Préférences d'affichage mémorisées dans le navigateur (absentes en navigation privée : on s'en passe)
export function readStored<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v: unknown = JSON.parse(raw);
    return valid(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function saveStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage indisponible : la préférence n'est simplement pas mémorisée
  }
}

// Fait défiler le plus proche conteneur défilant jusqu'à l'élément, sans bouger le reste de la page
export function scrollIntoContainer(el: HTMLElement) {
  let box = el.parentElement;
  while (box) {
    const { overflowY } = getComputedStyle(box);
    if ((overflowY === "auto" || overflowY === "scroll") && box.scrollHeight > box.clientHeight) break;
    box = box.parentElement;
  }
  if (!box) return;
  const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
  box.scrollTop += offset - box.clientHeight / 4;
}
