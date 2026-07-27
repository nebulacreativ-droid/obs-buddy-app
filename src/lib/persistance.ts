// Conservation de la conversation d'une page à l'autre.
//
// Le widget recrée son iframe à chaque changement de page de la boutique :
// sans cela, le client perdrait son échange en cliquant sur un produit.
// sessionStorage est volontairement préféré à localStorage — la conversation
// disparaît à la fermeture de l'onglet plutôt que de rester sur un poste
// éventuellement partagé.
import type { ChatMessage, DemandePro } from "./chat-client";
import type { ProduitCompact } from "./product-search";
import type { MarqueProposee } from "./marques-search";

const CLE = "obsbuddy-conversation";
const VERSION = 1;
const MAX_MESSAGES = 30;

export type EtatConversation = {
  messages: ChatMessage[];
  produits: Record<string, ProduitCompact>;
  marques: MarqueProposee[];
  demandePro: DemandePro | null;
};

const VIDE: EtatConversation = {
  messages: [],
  produits: {},
  marques: [],
  demandePro: null,
};

export function chargerConversation(): EtatConversation {
  if (typeof window === "undefined") return VIDE;

  try {
    const brut = window.sessionStorage.getItem(CLE);
    if (!brut) return VIDE;

    const donnees = JSON.parse(brut);
    // Un format plus ancien est ignoré plutôt que d'être rafistolé.
    if (donnees?.version !== VERSION || !Array.isArray(donnees.messages)) return VIDE;

    return {
      messages: donnees.messages.slice(-MAX_MESSAGES),
      produits: donnees.produits ?? {},
      marques: Array.isArray(donnees.marques) ? donnees.marques : [],
      demandePro: donnees.demandePro ?? null,
    };
  } catch {
    return VIDE;
  }
}

export function sauvegarderConversation(etat: EtatConversation): void {
  if (typeof window === "undefined") return;

  try {
    if (!etat.messages.length) {
      window.sessionStorage.removeItem(CLE);
      return;
    }

    // Seules les fiches produits encore citées sont conservées : inutile de
    // faire grossir le stockage avec des résultats de recherche abandonnés.
    const cites = new Set<string>();
    for (const m of etat.messages) {
      for (const trouve of m.content.matchAll(/\[\[P:([^\]]+)\]\]/g)) {
        cites.add(trouve[1].trim());
      }
    }
    const produits: Record<string, ProduitCompact> = {};
    for (const id of cites) {
      if (etat.produits[id]) produits[id] = etat.produits[id];
    }

    window.sessionStorage.setItem(
      CLE,
      JSON.stringify({
        version: VERSION,
        messages: etat.messages.slice(-MAX_MESSAGES),
        produits,
        marques: etat.marques,
        demandePro: etat.demandePro,
      }),
    );
  } catch {
    // Quota dépassé ou stockage refusé : la conversation reste utilisable,
    // elle ne survivra simplement pas au changement de page.
  }
}

export function effacerConversation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CLE);
  } catch {
    /* sans effet */
  }
}
