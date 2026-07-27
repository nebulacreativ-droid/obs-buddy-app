import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, RotateCcw } from "lucide-react";
import {
  streamChat,
  decouperMessage,
  formaterTexte,
  type ChatMessage,
} from "@/lib/chat-client";
import type { ProduitCompact } from "@/lib/product-search";

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
  "Salut, c'est O'Buddy 👋 Je connais le catalogue O'Barbershop par cœur. Dis-moi ce que tu cherches.";

const SUGGESTIONS = [
  "Une cire mate pour cheveux épais",
  "J'ouvre mon barbershop, par où je commence ?",
  "Quelle tondeuse pour faire des fades ?",
  "Comment entretenir mes lames ?",
];

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [produits, setProduits] = useState<Record<string, ProduitCompact>>({});

  const finRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Suit le bas de la conversation pendant le streaming.
  useEffect(() => {
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
    setErreur(null);
    setEnCours(false);
  }

  const vide = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-ink font-display text-sm text-gold">
            OB
          </div>
          <div className="leading-tight">
            <div className="font-display text-base">O'BUDDY</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Assistant barber
            </div>
          </div>
        </div>
        {!vide && (
          <button
            onClick={reinitialiser}
            className="tap-target flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Nouvelle discussion
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <Bulle role="assistant">
            <p className="text-sm leading-relaxed">{ACCUEIL}</p>
          </Bulle>

          {vide && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => envoyer(s)}
                  className="tap-target rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs transition hover:border-foreground/40 hover:-translate-y-0.5"
                >
                  {s}
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
                <ContenuAssistant texte={m.content} produits={produits} />
              </Bulle>
            );
          })}

          {erreur && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {erreur}
            </div>
          )}

          <div ref={finRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background px-4 py-3">
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
            className="max-h-32 flex-1 resize-none rounded-sm border border-border bg-card px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-foreground/40 disabled:opacity-60"
          />
          <button
            onClick={() => envoyer(saisie)}
            disabled={enCours || !saisie.trim()}
            aria-label="Envoyer"
            className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-foreground text-background transition hover:bg-foreground/90 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] text-muted-foreground">
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
        className={`max-w-[85%] rounded-sm px-3.5 py-2.5 ${
          utilisateur
            ? "bg-foreground text-background"
            : "border border-border bg-card"
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
}: {
  texte: string;
  produits: Record<string, ProduitCompact>;
}) {
  const segments = decouperMessage(texte);
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
        const produit = produits[s.id];
        // Le marqueur est ignoré si le produit n'a pas été remonté par la recherche.
        if (!produit) return null;
        return <CarteProduit key={i} produit={produit} />;
      })}
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

function CarteProduit({ produit }: { produit: ProduitCompact }) {
  return (
    <a
      href={produit.lien}
      target="_blank"
      rel="noopener noreferrer"
      className="tap-target group flex gap-3 rounded-sm border border-border bg-background p-2.5 transition hover:border-foreground/40 hover:-translate-y-0.5"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-muted">
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
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {produit.marque}
        </div>
        <div className="truncate text-sm font-medium leading-tight">
          {produit.nom}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-display text-base">{produit.prix_aff} €</span>
          {produit.dispo === "rupture" && (
            <span className="text-[10px] uppercase tracking-widest text-destructive">
              Rupture
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground transition group-hover:text-foreground" />
    </a>
  );
}

function Frappe() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delai) => (
        <span
          key={delai}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delai}ms` }}
        />
      ))}
    </div>
  );
}
