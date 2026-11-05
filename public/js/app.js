/* UNI STEEL — shared behaviour: content loading, language, header/footer, page renderers, WhatsApp, form. */
(function () {
  "use strict";

  /* ---------- language ---------- */
  var LANG_KEY = "unisteel_lang";
  var params = new URLSearchParams(location.search);
  var lang = "ar";
  try {
    lang = params.get("lang") || localStorage.getItem(LANG_KEY) || "ar";
  } catch (e) { lang = params.get("lang") || "ar"; }
  if (lang !== "ar" && lang !== "en") lang = "ar";
  if (params.get("lang")) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) {} }

  function t(key) { return (STR[lang] && STR[lang][key]) || STR.ar[key] || key; }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* raw* return plain text, name/desc return HTML-escaped text for innerHTML */
  function rawName(o) { return lang === "ar" ? (o.ar || o.en || "") : (o.en || o.ar || ""); }
  function rawDesc(o) { return lang === "ar" ? (o.dAr || o.dEn || "") : (o.dEn || o.dAr || ""); }
  function rawDet(o) { return lang === "ar" ? (o.detAr || o.detEn || "") : (o.detEn || o.detAr || ""); }
  function name(o) { return esc(rawName(o)); }
  function desc(o) { return esc(rawDesc(o)); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function paragraphs(text) {
    return String(text || "").split(/\n+/).filter(Boolean).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  }

  /* ---------- helpers ---------- */
  var page = document.body.dataset.page || "home";
  var PH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/><circle cx="9" cy="9" r="1.3"/></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  var WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.08.89.9-3-.2-.31A8.1 8.1 0 1 1 12.04 20.1Zm4.45-6.06c-.24-.12-1.44-.71-1.66-.79-.22-.08-.39-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06a6.6 6.6 0 0 1-1.94-1.2 7.3 7.3 0 0 1-1.34-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.1 3.65.57.25 1.02.4 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"/></svg>';
  var CALL_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg>';

  function waLink(text) { return "https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent(text); }
  /* wa.me link for one person's number (01x... -> 201x...) */
  function waTo(p, text) {
    var d = String(p || "").replace(/\D/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (/^01\d{9}$/.test(d)) d = "2" + d;
    return "https://wa.me/" + d + "?text=" + encodeURIComponent(text);
  }
  var USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
  function contactList() {
    return (SITE.contacts && SITE.contacts.length) ? SITE.contacts : (SITE.phones || []).map(function (p) { return { ar: "", en: "", phone: p, photo: "" }; });
  }
  function contactName(c) { return lang === "ar" ? (c.ar || c.en || "") : (c.en || c.ar || ""); }
  function contactTitle(c) { return lang === "ar" ? (c.tAr || c.tEn || "") : (c.tEn || c.tAr || ""); }
  function personCard(c) {
    var nm = contactName(c), tt = contactTitle(c);
    return '<div class="person">' +
      (c.photo ? '<img class="person-photo" src="' + esc(c.photo) + '" alt="' + esc(nm) + '" loading="lazy">' : '<div class="person-photo ph-user">' + USER_ICON + "</div>") +
      '<div class="person-info">' + (nm ? "<b>" + esc(nm) + "</b>" : "") + (tt ? '<span class="person-role">' + esc(tt) + "</span>" : "") +
      '<a class="ltr person-num" href="' + telLink(c.phone) + '">' + esc(c.phone) + "</a>" +
      '<div class="person-act"><a class="btn btn-primary btn-sm" href="' + telLink(c.phone) + '">' + t("common.call") + "</a>" +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + waTo(c.phone, t("wa.general")) + '">' + t("common.wa") + "</a></div></div></div>";
  }

  /* tel: link from whatever the admin typed: 01x... (Egypt, local) / 201x... / +201x... / 00201x... */
  function telLink(p) {
    var plus = /^\s*\+/.test(p), d = String(p || "").replace(/\D/g, "");
    if (d.indexOf("00") === 0) { d = d.slice(2); plus = true; }
    if (plus) return "tel:+" + d;
    if (d.charAt(0) === "0") return "tel:+2" + d;      // 010... -> +2010...
    return "tel:+" + d;                                 // already international (20...)
  }

  /* image placeholder; shows the real photo when a URL exists */
  function ph(labelKey, extra, imgSrc) {
    if (imgSrc) return '<div class="ph ' + (extra || "") + '"><img src="' + esc(imgSrc) + '" alt="" loading="lazy"></div>';
    return '<div class="ph ' + (extra || "") + '"><div>' + PH_ICON + "<span>" + t(labelKey) + "</span></div></div>";
  }
  function phIcon(imgSrc) {
    return '<div class="ph">' + (imgSrc ? '<img src="' + esc(imgSrc) + '" alt="" loading="lazy">' : PH_ICON) + "</div>";
  }
  function siteImg(key) { return (SITE.images && SITE.images[key]) || ""; }

  function $(sel, root) { return (root || document).querySelector(sel); }

  /* ---------- modal (video / project details) ---------- */
  function openModal(html) {
    closeModal();
    var m = document.createElement("div");
    m.className = "modal"; m.id = "modal";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = '<div class="modal-box"><button class="modal-close" type="button" aria-label="Close">&times;</button>' + html + "</div>";
    document.body.appendChild(m);
    document.body.style.overflow = "hidden";
    var cb = m.querySelector(".modal-close");
    if (cb) cb.focus();
  }
  function closeModal() {
    var m = $("#modal");
    if (m) m.remove();
    document.body.style.overflow = "";
  }
  function videoHtml(url) {
    var yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
    if (yt) return '<div class="video"><iframe src="https://www.youtube.com/embed/' + yt[1] + '?autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="Video"></iframe></div>';
    var vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return '<div class="video"><iframe src="https://player.vimeo.com/video/' + vm[1] + '?autoplay=1" allow="autoplay; fullscreen" allowfullscreen title="Video"></iframe></div>';
    if (/\.(mp4|webm)(\?|$)/i.test(url)) return '<div class="video"><video src="' + esc(url) + '" controls autoplay playsinline></video></div>';
    return '<p><a class="btn btn-primary" href="' + esc(url) + '" target="_blank" rel="noopener">' + t("common.watch") + "</a></p>";
  }

  /* ---------- header / footer ---------- */
  var NAV = [
    ["index.html", "nav.home", "home"],
    ["products.html", "nav.products", "products"],
    ["solutions.html", "nav.solutions", "solutions"],
    ["projects.html", "nav.projects", "projects"],
    ["about.html", "nav.about", "about"],
    ["contact.html", "nav.contact", "contact"]
  ];

  function logo(variant) { return '<img class="logo-img" src="img/logo-' + variant + '.png" alt="UNI STEEL — Commercial Kitchen Solutions" width="1701" height="765">'; }

  var THEME_KEY = "unisteel_theme";
  var THEME_ICONS = '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  function toggleTheme() {
    var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }

  function isActive(key) { return key === page || (key === "products" && page === "product"); }

  function renderHeader() {
    var links = NAV.map(function (n) {
      return '<a href="' + n[0] + '" class="' + (isActive(n[2]) ? "active" : "") + '">' + t(n[1]) + "</a>";
    }).join("");
    var hours = rawName(SITE.hours || {});
    var topbar = '<div class="topbar"><div class="container topbar-row"><div class="topbar-info">' +
      '<a class="ltr" href="' + telLink(SITE.phones[0]) + '">' + esc(SITE.phones[0]) + "</a>" +
      (hours ? "<span>" + esc(hours) + "</span>" : "") +
      '<span class="topbar-addr">' + name(SITE.address) + "</span></div>" +
      '<a class="topbar-cta" href="contact.html">' + t("nav.cta") + "</a></div></div>";
    $("#site-header").innerHTML = topbar +
      '<header class="site-header"><div class="container"><div class="pill header-row">' +
      '<a href="index.html" class="logo">' + logo("white") + "</a>" +
      '<nav class="nav" aria-label="Main">' + links + "</nav>" +
      '<div class="header-actions">' +
      '<button class="theme-btn" id="theme-btn" type="button" aria-label="' + t("theme.toggle") + '" title="' + t("theme.toggle") + '">' + THEME_ICONS + "</button>" +
      '<button class="lang-btn" id="lang-btn" type="button">' + t("lang.switch") + "</button>" +
      '<a href="contact.html" class="btn header-cta"><span>' + t("nav.cta") + '</span><span class="btn-ico"></span></a>' +
      '<button class="menu-btn" id="menu-btn" type="button" aria-label="Menu" aria-expanded="false"><span></span></button>' +
      "</div></div>" +
      '<nav class="mobile-nav" id="mobile-nav" aria-label="Mobile">' + links +
      '<a class="btn btn-primary" href="contact.html">' + t("nav.cta") + "</a></nav></div></header>";

    $("#theme-btn").addEventListener("click", toggleTheme);
    $("#lang-btn").addEventListener("click", function () { setLang(lang === "ar" ? "en" : "ar"); });
    var mb = $("#menu-btn");
    mb.addEventListener("click", function () {
      var open = $("#mobile-nav").classList.toggle("open");
      mb.setAttribute("aria-expanded", open);
    });
  }

  function renderFooter() {
    var cats = CATEGORIES.map(function (c) {
      return '<a href="products.html?cat=' + esc(c.id) + '">' + name(c) + "</a>";
    }).join("");
    var links = NAV.map(function (n) { return '<a href="' + n[0] + '">' + t(n[1]) + "</a>"; }).join("");
    var phones = contactList().map(function (c) {
      var nm = contactName(c);
      return '<a href="' + telLink(c.phone) + '">' + (nm ? esc(nm) + " · " : "") + '<span class="ltr">' + esc(c.phone) + "</span></a>";
    }).join("");
    var email = SITE.email ? '<a class="ltr" href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + "</a>" : "";
    $("#site-footer").innerHTML =
      '<footer class="site-footer"><div class="container"><div class="footer-grid">' +
      '<div class="footer-logo"><a href="index.html" class="logo">' + logo("white") + "</a>" +
      '<p class="footer-about">' + t("footer.about") + "</p></div>" +
      "<div><h4>" + t("footer.links") + "</h4>" + links + "</div>" +
      "<div><h4>" + t("footer.cats") + "</h4>" + cats + "</div>" +
      "<div><h4>" + t("footer.contact") + "</h4>" + phones + email + '<a href="' + waLink(t("wa.general")) + '" target="_blank" rel="noopener">' + t("common.wa") + "</a></div>" +
      '</div><div class="footer-big">' + t("footer.big") + '</div><div class="footer-bottom">© ' + new Date().getFullYear() + " UNI STEEL. " + t("footer.rights") + "</div></div></footer>" +
      '<div class="float-stack"><a class="float-btn call-float" href="' + telLink(SITE.phones[0]) + '" aria-label="' + t("float.call") + '">' + CALL_ICON + "</a>" +
      '<a class="float-btn wa-float" href="' + waLink(t("wa.general")) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + WA_ICON + "</a></div>";
  }

  /* ---------- reusable fragments ---------- */
  function productCard(p) {
    var cat = byId(CATEGORIES, p.cat) || { ar: "", en: "" };
    return '<a class="product-card" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
      ph("ph.product", "", p.images && p.images[0]) +
      '<div class="cat-body"><span class="tag">' + name(cat) + "</span><h3>" + name(p) + "</h3><p>" + desc(p) +
      '</p><span class="cat-more">' + t("common.details") + " ›</span></div></a>";
  }

  function projectCard(p) {
    var type = byId(PROJECT_TYPES, p.type) || { ar: "", en: "" };
    return '<article class="project-card" data-project="' + esc(p.id) + '" tabindex="0" role="button">' + ph("ph.project", "", p.images && p.images[0]) +
      '<div class="cat-body"><span class="tag">' + name(type) + "</span><h3>" + name(p) + "</h3>" +
      "<p><strong>" + t("projects.items") + "</strong> " + esc(rawName(p.items || {})) + "</p></div></article>";
  }

  function openProject(id) {
    var p = byId(PROJECTS, id);
    if (!p) return;
    var type = byId(PROJECT_TYPES, p.type) || { ar: "", en: "" };
    var html = '<span class="tag">' + name(type) + "</span><h2>" + name(p) + "</h2>" +
      "<p><strong>" + t("projects.items") + "</strong> " + esc(rawName(p.items || {})) + "</p>" +
      '<div class="prose">' + paragraphs(rawDet(p)) + "</div>";
    if (p.video) html += videoHtml(p.video);
    if (p.images && p.images.length) {
      html += '<div class="modal-gallery">' + p.images.map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy">'; }).join("") + "</div>";
    }
    html += '<p style="margin-top:18px"><a class="btn btn-primary" href="contact.html">' + t("cta.quote") + "</a></p>";
    openModal(html);
  }

  function stepsHtml(long) {
    var out = "";
    for (var i = 1; i <= 4; i++) {
      out += '<div class="step"><h3>' + t("step." + i + ".t") + "</h3><p>" + t(long ? "sol." + i + ".d" : "step." + i + ".d") + "</p></div>";
    }
    return out;
  }

  function venuesHtml() {
    return PROJECT_TYPES.map(function (v) { return '<span class="venue">' + t("venue." + v.id) + "</span>"; }).join("");
  }

  function circlesHtml() {
    var vi = (SITE.images && SITE.images.venues) || {};
    return PROJECT_TYPES.map(function (v) {
      return '<div class="circle">' + phIcon(vi[v.id]) + "<span>" + t("venue." + v.id) + "</span></div>";
    }).join("");
  }

  function menuItem(c) {
    return '<a class="menu-item" href="products.html?cat=' + esc(c.id) + '"><span class="dot"></span><div><h3>' + name(c) + "</h3><p>" + desc(c) + "</p></div></a>";
  }

  function svcHtml() {
    var si = (SITE.images && SITE.images.svc) || [];
    var out = "";
    for (var i = 1; i <= 3; i++) {
      out += '<article class="svc' + (i === 2 ? " hl" : "") + '"><h3>' + t("svc." + i + ".t") + "</h3><p>" + t("svc." + i + ".d") + "</p>" +
        ph("ph.project", "", si[i - 1]) + '<a class="btn ' + (i === 2 ? "btn-primary" : "btn-dark") + '" href="solutions.html"><span>' + t("svc.more") +
        '</span><span class="btn-ico"></span></a></article>';
    }
    return out;
  }

  function tabsHtml(items, active, allKey, attr) {
    var html = '<button class="tab' + (!active ? " active" : "") + '" data-' + attr + '="">' + t(allKey) + "</button>";
    items.forEach(function (i) {
      html += '<button class="tab' + (active === i.id ? " active" : "") + '" data-' + attr + '="' + esc(i.id) + '">' + name(i) + "</button>";
    });
    return html;
  }

  /* ---------- trust sections: each one is hidden until its data is filled ---------- */
  function renderTrust() {
    var box = $("#home-trust");
    if (!box) return;
    var html = "";
    if (SITE.stats && SITE.stats.length) {
      html += '<section class="section"><div class="container"><div class="stats">' +
        SITE.stats.map(function (x) {
          return '<div class="stat"><strong class="ltr">' + esc(x.value) + "</strong><span>" + name(x) + "</span></div>";
        }).join("") + "</div></div></section>";
    }
    if (SITE.credentials && SITE.credentials.length) {
      html += '<section class="section alt"><div class="container"><div class="section-head"><h2>' + t("cred.title") + '</h2></div><div class="venues">' +
        SITE.credentials.map(function (x) { return '<span class="venue">' + name(x) + "</span>"; }).join("") + "</div></div></section>";
    }
    var ex = SITE.exportCountries && (lang === "ar" ? SITE.exportCountries.ar : SITE.exportCountries.en);
    if (ex && ex.length) {
      html += '<section class="section"><div class="container"><div class="section-head"><h2>' + t("export.title") + "</h2><p>" + t("export.sub") +
        '</p></div><div class="venues">' + ex.map(function (c) { return '<span class="venue">' + esc(c) + "</span>"; }).join("") + "</div></div></section>";
    }
    box.innerHTML = html;
  }

  /* ---------- FAQ ---------- */
  var FAQ_COUNT = 7;
  function renderFaq() {
    var box = $("#faq-list");
    if (!box) return;
    var html = "";
    for (var i = 1; i <= FAQ_COUNT; i++) {
      html += "<details" + (i === 1 ? " open" : "") + "><summary>" + t("faq." + i + ".q") + "</summary><p>" + t("faq." + i + ".a") + "</p></details>";
    }
    box.innerHTML = html;
  }

  /* ---------- page renderers ---------- */
  var state = { cat: params.get("cat") || "", ptype: "" };
  var DEFAULT_FEATURED = ["gas-range", "undercounter-fridge", "pizza-oven", "hot-holding", "steam-kettle", "prep-table", "display-showcase", "fryer"];

  var renderers = {
    home: function () {
      var hm = $("#hero-media");
      var hi = siteImg("hero");
      hm.innerHTML = (hi ? '<img src="' + esc(hi) + '" alt="">' : "") +
        (SITE.heroVideo ? '<button class="play" type="button" data-video="' + esc(SITE.heroVideo) + '" aria-label="Play">' + PLAY_ICON + "</button>" : "") +
        (hi ? "" : '<span class="ph-label">' + t("hero.media") + "</span>");
      hm.classList.toggle("has-img", !!hi);

      // two product cards floating over the hero photo
      var hf = $("#hero-floats");
      if (hf) {
        var picks = ["pizza-oven", "display-showcase"].map(function (id) { return byId(PRODUCTS, id); }).filter(function (p) { return p && p.images && p.images[0]; });
        if (picks.length < 2) picks = PRODUCTS.filter(function (p) { return p.images && p.images[0]; }).slice(0, 2);
        hf.innerHTML = picks.map(function (p) {
          return '<a class="hero-float" href="product.html?id=' + encodeURIComponent(p.id) + '"><img src="' + esc(p.images[0]) + '" alt="" loading="lazy">' +
            "<span><b>" + name(p) + "</b><small>" + t("common.quote") + " ›</small></span></a>";
        }).join("");
      }

      var featured = PRODUCTS.filter(function (p) { return p.featured; });
      if (!featured.length) featured = DEFAULT_FEATURED.map(function (id) { return byId(PRODUCTS, id); }).filter(Boolean);
      // keep the rail from looking empty when only a few products are marked for the home page
      PRODUCTS.forEach(function (p) { if (featured.length < 6 && featured.indexOf(p) < 0) featured.push(p); });
      $("#home-rail").innerHTML = featured.slice(0, 12).map(productCard).join("");
      $("#home-svc").innerHTML = svcHtml();
      $("#menu-left").innerHTML = CATEGORIES.slice(0, 3).map(menuItem).join("");
      $("#menu-right").innerHTML = CATEGORIES.slice(3).map(menuItem).join("");
      $("#menu-center").innerHTML = ph("ph.category", "", siteImg("menu"));
      $("#home-steps").innerHTML = stepsHtml(false);
      $("#home-venues").innerHTML = circlesHtml();
      $("#home-projects").innerHTML = PROJECTS.slice(0, 3).map(projectCard).join("");
      $("#home-factory-img").innerHTML = ph("ph.factory", "", siteImg("factory"));
      var hc = $("#home-contacts");
      if (hc) hc.innerHTML = contactList().map(personCard).join("");
      renderTrust();
      renderFaq();
    },

    products: function () {
      if (state.cat && !byId(CATEGORIES, state.cat)) state.cat = ""; // unknown ?cat= falls back to "All"
      $("#cat-tabs").innerHTML = tabsHtml(CATEGORIES, state.cat, "products.all", "cat");
      var list = PRODUCTS.filter(function (p) { return !state.cat || p.cat === state.cat; });
      $("#product-grid").innerHTML = list.length ? list.map(productCard).join("") : '<p class="empty">' + t("products.empty") + "</p>";
    },

    product: function () {
      var p = byId(PRODUCTS, params.get("id"));
      var root = $("#product-root");
      if (!p) {
        root.innerHTML = '<p class="empty">' + t("product.notfound") + '</p><a class="btn btn-ghost" href="products.html">' + t("product.back") + "</a>";
        return;
      }
      var cat = byId(CATEGORIES, p.cat) || { ar: "", en: "" };
      document.title = rawName(p) + " | UNI STEEL";
      var imgs = p.images || [];
      var gallery;
      if (imgs.length) {
        gallery = '<div class="ph main" id="main-ph"><img id="main-img" src="' + esc(imgs[0]) + '" alt="' + name(p) + '"></div>';
        if (imgs.length > 1) {
          gallery += '<div class="thumbs">' + imgs.map(function (u, i) {
            return '<button type="button" class="thumb-btn' + (i === 0 ? " active" : "") + '" data-img="' + esc(u) + '"><div class="ph"><img src="' + esc(u) + '" alt="" loading="lazy"></div></button>';
          }).join("") + "</div>";
        }
      } else {
        gallery = ph("ph.product", "main") + '<div class="thumbs">' + [1, 2, 3].map(function () { return ph("ph.product", ""); }).join("") + "</div>";
      }
      var msg = t("wa.product") + rawName(p);
      var related = PRODUCTS.filter(function (x) { return x.cat === p.cat && x.id !== p.id; }).slice(0, 3);
      var extra = (p.specs || []).map(function (s) {
        var k = lang === "ar" ? (s.kAr || s.kEn) : (s.kEn || s.kAr);
        var v = lang === "ar" ? (s.vAr || s.vEn) : (s.vEn || s.vAr);
        return "<tr><th>" + esc(k) + "</th><td>" + esc(v) + "</td></tr>";
      }).join("");
      var det = rawDet(p);
      root.innerHTML =
        '<div class="product-grid"><div class="gallery">' + gallery + "</div>" +
        '<div class="product-info"><span class="tag">' + name(cat) + "</span><h1>" + name(p) + "</h1>" +
        '<p class="desc">' + desc(p) + " " + t("product.desc.note") + "</p>" +
        (det ? '<div class="prose">' + paragraphs(det) + "</div>" : "") +
        '<table class="specs"><tbody>' +
        extra +
        "<tr><th>" + t("spec.cat") + "</th><td>" + name(cat) + "</td></tr>" +
        "<tr><th>" + t("spec.size") + "</th><td>" + t("spec.size.v") + "</td></tr>" +
        "<tr><th>" + t("spec.made") + "</th><td>" + t("spec.made.v") + "</td></tr>" +
        "<tr><th>" + t("spec.install") + "</th><td>" + t("spec.install.v") + "</td></tr>" +
        "<tr><th>" + t("spec.warranty") + "</th><td>" + t("spec.warranty.v") + "</td></tr>" +
        "</tbody></table>" +
        '<div class="product-cta"><a class="btn btn-primary" href="contact.html?product=' + encodeURIComponent(p.id) + '">' + t("common.quote") + "</a>" +
        '<a class="btn btn-ghost" target="_blank" rel="noopener" href="' + waLink(msg) + '">' + t("common.wa") + "</a></div></div></div>" +
        (related.length ? '<h2 style="margin:56px 0 20px;font-size:1.4rem">' + t("product.related") + '</h2><div class="grid grid-3">' + related.map(productCard).join("") + "</div>" : "");
      var crumb = $("#crumb-name");
      if (crumb) crumb.innerHTML = name(p);
    },

    solutions: function () {
      $("#sol-steps").innerHTML = stepsHtml(true);
      $("#sol-venues").innerHTML = venuesHtml();
    },

    projects: function () {
      $("#type-tabs").innerHTML = tabsHtml(PROJECT_TYPES, state.ptype, "products.all", "ptype");
      var list = PROJECTS.filter(function (p) { return !state.ptype || p.type === state.ptype; });
      $("#project-grid").innerHTML = list.length ? list.map(projectCard).join("") : '<p class="empty">' + t("projects.empty") + "</p>";
    },

    about: function () {
      var ap = $("#about-people");
      if (ap) ap.innerHTML = contactList().map(personCard).join("");
      $("#about-img").innerHTML = ph("ph.factory", "", siteImg("about"));
    },

    contact: function () {
      var sel = $("#f-products");
      var current = sel.value || params.get("product") || "";
      sel.innerHTML = '<option value="">' + t("f.products.ph") + "</option>" + CATEGORIES.map(function (c) {
        var items = PRODUCTS.filter(function (p) { return p.cat === c.id; });
        if (!items.length) return ""; // no empty groups in the dropdown
        return '<optgroup label="' + name(c) + '">' + items.map(function (p) {
          return '<option value="' + esc(p.id) + '">' + name(p) + "</option>";
        }).join("") + "</optgroup>";
      }).join("");
      sel.value = current;

      var typeSel = $("#f-type"), tv = typeSel.value;
      typeSel.innerHTML = '<option value="">' + t("f.type.ph") + "</option>" +
        ["restaurant", "cafe", "hotel", "central", "catering", "bakery", "other"].map(function (k) {
          return '<option value="' + k + '">' + t("t." + k) + "</option>";
        }).join("");
      typeSel.value = tv;

      var info = '<div class="people">' + contactList().map(personCard).join("") + "</div>";
      if (SITE.email) info += '<div class="info-item"><h3>' + t("info.email") + '</h3><a href="mailto:' + esc(SITE.email) + '">' + esc(SITE.email) + "</a></div>";
      info += '<div class="info-item"><h3>' + t("info.address") + '</h3><p style="direction:inherit">' + name(SITE.address) + "</p></div>";
      var hrs = rawName(SITE.hours || {});
      if (hrs) info += '<div class="info-item"><h3>' + t("info.hours") + '</h3><p style="direction:inherit">' + esc(hrs) + "</p></div>";
      info += SITE.mapEmbed
        ? '<iframe class="map-ph" src="' + esc(SITE.mapEmbed) + '" loading="lazy" style="border:0;width:100%" title="Map"></iframe>'
        : ph("ph.map", "map-ph");
      $("#contact-info").innerHTML = info;
      renderFaq();
    }
  };

  /* ---------- apply language ---------- */
  function applyStatic() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    var tk = document.body.dataset.title;
    document.title = (tk ? t(tk) + " | " : "") + "UNI STEEL — Commercial Kitchen Solutions";
    document.querySelectorAll("[data-wa]").forEach(function (a) { a.href = waLink(t(a.dataset.wa)); });
  }

  function renderAll() {
    applyStatic();
    renderHeader();
    renderFooter();
    if (renderers[page]) renderers[page]();
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
    renderAll();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest(".tab");
    if (tab) {
      if (tab.dataset.cat !== undefined) { state.cat = tab.dataset.cat; renderers.products(); }
      if (tab.dataset.ptype !== undefined) { state.ptype = tab.dataset.ptype; renderers.projects(); }
      return;
    }
    var th = e.target.closest(".thumb-btn");
    if (th) {
      var main = $("#main-img");
      if (main) main.src = th.dataset.img;
      document.querySelectorAll(".thumb-btn").forEach(function (b) { b.classList.toggle("active", b === th); });
      return;
    }
    var vid = e.target.closest("[data-video]");
    if (vid) { openModal(videoHtml(vid.dataset.video)); return; }
    var pr = e.target.closest("[data-project]");
    if (pr) { openProject(pr.dataset.project); return; }
    if (e.target.closest(".modal-close") || e.target.id === "modal") closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-project]")) {
      e.preventDefault(); openProject(e.target.dataset.project);
    }
  });

  document.addEventListener("submit", function (e) {
    if (e.target.id !== "quote-form") return;
    e.preventDefault();
    var f = e.target;
    var status = $("#form-status");
    var v = function (id) { return (f.querySelector(id).value || "").trim(); };
    var bad = !v("#f-name") ? "#f-name" : (v("#f-phone").replace(/\D/g, "").length < 7 ? "#f-phone" : "");
    if (bad) {
      status.textContent = t(!v("#f-name") || !v("#f-phone") ? "f.required" : "f.phone.invalid");
      status.style.background = "#fdecea"; status.style.color = "#8a1f11";
      status.classList.add("show");
      var badEl = f.querySelector(bad);
      badEl.setAttribute("aria-invalid", "true");
      badEl.focus(); // also scrolls the offending field into view on phones
      return;
    }
    f.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    var prod = byId(PRODUCTS, v("#f-products"));
    var type = v("#f-type");
    var lines = [t("wa.form"), "",
      t("wa.l.name") + ": " + v("#f-name"),
      t("wa.l.phone") + ": " + v("#f-phone")];
    if (type) lines.push(t("wa.l.type") + ": " + t("t." + type));
    if (v("#f-area")) lines.push(t("wa.l.area") + ": " + v("#f-area") + (lang === "ar" ? " م²" : " m²"));
    if (prod) lines.push(t("wa.l.prod") + ": " + rawName(prod));
    if (v("#f-msg")) lines.push(t("wa.l.msg") + ": " + v("#f-msg"));

    if (SITE.formEndpoint) {
      try {
        fetch(SITE.formEndpoint, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: v("#f-name"), phone: v("#f-phone"), type: type, area: v("#f-area"),
            product: prod ? (prod.en || prod.ar) : "", message: v("#f-msg"), lang: lang })
        }).catch(function () {});
      } catch (err) {}
    }
    if (window.fbq) fbq("track", "Lead");
    if (window.gtag) gtag("event", "generate_lead");
    var link = waLink(lines.join("\n"));
    status.textContent = t("f.success") + " ";
    var again = document.createElement("a"); // fallback in case the browser blocked the pop-up
    again.href = link; again.target = "_blank"; again.rel = "noopener"; again.textContent = t("common.wa");
    again.style.textDecoration = "underline";
    status.appendChild(again);
    status.style.background = ""; status.style.color = "";
    status.classList.add("show");
    window.open(link, "_blank", "noopener");
  });

  /* ---------- analytics (only when IDs are set) ---------- */
  function loadTracking() {
    if (SITE.ga) {
      var s = document.createElement("script");
      s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(SITE.ga);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag("js", new Date()); gtag("config", SITE.ga);
    }
    if (SITE.pixel) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }
      (window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      fbq("init", SITE.pixel); fbq("track", "PageView");
    }
  }

  /* ---------- content from the admin panel (falls back to data.js defaults) ---------- */
  function loadContent() {
    return fetch("/api/content", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        if (!c || typeof c !== "object") return;
        if (c.site) SITE = Object.assign({}, SITE, c.site);
        if (c.categories && c.categories.length) CATEGORIES = c.categories;
        if (Array.isArray(c.products)) PRODUCTS = c.products;
        if (Array.isArray(c.projects)) PROJECTS = c.projects;
      })
      .catch(function () {});
  }

  loadContent().then(function () {
    loadTracking();
    renderAll();
  });
})();
