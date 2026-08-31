import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  Eye,
  ExternalLink,
  Headset,
  RotateCcw,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  streamChat,
  decouperMessage,
  formaterTexte,
  type ChatMessage,
} from "@/lib/chat-client";
import { usePanierHote } from "@/lib/panier-hote";
import type { ProduitCompact } from "@/lib/product-search";
import type { MarqueProposee } from "@/lib/marques-search";
import type { DemandePro } from "@/lib/chat-client";
import { BookingWidget } from "@/components/BookingWidget";
import {
  chargerConversation,
  sauvegarderConversation,
  effacerConversation,
} from "@/lib/persistance";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "O'Buddy — Assistant Barber O'Barbershop" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const ACCUEIL = "Salut, c'est O'Buddy 👋 Par quoi on commence ?";

// Routine perso et matériel pro sont fusionnés : dans les deux cas il s'agit
// d'une recommandation produit, le bot distingue ensuite perso ou pro.
const PARCOURS = [
  {
    numero: "01",
    eyebrow: "Déjà client",
    titre: "Ma commande",
    desc: "Suivi, livraison, retour",
    message: "J'ai une question sur ma commande.",
  },
  {
    numero: "02",
    eyebrow: "Conseil",
    titre: "Conseil produit",
    desc: "Routine perso ou matériel pro",
    message: "Je cherche une recommandation produit.",
  },
  {
    numero: "03",
    eyebrow: "Pro ouverture",
    titre: "J'ouvre mon shop",
    desc: "Matos, mobilier, revente",
    message: "J'ouvre mon barbershop, aide-moi à monter le projet.",
  },
  {
    numero: "04",
    eyebrow: "Professionnel",
    titre: "Devenir pro",
    desc: "Tarif pro, demande de contact",
    message: "Je veux devenir client pro.",
  },
  {
    numero: "05",
    eyebrow: "Divers",
    titre: "Autre question",
    desc: "Conseil technique, boutique",
    message: "J'ai une autre question.",
  },
];

function ChatPage() {
  // Reprise de la conversation en cours : le widget recrée son iframe à
  // chaque changement de page de la boutique.
  const [initial] = useState(chargerConversation);
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [produits, setProduits] = useState<Record<string, ProduitCompact>>(
    initial.produits,
  );
  const [marques, setMarques] = useState<MarqueProposee[]>(initial.marques);
  const [demandePro, setDemandePro] = useState<DemandePro | null>(
    initial.demandePro,
  );
  const panier = usePanierHote();

  const finRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Ne défile qu'une fois la conversation entamée : au chargement, cela
  // masquerait le message d'accueil et les tuiles de parcours.
  useEffect(() => {
    if (!messages.length) return;
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, enCours]);

  // On n'enregistre pas pendant le streaming : inutile d'écrire à chaque
  // fragment reçu, seul l'état stabilisé nous intéresse.
  useEffect(() => {
    if (enCours) return;
    sauvegarderConversation({ messages, produits, marques, demandePro });
  }, [messages, produits, marques, demandePro, enCours]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Question cliquée depuis une bulle de la boutique : on la joue comme si le
  // visiteur venait de l'écrire, pour qu'il arrive sur une réponse en cours.
  useEffect(() => {
    if (!panier.questionInitiale || enCours) return;
    const question = panier.questionInitiale;
    panier.effacerQuestion();
    void envoyer(question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panier.questionInitiale, enCours]);

  async function envoyer(texte: string) {
    const contenu = texte.trim();
    if (!contenu || enCours) return;

    setErreur(null);
    setSaisie("");

    const historique: ChatMessage[] = [
      ...messages,
      { role: "user", content: contenu },
    ];
    // Bulle assistant vide : elle se remplit au fil du flux.
    setMessages([...historique, { role: "assistant", content: "" }]);
    setEnCours(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumule = "";
    const majAssistant = (valeur: string) =>
      setMessages((prec) => {
        const copie = [...prec];
        copie[copie.length - 1] = { role: "assistant", content: valeur };
        return copie;
      });

    await streamChat(
      historique,
      {
        onTexte: (fragment) => {
          accumule += fragment;
          majAssistant(accumule);
        },
        onProduits: (liste) =>
          setProduits((prec) => {
            const suivant = { ...prec };
            for (const p of liste) suivant[p.id] = p;
            return suivant;
          }),
        onMarques: (liste) => setMarques(liste),
        onDemandePro: (d) => setDemandePro(d),
        onErreur: (message) => {
          setErreur(message);
          // Retire la bulle vide si le modèle n'a rien produit.
          if (!accumule) setMessages(historique);
        },
      },
      controller.signal,
      panier.page,
    );

    setEnCours(false);
    abortRef.current = null;
    champRef.current?.focus();
  }

  function reinitialiser() {
    abortRef.current?.abort();
    setMessages([]);
    setProduits({});
    setMarques([]);
    setDemandePro(null);
    setErreur(null);
    setEnCours(false);
    effacerConversation();
  }

  const vide = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      {/* Bandeau noir, logo jaune : l'ancrage de la DA O'Barbershop. */}
      <header className="flex shrink-0 items-center justify-between bg-ink px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold font-display text-base text-ink">
            OB
          </div>
          <div className="leading-none">
            <div className="font-display text-lg tracking-wide text-gold">
              O'BUDDY
            </div>
            <div className="mt-0.5 text-[10px] font-medium tracking-[0.14em] text-paper/55">
              SHOP ASSISTANT
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!vide && (
            <button
              onClick={reinitialiser}
              aria-label="Recommencer la discussion"
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-paper/25 text-paper transition hover:border-gold hover:bg-paper/10 hover:text-gold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Le lanceur est masqué pendant l'ouverture : la fermeture vit ici. */}
          {panier.embarque && (
            <button
              onClick={panier.fermer}
              aria-label="Fermer O'Buddy"
              className="tap-target flex h-8 w-8 items-center justify-center rounded-full border border-paper/25 text-paper transition hover:border-gold hover:bg-paper/10 hover:text-gold"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>
      <div className="h-0.5 shrink-0 bg-gold/70" />

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Bulle role="assistant">
            <p className="text-sm leading-relaxed">{ACCUEIL}</p>
          </Bulle>

          {vide && panier.page?.type === "product" && panier.page.titre && (
            <BandeauProduit titre={panier.page.titre} onDemander={envoyer} />
          )}

          {vide && (
            <div className="flex flex-wrap gap-1.5">
              {PARCOURS.map((p) => (
                <button
                  key={p.numero}
                  onClick={() => envoyer(p.message)}
                  className="tap-target rounded-full border border-ink/15 bg-paper px-3.5 py-2 text-xs font-medium transition hover:border-ink hover:bg-ink hover:text-gold"
                >
                  {p.titre}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => {
            const dernier = i === messages.length - 1;
            if (m.role === "user") {
              return (
                <Bulle key={i} role="user">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>
                </Bulle>
              );
            }
            // Bulle assistant encore vide pendant que le modèle réfléchit.
            if (!m.content && dernier && enCours) {
              return (
                <Bulle key={i} role="assistant">
                  <Frappe />
                </Bulle>
              );
            }
            return (
              <Bulle key={i} role="assistant">
                <ContenuAssistant
                  texte={m.content}
                  produits={produits}
                  marques={marques}
                  demandePro={demandePro}
                  panier={panier}
                  historique={messages}
                  actif={dernier && !enCours}
                  onChoix={envoyer}
                />
              </Bulle>
            );
          })}

          {erreur && (
            <div className="rounded-xl border border-[var(--rouge)]/40 bg-[var(--rouge)]/5 px-3.5 py-2.5 text-xs text-[var(--rouge)]">
              {erreur}
            </div>
          )}

          <div ref={finRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-ink/10 bg-paper px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={champRef}
            rows={1}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                envoyer(saisie);
              }
            }}
            placeholder="Pose ta question…"
            disabled={enCours}
            className="max-h-32 flex-1 resize-none rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-sm outline-none transition placeholder:text-ink/35 focus:border-ink/35 focus:shadow-[0_0_0_3px_rgba(252,242,79,.45)] disabled:opacity-60"
          />
          <button
            onClick={() => envoyer(saisie)}
            disabled={enCours || !saisie.trim()}
            aria-label="Envoyer"
            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-gold transition hover:bg-gold hover:text-ink disabled:opacity-25"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-ink/50">
          O'Buddy peut se tromper — vérifie les infos importantes sur obarbershop.com
        </p>
      </div>
    </div>
  );
}

function Bulle({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const utilisateur = role === "user";
  return (
    <div className={`flex ${utilisateur ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] px-4 py-3 text-[13.5px] ${
          utilisateur
            ? "rounded-[18px_18px_5px_18px] bg-ink text-gold"
            : "rounded-[18px_18px_18px_5px] border border-ink/10 bg-paper text-ink shadow-[0_2px_10px_rgba(15,15,15,.05)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ContenuAssistant({
  texte,
  produits,
  marques,
  demandePro,
  panier,
  historique,
  actif,
  onChoix,
}: {
  texte: string;
  produits: Record<string, ProduitCompact>;
  marques: MarqueProposee[];
  demandePro: DemandePro | null;
  panier: ReturnType<typeof usePanierHote>;
  historique: ChatMessage[];
  actif: boolean;
  onChoix: (valeur: string) => void;
}) {
  const { segments, choix } = decouperMessage(texte);

  return (
    <div className="flex flex-col gap-2">
      {segments.map((s, i) => {
        if (s.type === "texte") {
          const valeur = s.valeur.trim();
          if (!valeur) return null;
          return (
            <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
              <TexteFormate valeur={valeur} />
            </p>
          );
        }
        if (s.type === "marques") {
          return marques.length ? (
            <SelecteurMarques
              key={i}
              marques={marques}
              actif={actif}
              onValider={onChoix}
            />
          ) : null;
        }
        if (s.type === "rdv") {
          return <BlocRendezVous key={i} />;
        }
        if (s.type === "fidelite") {
          return <BlocFidelite key={i} panier={panier} />;
        }
        if (s.type === "conseiller") {
          return (
            <CarteConseiller
              key={i}
              panier={panier}
              historique={historique}
              actif={actif}
            />
          );
        }
        if (s.type === "demandePro") {
          return demandePro ? (
            <RecapDemandePro key={i} demande={demandePro} panier={panier} actif={actif} />
          ) : null;
        }
        const produit = produits[s.id];
        // Le marqueur est ignoré si le produit n'a pas été remonté par la recherche.
        if (!produit) return null;
        return <CarteProduit key={i} produit={produit} panier={panier} />;
      })}

      {actif && choix.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {choix.map((c) => (
            <button
              key={c}
              onClick={() => onChoix(c)}
              className="tap-target rounded-full border border-ink/15 bg-paper px-3.5 py-2 text-xs font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-gold"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Les styles du catalogue sont techniques : on les rend lisibles. */
const LIBELLES_STYLE: Record<string, string> = {
  old_school: "Old school",
  moderne: "Moderne",
  urbain: "Urbain",
  rock: "Rock",
  hipster: "Hipster",
  naturel: "Naturel",
  premium: "Premium",
};

const libelleStyle = (s: string) => LIBELLES_STYLE[s] ?? s;

/** Sélection multiple des marques à mettre en rayon (parcours ouverture). */
function SelecteurMarques({
  marques,
  actif,
  onValider,
}: {
  marques: MarqueProposee[];
  actif: boolean;
  onValider: (message: string) => void;
}) {
  const [choisies, setChoisies] = useState<string[]>([]);
  const [envoye, setEnvoye] = useState(false);

  const basculer = (nom: string) =>
    setChoisies((prec) =>
      prec.includes(nom) ? prec.filter((n) => n !== nom) : [...prec, nom],
    );

  const valider = () => {
    if (!choisies.length) return;
    setEnvoye(true);
    onValider(
      `Je retiens ces marques pour mon mur de revente : ${choisies.join(", ")}.`,
    );
  };

  const verrouille = envoye || !actif;

  return (
    <div className="rounded-2xl border border-ink/12 bg-paper p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
        COCHE TES MARQUES
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {marques.map((m) => {
          const active = choisies.includes(m.nom);
          return (
            <button
              key={m.nom}
              disabled={verrouille}
              onClick={() => basculer(m.nom)}
              className={`tap-target flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                active
                  ? "border-ink bg-ink text-gold"
                  : "border-ink/12 bg-paper hover:border-ink/40"
              } ${verrouille ? "cursor-default opacity-70" : ""}`}
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-ink/8 bg-white">
                {m.logo && (
                  <img
                    src={m.logo}
                    alt={m.nom}
                    loading="lazy"
                    className="h-full w-full object-contain p-0.5"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium leading-tight">
                  {m.nom}
                </div>
                <div
                  className={`truncate text-[10px] ${active ? "text-gold/70" : "text-ink/50"}`}
                >
                  {/* L'univers de la marque explique pourquoi elle est proposée. */}
                  {m.styles.slice(0, 2).map(libelleStyle).join(" · ") || m.pays}
                  {m.madeInFrance ? " · MIF" : ""}
                </div>
              </div>
              {active && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          );
        })}
      </div>

      {!verrouille && (
        <button
          onClick={valider}
          disabled={!choisies.length}
          className="tap-target mt-2.5 w-full rounded-xl bg-gold px-3 py-2.5 text-xs font-semibold text-ink transition hover:brightness-105 disabled:opacity-40"
        >
          VALIDER {choisies.length > 0 && `(${choisies.length})`}
        </button>
      )}
    </div>
  );
}

/**
 * Palier de fidélité. La donnée est demandée à la boutique par le widget, avec
 * la session du client : elle ne passe jamais par le serveur de l'assistant,
 * et un visiteur non connecté ne peut rien consulter.
 */
function BlocFidelite({ panier }: { panier: ReturnType<typeof usePanierHote> }) {
  const { fidelite, demanderFidelite } = panier;

  useEffect(() => {
    if (fidelite.etat === "inconnu") demanderFidelite();
  }, [fidelite.etat, demanderFidelite]);

  return (
    <div className="rounded-2xl border border-ink/12 bg-paper p-3.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
        FIDÉLITÉ
      </div>

      {(fidelite.etat === "inconnu" || fidelite.etat === "chargement") && (
        <Frappe />
      )}

      {fidelite.etat === "connecte" && (
        <>
          {fidelite.paliers.length ? (
            <>
              <div className="text-xs text-ink/60">
                {fidelite.prenom ? `${fidelite.prenom}, ton palier` : "Ton palier"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {fidelite.paliers.map((p) => (
                  <span
                    key={p}
                    className="bg-gold px-2 py-0.5 font-display text-sm tracking-wide text-ink"
                  >
                    {p.toUpperCase()}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed">
              Tu es bien connecté, mais aucun palier de fidélité n'est encore
              associé à ton compte.
            </p>
          )}
        </>
      )}

      {fidelite.etat === "deconnecte" && (
        <p className="text-sm leading-relaxed">
          Connecte-toi sur obarbershop.com pour voir ton palier — je ne peux pas
          y accéder autrement, c'est ce qui protège ton compte.
        </p>
      )}

      {fidelite.etat === "indisponible" && (
        <p className="text-sm leading-relaxed">
          Je n'arrive pas à récupérer ton palier depuis ici. Tu le retrouves dans
          ton compte sur obarbershop.com.
        </p>
      )}
    </div>
  );
}

/**
 * Récapitulatif avant envoi d'une demande de compte pro.
 * L'utilisateur voit exactement ce qui part avant de valider : rien n'est
 * transmis à la boutique sans son geste explicite.
 */
function RecapDemandePro({
  demande,
  panier,
  actif,
}: {
  demande: DemandePro;
  panier: ReturnType<typeof usePanierHote>;
  actif: boolean;
}) {
  const { envoiPro, envoyerDemandePro } = panier;

  const lignes: Array<[string, string]> = [
    ["Contact", demande.nom],
    ["Email", demande.email],
    ["Téléphone", demande.telephone],
    ["Rappel", demande.rappel ? "Souhaité" : ""],
    ["Société", demande.societe],
    ["SIRET", demande.siret],
    ["Activité", demande.activite],
    ["Ville", demande.ville],
  ];

  return (
    <div className="rounded-2xl border border-ink/12 bg-paper p-3.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
        DEMANDE DE COMPTE PRO
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {lignes.map(([libelle, valeur]) =>
          valeur ? (
            <div key={libelle} className="contents">
              <dt className="text-ink/55">{libelle}</dt>
              <dd className="font-medium break-words">{valeur}</dd>
            </div>
          ) : null,
        )}
      </dl>

      {demande.message && (
        <p className="mt-2 border-t border-ink/15 pt-2 text-xs text-ink/70">
          {demande.message}
        </p>
      )}

      {envoiPro.etat === "ok" ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-xs font-semibold text-gold">
          <Check className="h-3.5 w-3.5" /> DEMANDE ENVOYÉE
        </div>
      ) : (
        <>
          <button
            onClick={() => envoyerDemandePro({ ...demande })}
            disabled={!actif || envoiPro.etat === "envoi"}
            className="tap-target mt-3 w-full rounded-xl bg-gold px-3 py-2.5 text-xs font-semibold text-ink transition hover:brightness-105 disabled:opacity-40"
          >
            {envoiPro.etat === "envoi" ? "ENVOI…" : "ENVOYER MA DEMANDE"}
          </button>
          <p className="mt-1.5 text-[10px] text-ink/50">
            Ces informations partent à l'équipe O'Barbershop, qui te recontacte.
          </p>
        </>
      )}

      {envoiPro.etat === "erreur" && (
        <p className="mt-1.5 text-[11px] text-[var(--rouge)]">{envoiPro.message}</p>
      )}
    </div>
  );
}

/**
 * Rappelle au visiteur la fiche qu'il consulte et lui ouvre une porte d'entrée
 * directe. Le bot connaît déjà ce produit : il répondra sans reposer de question.
 */
function BandeauProduit({
  titre,
  onDemander,
}: {
  titre: string;
  onDemander: (message: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-gold/50 bg-gold/15 p-3.5">
      <div className="flex items-start gap-2">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
            TU REGARDES
          </div>
          <div className="mt-0.5 text-sm font-medium leading-tight">{titre}</div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => onDemander("Ce produit est fait pour moi ?")}
          className="tap-target rounded-full border border-ink/15 bg-paper px-3.5 py-2 text-xs font-medium transition hover:border-ink hover:bg-ink hover:text-gold"
        >
          C'est fait pour moi ?
        </button>
        <button
          onClick={() => onDemander("Comment on l'utilise, ce produit ?")}
          className="tap-target rounded-full border border-ink/15 bg-paper px-3.5 py-2 text-xs font-medium transition hover:border-ink hover:bg-ink hover:text-gold"
        >
          Comment l'utiliser ?
        </button>
        <button
          onClick={() => onDemander("Tu as mieux, ou un équivalent moins cher ?")}
          className="tap-target rounded-full border border-ink/15 bg-paper px-3.5 py-2 text-xs font-medium transition hover:border-ink hover:bg-ink hover:text-gold"
        >
          Une alternative ?
        </button>
      </div>
    </div>
  );
}

/**
 * Mise en relation avec un conseiller. L'échange est joint pour que l'équipe
 * reprenne où le bot s'est arrêté, et le visiteur voit ce qu'il transmet
 * avant de valider.
 */
function CarteConseiller({
  panier,
  historique,
  actif,
}: {
  panier: ReturnType<typeof usePanierHote>;
  historique: ChatMessage[];
  actif: boolean;
}) {
  const { envoiEscalade, envoyerEscalade } = panier;
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [precision, setPrecision] = useState("");

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const verrouille = envoiEscalade.etat === "envoi" || envoiEscalade.etat === "ok" || !actif;

  // Les derniers échanges suffisent à recontextualiser sans noyer l'équipe.
  const transcription = historique
    .slice(-10)
    .map((m) => `${m.role === "user" ? "Client" : "O'Buddy"} : ${m.content}`)
    .join("\n")
    .slice(0, 1400);

  if (envoiEscalade.etat === "ok") {
    return (
      <div className="rounded-2xl border border-ink/12 bg-paper p-3.5">
        <div className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2.5 text-xs font-semibold text-gold">
          <Check className="h-3.5 w-3.5" /> TRANSMIS À L'ÉQUIPE
        </div>
        <p className="mt-2 text-xs text-ink/70">
          Un conseiller O'Barbershop reprend ton échange et te répond par email.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/12 bg-paper p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Headset className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
          PARLER À UN CONSEILLER
        </span>
      </div>

      <p className="mb-2.5 text-xs text-ink/70">
        Je transmets notre échange à l'équipe. Laisse-moi ton email pour qu'on te réponde.
      </p>

      <div className="flex flex-col gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={verrouille}
          placeholder="ton@email.com"
          className="rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm outline-none transition placeholder:text-ink/35 focus:border-ink/35 focus:shadow-[0_0_0_3px_rgba(252,242,79,.4)] disabled:opacity-60"
        />
        <input
          type="text"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          disabled={verrouille}
          placeholder="Ton nom (facultatif)"
          className="rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm outline-none transition placeholder:text-ink/35 focus:border-ink/35 focus:shadow-[0_0_0_3px_rgba(252,242,79,.4)] disabled:opacity-60"
        />
        <textarea
          rows={2}
          value={precision}
          onChange={(e) => setPrecision(e.target.value)}
          disabled={verrouille}
          placeholder="Une précision à ajouter ? (facultatif)"
          className="resize-none rounded-xl border border-ink/15 bg-paper px-3 py-2.5 text-sm outline-none transition placeholder:text-ink/35 focus:border-ink/35 focus:shadow-[0_0_0_3px_rgba(252,242,79,.4)] disabled:opacity-60"
        />
      </div>

      <button
        onClick={() =>
          envoyerEscalade({
            sujet: "conseiller",
            nom: nom.trim(),
            email: email.trim(),
            message: precision.trim() || "Le client souhaite parler à un conseiller.",
            historique: transcription,
          })
        }
        disabled={verrouille || !emailValide}
        className="tap-target mt-2.5 w-full rounded-xl bg-gold px-3 py-2.5 text-xs font-semibold text-ink transition hover:brightness-105 disabled:opacity-40"
      >
        {envoiEscalade.etat === "envoi" ? "ENVOI…" : "DEMANDER UN CONSEILLER"}
      </button>

      <p className="mt-1.5 text-[10px] text-ink/50">
        Les derniers messages de notre échange seront joints.
      </p>

      {envoiEscalade.etat === "erreur" && (
        <p className="mt-1.5 text-[11px] text-[var(--rouge)]">{envoiEscalade.message}</p>
      )}
    </div>
  );
}

function BlocRendezVous() {
  return (
    <div className="rounded-2xl border border-ink/12 bg-paper p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">
        RENDEZ-VOUS CONSEILLER
      </div>
      <BookingWidget />
    </div>
  );
}

function TexteFormate({ valeur }: { valeur: string }) {
  return (
    <>
      {formaterTexte(valeur).map((f, i) => {
        if (f.type === "gras") return <strong key={i}>{f.valeur}</strong>;
        if (f.type === "lien")
          return (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {f.valeur}
            </a>
          );
        return <span key={i}>{f.valeur}</span>;
      })}
    </>
  );
}

function CarteProduit({
  produit,
  panier,
}: {
  produit: ProduitCompact;
  panier: ReturnType<typeof usePanierHote>;
}) {
  const etat = panier.etats[produit.id];
  const enRupture = produit.dispo === "rupture";

  // L'ajout direct n'est proposé que si la boutique héberge le chat, que le
  // produit est dispo, et qu'il n'a pas de variantes à choisir.
  const ajoutPossible = panier.disponible && !enRupture && !produit.declinaisons;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/12 bg-paper shadow-[0_2px_10px_rgba(15,15,15,.05)]">
      <a
        href={produit.lien}
        target="_blank"
        rel="noopener noreferrer"
        className="tap-target group flex gap-3 p-2.5"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/8 bg-white">
          {produit.image && (
            <img
              src={produit.image}
              alt={produit.nom}
              loading="lazy"
              className="h-full w-full object-contain p-0.5"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
            {produit.marque.toUpperCase()}
          </div>
          <div className="text-sm font-medium leading-tight">{produit.nom}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-md bg-gold px-2 py-0.5 font-display text-base leading-tight">
              {produit.prix_aff} €
            </span>
            {enRupture && (
              <span className="font-display text-[10px] tracking-[0.2em] text-[var(--rouge)]">
                RUPTURE
              </span>
            )}
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-ink/40 transition group-hover:text-ink" />
      </a>

      {ajoutPossible && (
        <button
          onClick={() => panier.ajouter(produit.id)}
          disabled={etat === "envoi" || etat === "ok"}
          className={`tap-target flex w-full items-center justify-center gap-1.5 border-t border-ink/10 px-3 py-2.5 text-xs font-semibold transition ${
            etat === "ok" ? "bg-ink text-gold" : "bg-gold text-ink hover:brightness-105"
          } disabled:cursor-default`}
        >
          {etat === "ok" ? (
            <>
              <Check className="h-3.5 w-3.5" /> AJOUTÉ
            </>
          ) : etat === "envoi" ? (
            "AJOUT…"
          ) : (
            <>
              <ShoppingBag className="h-3.5 w-3.5" /> AJOUTER AU PANIER
            </>
          )}
        </button>
      )}

      {etat === "erreur" && (
        <p className="border-t border-ink/10 px-3 py-2 text-[11px] text-[var(--rouge)]">
          {panier.messages[produit.id] ??
            "Ajout impossible. Ouvre la fiche produit pour commander."}
        </p>
      )}

      {panier.disponible && produit.declinaisons && !enRupture && (
        <p className="border-t border-ink/10 px-3 py-2 text-[11px] text-ink/60">
          Plusieurs versions — choisis la tienne sur la fiche produit.
        </p>
      )}
    </div>
  );
}

function Frappe() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delai) => (
        <span
          key={delai}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40"
          style={{ animationDelay: `${delai}ms` }}
        />
      ))}
    </div>
  );
}
