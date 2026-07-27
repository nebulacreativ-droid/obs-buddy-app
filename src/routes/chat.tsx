import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ExternalLink,
  RotateCcw,
  ShoppingBag,
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
import { BookingWidget } from "@/components/BookingWidget";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "O'Buddy — Assistant Barber O'Barbershop" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const ACCUEIL =
  "Salut, c'est O'Buddy 👋 Je connais le catalogue O'Barbershop par cœur. Par quoi on commence ?";

// Les 3 parcours historiques de l'assistant, menés en conversation, plus le SAV.
const PARCOURS = [
  {
    numero: "01",
    eyebrow: "Particulier",
    titre: "Ma routine perso",
    desc: "Cheveux, barbe, peau",
    message: "Je veux me composer une routine perso.",
  },
  {
    numero: "02",
    eyebrow: "Pro barbier",
    titre: "Mon matériel pro",
    desc: "Tondeuses, ciseaux, rasoirs",
    message: "Je cherche du matériel pro pour mon activité de barbier.",
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
    eyebrow: "Déjà client",
    titre: "Ma commande",
    desc: "Suivi, livraison, retour",
    message: "J'ai une question sur ma commande.",
  },
];

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [produits, setProduits] = useState<Record<string, ProduitCompact>>({});
  const [marques, setMarques] = useState<MarqueProposee[]>([]);
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

  useEffect(() => () => abortRef.current?.abort(), []);

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
        onErreur: (message) => {
          setErreur(message);
          // Retire la bulle vide si le modèle n'a rien produit.
          if (!accumule) setMessages(historique);
        },
      },
      controller.signal,
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
    setErreur(null);
    setEnCours(false);
  }

  const vide = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      {/* Bandeau noir, logo jaune : l'ancrage de la DA O'Barbershop. */}
      <header className="flex shrink-0 items-center justify-between bg-ink px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center bg-gold font-display text-base text-ink">
            OB
          </div>
          <div className="leading-none">
            <div className="font-display text-lg tracking-wide text-gold">
              O'BUDDY
            </div>
            <div className="mt-0.5 font-display text-[9px] tracking-[0.35em] text-paper/60">
              SHOP ASSISTANT
            </div>
          </div>
        </div>
        {!vide && (
          <button
            onClick={reinitialiser}
            className="tap-target flex items-center gap-1.5 border-2 border-paper/25 px-2.5 py-1.5 font-display text-[10px] tracking-[0.2em] text-paper transition hover:border-gold hover:text-gold"
          >
            <RotateCcw className="h-3 w-3" />
            RESET
          </button>
        )}
      </header>
      <div className="h-1 shrink-0 bg-gold" />

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Bulle role="assistant">
            <p className="text-sm leading-relaxed">{ACCUEIL}</p>
          </Bulle>

          {vide && (
            <div className="flex flex-col gap-2.5">
              {PARCOURS.map((p) => (
                <CarteParcours key={p.numero} parcours={p} onChoisir={envoyer} />
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
                  panier={panier}
                  actif={dernier && !enCours}
                  onChoix={envoyer}
                />
              </Bulle>
            );
          })}

          {erreur && (
            <div className="border-2 border-[var(--rouge)] bg-paper px-3 py-2 text-xs text-[var(--rouge)]">
              {erreur}
            </div>
          )}

          <div ref={finRef} />
        </div>
      </div>

      <div className="shrink-0 border-t-2 border-ink bg-paper px-4 py-3">
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
            className="max-h-32 flex-1 resize-none border-2 border-ink bg-paper px-3 py-2.5 text-sm outline-none transition placeholder:text-ink/40 focus:shadow-[3px_3px_0_0_var(--gold)] disabled:opacity-60"
          />
          <button
            onClick={() => envoyer(saisie)}
            disabled={enCours || !saisie.trim()}
            aria-label="Envoyer"
            className="tap-target flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink bg-ink text-gold transition hover:bg-gold hover:text-ink disabled:opacity-25"
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

/** Tuile de parcours reprenant les cartes numérotées de la landing. */
function CarteParcours({
  parcours,
  onChoisir,
}: {
  parcours: (typeof PARCOURS)[number];
  onChoisir: (message: string) => void;
}) {
  return (
    <button
      onClick={() => onChoisir(parcours.message)}
      className="tap-target group relative flex w-full flex-col overflow-hidden border-2 border-ink bg-paper text-left transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brut"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-3 -top-5 font-display text-7xl leading-none text-ink/[0.06] transition-colors group-hover:text-gold/40"
      >
        {parcours.numero}
      </div>

      <div className="relative z-10 flex items-center justify-between bg-ink px-3 py-1.5 text-gold">
        <span className="font-display text-[10px] tracking-[0.3em]">
          {parcours.numero}&nbsp;&nbsp;{parcours.eyebrow.toUpperCase()}
        </span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>

      <div className="relative z-10 px-3 py-2.5">
        <div className="font-display text-xl leading-tight">{parcours.titre}</div>
        <div className="text-xs text-ink/60">{parcours.desc}</div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-0 h-0 bg-gold transition-all duration-300 group-hover:h-1.5" />
    </button>
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
        className={`max-w-[88%] px-3.5 py-2.5 ${
          utilisateur ? "bg-ink text-gold" : "border-2 border-ink bg-paper text-ink"
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
  panier,
  actif,
  onChoix,
}: {
  texte: string;
  produits: Record<string, ProduitCompact>;
  marques: MarqueProposee[];
  panier: ReturnType<typeof usePanierHote>;
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
              className="tap-target border-2 border-ink bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink hover:text-gold"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div className="border-2 border-ink bg-paper p-2.5">
      <div className="mb-2 font-display text-[10px] tracking-[0.3em] text-ink/60">
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
              className={`tap-target flex items-center gap-2 border-2 p-1.5 text-left transition ${
                active
                  ? "border-ink bg-ink text-gold"
                  : "border-ink/20 bg-paper hover:border-ink"
              } ${verrouille ? "cursor-default opacity-70" : ""}`}
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden border border-ink/10 bg-white">
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
                  {m.pays}
                  {m.bestSeller ? " · Best-seller" : ""}
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
          className="tap-target mt-2 w-full bg-gold px-3 py-2 font-display text-xs tracking-[0.2em] text-ink transition hover:brightness-105 disabled:opacity-40"
        >
          VALIDER {choisies.length > 0 && `(${choisies.length})`}
        </button>
      )}
    </div>
  );
}

function BlocRendezVous() {
  return (
    <div className="border-2 border-ink bg-paper p-2.5">
      <div className="mb-1 font-display text-[10px] tracking-[0.3em] text-ink/60">
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
    <div className="border-2 border-ink bg-paper">
      <a
        href={produit.lien}
        target="_blank"
        rel="noopener noreferrer"
        className="tap-target group flex gap-3 p-2.5"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden border border-ink/10 bg-white">
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
          <div className="font-display text-[10px] tracking-[0.25em] text-ink/55">
            {produit.marque.toUpperCase()}
          </div>
          <div className="text-sm font-medium leading-tight">{produit.nom}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="bg-gold px-1.5 font-display text-base leading-tight">
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
          className={`tap-target flex w-full items-center justify-center gap-1.5 border-t-2 border-ink px-3 py-2 font-display text-xs tracking-[0.2em] transition ${
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
        <p className="border-t-2 border-ink px-2.5 py-1.5 text-[11px] text-[var(--rouge)]">
          {panier.messages[produit.id] ??
            "Ajout impossible. Ouvre la fiche produit pour commander."}
        </p>
      )}

      {panier.disponible && produit.declinaisons && !enRupture && (
        <p className="border-t-2 border-ink px-2.5 py-1.5 text-[11px] text-ink/60">
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
          className="h-1.5 w-1.5 animate-bounce bg-ink/50"
          style={{ animationDelay: `${delai}ms` }}
        />
      ))}
    </div>
  );
}
