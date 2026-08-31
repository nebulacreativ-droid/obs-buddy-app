// Pont panier entre le chat (iframe) et la boutique qui l'héberge.
//
// Le chat est servi depuis un autre domaine que PrestaShop : il n'a donc ni la
// session client, ni les cookies du panier. Il ne peut pas ajouter au panier
// lui-même. C'est widget.js, qui tourne SUR la boutique, qui exécute la
// requête ; le chat se contente de la demander.
//
// Protocole :
//   chat  → hôte : { source: "obsbuddy-chat", type: "pret" }
//   hôte  → chat : { source: "obsbuddy-hote", type: "bonjour", panierDisponible }
//   chat  → hôte : { source: "obsbuddy-chat", type: "ajouter-panier", id }
//   hôte  → chat : { source: "obsbuddy-hote", type: "resultat-panier", id, ok, message }
import { useCallback, useEffect, useRef, useState } from "react";

export type EtatAjout = "envoi" | "ok" | "erreur";

const SOURCE_CHAT = "obsbuddy-chat";
const SOURCE_HOTE = "obsbuddy-hote";

export type EnvoiPro =
  | { etat: "repos" }
  | { etat: "envoi" }
  | { etat: "ok" }
  | { etat: "erreur"; message: string };

/** Ce que le visiteur est en train de regarder sur la boutique. */
export type ContextePage = {
  type: string;
  url?: string;
  titre?: string;
  idProduit?: string;
};

export type Fidelite =
  | { etat: "inconnu" }
  | { etat: "chargement" }
  | { etat: "deconnecte" }
  | { etat: "indisponible" }
  | { etat: "connecte"; prenom: string; paliers: string[] };

export function usePanierHote() {
  const [disponible, setDisponible] = useState(false);
  const [etats, setEtats] = useState<Record<string, EtatAjout>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [fidelite, setFidelite] = useState<Fidelite>({ etat: "inconnu" });
  const [envoiPro, setEnvoiPro] = useState<EnvoiPro>({ etat: "repos" });
  const [envoiEscalade, setEnvoiEscalade] = useState<EnvoiPro>({ etat: "repos" });
  const [page, setPage] = useState<ContextePage | null>(null);
  const [questionInitiale, setQuestionInitiale] = useState<string | null>(null);

  // Origine de la boutique, apprise lors de la poignée de main. On ne poste
  // jamais vers "*" une fois qu'elle est connue.
  const origineHote = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const surMessage = (e: MessageEvent) => {
      // Seule la fenêtre parente peut piloter ce pont.
      if (e.source !== window.parent) return;
      const d = e.data;
      if (!d || d.source !== SOURCE_HOTE) return;

      if (d.type === "bonjour") {
        origineHote.current = e.origin;
        setDisponible(Boolean(d.panierDisponible));
        if (d.page && typeof d.page.type === "string") {
          setPage({
            type: d.page.type,
            url: typeof d.page.url === "string" ? d.page.url : undefined,
            titre: typeof d.page.titre === "string" ? d.page.titre : undefined,
            idProduit:
              typeof d.page.idProduit === "string" ? d.page.idProduit : undefined,
          });
        }
        return;
      }

      if (d.type === "resultat-panier" && typeof d.id === "string") {
        setEtats((prec) => ({ ...prec, [d.id]: d.ok ? "ok" : "erreur" }));
        if (typeof d.message === "string") {
          setMessages((prec) => ({ ...prec, [d.id]: d.message }));
        }
        return;
      }

      // Question posée depuis une bulle de la boutique : le chat la joue
      // comme si le visiteur venait de l'écrire.
      if (d.type === "poser-question" && typeof d.texte === "string") {
        const texte = d.texte.trim().slice(0, 300);
        if (texte) setQuestionInitiale(texte);
        return;
      }

      if (d.type === "resultat-escalade") {
        setEnvoiEscalade(
          d.ok
            ? { etat: "ok" }
            : {
                etat: "erreur",
                message:
                  typeof d.message === "string" && d.message
                    ? d.message
                    : "Envoi impossible pour le moment.",
              },
        );
        return;
      }

      if (d.type === "resultat-demande-pro") {
        setEnvoiPro(
          d.ok
            ? { etat: "ok" }
            : {
                etat: "erreur",
                message:
                  typeof d.message === "string" && d.message
                    ? d.message
                    : "Envoi impossible pour le moment.",
              },
        );
        return;
      }

      if (d.type === "resultat-fidelite") {
        if (d.indisponible) setFidelite({ etat: "indisponible" });
        else if (!d.connecte) setFidelite({ etat: "deconnecte" });
        else
          setFidelite({
            etat: "connecte",
            prenom: typeof d.prenom === "string" ? d.prenom : "",
            paliers: Array.isArray(d.paliers) ? d.paliers : [],
          });
      }
    };

    window.addEventListener("message", surMessage);
    // La poignée de main part vers "*" : elle ne transporte aucune donnée.
    window.parent.postMessage({ source: SOURCE_CHAT, type: "pret" }, "*");

    return () => window.removeEventListener("message", surMessage);
  }, []);

  const ajouter = useCallback(
    (id: string) => {
      if (!disponible || typeof window === "undefined") return;
      setEtats((prec) => ({ ...prec, [id]: "envoi" }));
      window.parent.postMessage(
        { source: SOURCE_CHAT, type: "ajouter-panier", id },
        origineHote.current ?? "*",
      );

      // Filet de sécurité : si l'hôte ne répond pas, on ne laisse pas le bouton
      // tourner indéfiniment.
      window.setTimeout(() => {
        setEtats((prec) => (prec[id] === "envoi" ? { ...prec, [id]: "erreur" } : prec));
      }, 12000);
    },
    [disponible],
  );

  /** Interroge la boutique sur le palier du client connecté. */
  const demanderFidelite = useCallback(() => {
    if (typeof window === "undefined" || window.parent === window) {
      setFidelite({ etat: "indisponible" });
      return;
    }
    setFidelite({ etat: "chargement" });
    window.parent.postMessage(
      { source: SOURCE_CHAT, type: "demande-fidelite" },
      origineHote.current ?? "*",
    );

    window.setTimeout(() => {
      setFidelite((prec) => (prec.etat === "chargement" ? { etat: "indisponible" } : prec));
    }, 12000);
  }, []);

  /** Transmet la demande de compte pro à la boutique, après validation par l'utilisateur. */
  const envoyerDemandePro = useCallback((donnees: Record<string, string>) => {
    if (typeof window === "undefined" || window.parent === window) {
      setEnvoiPro({
        etat: "erreur",
        message:
          "L'envoi n'est possible que depuis obarbershop.com. Ouvre O'Buddy depuis la boutique.",
      });
      return;
    }
    setEnvoiPro({ etat: "envoi" });
    window.parent.postMessage(
      { source: SOURCE_CHAT, type: "envoyer-demande-pro", donnees },
      origineHote.current ?? "*",
    );

    window.setTimeout(() => {
      setEnvoiPro((prec) =>
        prec.etat === "envoi"
          ? { etat: "erreur", message: "Pas de réponse de la boutique. Réessaie." }
          : prec,
      );
    }, 15000);
  }, []);

  /** Met le visiteur en relation avec un conseiller, historique à l'appui. */
  const envoyerEscalade = useCallback((donnees: Record<string, string>) => {
    if (typeof window === "undefined" || window.parent === window) {
      setEnvoiEscalade({
        etat: "erreur",
        message:
          "La mise en relation n'est possible que depuis obarbershop.com. Ouvre O'Buddy depuis la boutique.",
      });
      return;
    }
    setEnvoiEscalade({ etat: "envoi" });
    window.parent.postMessage(
      { source: SOURCE_CHAT, type: "envoyer-escalade", donnees },
      origineHote.current ?? "*",
    );

    window.setTimeout(() => {
      setEnvoiEscalade((prec) =>
        prec.etat === "envoi"
          ? { etat: "erreur", message: "Pas de réponse de la boutique. Réessaie." }
          : prec,
      );
    }, 15000);
  }, []);

  const effacerQuestion = useCallback(() => setQuestionInitiale(null), []);

  /**
   * Fait remonter un message à la boutique pour le tableau de bord.
   * Rien n'est envoyé si le chat est consulté hors de la boutique.
   */
  const journaliser = useCallback((role: "client" | "bot", message: string) => {
    if (typeof window === "undefined" || window.parent === window) return;
    const texte = message.trim();
    if (!texte) return;
    window.parent.postMessage(
      { source: SOURCE_CHAT, type: "journaliser", role, message: texte.slice(0, 1200) },
      origineHote.current ?? "*",
    );
  }, []);

  /** Le chat est-il ouvert depuis la boutique, ou consulté en direct ? */
  const embarque = typeof window !== "undefined" && window.parent !== window;

  /** Referme le panneau : le lanceur est masqué pendant l'ouverture. */
  const fermer = useCallback(() => {
    if (!embarque) return;
    window.parent.postMessage(
      { source: SOURCE_CHAT, type: "fermer" },
      origineHote.current ?? "*",
    );
  }, [embarque]);

  return {
    disponible,
    embarque,
    fermer,
    page,
    questionInitiale,
    effacerQuestion,
    journaliser,
    etats,
    messages,
    ajouter,
    fidelite,
    demanderFidelite,
    envoiPro,
    envoyerDemandePro,
    envoiEscalade,
    envoyerEscalade,
  };
}
