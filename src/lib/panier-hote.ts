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

export function usePanierHote() {
  const [disponible, setDisponible] = useState(false);
  const [etats, setEtats] = useState<Record<string, EtatAjout>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});

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

  return { disponible, etats, messages, ajouter };
}
