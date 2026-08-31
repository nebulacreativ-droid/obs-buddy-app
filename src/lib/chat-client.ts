// Client SSE pour /api/chat. Isolé de l'UI pour rester testable.
import type { ProduitCompact } from "./product-search";
import type { MarqueProposee } from "./marques-search";
import type { ContextePage } from "./panier-hote";
import { FORMULAIRES } from "./formulaires";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Demande de compte professionnel, validée côté serveur avant affichage. */
export type DemandePro = {
  nom: string;
  email: string;
  telephone: string;
  message: string;
  rappel: string;
  societe: string;
  siret: string;
  activite: string;
  ville: string;
};

export type EvenementChat =
  | { t: "text"; d: string }
  | { t: "produits"; d: ProduitCompact[] }
  | { t: "marques"; d: MarqueProposee[] }
  | { t: "demande_pro"; d: DemandePro }
  | { t: "done" }
  | { t: "error"; m: string };

export type CallbacksChat = {
  onTexte: (fragment: string) => void;
  onProduits: (produits: ProduitCompact[]) => void;
  onMarques: (marques: MarqueProposee[]) => void;
  onDemandePro: (demande: DemandePro) => void;
  onErreur: (message: string) => void;
};

const ERREUR_GENERIQUE =
  "Connexion perdue avec O'Buddy. Vérifie ta connexion et réessaie.";

/**
 * Envoie la conversation et consomme le flux SSE.
 * `signal` permet d'annuler proprement (démontage du composant, nouvelle question).
 */
export async function streamChat(
  messages: ChatMessage[],
  callbacks: CallbacksChat,
  signal?: AbortSignal,
  contexte?: ContextePage | null,
): Promise<void> {
  let reponse: Response;
  try {
    reponse = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, contexte: contexte ?? undefined }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
    callbacks.onErreur(ERREUR_GENERIQUE);
    return;
  }

  if (!reponse.ok || !reponse.body) {
    // Le serveur répond en JSON sur les erreurs de validation.
    const detail = await reponse
      .json()
      .then((j) => (typeof j?.erreur === "string" ? j.erreur : null))
      .catch(() => null);
    callbacks.onErreur(detail ?? ERREUR_GENERIQUE);
    return;
  }

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";

  try {
    while (true) {
      const { done, value } = await lecteur.read();
      if (done) break;

      tampon += decodeur.decode(value, { stream: true });

      // Les événements SSE sont séparés par une ligne vide.
      const blocs = tampon.split("\n\n");
      tampon = blocs.pop() ?? "";

      for (const bloc of blocs) {
        const ligne = bloc.split("\n").find((l) => l.startsWith("data: "));
        if (!ligne) continue;

        let evenement: EvenementChat;
        try {
          evenement = JSON.parse(ligne.slice(6));
        } catch {
          continue;
        }

        if (evenement.t === "text") callbacks.onTexte(evenement.d);
        else if (evenement.t === "produits") callbacks.onProduits(evenement.d);
        else if (evenement.t === "marques") callbacks.onMarques(evenement.d);
        else if (evenement.t === "demande_pro") callbacks.onDemandePro(evenement.d);
        else if (evenement.t === "error") callbacks.onErreur(evenement.m);
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") callbacks.onErreur(ERREUR_GENERIQUE);
  } finally {
    lecteur.releaseLock();
  }
}

// [[P:id]] carte produit · [[C:a|b|c]] réponses cliquables · [[F:MODELE]]
// cases à remplir · [[MARQUES]] sélecteur de marques · [[RDV]] rendez-vous
// [[FIDELITE]] palier client · [[PRO]] récapitulatif de demande pro
// [[CONSEILLER]] mise en relation humaine
const MARQUEURS =
  /\[\[P:([^\]]+)\]\]|\[\[C:([^\]]+)\]\]|\[\[F:([A-Z_]+)\]\]|\[\[(MARQUES|RDV|FIDELITE|PRO|CONSEILLER)\]\]/g;

export type SegmentMessage =
  | { type: "texte"; valeur: string }
  | { type: "produit"; id: string }
  | { type: "marques" }
  | { type: "rdv" }
  | { type: "fidelite" }
  | { type: "demandePro" }
  | { type: "conseiller" }
  /** Cases à remplir posées dans la conversation (voir formulaires.ts). */
  | { type: "formulaire"; modele: string };

export type MessageDecoupe = {
  segments: SegmentMessage[];
  /** Réponses proposées, à afficher en boutons sous la bulle. */
  choix: string[];
};

/**
 * Le flux arrive par morceaux : "[[F", ":COM", "MANDE]]". Pendant une fraction
 * de seconde, la fin du texte est donc un marqueur à moitié écrit — qu'on
 * afficherait tel quel. On coupe la queue ouverte ; elle sera rendue
 * correctement au fragment suivant.
 */
function masquerMarqueurPartiel(tail: string): string {
  const ouverture = tail.lastIndexOf("[[");
  if (ouverture === -1) return tail;
  return tail.includes("]]", ouverture) ? tail : tail.slice(0, ouverture);
}

/**
 * Sépare le corps du message (texte + cartes produit) des propositions de
 * réponse. Les choix sont sortis du flux : ils se rendent en boutons, pas
 * en ligne dans la phrase.
 */
export function decouperMessage(texte: string): MessageDecoupe {
  const segments: SegmentMessage[] = [];
  const choix: string[] = [];
  let curseur = 0;

  for (const match of texte.matchAll(MARQUEURS)) {
    const debut = match.index ?? 0;
    if (debut > curseur) {
      segments.push({ type: "texte", valeur: texte.slice(curseur, debut) });
    }

    if (match[1] !== undefined) {
      segments.push({ type: "produit", id: match[1].trim() });
    } else if (match[3] !== undefined) {
      // Un modèle inconnu est ignoré plutôt qu'affiché vide : le marqueur
      // disparaît simplement du message.
      if (FORMULAIRES[match[3]]) {
        segments.push({ type: "formulaire", modele: match[3] });
      }
    } else if (match[4] !== undefined) {
      const genre = match[4];
      segments.push({
        type:
          genre === "RDV"
            ? "rdv"
            : genre === "FIDELITE"
              ? "fidelite"
              : genre === "PRO"
                ? "demandePro"
                : genre === "CONSEILLER"
                  ? "conseiller"
                  : "marques",
      });
    } else if (match[2] !== undefined) {
      for (const option of match[2].split("|")) {
        const propre = option.trim();
        // 40 caractères : au-delà ce n'est plus un choix rapide mais une phrase.
        if (propre && propre.length <= 40 && !choix.includes(propre)) {
          choix.push(propre);
        }
      }
    }
    curseur = debut + match[0].length;
  }

  if (curseur < texte.length) {
    segments.push({ type: "texte", valeur: masquerMarqueurPartiel(texte.slice(curseur)) });
  }
  return { segments, choix: choix.slice(0, 5) };
}

export type FragmentTexte =
  | { type: "normal"; valeur: string }
  | { type: "gras"; valeur: string }
  | { type: "lien"; valeur: string; url: string };

// **gras** ou [libellé](url)
const MARKDOWN_LEGER = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

/**
 * Filet de sécurité : le prompt interdit le markdown, mais un modèle en glisse
 * toujours. On rend le gras et les liens plutôt que d'afficher la syntaxe brute.
 */
export function formaterTexte(texte: string): FragmentTexte[] {
  const fragments: FragmentTexte[] = [];
  let curseur = 0;

  for (const m of texte.matchAll(MARKDOWN_LEGER)) {
    const debut = m.index ?? 0;
    if (debut > curseur) {
      fragments.push({ type: "normal", valeur: texte.slice(curseur, debut) });
    }
    if (m[1]) fragments.push({ type: "gras", valeur: m[1] });
    else fragments.push({ type: "lien", valeur: m[2], url: m[3] });
    curseur = debut + m[0].length;
  }

  if (curseur < texte.length) {
    fragments.push({ type: "normal", valeur: texte.slice(curseur) });
  }
  return fragments;
}
