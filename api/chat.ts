// Fonction serverless O'Buddy — proxy OpenAI avec appel d'outils sur le catalogue.
//
// Runtime Node.js (pas Edge) : produits.json pèse 1.2 Mo, au-delà de la limite Edge.
// Pas d'en-têtes CORS : l'API n'est appelable que depuis obs-obuddy.vercel.app,
// ce qui empêche un tiers de consommer les crédits OpenAI du compte.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
// Extensions .js obligatoires : Vercel compile ces fonctions en ESM Node.
import {
  creerMoteur,
  type Produit,
  type SearchParams,
} from "../src/lib/product-search.js";
import { chercherInfo, SITE_URL } from "../src/lib/knowledge-base.js";
import {
  suivreCommande,
  idsNouveautes,
  idsMeilleuresVentes,
  apiConfiguree,
} from "../src/lib/prestashop.js";
import {
  creerCatalogueMarques,
  type Marque,
  type FicheCartographie,
} from "../src/lib/marques-search.js";

// gpt-4.1 complet : meilleure tenue du rôle, du parcours et des marqueurs.
// ~5× le prix de la version mini, soit de l'ordre de 0,008 $ par échange.
// Repasser en mini se fait sans redéploiement via la variable OPENAI_MODEL.
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const MAX_MESSAGES = 30;
const MAX_CHARS = 2000;
const MAX_TOOL_STEPS = 4;
const MAX_TOKENS = 700;

// Catalogue lu sur disque plutôt qu'importé : Node ESM refuse un import JSON
// sans attribut. Le fichier est embarqué via "includeFiles" dans vercel.json.
// Chemin résolu depuis ce module, pas depuis process.cwd() qui varie.
const ICI = dirname(fileURLToPath(import.meta.url));
const CATALOGUE: Produit[] = JSON.parse(
  readFileSync(join(ICI, "..", "src", "data", "produits.json"), "utf8"),
);

const lireJson = <T,>(...segments: string[]): T =>
  JSON.parse(readFileSync(join(ICI, "..", "src", "data", ...segments), "utf8"));

const moteur = creerMoteur(CATALOGUE);
const TAXONOMIE = moteur.taxonomie();

const catalogueMarques = creerCatalogueMarques(
  lireJson<Marque[]>("marques.json"),
  lireJson<FicheCartographie[]>("brands-cartographie.json"),
);

const SYSTEM_PROMPT = `Tu es O'Buddy, l'assistant barber d'O'Barbershop (${SITE_URL}).

RÈGLE N°1 — UNE SEULE QUESTION PAR MESSAGE, AVEC SES PROPOSITIONS
Ton message ne doit contenir qu'un seul point d'interrogation. Un seul.
❌ "Tes cheveux sont comment ? Et tu as une barbe ?"  (deux questions)
❌ "Quel type as-tu (raides, bouclés) ? Et une barbe ?"  (deux questions)

Chaque fois que tu poses une question fermée, termine ton message par les
réponses possibles au format [[C:choix1|choix2|choix3]]. L'interface les
affiche en boutons cliquables : l'utilisateur répond d'un doigt.
2 à 4 propositions, 3 mots maximum chacune.

✅ "Tes cheveux, ils sont plutôt comment ? [[C:Fins|Épais|Bouclés|Crépus]]"
✅ "Quel budget tu vises ? [[C:Moins de 20€|20 à 50€|Plus de 50€]]"
✅ "Tu bosses surtout sur quoi ? [[C:Fades|Coupe ciseaux|Barbe|Un peu de tout]]"

N'en mets pas quand la question est ouverte (ex: "décris-moi ton projet")
ni quand tu ne poses pas de question.
Tu poses ta question, tu t'arrêtes, tu attends la réponse.

TON STYLE
- Tu tutoies, tu es direct, chaleureux, jamais commercial-lourd.
- Réponses COURTES : 2 à 4 phrases. Pas de listes à rallonge, pas de blabla.
- Vocabulaire barber naturel (matos, fade, dégradé, routine), sans en faire trop.
- Tu parles français.
- Texte simple, JAMAIS de markdown : pas de **gras**, pas de listes numérotées,
  pas de liens [texte](url). Écris les URL en clair si besoin.
  Seuls les marqueurs [[P:id]] et [[C:...]] sont autorisés.

CE QUE TU FAIS
1. Tu recommandes des produits du catalogue O'Barbershop.
2. Tu réponds aux questions sur la boutique (livraison, compte pro…).
3. Tu donnes du conseil technique barbier (entretien du matos, gestes, routines).
4. Tu montres les nouveautés et les meilleures ventes (outil produits_en_avant).
5. Tu renseignes sur le statut d'une commande (outil suivi_commande).
6. Tu affiches le palier de fidélité d'un client connecté (marqueur [[FIDELITE]]).

DEVENIR CLIENT PRO
Reste léger : quatre informations suffisent — nom, email, téléphone, et ce
que la personne recherche. Demande-les UNE à la fois, puis propose d'être
rappelé ("Tu veux qu'un conseiller te rappelle ? [[C:Oui, rappelez-moi|Non, par email]]").

Raison sociale, SIRET, activité et ville sont FACULTATIFS : ne les réclame
jamais, propose-les au plus une fois, et n'insiste pas si la personne passe.
Beaucoup de projets ne sont pas encore immatriculés — exiger un SIRET
ferait fuir un futur client.

Appelle preparer_demande_pro dès que tu as les quatre informations de base.
Tu n'envoies jamais la demande toi-même : l'utilisateur valide le
récapitulatif affiché par l'interface.

PARLER À UN CONSEILLER
Quand tu ne peux pas répondre — information que tu n'as pas, litige, demande
technique pointue, réclamation — ou quand la personne demande explicitement un
humain, propose la mise en relation : une phrase courte, puis le marqueur
[[CONSEILLER]]. L'interface recueille son email et transmet l'échange à
l'équipe. Ne promets jamais de délai de réponse.
Ne le propose pas à la première difficulté : tente d'abord de répondre.

PALIER DE FIDÉLITÉ
Quand on te demande son palier, ses points ou son statut fidélité, réponds
une phrase courte puis écris le marqueur [[FIDELITE]]. L'interface interroge
la boutique avec la session du client : tu n'as ni à demander l'email, ni à
connaître le résultat, ni à l'inventer. Si la personne n'est pas connectée,
l'interface le lui dira elle-même.

SUIVI DE COMMANDE — RÈGLE DE CONFIDENTIALITÉ
Tu ne consultes JAMAIS une commande sans avoir à la fois sa référence ET
l'email du compte. S'il ne t'a donné qu'un des deux, demande l'autre, une
question à la fois. N'invente jamais un statut ni une date de livraison.
Si rien ne correspond, ne dis pas lequel des deux éléments est faux : tu ne
sais pas à qui tu parles, et le dire renseignerait un curieux.

RÈGLES ABSOLUES
- Pour recommander un produit, tu DOIS d'abord appeler rechercher_produits.
  N'invente JAMAIS un nom de produit, un prix, une marque ou un lien.
- Si une recherche ne renvoie rien, NE T'ARRÊTE PAS LÀ : relance-en une plus
  large (enlève le filtre de prix, élargis le type, simplifie les mots-clés)
  avant de conclure. Ce n'est qu'après plusieurs tentatives infructueuses que
  tu dis franchement que tu n'as pas trouvé. N'invente jamais un produit.
- Ne demande pas la permission de chercher ("tu veux que je te propose… ?") :
  cherche et propose directement.
- Pour toute question boutique, appelle infos_boutique. Si l'info n'est pas
  disponible, dis que tu n'as pas l'info précise et renvoie vers le service
  client sur ${SITE_URL}. N'invente jamais un délai, un tarif ou une procédure.
- Tu ne promets jamais une disponibilité ou un délai de livraison précis.
- Le conseil technique pur (sans produit) ne nécessite pas d'outil.

CITER UN PRODUIT
Quand tu recommandes un produit, écris son nom puis immédiatement son
marqueur [[P:id]] — l'interface affichera une carte cliquable.
Exemple : "La Cire Coiffante Mate de Sapiens [[P:12345]] fait le job."
Maximum 3 produits par réponse. Toujours dire POURQUOI ce produit.

MÉTHODE — RÈGLE LA PLUS IMPORTANTE
UNE SEULE question par message. Jamais deux. Jamais une phrase qui empile
plusieurs questions ("quel type de cheveux, tu as une barbe, et quel budget ?"
est INTERDIT). Tu poses la question la plus utile, tu attends la réponse,
puis tu enchaînes. C'est une conversation, pas un formulaire.
Si l'utilisateur donne déjà assez d'infos, ne pose aucune question : cherche
et recommande directement.

LES PARCOURS
La plupart des gens arrivent avec l'un de ces projets. Mène la conversation
une question à la fois, puis recommande. Ne déroule JAMAIS un questionnaire
complet : 3 à 4 échanges maximum avant de proposer quelque chose de concret.
Commence toujours par la dimension la plus discriminante du parcours (celle
citée en premier ci-dessous), et garde le reste pour les tours suivants.

1. RECOMMANDATION PRODUIT
   Ce parcours couvre aussi bien le particulier que le barbier professionnel.
   Ta PREMIÈRE question sert à trancher :
   "C'est pour toi ou pour ton activité de barbier ? [[C:Pour moi|Pour mon activité]]"

   a) Usage personnel — à cerner : cheveux (type, épaisseur), barbe, peau,
      style visé, temps qu'il veut y consacrer le matin, budget.
      ⚠️ Une "routine" n'existe PAS comme produit du catalogue. Tu la composes
      toi-même : une recherche par besoin (shampoing, puis huile ou baume à
      barbe, puis coiffant), puis tu présentes l'ensemble comme un rituel
      cohérent. Ne cherche jamais le mot "routine".

   b) Usage professionnel — à cerner : quel type de matos, usage principal
      (fade, dégradé, coupe ciseaux, finitions), volume d'utilisation
      quotidien, budget par outil.

      VOCABULAIRE MATÉRIEL PRO — à respecter strictement
      Le matériel d'un barbershop est d'abord du matériel de COUPE :
        · tondeuse de coupe, tondeuse de finition, têtes et lames
        · ciseaux (coupe, sculpteur), peignes
        · rasoir électrique, shavette, rasoir de sûreté
        · sèche-cheveux, brosses, capes et serviettes
        · mobilier et équipement de salon

      ❌ Ne parle JAMAIS de "matos barbe" ni de "matériel barbe" : ça n'existe
      pas au catalogue et très peu de salons s'équipent spécifiquement pour la
      barbe. Côté professionnel, la barbe relève du consommable de service et
      de la REVENTE (huiles, baumes, shampoings barbe), pas de l'équipement.

      Quand tu proposes un choix, reste dans ce vocabulaire. Par exemple :
      "Tu cherches quoi en priorité ? [[C:Tondeuses|Ciseaux|Rasage|Produits revente]]"

2. AUTRE QUESTION
   Tout ce qui ne rentre pas ailleurs : conseil technique barbier, question
   sur la boutique, curiosité sur une marque. Écoute d'abord, puis oriente
   vers l'outil adapté. Ne force jamais une recommandation produit si la
   personne cherche juste un conseil.

3. J'OUVRE MON BARBERSHOP
   À cerner : ambiance voulue, nombre de postes de coupe, clientèle cible,
   positionnement prix. Couvre ensuite matériel, mobilier et mur de revente.

   Le mur de revente est un moment clé : une fois le style et le positionnement
   connus, appelle proposer_marques et termine ton message par [[MARQUES]].
   L'utilisateur coche les marques qu'il veut en rayon, et tu enchaînes sur les
   produits de ces marques.

   Termine toujours un projet d'ouverture en proposant un rendez-vous avec un
   conseiller O'Barbershop : écris une phrase d'invitation puis le marqueur
   [[RDV]], qui affiche le module de prise de rendez-vous.

CATALOGUE — valeurs de filtres autorisées (n'en invente aucune autre)
super_cat : ${TAXONOMIE.super_cat.join(", ")}
segment : ${TAXONOMIE.segment.join(", ")}
styles : ${TAXONOMIE.styles.join(", ")}
type : ${TAXONOMIE.type.join(", ")}
marques : ${TAXONOMIE.marque.join(", ")}`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "rechercher_produits",
      description:
        "Cherche dans le catalogue O'Barbershop. À appeler avant toute recommandation produit.",
      parameters: {
        type: "object",
        properties: {
          texte: {
            type: "string",
            description:
              "Mots-clés libres (ex: 'cire mate', 'rasoir droit'). Tous les mots doivent correspondre : reste court et générique.",
          },
          type: {
            type: "array",
            items: { type: "string", enum: TAXONOMIE.type },
            description: "Type(s) de produit.",
          },
          super_cat: {
            type: "array",
            items: { type: "string", enum: TAXONOMIE.super_cat },
            description: "Grande famille de produit.",
          },
          marque: { type: "array", items: { type: "string", enum: TAXONOMIE.marque } },
          segment: {
            type: "array",
            items: { type: "string", enum: TAXONOMIE.segment },
            description: "Gamme de prix : entrée, milieu ou premium.",
          },
          styles: { type: "array", items: { type: "string", enum: TAXONOMIE.styles } },
          prix_min: { type: "number" },
          prix_max: { type: "number" },
          tri: {
            type: "string",
            enum: ["pertinence", "prix_croissant", "prix_decroissant"],
          },
          limite: { type: "number", description: "Nombre de résultats (défaut 8, max 12)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "produits_en_avant",
      description:
        "Renvoie les nouveautés de la boutique ou ses meilleures ventes du moment. À utiliser quand on demande ce qui est nouveau, ce qui marche le mieux, ce qui est populaire, ou pour illustrer une tendance.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["nouveautes", "meilleures_ventes"],
          },
          super_cat: {
            type: "array",
            items: { type: "string", enum: TAXONOMIE.super_cat },
            description: "Restreint à une famille de produits (facultatif).",
          },
          limite: { type: "number", description: "Nombre de résultats (défaut 6)." },
        },
        required: ["type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposer_marques",
      description:
        "Propose des marques à mettre en rayon pour un barbershop en création. À utiliser dans le parcours ouverture de shop, une fois le style et le positionnement connus. L'interface affiche une sélection multiple : l'utilisateur coche celles qu'il retient.",
      parameters: {
        type: "object",
        properties: {
          styles: {
            type: "array",
            items: { type: "string", enum: TAXONOMIE.styles },
            description: "Styles du shop, pour aligner les marques.",
          },
          segment: {
            type: "array",
            items: { type: "string", enum: TAXONOMIE.segment },
            description: "Positionnement prix visé.",
          },
          seulementBestSellers: {
            type: "boolean",
            description: "Ne garder que les marques qui se vendent le mieux.",
          },
          madeInFrance: { type: "boolean" },
          limite: { type: "number", description: "Nombre de marques (défaut 12)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preparer_demande_pro",
      description:
        "Prépare une demande de contact professionnel. Seuls le nom, l'email, le téléphone et un message sont nécessaires. L'interface affiche un récapitulatif que l'utilisateur valide lui-même : cet outil n'envoie rien.",
      parameters: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom et prénom du contact." },
          email: { type: "string" },
          telephone: { type: "string" },
          message: {
            type: "string",
            description: "Ce que la personne recherche, en clair.",
          },
          rappel: {
            type: "boolean",
            description: "La personne souhaite être rappelée par téléphone.",
          },
          societe: { type: "string", description: "Raison sociale (facultatif)." },
          siret: { type: "string", description: "SIRET à 14 chiffres (facultatif)." },
          activite: {
            type: "string",
            description: "Barbershop, salon, institut… (facultatif)",
          },
          ville: { type: "string", description: "Facultatif." },
        },
        required: ["nom", "email", "telephone", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suivi_commande",
      description:
        "Donne le statut d'une commande. Exige IMPÉRATIVEMENT la référence de commande ET l'email utilisé lors de l'achat. N'appelle cet outil que lorsque tu as les deux : sans quoi, demande d'abord ce qui manque.",
      parameters: {
        type: "object",
        properties: {
          reference: {
            type: "string",
            description: "Référence de la commande (ex: XKBKNABJK).",
          },
          email: {
            type: "string",
            description: "Email du compte ayant passé la commande.",
          },
        },
        required: ["reference", "email"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "infos_boutique",
      description:
        "Renvoie les infos officielles de la boutique (livraison, compte pro, retours, contact…). À appeler pour toute question sur le fonctionnement de la boutique.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "La question de l'utilisateur, en clair.",
          },
        },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
];

async function executerOutil(nom: string, args: Record<string, unknown>) {
  if (nom === "produits_en_avant") {
    const type = String(args.type ?? "");
    const limite = Math.min(Number(args.limite) || 6, 10);
    const familles = Array.isArray(args.super_cat) ? (args.super_cat as string[]) : [];

    const ids =
      type === "meilleures_ventes"
        ? await idsMeilleuresVentes(40)
        : await idsNouveautes(40);

    if (!ids) {
      return {
        pourLeModele: {
          disponible: false,
          consigne: apiConfiguree()
            ? "La boutique ne répond pas pour l'instant. Dis-le simplement et propose de chercher autrement."
            : "Cette information n'est pas accessible. Propose de chercher par type de produit à la place.",
        },
        pourLInterface: null,
      };
    }

    // Les identifiants viennent de la boutique, les fiches du catalogue local :
    // on garde un affichage homogène et on écarte ce qui n'est plus vendable.
    const produits = ids
      .map((id) => moteur.parId(id))
      .filter((p): p is NonNullable<typeof p> => !!p && p.dispo !== "rupture")
      .filter((p) => !familles.length || familles.includes(p.super_cat))
      .slice(0, limite);

    return {
      pourLeModele: {
        disponible: true,
        type,
        nombre: produits.length,
        produits: produits.map((p) => ({
          id: p.id,
          nom: p.nom,
          marque: p.marque,
          prix: p.prix_aff,
          categorie: p.categorie,
        })),
      },
      pourLInterface: produits,
    };
  }

  if (nom === "proposer_marques") {
    const marques = catalogueMarques.proposer({
      styles: Array.isArray(args.styles) ? (args.styles as string[]) : undefined,
      segment: Array.isArray(args.segment) ? (args.segment as string[]) : undefined,
      seulementBestSellers: args.seulementBestSellers === true,
      madeInFrance: args.madeInFrance === true,
      limite: Number(args.limite) || 12,
    });

    return {
      pourLeModele: {
        nombre: marques.length,
        consigne:
          "Présente-les en une phrase, puis termine ton message par le marqueur [[MARQUES]] " +
          "pour que l'utilisateur puisse cocher celles qu'il retient. Ne liste pas les marques " +
          "une par une dans le texte.",
        marques: marques.map((m) => ({
          nom: m.nom,
          pays: m.pays,
          segment: m.segment,
          bestSeller: m.bestSeller,
        })),
      },
      pourLInterface: null,
      marques,
    };
  }

  if (nom === "preparer_demande_pro") {
    const texte = (cle: string, max = 200) =>
      String(args[cle] ?? "").trim().slice(0, max);

    const demande = {
      nom: texte("nom"),
      email: texte("email"),
      telephone: texte("telephone", 40),
      message: texte("message", 1500),
      rappel: args.rappel === true ? "oui" : "",
      societe: texte("societe"),
      siret: texte("siret", 40).replace(/\s+/g, ""),
      activite: texte("activite"),
      ville: texte("ville"),
    };

    // On valide ici ce que la boutique revalidera : autant le dire au modèle
    // tout de suite plutôt que de faire échouer l'envoi après coup.
    // Société et SIRET restent facultatifs — un projet en cours de création
    // n'a pas encore d'immatriculation.
    const manques: string[] = [];
    if (!demande.nom) manques.push("le nom du contact");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demande.email)) manques.push("un email valide");
    if (demande.telephone.replace(/\D/g, "").length < 9) manques.push("un téléphone");
    if (!demande.message) manques.push("ce qu'il recherche");
    if (demande.siret && !/^\d{14}$/.test(demande.siret)) {
      manques.push("un SIRET à 14 chiffres (ou laisse-le de côté)");
    }

    if (manques.length) {
      return {
        pourLeModele: {
          pret: false,
          consigne: `Il manque ${manques.join(", ")}. Demande l'élément manquant, un seul à la fois.`,
        },
        pourLInterface: null,
      };
    }

    return {
      pourLeModele: {
        pret: true,
        consigne:
          "Dis en une phrase que le récapitulatif est prêt, puis termine par le " +
          "marqueur [[PRO]]. Ne réécris pas les informations : l'interface les affiche " +
          "et c'est l'utilisateur qui valide l'envoi.",
      },
      pourLInterface: null,
      demandePro: demande,
    };
  }

  if (nom === "suivi_commande") {
    const reference = String(args.reference ?? "");
    const email = String(args.email ?? "");

    if (!reference.trim() || !email.trim()) {
      return {
        pourLeModele: {
          consigne:
            "Il manque la référence ou l'email. Demande l'information manquante, sans jamais deviner.",
        },
        pourLInterface: null,
      };
    }

    const suivi = await suivreCommande(reference, email);

    if (suivi.etat === "indisponible") {
      return {
        pourLeModele: {
          consigne:
            "Le suivi des commandes est momentanément inaccessible. Invite à contacter le service client.",
        },
        pourLInterface: null,
      };
    }

    if (suivi.etat === "introuvable") {
      return {
        pourLeModele: {
          trouvee: false,
          consigne:
            "Aucune commande ne correspond à ce couple référence + email. Dis-le sans préciser lequel des deux est en cause, et invite à vérifier les deux ou à contacter le service client.",
        },
        pourLInterface: null,
      };
    }

    return { pourLeModele: { trouvee: true, ...suivi }, pourLInterface: null };
  }

  if (nom === "rechercher_produits") {
    // Les ventes réelles pondèrent le classement : à pertinence comparable,
    // ce qui part le mieux en boutique remonte. Le résultat est mis en cache
    // 30 min côté client PrestaShop, l'appel est donc quasi gratuit.
    const ventes = await idsMeilleuresVentes(60);
    if (ventes) moteur.definirMeilleuresVentes(ventes);

    const produits = moteur.rechercher(args as SearchParams);
    return {
      pourLeModele: {
        nombre: produits.length,
        produits: produits.map((p) => ({
          id: p.id,
          nom: p.nom,
          marque: p.marque,
          prix: p.prix_aff,
          categorie: p.categorie,
          segment: p.segment,
          dispo: p.dispo,
          argument: p.argument,
        })),
      },
      pourLInterface: produits,
    };
  }

  if (nom === "infos_boutique") {
    const question = String(args.question ?? "");
    const fiches = chercherInfo(question);
    const fiables = fiches.filter((f) => f.verifie && f.reponse);

    if (!fiables.length) {
      return {
        pourLeModele: {
          info_disponible: false,
          consigne:
            "Aucune information vérifiée sur ce sujet. Dis que tu n'as pas l'info précise " +
            `et invite à contacter le service client via ${SITE_URL}. N'invente rien.`,
        },
        pourLInterface: null,
      };
    }

    return {
      pourLeModele: {
        info_disponible: true,
        reponses: fiables.map((f) => ({ sujet: f.sujet, reponse: f.reponse })),
      },
      pourLInterface: null,
    };
  }

  return { pourLeModele: { erreur: `Outil inconnu: ${nom}` }, pourLInterface: null };
}

type MessageEntrant = { role: "user" | "assistant"; content: string };

type ContexteEntrant = {
  type?: string;
  url?: string;
  titre?: string;
  idProduit?: string;
};

/**
 * Traduit la page consultée en note pour le modèle. Sur une fiche produit,
 * la fiche est résolue depuis le catalogue local : le modèle dispose du nom,
 * du prix et de l'identifiant sans avoir à lancer une recherche.
 */
function resoudreContexte(ctx: ContexteEntrant | null): {
  note: string | null;
  produit: ReturnType<typeof moteur.parId>;
} {
  const rien = { note: null, produit: null };
  if (!ctx?.type) return rien;

  if (ctx.type === "product" && ctx.idProduit) {
    const p = moteur.parId(ctx.idProduit);
    if (p) {
      return {
        produit: p,
        note:
          `CONTEXTE — Le client consulte en ce moment la fiche de "${p.nom}" ` +
          `(${p.marque}, ${p.prix_aff} €, ${p.categorie}, identifiant ${p.id}). ` +
          "S'il pose une question sans préciser de quoi il parle, c'est de ce " +
          `produit. Tu peux le citer directement avec [[P:${p.id}]] sans relancer ` +
          "de recherche. Ne le mentionne pas spontanément s'il te parle d'autre chose.",
      };
    }
    // Produit hors catalogue local : on transmet au moins son intitulé.
    if (ctx.titre) {
      return { note: `CONTEXTE — Le client consulte la fiche produit "${ctx.titre}".`, produit: null };
    }
  }

  if (ctx.type === "category" && ctx.titre) {
    return { note: `CONTEXTE — Le client navigue dans le rayon "${ctx.titre}".`, produit: null };
  }

  if (ctx.type === "cart") {
    return {
      note: "CONTEXTE — Le client est sur sa page panier, probablement en fin de parcours.",
      produit: null,
    };
  }

  if (ctx.type === "order" || ctx.type === "order-confirmation") {
    return { note: "CONTEXTE — Le client est dans le tunnel de commande.", produit: null };
  }

  return rien;
}

function validerRequete(
  body: unknown,
): { messages: MessageEntrant[]; contexte: ContexteEntrant | null } | { erreur: string } {
  if (!body || typeof body !== "object") return { erreur: "Corps de requête invalide." };
  const { messages, contexte } = body as { messages?: unknown; contexte?: unknown };

  if (!Array.isArray(messages) || messages.length === 0) {
    return { erreur: "Aucun message fourni." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { erreur: "Conversation trop longue. Relance une nouvelle discussion." };
  }

  const propres: MessageEntrant[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") return { erreur: "Message invalide." };
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return { erreur: "Rôle invalide." };
    if (typeof content !== "string") return { erreur: "Contenu invalide." };
    propres.push({ role, content: content.slice(0, MAX_CHARS) });
  }

  // Le contexte vient du widget : on ne garde que des chaînes courtes et
  // typées, jamais l'objet brut.
  let contextePropre: ContexteEntrant | null = null;
  if (contexte && typeof contexte === "object") {
    const c = contexte as Record<string, unknown>;
    const texte = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined;
    contextePropre = {
      type: texte(c.type),
      url: texte(c.url),
      titre: texte(c.titre),
      idProduit: texte(c.idProduit),
    };
  }

  return { messages: propres, contexte: contextePropre };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée." });
    return;
  }

  const cle = process.env.OPENAI_API_KEY;
  if (!cle) {
    res.status(500).json({ erreur: "OPENAI_API_KEY absente de la configuration serveur." });
    return;
  }

  const validation = validerRequete(req.body);
  if ("erreur" in validation) {
    res.status(400).json({ erreur: validation.erreur });
    return;
  }

  const client = new OpenAI({ apiKey: cle });

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const envoyer = (donnees: unknown) => {
    res.write(`data: ${JSON.stringify(donnees)}\n\n`);
  };

  // Le modèle peut citer la fiche consultée sans lancer de recherche : sans
  // cet envoi, l'interface n'aurait pas les données et masquerait la carte.
  if (produitConsulte) {
    envoyer({ t: "produits", d: [produitConsulte] });
  }

  const { note, produit: produitConsulte } = resoudreContexte(validation.contexte);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(note ? [{ role: "system" as const, content: note }] : []),
    ...validation.messages,
  ];

  try {
    for (let etape = 0; etape < MAX_TOOL_STEPS; etape++) {
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS,
        max_tokens: MAX_TOKENS,
        temperature: 0.6,
        stream: true,
      });

      let texte = "";
      const appels: Array<{ id: string; nom: string; args: string }> = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          texte += delta.content;
          envoyer({ t: "text", d: delta.content });
        }

        // Les appels d'outils arrivent en fragments qu'il faut recoller par index.
        for (const tc of delta.tool_calls ?? []) {
          const i = tc.index;
          appels[i] ??= { id: "", nom: "", args: "" };
          if (tc.id) appels[i].id = tc.id;
          if (tc.function?.name) appels[i].nom += tc.function.name;
          if (tc.function?.arguments) appels[i].args += tc.function.arguments;
        }
      }

      const valides = appels.filter((a) => a && a.id && a.nom);
      if (valides.length === 0) break;

      messages.push({
        role: "assistant",
        content: texte || null,
        tool_calls: valides.map((a) => ({
          id: a.id,
          type: "function" as const,
          function: { name: a.nom, arguments: a.args || "{}" },
        })),
      });

      for (const appel of valides) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(appel.args || "{}");
        } catch {
          args = {};
        }

        const resultat = await executerOutil(appel.nom, args);

        if (resultat.pourLInterface?.length) {
          envoyer({ t: "produits", d: resultat.pourLInterface });
        }

        // Les marques ne transitent que vers l'interface : le modèle n'en reçoit
        // qu'un résumé, c'est l'utilisateur qui coche dans le sélecteur.
        const extra = resultat as {
          marques?: unknown[];
          demandePro?: Record<string, string>;
        };
        if (extra.marques?.length) {
          envoyer({ t: "marques", d: extra.marques });
        }
        if (extra.demandePro) {
          envoyer({ t: "demande_pro", d: extra.demandePro });
        }

        messages.push({
          role: "tool",
          tool_call_id: appel.id,
          content: JSON.stringify(resultat.pourLeModele),
        });
      }
    }

    envoyer({ t: "done" });
  } catch (err) {
    console.error("[api/chat]", err);
    envoyer({
      t: "error",
      m: "Petit souci technique de mon côté. Réessaie dans un instant.",
    });
  } finally {
    res.end();
  }
}
