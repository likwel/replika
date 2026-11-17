// « Associer un compte » : n'importe quel bouton de l'application ouvre la même fenêtre (AssociateAccountHost,
// monté une fois dans AppLayout) sans avoir à en porter l'état.
export const ASSOCIATE_EVENT = "suiteflow:associate-account";
export const openAssociate = () => window.dispatchEvent(new CustomEvent(ASSOCIATE_EVENT));
