/* UNI STEEL admin panel */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var content = null;
  var tab = "products";

  var PROJECT_TYPES = [
    ["restaurant", "مطاعم"], ["hotel", "فنادق"], ["cafe", "كافيهات"], ["central", "مطابخ مركزية"], ["catering", "كاترينج"]
  ];

  /* ---------- helpers ---------- */
  function imgSrc(u) {
    if (/^https?:\/\//.test(u)) return u;
    if (/^gh\//.test(u) && typeof CONTENT_BASE === "string" && CONTENT_BASE) return CONTENT_BASE + "img/" + u.slice(3);
    return "/" + u;
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getPath(o, p) { return p.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) {
    var ks = p.split(".");
    for (var i = 0; i < ks.length - 1; i++) {
      var k = ks[i];
      if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[k];
    }
    o[ks[ks.length - 1]] = v;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function slug(v) { return String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function rid(p) { return p + "-" + Math.random().toString(36).slice(2, 7); }

  var toastTimer;
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg; t.className = "toast" + (bad ? " bad" : ""); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- api ---------- */
  function api(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        // only a real "session ended" answer sends us back to the login screen (a wrong current password is also a 4xx)
        if (r.status === 401 && j.error === "unauthorized") { showLogin(); throw new Error("auth"); }
        if (!r.ok) { var code = j.error || (r.status === 413 ? "too_large" : ""); var e = new Error(code || "error"); e.code = code; throw e; }
        return j;
      });
    });
  }

  /* ---------- unsaved changes in the settings tabs (they live in `content` until "Save") ---------- */
  var dirty = false;
  function touch(obj) { if (obj === content) dirty = true; }
  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- link checks (the server silently drops invalid links, so tell the person instead) ---------- */
  function httpsOnly(v) { return !v || /^https:\/\/\S+$/.test(v); }
  function fixMapEmbed() {
    var v = String(content.site.mapEmbed || "").trim();
    var m = v.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i); // people paste the whole <iframe> snippet from Google Maps
    if (m) v = m[1].replace(/&amp;/g, "&");
    content.site.mapEmbed = v;
    if (v && !/^https:\/\/www\.google\.com\/maps\/\S*$/.test(v)) return "رابط الخريطة لازم يبدأ بـ https://www.google.com/maps/ (انسخ قيمة src من كود التضمين).";
    return "";
  }
  function siteLinkError() {
    var s = content.site;
    return fixMapEmbed() ||
      (!httpsOnly(s.heroVideo) ? "رابط فيديو الصفحة الرئيسية لازم يبدأ بـ https" : "") ||
      (!httpsOnly(s.formEndpoint) ? "رابط استقبال النموذج لازم يبدأ بـ https" : "");
  }

  var STORAGE_ERRORS = {
    storage_not_configured: "التخزين مش متضبط. ضيف GITHUB_TOKEN في إعدادات Vercel (شوف README).",
    github_auth: "توكن GitHub غلط أو منتهي أو ملوش صلاحية Contents: Read and write على الريبو.",
    github_not_found: "GitHub مش لاقي الريبو. راجع GITHUB_REPO والتوكن.",
    github_failed: "GitHub رفض الحفظ. جرّب تاني بعد شوية."
  };

  function save(msg) {
    var bad = siteLinkError();
    if (bad) { toast(bad, true); return Promise.resolve(false); }
    return api("/api/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      .then(function (j) { content = j.content; dirty = false; toast(msg || "تم الحفظ ✓"); return true; })
      .catch(function (e) {
        if (e.message !== "auth") toast(STORAGE_ERRORS[e.code] || "فشل الحفظ. جرّب تاني.", true);
        return false;
      });
  }
  /* delete / toggle: if the save fails, put the list back the way it was so the screen never lies */
  function saveOrRevert(snapshot, msg) {
    return save(msg).then(function (ok) { if (!ok && snapshot) content = snapshot; return ok; });
  }

  /* ---------- image upload (compresses before sending) ---------- */
  function compress(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file).then(function (bmp) {
      var max = 1600, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) {
        c.toBlob(function (b) {
          if (!b || (scale === 1 && b.size >= file.size)) return res(file);
          res(new File([b], "img.webp", { type: "image/webp" }));
        }, "image/webp", 0.82);
      });
    }).catch(function () { return file; });
  }
  function uploadFile(file) {
    return compress(file).then(function (f) {
      var fd = new FormData();
      fd.append("file", f, f.name);
      return api("/api/upload", { method: "POST", body: fd });
    }).then(function (j) { return j.url; });
  }
  function uploadError(e) {
    if (e.message === "auth") return;
    var m = { too_large: "الصورة كبيرة. صغّرها لأقل من 4 ميجا.", unsupported_type: "نوع الملف مش مدعوم. استخدم JPG أو PNG أو WebP.", storage_not_configured: STORAGE_ERRORS.storage_not_configured, github_auth: STORAGE_ERRORS.github_auth, github_not_found: STORAGE_ERRORS.github_not_found, github_failed: STORAGE_ERRORS.github_failed }[e.code];
    toast(m || "فشل رفع الصورة.", true);
  }

  /* ---------- field builders ---------- */
  function tf(label, k, o) {
    o = o || {};
    var attrs = ' data-k="' + k + '"' + (o.dir ? ' dir="' + o.dir + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "");
    var inp = o.area ? '<textarea rows="' + (o.rows || 3) + '"' + attrs + "></textarea>"
      : o.options ? "<select" + attrs + ">" + o.options.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + "</option>"; }).join("") + "</select>"
      : '<input type="' + (o.type || "text") + '"' + attrs + ">";
    return '<label class="f"><span>' + label + "</span>" + inp + (o.hint ? "<small>" + o.hint + "</small>" : "") + "</label>";
  }
  function bi(label, kAr, kEn, o) {
    o = o || {};
    return '<div class="grid2">' + tf(label + " (عربي)", kAr, o) + tf(label + " (English)", kEn, Object.assign({}, o, { dir: "ltr" })) + "</div>";
  }
  function chk(label, k) { return '<label class="chk"><input type="checkbox" data-k="' + k + '"> ' + label + "</label>"; }
  function imgList(path, max) { return '<div data-imglist="' + path + '" data-max="' + (max || 12) + '"></div>'; }
  function imgOne(path) { return '<div data-single="' + path + '"></div>'; }
  function addBtn(path, tpl, label) {
    return '<button type="button" class="btn ghost sm" data-add="' + path + '" data-tpl="' + esc(JSON.stringify(tpl)) + '">+ ' + label + "</button>";
  }
  function rmBtn(path, i) { return '<button type="button" class="rm" data-rm="' + path + '" data-i="' + i + '" aria-label="حذف">&times;</button>'; }

  /* ---------- binding ---------- */
  function bind(root, obj) {
    root.querySelectorAll("[data-k]").forEach(function (el) {
      var k = el.dataset.k, v = getPath(obj, k);
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.dataset.lines !== undefined) el.value = (v || []).join("\n");
      else el.value = v == null ? "" : v;
      var ev = (el.tagName === "SELECT" || el.type === "checkbox") ? "change" : "input";
      el.addEventListener(ev, function () {
        var val = el.type === "checkbox" ? el.checked
          : el.dataset.lines !== undefined ? el.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean)
          : el.value;
        setPath(obj, k, val);
        touch(obj);
      });
    });
  }

  function mountImages(root, obj) {
    root.querySelectorAll("[data-imglist]").forEach(function (box) {
      var path = box.dataset.imglist, max = +box.dataset.max || 12;
      var arr = getPath(obj, path);
      if (!Array.isArray(arr)) { arr = []; setPath(obj, path, arr); }
      box.innerHTML = '<div class="imgs">' + arr.map(function (u, i) {
        return '<div class="img-item"><img src="' + esc(imgSrc(u)) + '" alt=""><span class="badge">' + (i === 0 ? "الرئيسية" : "") + "</span>" +
          '<div class="img-actions"><button type="button" data-a="up" data-i="' + i + '" title="تقديم">&rarr;</button>' +
          '<button type="button" data-a="down" data-i="' + i + '" title="تأخير">&larr;</button>' +
          '<button type="button" class="del" data-a="del" data-i="' + i + '" title="حذف">&times;</button></div></div>';
      }).join("") + (arr.length < max ? '<label class="img-add">+ إضافة صور<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden></label>' : "") + "</div>";
      box.onclick = function (e) {
        var b = e.target.closest("[data-a]");
        if (!b) return;
        var i = +b.dataset.i, a = b.dataset.a;
        if (a === "del") arr.splice(i, 1);
        if (a === "up" && i > 0) arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
        if (a === "down" && i < arr.length - 1) arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
        touch(obj);
        mountImages(root, obj);
      };
      var inp = $("input[type=file]", box);
      if (inp) inp.onchange = function () {
        var files = Array.prototype.slice.call(inp.files, 0, max - arr.length);
        if (!files.length) return;
        toast("جاري رفع الصور...");
        files.reduce(function (p, f) {
          return p.then(function () { return uploadFile(f).then(function (u) { arr.push(u); }); });
        }, Promise.resolve()).then(function () { touch(obj); toast("تم رفع الصور ✓"); mountImages(root, obj); })
          .catch(function (e) { uploadError(e); touch(obj); mountImages(root, obj); });
      };
    });

    root.querySelectorAll("[data-single]").forEach(function (box) {
      var path = box.dataset.single, u = getPath(obj, path);
      box.innerHTML = '<div class="single"><img class="prev" ' + (u ? 'src="' + esc(imgSrc(u)) + '"' : "") + ' alt=""><div class="s-act">' +
        '<label class="btn ghost sm">' + (u ? "تغيير الصورة" : "رفع صورة") + '<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label>' +
        (u ? '<button type="button" class="btn danger sm" data-clear>إزالة</button>' : "") + "</div></div>";
      var inp = $("input[type=file]", box);
      inp.onchange = function () {
        if (!inp.files[0]) return;
        toast("جاري رفع الصورة...");
        uploadFile(inp.files[0]).then(function (url) { setPath(obj, path, url); touch(obj); toast("تم رفع الصورة ✓ (اضغط «حفظ التغييرات»)"); mountImages(root, obj); }).catch(uploadError);
      };
      var cl = $("[data-clear]", box);
      if (cl) cl.onclick = function () { setPath(obj, path, ""); touch(obj); mountImages(root, obj); };
    });
  }

  /* delegated add/remove for repeaters; getObj() returns the object being edited */
  function wire(root, getObj, repaint) {
    root.addEventListener("click", function (e) {
      var a = e.target.closest("[data-add]");
      if (a) {
        var obj = getObj(), arr = getPath(obj, a.dataset.add);
        if (!Array.isArray(arr)) { arr = []; setPath(obj, a.dataset.add, arr); }
        arr.push(JSON.parse(a.dataset.tpl));
        touch(obj);
        repaint();
        return;
      }
      var r = e.target.closest("[data-rm]");
      if (r) {
        var arr2 = getPath(getObj(), r.dataset.rm);
        arr2.splice(+r.dataset.i, 1);
        touch(getObj());
        repaint();
      }
    });
  }

  function paintInto(root, obj, html) {
    var st = root.scrollTop;
    root.innerHTML = html;
    bind(root, obj);
    mountImages(root, obj);
    root.scrollTop = st;
  }

  /* ---------- modal editor ---------- */
  function editor(title, draft, bodyFn, onOk) {
    var m = document.createElement("div");
    m.className = "mod";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = '<div class="mod-box"><div class="mod-head"><h2>' + esc(title) + '</h2><button class="x" type="button" aria-label="إغلاق">&times;</button></div>' +
      '<div class="mod-body"></div><div class="mod-foot"><button class="btn primary ok" type="button">حفظ</button><button class="btn ghost cancel" type="button">إلغاء</button></div></div>';
    document.body.appendChild(m);
    var body = $(".mod-body", m);
    function paint() { paintInto(body, draft, bodyFn(draft)); }
    wire(body, function () { return draft; }, paint);
    paint();
    function close() { m.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape" && m.parentNode && m.style.display !== "none") close(); }
    document.addEventListener("keydown", onKey);
    $(".x", m).onclick = close;
    $(".cancel", m).onclick = close;
    $(".ok", m).onclick = function () {
      var btn = this; btn.disabled = true;
      Promise.resolve(onOk(draft)).then(function (done) { btn.disabled = false; if (done !== false) close(); });
    };
  }

  /* ---------- panels ---------- */
  var BASE_TABS = [["products", "المنتجات"], ["projects", "المشاريع"], ["images", "صور الرئيسية"], ["categories", "الأقسام"], ["company", "بيانات الشركة"], ["users", "المستخدمين"], ["security", "الأمان"]];
  var me = null; // the signed-in user: { username, name, role, builtin }
  function tabsList() { return BASE_TABS.filter(function (t) { return t[0] !== "users" || (me && me.role === "owner"); }); }

  function renderTabs() {
    $("#tabs").innerHTML = tabsList().map(function (t) {
      var n = t[0] === "products" ? content.products.length : t[0] === "projects" ? content.projects.length : "";
      return '<button class="tab' + (t[0] === tab ? " on" : "") + '" data-tab="' + t[0] + '">' + t[1] + (n !== "" ? "<small>(" + n + ")</small>" : "") + "</button>";
    }).join("");
  }
  function paintPanel() {
    if (!tabsList().some(function (t) { return t[0] === tab; })) tab = "products";
    renderTabs();
    var p = $("#panel");
    var fn = { products: panelProducts, projects: panelProjects, images: panelImages, categories: panelCategories, company: panelCompany, users: panelUsers, security: panelSecurity }[tab];
    fn(p);
  }

  /* ----- products ----- */
  var pFilter = { q: "", cat: "" };
  function catOptions(withAll) {
    var o = content.categories.map(function (c) { return [c.id, c.ar]; });
    return withAll ? [["", "كل الأقسام"]].concat(o) : o;
  }
  function catName(id) { var c = content.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.ar : ""; }

  function panelProducts(p) {
    p.innerHTML = '<div class="bar"><input id="q" placeholder="ابحث عن منتج" value="' + esc(pFilter.q) + '">' +
      '<select id="cf">' + catOptions(true).map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === pFilter.cat ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" +
      '<span class="spacer"></span><button class="btn primary" id="add-p">+ منتج جديد</button></div><div class="list" id="plist"></div>';
    $("#q").oninput = function () { pFilter.q = this.value; paintProductList(); };
    $("#cf").onchange = function () { pFilter.cat = this.value; paintProductList(); };
    $("#add-p").onclick = function () { editProduct(null); };
    paintProductList();
  }
  function paintProductList() {
    var q = pFilter.q.trim().toLowerCase();
    var list = content.products.filter(function (x) {
      return (!pFilter.cat || x.cat === pFilter.cat) && (!q || (x.ar + " " + x.en).toLowerCase().indexOf(q) > -1);
    });
    var box = $("#plist");
    box.innerHTML = list.length ? list.map(function (x) {
      return '<div class="row">' + (x.images[0] ? '<img class="thumb" src="' + esc(imgSrc(x.images[0])) + '" alt="">' : '<div class="thumb"></div>') +
        '<div class="r-main"><b>' + esc(x.ar || x.en) + "</b><small>" + esc(x.en) + " · " + esc(catName(x.cat)) + " · " + x.images.length + " صور</small></div>" +
        '<label class="chk"><input type="checkbox" data-feat="' + esc(x.id) + '"' + (x.featured ? " checked" : "") + "> في الرئيسية</label>" +
        '<div class="acts"><button class="btn ghost sm" data-edit="' + esc(x.id) + '">تعديل</button><button class="btn danger sm" data-del="' + esc(x.id) + '">حذف</button></div></div>';
    }).join("") : '<div class="empty">مفيش منتجات هنا.</div>';
    box.onclick = function (e) {
      var ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) editProduct(ed.dataset.edit);
      if (del && confirm("متأكد إنك عايز تحذف المنتج ده؟")) {
        var snap = clone(content);
        content.products = content.products.filter(function (x) { return x.id !== del.dataset.del; });
        saveOrRevert(snap, "تم الحذف").then(paintPanel);
      }
    };
    box.onchange = function (e) {
      var f = e.target.closest("[data-feat]");
      if (!f) return;
      var snap = clone(content);
      content.products.forEach(function (x) { if (x.id === f.dataset.feat) x.featured = f.checked; });
      saveOrRevert(snap).then(function (ok) { if (!ok) paintPanel(); });
    };
  }
  function productBody(d) {
    return '<div class="card"><h2>الأساسيات</h2><div class="grid2">' + tf("القسم", "cat", { options: catOptions(false) }) + "<div></div></div>" +
      bi("اسم المنتج", "ar", "en") + bi("وصف قصير", "dAr", "dEn", { area: true, rows: 2, hint: "جملة أو اتنين بتظهر على كارت المنتج." }) +
      chk("يظهر في الصفحة الرئيسية", "featured") + "</div>" +
      '<div class="card"><h2>الصور</h2><p class="muted">أول صورة هي الرئيسية. الصور بتتضغط تلقائياً قبل الرفع.</p>' + imgList("images", 12) + "</div>" +
      '<div class="card"><h2>تفاصيل المنتج</h2>' + bi("وصف تفصيلي", "detAr", "detEn", { area: true, rows: 5, hint: "كل سطر جديد بيبقى فقرة." }) + "</div>" +
      '<div class="card"><h2>مواصفات إضافية</h2><p class="muted">بتظهر في جدول المواصفات (أبعاد، سعة، قدرة، خامة...).</p>' +
      (d.specs || []).map(function (s, i) {
        return '<div class="rep-row c4">' + tf("الاسم (عربي)", "specs." + i + ".kAr") + tf("الاسم (English)", "specs." + i + ".kEn", { dir: "ltr" }) +
          tf("القيمة (عربي)", "specs." + i + ".vAr") + tf("القيمة (English)", "specs." + i + ".vEn", { dir: "ltr" }) + rmBtn("specs", i) + "</div>";
      }).join("") + addBtn("specs", { kAr: "", kEn: "", vAr: "", vEn: "" }, "إضافة مواصفة") + "</div>";
  }
  function editProduct(id) {
    var existing = id && content.products.filter(function (x) { return x.id === id; })[0];
    var draft = existing ? clone(existing) : { id: "", cat: content.categories[0].id, ar: "", en: "", dAr: "", dEn: "", detAr: "", detEn: "", featured: false, images: [], specs: [] };
    editor(existing ? "تعديل: " + (existing.ar || existing.en) : "منتج جديد", draft, productBody, function (d) {
      if (!d.ar.trim() && !d.en.trim()) { toast("اكتب اسم المنتج", true); return false; }
      if (existing) content.products = content.products.map(function (x) { return x.id === id ? d : x; });
      else { d.id = slug(d.en) || rid("product"); content.products.push(d); }
      return save().then(function (ok) { if (ok) paintPanel(); return ok; });
    });
  }

  /* ----- projects ----- */
  function panelProjects(p) {
    p.innerHTML = '<div class="bar"><span class="spacer"></span><button class="btn primary" id="add-j">+ مشروع جديد</button></div><div class="list" id="jlist"></div>';
    $("#add-j").onclick = function () { editProject(null); };
    var box = $("#jlist");
    box.innerHTML = content.projects.length ? content.projects.map(function (x) {
      var tn = PROJECT_TYPES.filter(function (t) { return t[0] === x.type; })[0];
      return '<div class="row">' + (x.images[0] ? '<img class="thumb" src="' + esc(imgSrc(x.images[0])) + '" alt="">' : '<div class="thumb"></div>') +
        '<div class="r-main"><b>' + esc(x.ar || x.en) + "</b><small>" + esc(tn ? tn[1] : "") + " · " + x.images.length + " صور" + (x.video ? " · فيديو" : "") + "</small></div>" +
        '<div class="acts"><button class="btn ghost sm" data-edit="' + esc(x.id) + '">تعديل</button><button class="btn danger sm" data-del="' + esc(x.id) + '">حذف</button></div></div>';
    }).join("") : '<div class="empty">لسه مفيش مشاريع. اضغط «مشروع جديد».</div>';
    box.onclick = function (e) {
      var ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
      if (ed) editProject(ed.dataset.edit);
      if (del && confirm("متأكد إنك عايز تحذف المشروع ده؟")) {
        var snap = clone(content);
        content.projects = content.projects.filter(function (x) { return x.id !== del.dataset.del; });
        saveOrRevert(snap, "تم الحذف").then(paintPanel);
      }
    };
  }
  function projectBody() {
    return '<div class="card"><h2>الأساسيات</h2><div class="grid2">' + tf("نوع المكان", "type", { options: PROJECT_TYPES }) + "<div></div></div>" +
      bi("اسم المشروع", "ar", "en") + bi("الأجهزة المركّبة", "items.ar", "items.en", { hint: "مثال: بوتجازات، قلايات، ترابيزات تحضير" }) + "</div>" +
      '<div class="card"><h2>الصور</h2>' + imgList("images", 24) + "</div>" +
      '<div class="card"><h2>فيديو (اختياري)</h2>' + tf("رابط الفيديو", "video", { dir: "ltr", ph: "https://www.youtube.com/watch?v=...", hint: "يوتيوب أو فيميو أو ملف mp4. لازم يبدأ بـ https" }) + "</div>" +
      '<div class="card"><h2>تفاصيل المشروع</h2>' + bi("وصف", "detAr", "detEn", { area: true, rows: 4 }) + "</div>";
  }
  function editProject(id) {
    var existing = id && content.projects.filter(function (x) { return x.id === id; })[0];
    var draft = existing ? clone(existing) : { id: "", type: "restaurant", ar: "", en: "", items: { ar: "", en: "" }, detAr: "", detEn: "", video: "", images: [] };
    editor(existing ? "تعديل: " + (existing.ar || existing.en) : "مشروع جديد", draft, projectBody, function (d) {
      if (!d.ar.trim() && !d.en.trim()) { toast("اكتب اسم المشروع", true); return false; }
      d.video = (d.video || "").trim();
      if (!httpsOnly(d.video)) { toast("رابط الفيديو لازم يبدأ بـ https", true); return false; }
      if (existing) content.projects = content.projects.map(function (x) { return x.id === id ? d : x; });
      else { d.id = slug(d.en) || rid("project"); content.projects.push(d); }
      return save().then(function (ok) { if (ok) paintPanel(); return ok; });
    });
  }

  /* ----- generic settings panels (bound to `content`) ----- */
  function settingsPanel(root, html) {
    root.innerHTML = "";
    var box = document.createElement("div");
    root.appendChild(box);
    paintInto(box, content, html() + '<div class="savebar"><button class="btn primary" id="save-btn" type="button">حفظ التغييرات</button></div>');
    $("#save-btn").onclick = function () { var b = this; b.disabled = true; save().then(function () { b.disabled = false; paintPanel(); }); };
    return box;
  }
  var panelWire = null;
  function settingsRepaint() {
    // re-render current settings tab keeping unsaved edits (they live in `content`)
    var p = $("#panel");
    var st = window.scrollY;
    paintPanel();
    window.scrollTo(0, st);
    return p;
  }

  function panelImages(root) {
    settingsPanel(root, function () {
      return '<div class="hint-box">الصور بتتحول تلقائياً لحجم مناسب للموقع. لو مفيش صورة، بيظهر مكانها شكل فاضي.</div>' +
        '<div class="card"><h2>أول شاشة (Hero)</h2><p class="muted">الصورة الكبيرة اللي في الكارت تحت العنوان.</p>' + imgOne("site.images.hero") +
        '<div style="margin-top:14px">' + tf("رابط فيديو (اختياري)", "site.heroVideo", { dir: "ltr", ph: "https://www.youtube.com/watch?v=...", hint: "لو اتحط، بيظهر زر تشغيل على الصورة." }) + "</div></div>" +
        '<div class="card"><h2>الخدمات (3 كروت)</h2><div class="grid3">' +
        [0, 1, 2].map(function (i) { return "<div><b>" + ["تصنيع بالمقاس", "توصيل وتركيب", "تسليم جاهز للتشغيل"][i] + "</b>" + imgOne("site.images.svc." + i) + "</div>"; }).join("") + "</div></div>" +
        '<div class="card"><h2>أقسام المنتجات (الدايرة اللي في النص)</h2>' + imgOne("site.images.menu") + "</div>" +
        '<div class="card"><h2>أنواع الأماكن (دواير)</h2><div class="grid3">' +
        PROJECT_TYPES.map(function (t) { return "<div><b>" + t[1] + "</b>" + imgOne("site.images.venues." + t[0]) + "</div>"; }).join("") + "</div></div>" +
        '<div class="card"><h2>المصنع</h2><div class="grid2"><div><b>صورة المصنع (الرئيسية)</b>' + imgOne("site.images.factory") +
        "</div><div><b>صورة صفحة «من نحن»</b>" + imgOne("site.images.about") + "</div></div></div>";
    });
  }

  function panelCategories(root) {
    settingsPanel(root, function () {
      return content.categories.map(function (c, i) {
        return '<div class="card"><h2>' + esc(c.ar) + "</h2>" + bi("الاسم", "categories." + i + ".ar", "categories." + i + ".en") +
          bi("وصف قصير", "categories." + i + ".dAr", "categories." + i + ".dEn", { area: true, rows: 2 }) + "</div>";
      }).join("");
    });
  }

  function panelCompany(root) {
    var box = settingsPanel(root, function () {
      var s = content.site;
      return '<div class="card"><h2>التواصل</h2><div class="grid2">' +
        tf("رقم واتساب", "site.whatsapp", { dir: "ltr", ph: "201019182323", hint: "بالصيغة الدولية من غير + أو مسافات." }) +
        tf("الإيميل الرسمي", "site.email", { dir: "ltr", type: "email" }) + "</div>" +
        '<h3 style="margin:16px 0 8px;font-size:1rem">الأشخاص وأرقامهم (بيظهروا في الرئيسية وصفحة التواصل والفوتر)</h3>' +
        (s.contacts || []).map(function (c, i) {
          return '<div class="rep-row"><div class="grid2">' + tf("الاسم (عربي)", "site.contacts." + i + ".ar", { ph: "م. سيد سلامة" }) + tf("Name (English)", "site.contacts." + i + ".en", { dir: "ltr", ph: "Eng. Sayed Salama" }) + "</div>" +
            '<div class="grid2">' + tf("المسمى (عربي)", "site.contacts." + i + ".tAr", { ph: "صاحب الشركة" }) + tf("Title (English)", "site.contacts." + i + ".tEn", { dir: "ltr", ph: "Company Owner" }) + "</div>" +
            '<div class="grid2">' + tf("رقم الموبايل", "site.contacts." + i + ".phone", { dir: "ltr", ph: "01067966076" }) +
            '<div><b style="font-size:.88rem">الصورة (اختياري)</b>' + imgOne("site.contacts." + i + ".photo") + "</div></div>" + rmBtn("site.contacts", i) + "</div>";
        }).join("") + addBtn("site.contacts", { ar: "", en: "", tAr: "", tEn: "", phone: "", photo: "" }, "إضافة شخص") +
        '<div style="margin-top:14px">' + bi("العنوان", "site.address.ar", "site.address.en") + bi("مواعيد العمل", "site.hours.ar", "site.hours.en", { ph: "السبت - الخميس: 9 ص - 5 م" }) +
        tf("رابط خريطة جوجل (Embed)", "site.mapEmbed", { dir: "ltr", ph: "https://www.google.com/maps/embed?pb=...", hint: "من جوجل ماب: مشاركة ← تضمين خريطة ← انسخ قيمة src." }) + "</div></div>" +

        '<div class="card"><h2>أرقام الشركة</h2><p class="muted">بتظهر في الصفحة الرئيسية لو اتملت. مثال: 1997 — سنة التأسيس.</p>' +
        (s.stats || []).map(function (x, i) {
          return '<div class="rep-row c3">' + tf("الرقم", "site.stats." + i + ".value", { dir: "ltr" }) + tf("الوصف (عربي)", "site.stats." + i + ".ar") + tf("الوصف (English)", "site.stats." + i + ".en", { dir: "ltr" }) + rmBtn("site.stats", i) + "</div>";
        }).join("") + addBtn("site.stats", { value: "", ar: "", en: "" }, "إضافة رقم") + "</div>" +

        '<div class="card"><h2>الاعتمادات والشهادات</h2>' +
        (s.credentials || []).map(function (x, i) {
          return '<div class="rep-row c2">' + tf("عربي", "site.credentials." + i + ".ar") + tf("English", "site.credentials." + i + ".en", { dir: "ltr" }) + rmBtn("site.credentials", i) + "</div>";
        }).join("") + addBtn("site.credentials", { ar: "", en: "" }, "إضافة اعتماد") + "</div>" +

        '<div class="card"><h2>دول التصدير</h2><p class="muted">اسم دولة في كل سطر. اكتب العربي والإنجليزي بنفس الترتيب.</p><div class="grid2">' +
        '<label class="f"><span>بالعربي</span><textarea rows="6" data-k="site.exportCountries.ar" data-lines></textarea></label>' +
        '<label class="f"><span>English</span><textarea rows="6" dir="ltr" data-k="site.exportCountries.en" data-lines></textarea></label></div></div>' +

        '<div class="card"><h2>التتبع والإعلانات</h2><div class="grid3">' +
        tf("Google Analytics ID", "site.ga", { dir: "ltr", ph: "G-XXXXXXXXXX" }) + tf("Meta Pixel ID", "site.pixel", { dir: "ltr", ph: "1234567890" }) +
        tf("رابط استقبال النموذج (اختياري)", "site.formEndpoint", { dir: "ltr", ph: "https://formspree.io/f/...", hint: "لو عايز الطلبات توصل إيميل كمان." }) + "</div></div>";
    });
    if (!panelWire) {
      wire($("#panel"), function () { return content; }, settingsRepaint);
      panelWire = true;
    }
    return box;
  }

  /* ----- users (owners only) ----- */
  var USER_ERRORS = {
    bad_username: "اسم المستخدم لازم يكون 3 إلى 30 حرف: إنجليزي صغير وأرقام ونقطة وشرطة بس.",
    too_short: "كلمة السر لازم تكون 8 حروف على الأقل.",
    exists: "اسم المستخدم ده موجود قبل كده.",
    forbidden: "الصلاحية دي للمدير بس.",
    storage_not_configured: "تخزين المستخدمين مش متضبط. اربط Upstash Redis بالمشروع.",
    cannot_change_self: "مينفعش تغيّر صلاحيتك بنفسك.",
    cannot_delete_self: "مينفعش تحذف حسابك بنفسك.",
    too_many_users: "وصلت للحد الأقصى من المستخدمين.",
    managed_by_env: "المستخدم ده متحدد في إعدادات Vercel (ADMIN_USERS) ومينفعش يتعدل من هنا."
  };
  function roleLabel(r) { return r === "owner" ? "مدير (كل الصلاحيات)" : "محرر (تعديل المحتوى)"; }
  function panelUsers(root) {
    root.innerHTML = '<div class="card"><p class="muted">جاري التحميل...</p></div>';
    api("/api/users").then(function (d) { paintUsers(root, d); })
      .catch(function (e) { if (e.message !== "auth") root.innerHTML = '<div class="card">مقدرناش نحمّل المستخدمين.</div>'; });
  }
  function paintUsers(root, d) {
    root.innerHTML = (d.canManage ? "" : '<div class="hint-box">إضافة مستخدمين من هنا محتاجة Redis. من غيره ضيفهم في Vercel: Settings ← Environment Variables ← <span class="ltr">ADMIN_USERS</span> بالشكل <span class="ltr">sara:Pass12345:editor,omar:Pass67890:owner</span> وأعد النشر.</div>') +
      '<div class="bar"><span class="muted">المدير يعدّل كل حاجة ويدير المستخدمين. المحرر يعدّل المحتوى بس.</span><span class="spacer"></span>' +
      '<button class="btn primary" id="add-u"' + (d.canManage ? "" : " disabled") + '>+ مستخدم جديد</button></div><div class="list" id="ulist">' +
      (d.ownerConfigured ? '<div class="row"><div class="r-main"><b>' + esc(d.ownerUsername) + ' <span class="tag">الحساب الأساسي</span></b><small>مدير · كلمة سره في إعدادات الاستضافة (ADMIN_PASSWORD)</small></div></div>' : "") +
      d.users.map(function (u) {
        if (u.env) {
          return '<div class="row"><div class="r-main"><b>' + esc(u.name) + ' <span class="tag">من إعدادات Vercel</span></b><small><span class="ltr">' + esc(u.username) + "</span> · " + roleLabel(u.role) + "</small></div></div>";
        }
        return '<div class="row"><div class="r-main"><b>' + esc(u.name) + '</b><small><span class="ltr">' + esc(u.username) + "</span> · " + roleLabel(u.role) + "</small></div>" +
          '<div class="acts"><button class="btn ghost sm" data-uedit="' + esc(u.username) + '">تعديل</button>' +
          (u.username === me.username ? "" : '<button class="btn danger sm" data-udel="' + esc(u.username) + '">حذف</button>') + "</div></div>";
      }).join("") + "</div>";
    var reload = function () { panelUsers(root); };
    $("#add-u").onclick = function () {
      editor("مستخدم جديد", { username: "", name: "", role: "editor", password: "" }, function () {
        return '<div class="card"><div class="grid2">' + tf("الاسم", "name") + tf("اسم المستخدم (للدخول)", "username", { dir: "ltr", hint: "حروف إنجليزي صغيرة وأرقام، من 3 لـ 30." }) + "</div>" +
          '<div class="grid2">' + tf("كلمة السر", "password", { type: "password", dir: "ltr", hint: "8 حروف على الأقل." }) +
          tf("الصلاحية", "role", { options: [["editor", "محرر (تعديل المحتوى)"], ["owner", "مدير (كل الصلاحيات)"]] }) + "</div></div>";
      }, function (draft) {
        if (!draft.username || !draft.password) { toast("اكتب اسم المستخدم وكلمة السر.", true); return false; }
        return api("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) })
          .then(function () { toast("تمت إضافة المستخدم ✓"); reload(); return true; })
          .catch(function (e) { if (e.message !== "auth") toast(USER_ERRORS[e.code] || "فشلت الإضافة.", true); return false; });
      });
    };
    $("#ulist").onclick = function (e) {
      var ed = e.target.closest("[data-uedit]"), del = e.target.closest("[data-udel]");
      if (ed) {
        var u = d.users.filter(function (x) { return x.username === ed.dataset.uedit; })[0];
        editor("تعديل: " + u.username, { name: u.name, role: u.role, password: "" }, function () {
          return '<div class="card"><div class="grid2">' + tf("الاسم", "name") +
            tf("الصلاحية", "role", { options: [["editor", "محرر (تعديل المحتوى)"], ["owner", "مدير (كل الصلاحيات)"]] }) + "</div>" +
            tf("كلمة سر جديدة", "password", { type: "password", dir: "ltr", hint: "سيبها فاضية لو مش عايز تغيّرها. لو غيّرتها المستخدم هيتسجّل خروجه." }) + "</div>";
        }, function (draft) {
          var body = { name: draft.name, role: draft.role };
          if (draft.password) body.password = draft.password;
          return api("/api/users/" + encodeURIComponent(u.username), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
            .then(function () { toast("تم الحفظ ✓"); reload(); return true; })
            .catch(function (e2) { if (e2.message !== "auth") toast(USER_ERRORS[e2.code] || "فشل الحفظ.", true); return false; });
        });
      }
      if (del && confirm("تحذف المستخدم " + del.dataset.udel + "؟ مش هيقدر يدخل تاني.")) {
        api("/api/users/" + encodeURIComponent(del.dataset.udel), { method: "DELETE" })
          .then(function () { toast("تم الحذف"); reload(); })
          .catch(function (e3) { if (e3.message !== "auth") toast(USER_ERRORS[e3.code] || "فشل الحذف.", true); });
      }
    };
  }

  function panelSecurity(root) {
    root.innerHTML = '<div class="card"><h2>تغيير كلمة السر</h2><p class="muted" id="pw-note">اختار كلمة سر 8 حروف على الأقل.</p>' +
      '<div class="grid3">' + '<label class="f"><span>كلمة السر الحالية</span><input type="password" id="pw-cur" autocomplete="current-password"></label>' +
      '<label class="f"><span>كلمة السر الجديدة</span><input type="password" id="pw-new" autocomplete="new-password"></label>' +
      '<div></div></div><p style="margin-top:14px"><button class="btn primary" id="pw-save">تغيير</button></p></div>';
    $("#pw-save").onclick = function () {
      if (!$("#pw-cur").value) { toast("اكتب كلمة السر الحالية.", true); $("#pw-cur").focus(); return; }
      if ($("#pw-new").value.length < 8) { toast("كلمة السر لازم تكون 8 حروف على الأقل.", true); $("#pw-new").focus(); return; }
      api("/api/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: $("#pw-cur").value, next: $("#pw-new").value }) })
        .then(function () { toast("تم تغيير كلمة السر ✓"); $("#pw-cur").value = ""; $("#pw-new").value = ""; })
        .catch(function (e) {
          var m = { bad_password: "كلمة السر الحالية غلط.", too_short: "كلمة السر لازم تكون 8 حروف على الأقل.", password_set_by_env: "كلمة السر متحددة من إعدادات السيرفر ومينفعش تتغير من هنا." }[e.code];
          if (e.message !== "auth") toast(m || "فشل التغيير.", true);
        });
    };
  }

  /* ---------- auth + boot ---------- */
  function showLogin() {
    // an open editor must not float above the login screen; it comes back (with its draft) after logging in again
    document.querySelectorAll(".mod").forEach(function (m) { m.style.display = "none"; });
    $("#app").hidden = true; $("#login").hidden = false;
    setTimeout(function () { ($("#login-user").value ? $("#login-pw") : $("#login-user")).focus(); }, 50);
  }
  var storage = null;
  function renderBanner() {
    var msgs = [];
    if (storage && storage.content === "none") msgs.push("المحتوى مش هيتحفظ: ضيف GITHUB_TOKEN في إعدادات Vercel (شوف README) وأعد النشر.");
    $("#banner").innerHTML = msgs.map(esc).join("<br>");
    $("#banner-wrap").hidden = !msgs.length;
  }
  function renderWho() {
    $("#who").textContent = me ? me.name + " · " + (me.role === "owner" ? "مدير" : "محرر") : "";
  }
  function showApp() {
    $("#login").hidden = true; $("#app").hidden = false;
    renderWho();
    renderBanner();
    document.querySelectorAll(".mod").forEach(function (m) { m.style.display = ""; });
    paintPanel();
  }

  $("#login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#login-err");
    err.hidden = true;
    api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: $("#login-user").value.trim(), password: $("#login-pw").value }) })
      .then(function () { return api("/api/me"); })
      .then(function (m) { storage = m.storage; me = m.user; return content ? content : api("/api/admin/content"); }) // after an expired session keep the unsaved edits already on screen
      .then(function (c) { content = c; $("#login-pw").value = ""; showApp(); })
      .catch(function (e2) {
        err.textContent = e2.code === "too_many_attempts" ? "محاولات كتير. استنى 15 دقيقة وجرّب تاني."
          : e2.code === "bad_password" ? "اسم المستخدم أو كلمة السر غلط."
          : e2.code === "admin_not_configured" ? "الحساب الأساسي مش متفعّل. ضيف ADMIN_PASSWORD في إعدادات المشروع."
          : "مقدرناش نوصل للسيرفر. جرّب تاني.";
        err.hidden = false;
      });
  });
  $("#logout").onclick = function () {
    if (dirty && !confirm("في تغييرات لسه ما اتحفظتش. تخرج وتتجاهلها؟")) return;
    api("/api/logout", { method: "POST" }).then(function () {
      content = null; dirty = false; me = null;
      document.querySelectorAll(".mod").forEach(function (m) { m.remove(); });
      showLogin();
    });
  };
  $("#tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.dataset.tab;
    paintPanel();
  });

  api("/api/me").then(function (m) {
    storage = m.storage;
    me = m.user;
    if (!m.authed) return showLogin();
    return api("/api/admin/content").then(function (c) { content = c; showApp(); });
  }).catch(function () { showLogin(); });
})();
