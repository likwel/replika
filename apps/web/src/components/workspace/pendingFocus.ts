import type { Focus } from "./helpers";

// « À traiter » → publication ou conversation d'origine : les deux pages sont indépendantes, la cible
// à ouvrir est donc transmise d'une page à l'autre par ce relais, lu une seule fois à l'ouverture.
let pending: Focus | null = null;

export const setPendingFocus = (f: Focus) => {
  pending = f;
};

export const takePendingFocus = (): Focus | null => {
  const f = pending;
  pending = null;
  return f;
};
