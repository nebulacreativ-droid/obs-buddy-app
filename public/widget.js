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
    ".obsbuddy-lanceur.obsbuddy-masque{display:none}}";

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
    if (ouvert) creerIframe();

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
    if (e.key === "Escape" && ouvert) basculer(false);
  });

  function monter() {
    document.body.appendChild(panneau);
    document.body.appendChild(lanceur);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", monter);
  } else {
    monter();
  }

  // ── Pont panier ────────────────────────────────────────────────────────
  // Le chat vit dans une iframe sur un autre domaine : il n'a ni la session
  // client ni les cookies du panier. Il demande, c'est ce script — qui tourne
  // sur la boutique — qui exécute l'ajout.

  function boutique() {
    return typeof window.prestashop === "object" ? window.prestashop : null;
  }

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
      envoyerDemandePro(d.donnees);
    }
  });

  /** Transmet la demande de compte pro au module, qui l'enregistre en SAV. */
  function envoyerDemandePro(donnees) {
    var ps = boutique();
    var base = ps && ps.urls && ps.urls.base_url ? ps.urls.base_url : "/";

    var corps = new URLSearchParams();
    var champs = [
      "nom",
      "email",
      "telephone",
      "message",
      "rappel",
      "societe",
      "siret",
      "activite",
      "ville",
    ];
    for (var i = 0; i < champs.length; i++) {
      corps.append(champs[i], String(donnees[champs[i]] || ""));
    }

    fetch(base + "index.php?fc=module&module=obsbuddy&controller=contactpro", {
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
          type: "resultat-demande-pro",
          ok: !!(data && data.ok),
          message: data && data.erreur ? String(data.erreur) : "",
        });
      })
      .catch(function () {
        repondre({
          source: "obsbuddy-hote",
          type: "resultat-demande-pro",
          ok: false,
          message: "Envoi impossible pour le moment.",
        });
      });
  }

  /**
   * Palier de fidélité du client connecté.
   *
   * La requête part de la boutique avec les cookies de session : c'est
   * PrestaShop qui identifie le client, pas nous. Aucune donnée client ne
   * transite par le serveur de l'assistant — la boutique répond ici, et le
   * chat se contente d'afficher.
   */
  function lireFidelite() {
    var ps = boutique();
    var base = ps && ps.urls && ps.urls.base_url ? ps.urls.base_url : "/";

    fetch(base + "index.php?fc=module&module=obsbuddy&controller=fidelite", {
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
