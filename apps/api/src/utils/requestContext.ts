import { AsyncLocalStorage } from "node:async_hooks";

// Contexte d'une requête faite par un membre d'équipe dans l'espace d'un autre compte : qui agit réellement.
// Lu par le client Prisma pour signer chaque entrée d'historique (ActivityLog.actorId / actorName).
export interface Actor {
  id: string;
  name: string;
}

const storage = new AsyncLocalStorage<Actor>();

export const runAsActor = (actor: Actor, fn: () => void) => storage.run(actor, fn);
export const currentActor = (): Actor | undefined => storage.getStore();
