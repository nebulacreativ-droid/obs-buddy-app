/**
 * O'Buddy — widget de chat embarquable.
 *
 * Intégration (une seule ligne, à coller avant </body> ou dans un module HTML) :
 *   <script src="https://obs-obuddy.vercel.app/widget.js" defer></script>
 *
 * Tout est préfixé `obsbuddy-` et posé en position fixed : aucun conflit avec
 * le thème PrestaShop. Le chat lui-même vit dans une iframe, donc totalement
 * isolé du CSS et du JS de la boutique.
 */
(function () {
  "use strict";

  if (window.__obsbuddyCharge) return;
  window.__obsbuddyCharge = true;

  // L'origine est déduite du script lui-même : fonctionne aussi sur les
  // déploiements de preview Vercel sans rien reconfigurer.
  var script = document.currentScript;
  var ORIGINE = "https://obs-obuddy.vercel.app";
  if (script && script.src) {
    try {
      ORIGINE = new URL(script.src).origin;
    } catch (e) {
      /* on garde la valeur par défaut */
    }
  }

  var JAUNE = "#FCF24F";
  var NOIR = "#0F0F0F";
  var Z = 2147483000;

  // Délais avant proposition spontanée. Plus court sur une fiche produit :
  // le visiteur y est déjà en train d'hésiter.
  var DELAI_FICHE_MS = 22000;
  var DELAI_AUTRE_MS = 50000;
  var CLE_INVITE = "obsbuddy-invite-vue";

  var styles =
    "" +
    ".obsbuddy-lanceur{position:fixed;right:20px;bottom:20px;z-index:" + Z + ";" +
    "width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;" +
    "background:" + JAUNE + ";color:" + NOIR + ";display:flex;align-items:center;justify-content:center;" +
    "box-shadow:0 6px 24px rgba(0,0,0,.28);transition:transform .2s ease,box-shadow .2s ease;" +
    "padding:0;margin:0;line-height:0}" +
    ".obsbuddy-lanceur:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,0,0,.34)}" +
    ".obsbuddy-lanceur:focus-visible{outline:3px solid " + NOIR + ";outline-offset:3px}" +
    ".obsbuddy-lanceur svg{width:26px;height:26px;display:block}" +

    ".obsbuddy-pastille{position:absolute;top:-2px;right:-2px;width:14px;height:14px;" +
    "border-radius:50%;background:" + NOIR + ";border:2px solid " + JAUNE + "}" +

    // ── Invitation spontanée ──────────────────────────────────────────────
    ".obsbuddy-invite{position:fixed;right:20px;bottom:92px;z-index:" + Z + ";" +
    "max-width:270px;background:#fff;color:" + NOIR + ";border:2px solid " + NOIR + ";" +
    "border-radius:10px;padding:12px 34px 12px 14px;cursor:pointer;text-align:left;" +
    "box-shadow:6px 6px 0 0 " + JAUNE + ";font:500 13px/1.45 'Montserrat',system-ui,sans-serif;" +
    "opacity:0;transform:translateY(8px);pointer-events:none;" +
    "transition:opacity .25s ease,transform .25s ease}" +
    ".obsbuddy-invite.obsbuddy-visible{opacity:1;transform:none;pointer-events:auto}" +
    ".obsbuddy-invite strong{display:block;font-weight:700;margin-bottom:2px}" +
    ".obsbuddy-invite-produit{display:block;margin-top:6px;font-size:12px;color:#555;" +
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".obsbuddy-invite-fermer{position:absolute;top:6px;right:6px;width:22px;height:22px;" +
    "border:0;background:transparent;color:#888;cursor:pointer;font-size:16px;line-height:1;" +
    "padding:0;border-radius:4px}" +
    ".obsbuddy-invite-fermer:hover{background:#eee;color:" + NOIR + "}" +

    ".obsbuddy-panneau{position:fixed;right:20px;bottom:92px;z-index:" + Z + ";" +
    "width:400px;height:min(620px,calc(100vh - 120px));border:0;border-radius:12px;overflow:hidden;" +
    "background:#fff;box-shadow:0 16px 50px rgba(0,0,0,.3);" +
    "opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;" +
    "transition:opacity .18s ease,transform .18s ease}" +
    ".obsbuddy-panneau.obsbuddy-ouvert{opacity:1;transform:none;pointer-events:auto}" +
    ".obsbuddy-panneau iframe{width:100%;height:100%;border:0;display:block}" +

    "@media (max-width:520px){" +
    ".obsbuddy-panneau{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}" +
    ".obsbuddy-lanceur{right:16px;bottom:16px;width:54px;height:54px}" +
    ".obsbuddy-invite{right:16px;bottom:82px;max-width:calc(100vw - 32px)}" +
    ".obsbuddy-lanceur.obsbuddy-masque{display:none}}" +

    "@media (prefers-reduced-motion:reduce){" +
    ".obsbuddy-invite,.obsbuddy-panneau,.obsbuddy-lanceur{transition:none}}";

  var feuille = document.createElement("style");
  feuille.textContent = styles;
  document.head.appendChild(feuille);

  var ICONE_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4.2-.9L3 20.5l1.6-4.4A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>';

  var ICONE_FERMER =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var lanceur = document.createElement("button");
  lanceur.className = "obsbuddy-lanceur";
  lanceur.type = "button";
  lanceur.setAttribute("aria-label", "Ouvrir O'Buddy, l'assistant barber");
  lanceur.setAttribute("aria-expanded", "false");
  lanceur.innerHTML = ICONE_CHAT + '<span class="obsbuddy-pastille"></span>';

  var panneau = document.createElement("div");
  panneau.className = "obsbuddy-panneau";
  panneau.setAttribute("role", "dialog");
  panneau.setAttribute("aria-label", "O'Buddy — assistant barber");

  var invite = null;
  var ouvert = false;
  var iframeCreee = false;

  function creerIframe() {
    if (iframeCreee) return;
    iframeCreee = true;
    var iframe = document.createElement("iframe");
    iframe.src = ORIGINE + "/chat";
    iframe.title = "O'Buddy — assistant barber O'Barbershop";
    iframe.setAttribute("allow", "clipboard-write");
    panneau.appendChild(iframe);
  }

  function basculer(forcer) {
    ouvert = typeof forcer === "boolean" ? forcer : !ouvert;

    // L'iframe n'est créée qu'à la première ouverture : aucun coût de
    // chargement pour les visiteurs qui n'ouvrent jamais le chat.
    if (ouvert) {
      creerIframe();
      masquerInvite();
    }

    panneau.classList.toggle("obsbuddy-ouvert", ouvert);
    lanceur.classList.toggle("obsbuddy-masque", ouvert);
    lanceur.setAttribute("aria-expanded", String(ouvert));
    lanceur.setAttribute(
      "aria-label",
      ouvert ? "Fermer O'Buddy" : "Ouvrir O'Buddy, l'assistant barber",
    );
    lanceur.innerHTML = ouvert
      ? ICONE_FERMER
      : ICONE_CHAT + '<span class="obsbuddy-pastille"></span>';
  }

  lanceur.addEventListener("click", function () {
    basculer();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (ouvert) basculer(false);
      else masquerInvite();
    }
  });

  function monter() {
    document.body.appendChild(panneau);
    document.body.appendChild(lanceur);
    programmerInvite();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", monter);
  } else {
    monter();
  }

  // ── Contexte de page ───────────────────────────────────────────────────
  // Permet à O'Buddy de savoir ce que le visiteur est en train de regarder,
  // et de répondre sur CE produit plutôt que de repartir de zéro.

  function boutique() {
    return typeof window.prestashop === "object" ? window.prestashop : null;
  }

  /**
   * Premier sélecteur qui donne un texte. L'ordre compte : un `h1` nu est le
   * dernier recours, car ce n'est pas toujours le nom du produit selon le thème.
   */
  function premierTexte(selecteurs) {
    for (var i = 0; i < selecteurs.length; i++) {
      var el = document.querySelector(selecteurs[i]);
      if (el) {
        var texte = (el.getAttribute("content") || el.textContent || "").trim();
        if (texte) return texte.slice(0, 120);
      }
    }
    return "";
  }

  var SELECTEURS_PRODUIT = [
    '[itemprop="name"]',
    'meta[property="og:title"]',
    ".product-detail-name",
    "h1.h1",
    "#main h1",
    "h1",
  ];

  var SELECTEURS_CATEGORIE = ["#js-product-list-header h1", ".block-category h1", "#main h1", "h1"];

  function contextePage() {
    var ps = boutique();
    var page = ps && ps.page ? ps.page : {};
    var contexte = {
      type: String(page.page_name || ""),
      url: location.href,
    };

    if (contexte.type === "product") {
      var champ = document.querySelector(
        '#product_page_product_id, input[name="id_product"]',
      );
      if (champ && champ.value) contexte.idProduit = String(champ.value);
      contexte.titre = premierTexte(SELECTEURS_PRODUIT);
    } else if (contexte.type === "category") {
      contexte.titre = premierTexte(SELECTEURS_CATEGORIE);
    }

    return contexte;
  }

  // ── Invitation spontanée ───────────────────────────────────────────────
  // Une bulle discrète, jamais une ouverture forcée du panneau : proposer
  // sans s'imposer. Une seule fois par session, et plus jamais si le
  // visiteur la ferme ou ouvre le chat de lui-même.

  function invitationDejaVue() {
    try {
      return window.sessionStorage.getItem(CLE_INVITE) === "1";
    } catch (e) {
      return false;
    }
  }

  function marquerInvitationVue() {
    try {
      window.sessionStorage.setItem(CLE_INVITE, "1");
    } catch (e) {
      /* stockage refusé : l'invitation réapparaîtra au prochain chargement */
    }
  }

  function masquerInvite() {
    if (!invite) return;
    invite.classList.remove("obsbuddy-visible");
    marquerInvitationVue();
    window.setTimeout(function () {
      if (invite && invite.parentNode) invite.parentNode.removeChild(invite);
      invite = null;
    }, 260);
  }

  function afficherInvite(contexte) {
    if (ouvert || invite || invitationDejaVue()) return;

    var surFiche = contexte.type === "product";
    var titre = surFiche ? "Une question sur ce produit ?" : "Besoin d'un coup de main ?";
    var corps = surFiche
      ? "Je te dis s'il est fait pour toi."
      : "Routine, matos, commande — demande-moi.";

    invite = document.createElement("div");
    invite.className = "obsbuddy-invite";
    invite.setAttribute("role", "button");
    invite.setAttribute("tabindex", "0");
    invite.setAttribute("aria-label", titre + " Ouvrir O'Buddy.");

    var contenu = "<strong>" + titre + "</strong>" + corps;
    if (surFiche && contexte.titre) {
      contenu +=
        '<span class="obsbuddy-invite-produit">' + echapper(contexte.titre) + "</span>";
    }
    invite.innerHTML =
      contenu +
      '<button class="obsbuddy-invite-fermer" type="button" aria-label="Fermer la proposition">&times;</button>';

    invite.addEventListener("click", function (e) {
      if (e.target && e.target.classList.contains("obsbuddy-invite-fermer")) {
        e.stopPropagation();
        masquerInvite();
        return;
      }
      marquerInvitationVue();
      basculer(true);
    });

    invite.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        marquerInvitationVue();
        basculer(true);
      }
    });

    document.body.appendChild(invite);
    // Force un reflow pour que la transition d'apparition se joue.
    void invite.offsetWidth;
    invite.classList.add("obsbuddy-visible");
  }

  function echapper(texte) {
    var div = document.createElement("div");
    div.textContent = texte;
    return div.innerHTML;
  }

  function programmerInvite() {
    if (invitationDejaVue()) return;

    var contexte = contextePage();
    var delai = contexte.type === "product" ? DELAI_FICHE_MS : DELAI_AUTRE_MS;

    var minuteur = window.setTimeout(function () {
      afficherInvite(contexte);
    }, delai);

    // Intention de sortie : le curseur remonte hors de la fenêtre. Sur mobile
    // l'événement n'existe pas, le délai reste le seul déclencheur.
    var surSortie = function (e) {
      if (e.clientY > 0 || invitationDejaVue()) return;
      document.removeEventListener("mouseout", surSortie);
      window.clearTimeout(minuteur);
      afficherInvite(contexte);
    };
    document.addEventListener("mouseout", surSortie);
  }

  // ── Pont avec le chat ──────────────────────────────────────────────────
  // Le chat vit dans une iframe sur un autre domaine : il n'a ni la session
  // client ni les cookies du panier. Il demande, c'est ce script — qui tourne
  // sur la boutique — qui exécute.

  /** Le panier n'est pilotable que si PrestaShop expose son jeton et son URL. */
  function panierDisponible() {
    var ps = boutique();
    return !!(ps && ps.static_token && ps.urls && ps.urls.pages && ps.urls.pages.cart);
  }

  function repondre(message) {
    var iframe = panneau.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(message, ORIGINE);
    }
  }

  function urlModule(controleur) {
    var ps = boutique();
    var base = ps && ps.urls && ps.urls.base_url ? ps.urls.base_url : "/";
    return base + "index.php?fc=module&module=obsbuddy&controller=" + controleur;
  }

  function ajouterAuPanier(idProduit) {
    var ps = boutique();

    var corps = new URLSearchParams({
      controller: "cart",
      add: "1",
      action: "update",
      ajax: "1",
      id_product: String(idProduit),
      qty: "1",
      token: ps.static_token,
    });

    fetch(ps.urls.pages.cart, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: corps.toString(),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var erreurs = data && data.errors;
        var enEchec =
          (data && data.hasError) ||
          (Array.isArray(erreurs) ? erreurs.length > 0 : !!erreurs);

        if (enEchec) {
          repondre({
            source: "obsbuddy-hote",
            type: "resultat-panier",
            id: idProduit,
            ok: false,
            message: Array.isArray(erreurs) ? erreurs[0] : String(erreurs),
          });
          return;
        }

        // Rafraîchit le compteur de panier du thème.
        if (ps.emit) ps.emit("updateCart", { reason: { linkAction: "add-to-cart" }, resp: data });

        repondre({
          source: "obsbuddy-hote",
          type: "resultat-panier",
          id: idProduit,
          ok: true,
        });
      })
      .catch(function () {
        repondre({
          source: "obsbuddy-hote",
          type: "resultat-panier",
          id: idProduit,
          ok: false,
          message: "Ajout impossible pour le moment.",
        });
      });
  }

  /**
   * Palier de fidélité du client connecté.
   *
   * La requête part de la boutique avec les cookies de session : c'est
   * PrestaShop qui identifie le client, pas nous. Aucune donnée client ne
   * transite par le serveur de l'assistant.
   */
  function lireFidelite() {
    fetch(urlModule("fidelite"), {
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        repondre({
          source: "obsbuddy-hote",
          type: "resultat-fidelite",
          connecte: !!(data && data.connecte),
          prenom: data && data.prenom ? String(data.prenom) : "",
          paliers: data && Array.isArray(data.paliers) ? data.paliers : [],
        });
      })
      .catch(function () {
        repondre({
          source: "obsbuddy-hote",
          type: "resultat-fidelite",
          indisponible: true,
        });
      });
  }

  /** Envoi commun aux demandes pro et aux mises en relation avec un conseiller. */
  function envoyerDemande(donnees, typeReponse) {
    var corps = new URLSearchParams();
    var champs = [
      "sujet",
      "nom",
      "email",
      "telephone",
      "message",
      "rappel",
      "historique",
      "societe",
      "siret",
      "activite",
      "ville",
    ];
    for (var i = 0; i < champs.length; i++) {
      corps.append(champs[i], String(donnees[champs[i]] || ""));
    }

    fetch(urlModule("contactpro"), {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: corps.toString(),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        repondre({
          source: "obsbuddy-hote",
          type: typeReponse,
          ok: !!(data && data.ok),
          message: data && data.erreur ? String(data.erreur) : "",
        });
      })
      .catch(function () {
        repondre({
          source: "obsbuddy-hote",
          type: typeReponse,
          ok: false,
          message: "Envoi impossible pour le moment.",
        });
      });
  }

  window.addEventListener("message", function (e) {
    // Seule l'iframe du chat, sur son origine connue, peut piloter ce pont.
    if (e.origin !== ORIGINE) return;
    var iframe = panneau.querySelector("iframe");
    if (!iframe || e.source !== iframe.contentWindow) return;

    var d = e.data;
    if (!d || d.source !== "obsbuddy-chat") return;

    if (d.type === "pret") {
      repondre({
        source: "obsbuddy-hote",
        type: "bonjour",
        panierDisponible: panierDisponible(),
        page: contextePage(),
      });
      return;
    }

    if (d.type === "ajouter-panier" && d.id && panierDisponible()) {
      ajouterAuPanier(d.id);
      return;
    }

    if (d.type === "demande-fidelite") {
      lireFidelite();
      return;
    }

    if (d.type === "envoyer-demande-pro" && d.donnees) {
      envoyerDemande(d.donnees, "resultat-demande-pro");
      return;
    }

    if (d.type === "envoyer-escalade" && d.donnees) {
      envoyerDemande(d.donnees, "resultat-escalade");
      return;
    }

    if (d.type === "fermer") {
      basculer(false);
    }
  });

  // API minimale pour piloter le widget depuis la boutique
  // (ex: un bouton "Demander à O'Buddy" sur une fiche produit).
  window.OBuddy = {
    ouvrir: function () {
      basculer(true);
    },
    fermer: function () {
      basculer(false);
    },
    basculer: basculer,
  };
})();
