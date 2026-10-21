import { CONTACT_EMAIL } from "./plans";

// Informations de l'éditeur affichées sur la page « Mentions légales ».
// Les champs vides s'affichent « à compléter » : renseignez-les avant la mise en ligne publique.
export const LEGAL = {
  brand: "SuiteFlow",
  company: "", // raison sociale de la société éditrice
  legalForm: "", // SARL, SAS, entreprise individuelle…
  capital: "", // capital social (ex. « 1 000 000 Ar »)
  address: "", // siège social
  city: "Antananarivo, Madagascar",
  rcs: "", // numéro RCS
  nif: "", // NIF
  stat: "", // numéro statistique (STAT)
  director: "", // directeur ou directrice de la publication
  email: CONTACT_EMAIL,
  phone: "",
  host: {
    name: "", // hébergeur du site et de l'API
    address: "",
    website: "",
  },
  updatedAt: "22 octobre 2026",
};
