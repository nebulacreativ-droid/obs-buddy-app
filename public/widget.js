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

  // Délais avant proposition spontanée. Bien plus court sur une fiche produit :
  // le visiteur y hésite déjà, l'attendre au clic fait perdre la vente.
  var DELAI_FICHE_MS = 12000;
  var DELAI_AUTRE_MS = 50000;
  var CLE_INVITE = "obsbuddy-invite-vue";

  // Les trois questions qui reviennent devant une fiche produit.
  var QUESTIONS_PRODUIT = [
    "C'est fait pour moi ?",
    "Comment je l'utilise ?",
    "Tu as une alternative ?",
  ];

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

    // ── Questions posées d'emblée sur une fiche produit ───────────────────
    ".obsbuddy-questions{position:fixed;right:20px;bottom:92px;z-index:" + Z + ";" +
    "display:flex;flex-direction:column;align-items:flex-end;gap:7px;max-width:300px;" +
    "opacity:0;transform:translateY(8px);pointer-events:none;" +
    "transition:opacity .25s ease,transform .25s ease}" +
    ".obsbuddy-questions.obsbuddy-visible{opacity:1;transform:none;pointer-events:auto}" +

    ".obsbuddy-q-entete{position:relative;background:" + NOIR + ";color:" + JAUNE + ";" +
    "border-radius:10px 10px 4px 10px;padding:10px 34px 10px 13px;max-width:100%;" +
    "font:700 12.5px/1.4 'Montserrat',system-ui,sans-serif;text-align:left;" +
    "box-shadow:0 6px 20px rgba(0,0,0,.22)}" +
    ".obsbuddy-q-produit{display:block;margin-top:3px;font-weight:500;font-size:11.5px;" +
    "color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".obsbuddy-q-fermer{position:absolute;top:5px;right:5px;width:22px;height:22px;" +
    "border:0;background:transparent;color:rgba(255,255,255,.55);cursor:pointer;" +
    "font-size:16px;line-height:1;padding:0;border-radius:4px}" +
    ".obsbuddy-q-fermer:hover{background:rgba(255,255,255,.15);color:#fff}" +

    ".obsbuddy-q{background:#fff;color:" + NOIR + ";border:2px solid " + NOIR + ";" +
    "border-radius:10px;padding:8px 12px;cursor:pointer;text-align:right;" +
    "font:500 13px/1.3 'Montserrat',system-ui,sans-serif;" +
    "box-shadow:3px 3px 0 0 " + JAUNE + ";" +
    "transition:background .15s ease,color .15s ease,transform .15s ease}" +
    ".obsbuddy-q:hover{background:" + NOIR + ";color:" + JAUNE + ";transform:translateX(-2px)}" +
    ".obsbuddy-q:focus-visible{outline:3px solid " + JAUNE + ";outline-offset:2px}" +

    // Panneau latéral ancré au bord droit, pleine hauteur : le visiteur garde
    // la boutique à l'œil pendant qu'il discute. Il glisse depuis la droite
    // plutôt que d'apparaître, ce qui rend l'ouverture lisible.
    ".obsbuddy-panneau{position:fixed;right:0;top:0;bottom:0;z-index:" + Z + ";" +
    "width:min(420px,100vw);height:100dvh;border:0;overflow:hidden;" +
    "border-radius:16px 0 0 16px;background:#fff;" +
    "box-shadow:-14px 0 44px rgba(0,0,0,.24);" +
    "opacity:0;transform:translateX(100%);pointer-events:none;" +
    "transition:opacity .22s ease,transform .28s cubic-bezier(.22,.7,.24,1)}" +
    ".obsbuddy-panneau.obsbuddy-ouvert{opacity:1;transform:none;pointer-events:auto}" +
    ".obsbuddy-panneau iframe{width:100%;height:100%;border:0;display:block}" +

    // Le panneau recouvre l'angle du lanceur : on le retire à l'ouverture,
    // la fermeture se fait depuis l'en-tête du chat.
    ".obsbuddy-lanceur.obsbuddy-masque{display:none}" +

    "@media (max-width:520px){" +
    ".obsbuddy-panneau{width:100vw;border-radius:0}" +
    ".obsbuddy-lanceur{right:16px;bottom:16px;width:54px;height:54px}" +
    ".obsbuddy-invite{right:16px;bottom:82px;max-width:calc(100vw - 32px)}" +
    ".obsbuddy-questions{right:16px;bottom:82px;max-width:calc(100vw - 32px)}}" +

    "@media (prefers-reduced-motion:reduce){" +
    ".obsbuddy-invite,.obsbuddy-questions,.obsbuddy-panneau,.obsbuddy-lanceur," +
    ".obsbuddy-q{transition:none}}";

  var feuille = document.createElement("style");
  feuille.textContent = styles;
  document.head.appendChild(feuille);

  // Une étoile plutôt qu'une bulle de dialogue : O'Buddy conseille et compose
  // une sélection, il ne se contente pas de répondre. L'icône doit le dire.
  var ICONE_ETOILE =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M12 1.6c.3 0 .6.2.7.5l1.7 5a4 4 0 0 0 2.5 2.5l5 1.7a.8.8 0 0 1 0 1.4l-5 1.7a4 4 0 0 0-2.5 2.5l-1.7 5a.8.8 0 0 1-1.4 0l-1.7-5a4 4 0 0 0-2.5-2.5l-5-1.7a.8.8 0 0 1 0-1.4l5-1.7a4 4 0 0 0 2.5-2.5l1.7-5c.1-.3.4-.5.7-.5z"/>' +
    '<path d="M19.2 2.2c.2 0 .3.1.4.3l.6 1.7c.1.3.3.5.6.6l1.7.6a.4.4 0 0 1 0 .8l-1.7.6a1 1 0 0 0-.6.6l-.6 1.7a.4.4 0 0 1-.8 0l-.6-1.7a1 1 0 0 0-.6-.6l-1.7-.6a.4.4 0 0 1 0-.8l1.7-.6a1 1 0 0 0 .6-.6l.6-1.7c.1-.2.2-.3.4-.3z" opacity=".85"/></svg>';

  var ICONE_FERMER =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  var lanceur = document.createElement("button");
  lanceur.className = "obsbuddy-lanceur";
  lanceur.type = "button";
  lanceur.setAttribute("aria-label", "Ouvrir O'Buddy, l'assistant barber");
  lanceur.setAttribute("aria-expanded", "false");
  lanceur.innerHTML = ICONE_ETOILE + '<span class="obsbuddy-pastille"></span>';

  var panneau = document.createElement("div");
  panneau.className = "obsbuddy-panneau";
  panneau.setAttribute("role", "dialog");
  panneau.setAttribute("aria-label", "O'Buddy — assistant barber");

  var invite = null;
  var ouvert = false;
  var iframeCreee = false;
  var chatPret = false;
  var questionEnAttente = null;

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
      : ICONE_ETOILE + '<span class="obsbuddy-pastille"></span>';
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

  // Le montage est déclenché tout en bas du fichier, une fois toutes les
  // constantes assignées : les `var` sont hoistées mais pas leurs valeurs, et
  // monter trop tôt lisait un tableau encore `undefined` — l'exception coupait
  // alors le reste du script, dont l'écouteur de messages.
  function monter() {
    document.body.appendChild(panneau);
    document.body.appendChild(lanceur);
    programmerInvite();
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

  /**
   * Ouvre le chat avec une question déjà posée. Elle est mise en attente : le
   * chat vient d'être créé et signalera lui-même quand il est prêt à la recevoir.
   */
  function ouvrirAvecQuestion(question) {
    questionEnAttente = question;
    basculer(true);
    // Si le chat était déjà chargé, il ne renverra pas de poignée de main.
    if (chatPret) transmettreQuestion();
  }

  function transmettreQuestion() {
    if (!questionEnAttente) return;
    repondre({
      source: "obsbuddy-hote",
      type: "poser-question",
      texte: questionEnAttente,
    });
    questionEnAttente = null;
  }

  /**
   * Sur une fiche produit, on ne se contente pas d'inviter : on pose déjà les
   * questions. Le visiteur clique sur celle qui le concerne et le chat s'ouvre
   * avec la réponse en route — un geste au lieu de trois.
   */
  function afficherQuestions(contexte) {
    if (ouvert || invite || invitationDejaVue()) return;

    invite = document.createElement("div");
    invite.className = "obsbuddy-questions";

    var entete = document.createElement("div");
    entete.className = "obsbuddy-q-entete";
    entete.innerHTML =
      "Une question sur ce produit ?" +
      (contexte.titre
        ? '<span class="obsbuddy-q-produit">' + echapper(contexte.titre) + "</span>"
        : "") +
      '<button class="obsbuddy-q-fermer" type="button" aria-label="Fermer">&times;</button>';
    entete.querySelector(".obsbuddy-q-fermer").addEventListener("click", masquerInvite);
    invite.appendChild(entete);

    QUESTIONS_PRODUIT.forEach(function (question) {
      var bouton = document.createElement("button");
      bouton.className = "obsbuddy-q";
      bouton.type = "button";
      bouton.textContent = question;
      bouton.addEventListener("click", function () {
        marquerInvitationVue();
        ouvrirAvecQuestion(question);
      });
      invite.appendChild(bouton);
    });

    document.body.appendChild(invite);
    void invite.offsetWidth;
    invite.classList.add("obsbuddy-visible");
  }

  function afficherInvite(contexte) {
    if (ouvert || invite || invitationDejaVue()) return;

    if (contexte.type === "product") {
      afficherQuestions(contexte);
      return;
    }

    var titre = "Besoin d'un coup de main ?";
    var corps = "Routine, matos, commande — demande-moi.";
    var surFiche = false;

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
      chatPret = true;
      repondre({
        source: "obsbuddy-hote",
        type: "bonjour",
        panierDisponible: panierDisponible(),
        page: contextePage(),
      });
      transmettreQuestion();
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

  // Dernière instruction du script : à ce point, tout est déclaré et assigné.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", monter);
  } else {
    monter();
  }
})();
