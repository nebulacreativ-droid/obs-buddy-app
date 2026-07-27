// Client SSE pour /api/chat. Isolé de l'UI pour rester testable.
import type { ProduitCompact } from "./product-search";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type EvenementChat =
  | { t: "text"; d: string }
  | { t: "produits"; d: ProduitCompact[] }
  | { t: "done" }
  | { t: "error"; m: string };

export type CallbacksChat = {
  onTexte: (fragment: string) => void;
  onProduits: (produits: ProduitCompact[]) => void;
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
): Promise<void> {
  let reponse: Response;
  try {
    reponse = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
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
        else if (evenement.t === "error") callbacks.onErreur(evenement.m);
      }
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") callbacks.onErreur(ERREUR_GENERIQUE);
  } finally {
    lecteur.releaseLock();
  }
}

const MARQUEUR_PRODUIT = /\[\[P:([^\]]+)\]\]/g;

export type SegmentMessage =
  | { type: "texte"; valeur: string }
  | { type: "produit"; id: string };

/**
 * Découpe un message en segments texte / cartes produit.
 * Le modèle cite un produit avec le marqueur [[P:id]].
 */
export function decouperMessage(texte: string): SegmentMessage[] {
  const segments: SegmentMessage[] = [];
  let curseur = 0;

  for (const match of texte.matchAll(MARQUEUR_PRODUIT)) {
    const debut = match.index ?? 0;
    if (debut > curseur) {
      segments.push({ type: "texte", valeur: texte.slice(curseur, debut) });
    }
    segments.push({ type: "produit", id: match[1].trim() });
    curseur = debut + match[0].length;
  }

  if (curseur < texte.length) {
    segments.push({ type: "texte", valeur: texte.slice(curseur) });
  }
  return segments;
}
