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
        return;
      }

      if (d.type === "resultat-panier" && typeof d.id === "string") {
        setEtats((prec) => ({ ...prec, [d.id]: d.ok ? "ok" : "erreur" }));
        if (typeof d.message === "string") {
          setMessages((prec) => ({ ...prec, [d.id]: d.message }));
        }
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

  return {
    disponible,
    etats,
    messages,
    ajouter,
    fidelite,
    demanderFidelite,
    envoiPro,
    envoyerDemandePro,
  };
}
