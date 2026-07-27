// Client de l'API Webservice PrestaShop — SERVEUR UNIQUEMENT.
//
// La clé ne doit jamais atteindre le navigateur : ce module n'est importé que
// par la fonction serverless. Accès en lecture seule.

const BASE = (process.env.PRESTASHOP_URL || "https://www.obarbershop.com").replace(/\/+$/, "");

// Tolère les deux noms : la variable a d'abord été créée sous "Prestashop".
const CLE = process.env.PRESTASHOP_API_KEY || process.env.Prestashop || "";

const DELAI_MS = 8000;

export const apiConfiguree = () => CLE.length > 0;

async function appeler<T>(chemin: string, params: Record<string, string>): Promise<T | null> {
  if (!apiConfiguree()) return null;

  const url = new URL(`${BASE}/api/${chemin}`);
  url.searchParams.set("output_format", "JSON");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  try {
    const r = await fetch(url, {
      headers: {
        // Webservice PrestaShop : clé en identifiant, mot de passe vide.
        Authorization: "Basic " + Buffer.from(`${CLE}:`).toString("base64"),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(DELAI_MS),
    });

    // 404 = aucune ressource ne correspond au filtre : cas normal, pas une panne.
    if (r.status === 404) return null;
    if (!r.ok) {
      console.error(`[prestashop] ${chemin} → HTTP ${r.status}`);
      return null;
    }

    const texte = await r.text();
    if (!texte.trim()) return null;
    return JSON.parse(texte) as T;
  } catch (err) {
    console.error(`[prestashop] ${chemin} injoignable`, err);
    return null;
  }
}

/** Les champs multilingues arrivent en tableau [{id, value}] selon la config. */
function valeurTexte(champ: unknown): string {
  if (typeof champ === "string") return champ;
  if (Array.isArray(champ) && champ.length) {
    const premier = champ[0] as { value?: string };
    return typeof premier?.value === "string" ? premier.value : "";
  }
  return "";
}

// ── Suivi de commande ──────────────────────────────────────────────────────

export type ResultatSuivi =
  | {
      etat: "trouvee";
      reference: string;
      statut: string;
      date: string;
      total: string;
      numeroSuivi?: string;
    }
  | { etat: "introuvable" }
  | { etat: "indisponible" };

/**
 * Vérifie une commande à partir de sa référence ET de l'email du client.
 *
 * Sécurité : les deux doivent correspondre. En cas d'échec on renvoie
 * toujours "introuvable", que la référence n'existe pas ou que l'email ne
 * corresponde pas — sinon la réponse dirait à un inconnu quelles références
 * sont valides, et il suffirait d'en essayer pour cartographier les commandes.
 */
export async function suivreCommande(
  reference: string,
  email: string,
): Promise<ResultatSuivi> {
  if (!apiConfiguree()) return { etat: "indisponible" };

  const ref = reference.trim().toUpperCase();
  const mail = email.trim().toLowerCase();
  if (!ref || !mail) return { etat: "introuvable" };

  const rep = await appeler<{ orders?: Array<Record<string, unknown>> }>("orders", {
    "filter[reference]": `[${ref}]`,
    display: "full",
    limit: "1",
  });

  const commande = rep?.orders?.[0];
  if (!commande) return { etat: "introuvable" };

  // Contrôle d'identité : l'email du compte doit correspondre.
  const idClient = String(commande.id_customer ?? "");
  if (!idClient) return { etat: "introuvable" };

  const repClient = await appeler<{ customer?: { email?: string } }>(
    `customers/${encodeURIComponent(idClient)}`,
    {},
  );
  const emailClient = (repClient?.customer?.email ?? "").trim().toLowerCase();
  if (!emailClient || emailClient !== mail) return { etat: "introuvable" };

  // Libellé du statut courant.
  const idStatut = String(commande.current_state ?? "");
  let statut = "En cours de traitement";
  if (idStatut) {
    const repStatut = await appeler<{ order_state?: { name?: unknown } }>(
      `order_states/${encodeURIComponent(idStatut)}`,
      {},
    );
    const libelle = valeurTexte(repStatut?.order_state?.name);
    if (libelle) statut = libelle;
  }

  const suivi = String(commande.shipping_number ?? "").trim();

  return {
    etat: "trouvee",
    reference: String(commande.reference ?? ref),
    statut,
    date: String(commande.date_add ?? "").slice(0, 10),
    total: String(commande.total_paid ?? ""),
    numeroSuivi: suivi || undefined,
  };
}

// ── Nouveautés et meilleures ventes ────────────────────────────────────────

type Cache<T> = { valeur: T; expire: number };
const DUREE_CACHE_MS = 30 * 60 * 1000;

let cacheNouveautes: Cache<string[]> | null = null;
let cacheVentes: Cache<string[]> | null = null;

const valide = <T,>(c: Cache<T> | null) => (c && c.expire > Date.now() ? c.valeur : null);

/** Identifiants produits les plus récemment ajoutés à la boutique. */
export async function idsNouveautes(limite = 20): Promise<string[] | null> {
  const enCache = valide(cacheNouveautes);
  if (enCache) return enCache.slice(0, limite);

  const rep = await appeler<{ products?: Array<{ id: number | string }> }>("products", {
    "filter[active]": "[1]",
    sort: "[date_add_DESC]",
    limit: "40",
    display: "[id]",
  });
  if (!rep?.products) return null;

  const ids = rep.products.map((p) => String(p.id));
  cacheNouveautes = { valeur: ids, expire: Date.now() + DUREE_CACHE_MS };
  return ids.slice(0, limite);
}

/**
 * Meilleures ventes calculées depuis les lignes de commande récentes.
 * PrestaShop n'expose pas de ressource "best sellers" : on agrège nous-mêmes
 * les 600 dernières lignes vendues, ce qui reflète les ventes réelles.
 */
export async function idsMeilleuresVentes(limite = 20): Promise<string[] | null> {
  const enCache = valide(cacheVentes);
  if (enCache) return enCache.slice(0, limite);

  const rep = await appeler<{
    order_details?: Array<{ product_id: number | string; product_quantity: number | string }>;
  }>("order_details", {
    sort: "[id_DESC]",
    limit: "600",
    display: "[product_id,product_quantity]",
  });
  if (!rep?.order_details) return null;

  const totaux = new Map<string, number>();
  for (const ligne of rep.order_details) {
    const id = String(ligne.product_id);
    const qte = Number(ligne.product_quantity) || 1;
    totaux.set(id, (totaux.get(id) ?? 0) + qte);
  }

  const ids = [...totaux.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  cacheVentes = { valeur: ids, expire: Date.now() + DUREE_CACHE_MS };
  return ids.slice(0, limite);
}
