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
