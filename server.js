/* UNI STEEL — website + admin API.
   Runs in two modes:
   - Local / VPS:  npm start   (http://localhost:3000, admin at /admin/). Content and images are stored in ./data and ./uploads.
   - Vercel:       the Express app is exported and runs as a serverless function. Vercel has no writable disk, so the admin
                   saves content and uploaded photos to the GitHub repo (branch "content") through the GitHub API. The public
                   site reads them straight from GitHub, so Vercel storage and Vercel functions are not used for visitors.
   Env (all optional locally):
     PORT, TRUST_PROXY
     ADMIN_USERNAME        username of the built-in owner account (default "admin")
     ADMIN_PASSWORD        password of the built-in owner; required on Vercel; locally generated on first run if missing
     ADMIN_USERS           extra admin users: "name:password:role,name2:password2" (role owner|editor, default editor)
     SESSION_SECRET        optional; otherwise derived from ADMIN_PASSWORD
     GITHUB_TOKEN          token with "Contents: read and write" on the repo -> content + photos live in GitHub
     GITHUB_REPO           "owner/repo" (default kedaagency/unisteel)      GITHUB_BRANCH  (default "content")
     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   optional alternative to GitHub (content, photos and users) */
"use strict";

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ON_VERCEL = !!process.env.VERCEL;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const BACKUPS = path.join(DATA, "backups");
const CONTENT_FILE = path.join(DATA, "content.json");
const ADMIN_FILE = path.join(DATA, "admin.json");
const SECRET_FILE = path.join(DATA, "secret.key");
const PORT = process.env.PORT || 3000;

const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/+$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPO = (process.env.GITHUB_REPO || "kedaagency/unisteel").trim();
const GITHUB_BRANCH = (process.env.GITHUB_BRANCH || "content").trim();
const GITHUB_API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
const USE_GITHUB = !!GITHUB_TOKEN && /^[\w.-]+\/[\w.-]+$/.test(GITHUB_REPO);
const IMG_PREFIX = "unisteel:img:";
const CONTENT_KEY = "unisteel:content";
const BACKUP_KEY = "unisteel:content:backups";

if (!ON_VERCEL) [DATA, UPLOADS, BACKUPS].forEach((d) => fs.mkdirSync(d, { recursive: true }));

/* ---------------- secrets / password ---------------- */
let SECRET;
if (process.env.SESSION_SECRET) SECRET = process.env.SESSION_SECRET;
else if (process.env.ADMIN_PASSWORD) SECRET = crypto.createHash("sha256").update("unisteel-session|" + process.env.ADMIN_PASSWORD).digest("hex");
else if (GITHUB_TOKEN) SECRET = crypto.createHash("sha256").update("unisteel-session|" + GITHUB_TOKEN).digest("hex");
else if (REDIS_URL && REDIS_TOKEN) SECRET = crypto.createHash("sha256").update("unisteel-session|" + REDIS_TOKEN).digest("hex");
else if (!ON_VERCEL) {
  if (fs.existsSync(SECRET_FILE)) SECRET = fs.readFileSync(SECRET_FILE, "utf8").trim();
  else { SECRET = crypto.randomBytes(32).toString("hex"); fs.writeFileSync(SECRET_FILE, SECRET); }
} else SECRET = crypto.randomBytes(32).toString("hex"); // Vercel without ADMIN_PASSWORD: login is disabled anyway

function hashPassword(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString("hex"); }
function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function setPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ salt, hash: hashPassword(pw, salt) }));
}
function adminConfigured() { return !!process.env.ADMIN_PASSWORD || (!ON_VERCEL && fs.existsSync(ADMIN_FILE)); }
function checkPassword(pw) {
  if (typeof pw !== "string" || !pw) return false;
  if (process.env.ADMIN_PASSWORD) return safeEqual(pw, process.env.ADMIN_PASSWORD);
  if (ON_VERCEL) return false;
  try {
    const a = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8"));
    return safeEqual(hashPassword(pw, a.salt), a.hash);
  } catch (e) { console.error("admin.json unreadable:", e.message); return false; }
}
if (!process.env.ADMIN_PASSWORD && !ON_VERCEL && !fs.existsSync(ADMIN_FILE)) {
  const first = crypto.randomBytes(9).toString("base64url");
  setPassword(first);
  fs.writeFileSync(path.join(DATA, "FIRST-ADMIN-PASSWORD.txt"), first + "\n");
  console.log("\n  First run: admin password generated: " + first);
  console.log("  (also saved in data/FIRST-ADMIN-PASSWORD.txt. Change it from the admin panel, then delete that file.)\n");
}
if (ON_VERCEL && !process.env.ADMIN_PASSWORD) console.error("ADMIN_PASSWORD is not set: the built-in owner login is disabled (other admin users can still log in).");

/* ---------------- users + sessions ---------------- */
const COOKIE = "us_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const OWNER_NAME = String(process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const USERS_FILE = path.join(DATA, "users.json");
const USERS_KEY = "unisteel:users";
const DUMMY_REC = { salt: "0".repeat(32), hash: "0".repeat(128) };
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

function sign(v) { return crypto.createHmac("sha256", SECRET).update(v).digest("hex"); }
// the session cookie carries the username and a fingerprint of the password hash, so a password reset or a deleted user ends the session
function makeToken(user) {
  const p = Buffer.from(JSON.stringify({ u: user.username, v: user.v, exp: Date.now() + SESSION_MS })).toString("base64url");
  return p + "." + sign(p);
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i <= 0) return;
    const raw = p.slice(i + 1).trim();
    let val = raw;
    try { val = decodeURIComponent(raw); } catch (e) { /* malformed cookie: keep raw, it will fail the signature check */ }
    out[p.slice(0, i).trim()] = val;
  });
  return out;
}
function readToken(req) {
  const tok = parseCookies(req)[COOKIE];
  if (!tok) return null;
  const i = tok.lastIndexOf(".");
  if (i < 1) return null;
  const p = tok.slice(0, i), sig = tok.slice(i + 1);
  if (!safeEqual(sig, sign(p))) return null;
  let d;
  try { d = JSON.parse(Buffer.from(p, "base64url").toString()); } catch (e) { return null; }
  return d && typeof d.u === "string" && typeof d.v === "string" && d.exp > Date.now() ? d : null;
}
function fingerprint(rec) { return rec.hash.slice(0, 16); }
async function getSession(req) {
  const d = readToken(req);
  if (!d) return null;
  if (d.u === OWNER_NAME) {
    return d.v === "owner" && adminConfigured() ? { username: OWNER_NAME, name: "المالك", role: "owner", builtin: true } : null;
  }
  const rec = (await loadUsers())[d.u];
  if (!rec || fingerprint(rec) !== d.v) return null;
  return { username: rec.username, name: rec.name, role: rec.role, builtin: false };
}
function requireAuth(req, res, next) {
  getSession(req).then((u) => {
    if (!u) return res.status(401).json({ error: "unauthorized" });
    req.user = u;
    next();
  }).catch(next);
}
function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== "owner") return res.status(403).json({ error: "forbidden" });
  next();
}
function cookieHeader(value, maxAgeSec, req) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return COOKIE + "=" + encodeURIComponent(value) + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAgeSec + (secure ? "; Secure" : "");
}

/* stored users: { username: { username, name, role: "owner"|"editor", salt, hash, createdAt } } */
function verifyRec(pw, rec) {
  return typeof pw === "string" && pw.length > 0 && safeEqual(hashPassword(pw, rec.salt), rec.hash);
}
function newRec(username, name, role, pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { username, name, role, salt, hash: hashPassword(pw, salt), createdAt: new Date().toISOString() };
}
function canManageUsers() { return USE_REDIS || !ON_VERCEL; } // users created from the panel need Redis (or a local file)

// Users defined in the ADMIN_USERS variable ("name:password:role,..."): they work everywhere, are read-only in the panel.
const ENV_USERS = {};
String(process.env.ADMIN_USERS || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((item) => {
  const parts = item.split(":");
  const username = (parts.shift() || "").trim().toLowerCase();
  let role = "editor";
  if (parts.length >= 2 && /^(owner|editor)$/.test(parts[parts.length - 1])) role = parts.pop();
  const pw = parts.join(":");
  if (!USERNAME_RE.test(username) || username === OWNER_NAME || pw.length < 8) { console.error("ADMIN_USERS: skipped an invalid entry (" + username + ")"); return; }
  const rec = newRec(username, username, role, pw);
  rec.env = true;
  ENV_USERS[username] = rec;
});
let usersCache = { at: 0, v: null };
async function loadUsers(force) {
  if (!force && usersCache.v && Date.now() - usersCache.at < 5000) return usersCache.v;
  let u = {};
  if (USE_REDIS) {
    const raw = await redisCall(["GET", USERS_KEY]);
    if (raw) { try { u = JSON.parse(raw) || {}; } catch (e) { console.error("users data corrupt:", e.message); } }
  } else if (!ON_VERCEL) {
    try { u = JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) || {}; } catch (e) { /* no users yet */ }
  }
  u = Object.assign({}, u, ENV_USERS);
  usersCache = { at: Date.now(), v: u };
  return u;
}
async function saveUsers(all) {
  const u = {};
  Object.keys(all).forEach((k) => { if (!all[k].env) u[k] = all[k]; }); // env users are never written to storage
  if (USE_REDIS) await redisCall(["SET", USERS_KEY, JSON.stringify(u)]);
  else if (!ON_VERCEL) { const tmp = USERS_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(u, null, 2)); fs.renameSync(tmp, USERS_FILE); }
  else throw storageError("storage_not_configured");
  usersCache = { at: Date.now(), v: Object.assign({}, u, ENV_USERS) };
}
function publicUser(u) { return { username: u.username, name: u.name, role: u.role, createdAt: u.createdAt, env: !!u.env }; }

// per-instance login throttle (on serverless each instance has its own counter, so this is best-effort there)
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
function tooManyAttempts(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  attempts.set(ip, list);
  return list.length >= 10;
}
setInterval(() => {
  const now = Date.now();
  attempts.forEach((list, ip) => { if (!list.some((t) => now - t < WINDOW_MS)) attempts.delete(ip); });
}, 5 * 60 * 1000).unref();

/* ---------------- content: validation ---------------- */
// Built-in starting content. If this file were ever missing from the serverless bundle, fall back to a minimal
// set so the API (and the admin panel) still start; content saved in Redis / data/ is unaffected.
let DEFAULTS;
try { DEFAULTS = JSON.parse(JSON.stringify(require("./public/js/data.js"))); }
catch (e) {
  console.error("public/js/data.js could not be loaded, using minimal defaults:", e.message);
  DEFAULTS = {
    SITE: { whatsapp: "201019182323", phones: ["01019182323"], contacts: [{ ar: "", en: "", tAr: "", tEn: "", phone: "01019182323", photo: "" }], address: { ar: "", en: "" }, hours: { ar: "", en: "" } },
    CATEGORIES: [
      { id: "cooling", ar: "التبريد", en: "Refrigeration" }, { id: "cooking", ar: "الطهي", en: "Cooking" },
      { id: "holding", ar: "الحفظ والتقديم", en: "Holding & Serving" }, { id: "bulk", ar: "الإنتاج بالكميات", en: "Bulk Production" },
      { id: "equipment", ar: "التجهيزات", en: "Kitchen Equipment" }
    ],
    PRODUCTS: [], PROJECTS: [],
    PROJECT_TYPES: ["restaurant", "hotel", "cafe", "central", "catering"].map((id) => ({ id }))
  };
}
const CAT_IDS = DEFAULTS.CATEGORIES.map((c) => c.id);
const TYPE_IDS = DEFAULTS.PROJECT_TYPES.map((t) => t.id);

function s(v, max) {
  if (v != null && typeof v === "object") return ""; // never turn objects/arrays into "[object Object]" or "a,b"
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max || 500);
}
// images are local uploads ("uploads/x.webp"), files shipped with the site ("img/products/x.webp") images kept in Redis ("api/img/x.webp") or in the GitHub repo ("gh/x.webp")
const IMG_RE = /^(uploads\/[A-Za-z0-9_.-]+|img\/(?!.*\.\.)[A-Za-z0-9_./-]+|(?:api\/img|gh)\/[a-z0-9-]+\.(?:webp|jpg|png|gif))$/;
function img(v) { v = s(v, 300); return IMG_RE.test(v) ? v : ""; }
function imgs(a, max) { return (Array.isArray(a) ? a : []).map(img).filter(Boolean).slice(0, max || 20); }
// video links: any https address, or a file uploaded to this same server when running locally
function videoUrl(v) { v = s(v, 500); return /^(https:\/\/[^\s"'<>]+|\/uploads\/[A-Za-z0-9_.-]+\.(mp4|webm))$/.test(v) ? v : ""; }
function https(v) { v = s(v, 500); return /^https:\/\/[^\s"'<>]+$/.test(v) ? v : ""; }
function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function arr(v) { return Array.isArray(v) ? v : []; }
function bi(o) { o = obj(o); return { ar: s(o.ar), en: s(o.en) }; }
function phone(v) { return s(v, 20).replace(/[^\d+\s()-]/g, "").trim(); }
function waNumber(v) {
  let d = s(v, 24).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^01\d{9}$/.test(d)) d = "2" + d; // Egyptian mobile typed locally (01x...) -> international 201x...
  return d.slice(0, 20);
}
function email(v) { v = s(v, 120); return /^[^\s@<>"']+@[^\s@<>"']+$/.test(v) ? v : ""; }
function slug(v, fallback) {
  const x = s(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return x || fallback;
}
function uniqueIds(list, prefix) {
  const seen = new Set();
  list.forEach((it, i) => {
    let id = slug(it.id, prefix + "-" + (i + 1));
    while (seen.has(id)) id += "-" + crypto.randomBytes(2).toString("hex");
    seen.add(id); it.id = id;
  });
  return list;
}

function normalize(b) {
  b = obj(b);
  const st = obj(b.site);
  const im = obj(st.images);
  const venues = {};
  TYPE_IDS.forEach((id) => { venues[id] = img(obj(im.venues)[id]); });
  const site = {
    whatsapp: waNumber(st.whatsapp),
    email: email(st.email),
    address: bi(st.address),
    hours: bi(st.hours),
    mapEmbed: /^https:\/\/www\.google\.com\/maps\/[^\s"'<>]*$/.test(s(st.mapEmbed, 1000)) ? s(st.mapEmbed, 1000) : "",
    formEndpoint: https(st.formEndpoint),
    ga: s(st.ga, 30).replace(/[^A-Za-z0-9-]/g, ""),
    pixel: s(st.pixel, 30).replace(/\D/g, ""),
    heroVideo: videoUrl(st.heroVideo),
    stats: arr(st.stats).slice(0, 8).map((x) => { x = obj(x); return { value: s(x.value, 20), ar: s(x.ar, 80), en: s(x.en, 80) }; }).filter((x) => x.value),
    credentials: arr(st.credentials).slice(0, 20).map((x) => { x = obj(x); return { ar: s(x.ar, 100), en: s(x.en, 100) }; }).filter((x) => x.ar || x.en),
    exportCountries: {
      ar: arr(obj(st.exportCountries).ar).map((x) => s(x, 60)).filter(Boolean).slice(0, 80),
      en: arr(obj(st.exportCountries).en).map((x) => s(x, 60)).filter(Boolean).slice(0, 80)
    },
    images: {
      hero: img(im.hero), factory: img(im.factory), about: img(im.about), menu: img(im.menu),
      svc: [0, 1, 2].map((i) => img(arr(im.svc)[i])), venues
    }
  };
  // contacts: [{ ar, en, phone, photo }]. Older content only had `phones`; reuse the default names when the number matches.
  const digits = (p) => String(p).replace(/\D/g, "");
  let contacts = arr(st.contacts).slice(0, 6).map(obj)
    .map((c) => ({ ar: s(c.ar, 60), en: s(c.en, 60), tAr: s(c.tAr, 60), tEn: s(c.tEn, 60), phone: phone(c.phone), photo: img(c.photo) })).filter((c) => c.phone);
  if (!contacts.length) {
    contacts = arr(st.phones).map(phone).filter(Boolean).slice(0, 6).map((p) => {
      const d = DEFAULTS.SITE.contacts.find((x) => digits(x.phone) === digits(p));
      return { ar: d ? d.ar : "", en: d ? d.en : "", tAr: d ? d.tAr : "", tEn: d ? d.tEn : "", phone: p, photo: "" };
    });
  }
  if (!contacts.length) contacts = JSON.parse(JSON.stringify(DEFAULTS.SITE.contacts));
  contacts.forEach((c) => { // content saved before titles existed: use the default title for the same number
    if (c.tAr || c.tEn) return;
    const d = DEFAULTS.SITE.contacts.find((x) => digits(x.phone) === digits(c.phone));
    if (d) { c.tAr = d.tAr; c.tEn = d.tEn; }
  });
  site.contacts = contacts;
  site.phones = contacts.map((c) => c.phone);
  if (!site.whatsapp) site.whatsapp = DEFAULTS.SITE.whatsapp;

  const catIn = arr(b.categories);
  const categories = DEFAULTS.CATEGORIES.map((def) => {
    const c = obj(catIn.find((x) => x && x.id === def.id));
    return { id: def.id, ar: s(c.ar, 80) || def.ar, en: s(c.en, 80) || def.en, dAr: s(c.dAr, 300), dEn: s(c.dEn, 300) };
  });

  const products = uniqueIds(arr(b.products).slice(0, 500).map(obj).map((p) => ({
    id: p.id,
    cat: CAT_IDS.includes(p.cat) ? p.cat : CAT_IDS[0],
    ar: s(p.ar, 120), en: s(p.en, 120),
    dAr: s(p.dAr, 600), dEn: s(p.dEn, 600),
    detAr: s(p.detAr, 4000), detEn: s(p.detEn, 4000),
    featured: !!p.featured,
    images: imgs(p.images, 12),
    specs: arr(p.specs).slice(0, 30)
      .map((x) => { x = obj(x); return { kAr: s(x.kAr, 80), kEn: s(x.kEn, 80), vAr: s(x.vAr, 200), vEn: s(x.vEn, 200) }; })
      .filter((x) => x.kAr || x.kEn)
  })).filter((p) => p.ar || p.en), "product");

  const projects = uniqueIds(arr(b.projects).slice(0, 300).map(obj).map((p) => ({
    id: p.id,
    type: TYPE_IDS.includes(p.type) ? p.type : TYPE_IDS[0],
    ar: s(p.ar, 120), en: s(p.en, 120),
    items: bi(p.items),
    detAr: s(p.detAr, 4000), detEn: s(p.detEn, 4000),
    video: videoUrl(p.video),
    images: imgs(p.images, 24)
  })).filter((p) => p.ar || p.en), "project");

  return { site, categories, products, projects };
}

function seedContent() {
  const d = DEFAULTS;
  const site = Object.assign({}, d.SITE);
  site.images = Object.assign({ hero: "", factory: "", about: "", menu: "", svc: ["", "", ""], venues: {} }, d.SITE.images || {});
  site.heroVideo = d.SITE.heroVideo || "";
  return normalize({ site, categories: d.CATEGORIES, products: d.PRODUCTS, projects: d.PROJECTS });
}

/* ---------------- content: storage (Redis | local file | read-only defaults) ---------------- */
function storageError(code) { const e = new Error(code); e.code = code; return e; }

async function redisCall(cmd) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("redis: " + (j.error || r.status));
  return j.result;
}
async function redisPipeline(cmds) {
  const r = await fetch(REDIS_URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds)
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j) || j.some((x) => x && x.error)) throw new Error("redis pipeline failed (" + r.status + ")");
  return j;
}

/* GitHub as storage: files live on the "content" branch of the repo. Git history is the backup. */
function ghError(r) {
  const e = new Error("github " + r.status + ": " + ((r.json && r.json.message) || ""));
  e.code = r.status === 401 || r.status === 403 ? "github_auth" : r.status === 404 ? "github_not_found" : "github_failed";
  return e;
}
async function ghFetch(method, p, body) {
  const r = await fetch(GITHUB_API + p, {
    method,
    headers: Object.assign({
      Authorization: "Bearer " + GITHUB_TOKEN, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "unisteel-admin"
    }, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
  return { status: r.status, ok: r.ok, json };
}
let ghBranchReady = false;
async function ghEnsureBranch() {
  if (ghBranchReady) return;
  const b = await ghFetch("GET", "/repos/" + GITHUB_REPO + "/branches/" + encodeURIComponent(GITHUB_BRANCH));
  if (b.ok) { ghBranchReady = true; return; }
  if (b.status !== 404) throw ghError(b);
  // first save: create the content branch from the default branch
  const repo = await ghFetch("GET", "/repos/" + GITHUB_REPO);
  if (!repo.ok) throw ghError(repo);
  const ref = await ghFetch("GET", "/repos/" + GITHUB_REPO + "/git/ref/heads/" + repo.json.default_branch);
  if (!ref.ok) throw ghError(ref);
  const mk = await ghFetch("POST", "/repos/" + GITHUB_REPO + "/git/refs", { ref: "refs/heads/" + GITHUB_BRANCH, sha: ref.json.object.sha });
  if (!mk.ok && mk.status !== 422) throw ghError(mk); // 422: someone created it a moment ago
  ghBranchReady = true;
}
async function ghGet(filePath) {
  const r = await ghFetch("GET", "/repos/" + GITHUB_REPO + "/contents/" + filePath + "?ref=" + encodeURIComponent(GITHUB_BRANCH));
  if (r.status === 404) return null; // no file yet (or no branch yet)
  if (!r.ok) throw ghError(r);
  return { sha: r.json.sha, buf: Buffer.from(r.json.content || "", "base64") };
}
async function ghPut(filePath, buf, message) {
  await ghEnsureBranch();
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await ghGet(filePath);
    const body = { message, content: buf.toString("base64"), branch: GITHUB_BRANCH };
    if (cur) body.sha = cur.sha;
    const r = await ghFetch("PUT", "/repos/" + GITHUB_REPO + "/contents/" + filePath, body);
    if (r.ok) return r.json;
    if (r.status !== 409 && r.status !== 422) throw ghError(r); // 409/422: the file changed meanwhile, read it again and retry
  }
  throw new Error("github: too many conflicts");
}

function readFileContent() {
  try { return normalize(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf8"))); } // normalize also upgrades older saved content
  catch (e) {
    if (fs.existsSync(CONTENT_FILE)) console.error("content.json corrupt (" + e.message + "), recovering");
    // newest valid backup first, otherwise the built-in defaults
    let c = null;
    try {
      const files = fs.readdirSync(BACKUPS).filter((f) => f.startsWith("content-")).sort().reverse();
      for (const f of files) {
        try { c = normalize(JSON.parse(fs.readFileSync(path.join(BACKUPS, f), "utf8"))); break; } catch (e2) { /* try the next one */ }
      }
    } catch (e3) { /* no backups folder */ }
    if (!c) c = seedContent();
    try { writeFileContent(c); } catch (e4) { console.error("could not rewrite content.json:", e4.message); }
    return c;
  }
}
function writeFileContent(c) {
  if (fs.existsSync(CONTENT_FILE)) {
    fs.copyFileSync(CONTENT_FILE, path.join(BACKUPS, "content-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json"));
    const old = fs.readdirSync(BACKUPS).filter((f) => f.startsWith("content-")).sort();
    old.slice(0, Math.max(0, old.length - 40)).forEach((f) => fs.unlinkSync(path.join(BACKUPS, f)));
  }
  const tmp = CONTENT_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(c, null, 2));
  fs.renameSync(tmp, CONTENT_FILE);
}

async function readContent() {
  if (USE_GITHUB) {
    const f = await ghGet("content.json");
    if (!f) return seedContent(); // nothing saved yet: built-in defaults (written to GitHub on the first admin save)
    try { return normalize(JSON.parse(f.buf.toString("utf8"))); }
    catch (e) { console.error("content.json in GitHub is corrupt, using defaults:", e.message); return seedContent(); }
  }
  if (USE_REDIS) {
    const raw = await redisCall(["GET", CONTENT_KEY]);
    if (!raw) return seedContent(); // nothing saved yet: show the built-in defaults (not written until the first admin save)
    try { return normalize(JSON.parse(raw)); }
    catch (e) { console.error("stored content is corrupt, using defaults:", e.message); return seedContent(); }
  }
  if (!ON_VERCEL) return readFileContent();
  return seedContent(); // Vercel without Redis: read-only defaults
}
async function writeContent(c, who) {
  if (USE_GITHUB) {
    await ghPut("content.json", Buffer.from(JSON.stringify(c, null, 2)), "Update site content" + (who ? " (" + who + ")" : ""));
    return;
  }
  if (USE_REDIS) {
    const old = await redisCall(["GET", CONTENT_KEY]);
    const cmds = [["SET", CONTENT_KEY, JSON.stringify(c)]];
    if (old) { cmds.push(["LPUSH", BACKUP_KEY, old]); cmds.push(["LTRIM", BACKUP_KEY, 0, 29]); }
    await redisPipeline(cmds);
    return;
  }
  if (ON_VERCEL) throw storageError("storage_not_configured");
  writeFileContent(c);
}
if (!ON_VERCEL && !USE_REDIS && !USE_GITHUB && !fs.existsSync(CONTENT_FILE)) writeFileContent(seedContent());

// short in-memory cache so public page views don't hit the database every time
let cache = { at: 0, value: null };
const CACHE_MS = 15000;
async function readContentCached() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  const c = await readContent();
  cache = { at: Date.now(), value: c };
  return c;
}

/* ---------------- images: storage (GitHub | Redis | local folder) ---------------- */
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const IMG_NAME_RE = /^[a-z0-9]+-[a-f0-9]{8}\.(webp|jpg|png|gif)$/;
async function saveImage(buf, ext) {
  const name = Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex") + "." + ext;
  if (USE_GITHUB) {
    await ghPut("img/" + name, buf, "Upload photo " + name);
    return "gh/" + name; // the site turns this into the raw.githubusercontent.com address (see public/js/config.js)
  }
  if (USE_REDIS) {
    // photos are compressed in the browser first (~100-300 KB), so base64 in Redis is small; they are served by GET /api/img/:name
    await redisCall(["SET", IMG_PREFIX + name, buf.toString("base64")]);
    return "api/img/" + name;
  }
  if (ON_VERCEL) throw storageError("storage_not_configured");
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return "uploads/" + name;
}

/* ---------------- app ---------------- */
const app = express();
app.disable("x-powered-by");
// Trust X-Forwarded-For only behind a real proxy (always true on Vercel; elsewhere set TRUST_PROXY=1),
// otherwise anyone could spoof their IP and bypass the login rate limit.
if (ON_VERCEL) app.set("trust proxy", 1);
else if (process.env.TRUST_PROXY) app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? +process.env.TRUST_PROXY : process.env.TRUST_PROXY);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use("/api", express.json({ limit: "2mb" }));
app.use("/api", (req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public content. On Vercel the CDN keeps it for up to a minute (fewer function calls), so admin edits show up within ~1 minute.
app.get("/api/content", wrap(async (req, res) => {
  const c = await readContentCached();
  if (ON_VERCEL) res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  res.json(c);
}));
// Admin always reads the live copy (never cached), so it can't save over a newer edit with an old one.
app.get("/api/admin/content", requireAuth, wrap(async (req, res) => {
  res.json(await readContent());
}));

app.post("/api/login", wrap(async (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) return res.status(429).json({ error: "too_many_attempts" });
  const body = obj(req.body);
  const username = s(body.username, 40).toLowerCase() || OWNER_NAME;
  const password = body.password;
  let user = null;
  if (username === OWNER_NAME) {
    if (!adminConfigured()) return res.status(503).json({ error: "admin_not_configured" });
    if (checkPassword(password)) user = { username: OWNER_NAME, v: "owner" };
  } else {
    const rec = (await loadUsers())[username];
    if (verifyRec(password, rec || DUMMY_REC) && rec) user = { username: rec.username, v: fingerprint(rec) };
  }
  if (!user) {
    attempts.get(ip).push(Date.now());
    return res.status(401).json({ error: "bad_password" });
  }
  res.setHeader("Set-Cookie", cookieHeader(makeToken(user), SESSION_MS / 1000, req));
  res.json({ ok: true });
}));
app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", cookieHeader("", 0, req));
  res.json({ ok: true });
});
app.get("/api/me", wrap(async (req, res) => {
  const u = await getSession(req);
  res.json({
    authed: !!u,
    user: u ? { username: u.username, name: u.name, role: u.role, builtin: u.builtin } : null,
    passwordFromEnv: !!process.env.ADMIN_PASSWORD,
    configured: adminConfigured(),
    canManageUsers: canManageUsers(),
    canUploadVideo: canUploadVideo(),
    storage: {
      content: USE_GITHUB ? "github" : USE_REDIS ? "redis" : ON_VERCEL ? "none" : "file",
      images: USE_GITHUB ? "github" : USE_REDIS ? "redis" : ON_VERCEL ? "none" : "file"
    }
  });
}));

app.put("/api/content", requireAuth, wrap(async (req, res) => {
  const b = req.body;
  // refuse obviously broken bodies (wrong content-type, empty object, ...) instead of wiping the site with defaults
  if (!b || typeof b !== "object" || Array.isArray(b) || !Array.isArray(b.products) || !Array.isArray(b.projects) || !b.site || typeof b.site !== "object") {
    return res.status(400).json({ error: "invalid_content" });
  }
  let c;
  try { c = normalize(b); } catch (e) { console.error(e); return res.status(400).json({ error: "invalid_content" }); }
  try { await writeContent(c, req.user.username); }
  catch (e) {
    console.error(e);
    return res.status(e.code === "storage_not_configured" ? 503 : /^github_/.test(e.code || "") ? 502 : 500).json({ error: e.code || "write_failed" });
  }
  cache = { at: Date.now(), value: c };
  res.json({ ok: true, content: c });
}));

app.post("/api/password", requireAuth, wrap(async (req, res) => {
  const { current, next } = obj(req.body);
  if (req.user.builtin) {
    // the built-in owner: password lives in the ADMIN_PASSWORD variable (or, locally, in data/admin.json)
    if (process.env.ADMIN_PASSWORD || ON_VERCEL) return res.status(400).json({ error: "password_set_by_env" });
    if (!checkPassword(current)) return res.status(403).json({ error: "bad_password" });
    if (typeof next !== "string" || next.length < 8) return res.status(400).json({ error: "too_short" });
    setPassword(next);
    // a password change must end every other session: new signing key, and keep this browser logged in
    SECRET = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(SECRET_FILE, SECRET);
    res.setHeader("Set-Cookie", cookieHeader(makeToken({ username: OWNER_NAME, v: "owner" }), SESSION_MS / 1000, req));
    const f = path.join(DATA, "FIRST-ADMIN-PASSWORD.txt");
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return res.json({ ok: true });
  }
  const users = await loadUsers(true);
  const rec = users[req.user.username];
  if (rec && rec.env) return res.status(400).json({ error: "password_set_by_env" });
  if (!rec || !verifyRec(current, rec)) return res.status(403).json({ error: "bad_password" });
  if (typeof next !== "string" || next.length < 8) return res.status(400).json({ error: "too_short" });
  const fresh = newRec(rec.username, rec.name, rec.role, next);
  fresh.createdAt = rec.createdAt;
  users[rec.username] = fresh;
  await saveUsers(users);
  res.setHeader("Set-Cookie", cookieHeader(makeToken({ username: fresh.username, v: fingerprint(fresh) }), SESSION_MS / 1000, req));
  res.json({ ok: true });
}));

/* ---- user management (owners only) ---- */
app.get("/api/users", requireAuth, requireOwner, wrap(async (req, res) => {
  const list = Object.values(await loadUsers(true)).map(publicUser).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  res.json({ users: list, ownerUsername: OWNER_NAME, ownerConfigured: adminConfigured(), canManage: canManageUsers() });
}));
app.post("/api/users", requireAuth, requireOwner, wrap(async (req, res) => {
  if (!canManageUsers()) return res.status(503).json({ error: "storage_not_configured" });
  const b = obj(req.body);
  const username = s(b.username, 30).toLowerCase();
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: "bad_username" });
  if (typeof b.password !== "string" || b.password.length < 8) return res.status(400).json({ error: "too_short" });
  const users = await loadUsers(true);
  if (username === OWNER_NAME || users[username]) return res.status(409).json({ error: "exists" });
  if (Object.keys(users).length >= 30) return res.status(400).json({ error: "too_many_users" });
  users[username] = newRec(username, s(b.name, 60) || username, b.role === "owner" ? "owner" : "editor", b.password);
  await saveUsers(users);
  res.json({ ok: true, user: publicUser(users[username]) });
}));
app.put("/api/users/:username", requireAuth, requireOwner, wrap(async (req, res) => {
  if (!canManageUsers()) return res.status(503).json({ error: "storage_not_configured" });
  const username = s(req.params.username, 30).toLowerCase();
  const b = obj(req.body);
  const users = await loadUsers(true);
  const rec = users[username];
  if (!rec) return res.status(404).json({ error: "not_found" });
  if (rec.env) return res.status(409).json({ error: "managed_by_env" });
  if (username === req.user.username && b.role && b.role !== rec.role) return res.status(400).json({ error: "cannot_change_self" });
  if (b.password != null && (typeof b.password !== "string" || b.password.length < 8)) return res.status(400).json({ error: "too_short" });
  const next = b.password ? newRec(username, rec.name, rec.role, b.password) : Object.assign({}, rec);
  next.createdAt = rec.createdAt;
  if (b.name != null) next.name = s(b.name, 60) || username;
  if (b.role === "owner" || b.role === "editor") next.role = b.role;
  users[username] = next;
  await saveUsers(users);
  res.json({ ok: true, user: publicUser(next) });
}));
app.delete("/api/users/:username", requireAuth, requireOwner, wrap(async (req, res) => {
  if (!canManageUsers()) return res.status(503).json({ error: "storage_not_configured" });
  const username = s(req.params.username, 30).toLowerCase();
  if (username === req.user.username) return res.status(400).json({ error: "cannot_delete_self" });
  const users = await loadUsers(true);
  if (!users[username]) return res.status(404).json({ error: "not_found" });
  if (users[username].env) return res.status(409).json({ error: "managed_by_env" });
  delete users[username];
  await saveUsers(users);
  res.json({ ok: true });
}));

// Vercel Functions reject request bodies over 4.5 MB; the admin compresses photos in the browser first.
const MAX_UPLOAD = ON_VERCEL ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD, files: 1 } });
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "webp";
  if (buf.length > 6 && buf.slice(0, 4).toString() === "GIF8") return "gif";
  return null;
}
app.post("/api/upload", requireAuth, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "too_large" : "upload_failed" });
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const ext = sniff(req.file.buffer);
    if (!ext) return res.status(400).json({ error: "unsupported_type" });
    // this callback runs outside Express' error handling: a storage error here must not crash the server
    try { res.json({ url: await saveImage(req.file.buffer, ext) }); }
    catch (e) {
      console.error(e);
      res.status(e.code === "storage_not_configured" ? 503 : /^github_/.test(e.code || "") ? 502 : 500).json({ error: e.code || "write_failed" });
    }
  });
});

/* ---------------- video upload ----------------
   Vercel Functions reject request bodies over 4.5 MB, so the admin sends the file in ~3 MB pieces. Each piece is parked
   (a Git blob in GitHub mode, a temp file locally) and "finish" stitches them into one file. In GitHub mode the video is
   committed to the content branch and served by jsDelivr (a free CDN with range support, pinned to that commit), so
   visitors never stream it from Vercel. jsDelivr does not serve GitHub files over 20 MB. */
const VIDEO_MAX = 20 * 1024 * 1024;
const VIDEO_CHUNK = 3 * 1024 * 1024;
const VIDEO_MAX_PARTS = Math.ceil(VIDEO_MAX / VIDEO_CHUNK) + 1;
const VIDEO_TMP = path.join(DATA, "video-tmp");
const vupload = multer({ storage: multer.memoryStorage(), limits: { fileSize: VIDEO_CHUNK + 512 * 1024, files: 1 } });
function canUploadVideo() { return USE_GITHUB || (!ON_VERCEL && !USE_REDIS); }
function sniffVideo(buf) {
  if (buf.length > 16 && buf.slice(4, 8).toString() === "ftyp" && buf.slice(8, 12).toString() !== "qt  ") return "mp4";
  if (buf.length > 16 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}
function storageStatus(e) { return e.code === "storage_not_configured" ? 503 : /^github_/.test(e.code || "") ? 502 : 500; }
app.post("/api/video/chunk", requireAuth, (req, res) => {
  if (!canUploadVideo()) return res.status(400).json({ error: "video_unsupported" });
  vupload.single("chunk")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "too_large" : "upload_failed" });
    const id = String((req.body && req.body.id) || ""), i = parseInt(req.body && req.body.i, 10);
    if (!req.file || !/^[a-f0-9]{16}$/.test(id) || !(i >= 0 && i < VIDEO_MAX_PARTS)) return res.status(400).json({ error: "bad_request" });
    try {
      if (USE_GITHUB) {
        const r = await ghFetch("POST", "/repos/" + GITHUB_REPO + "/git/blobs", { content: req.file.buffer.toString("base64"), encoding: "base64" });
        if (!r.ok) throw ghError(r);
        return res.json({ ref: r.json.sha });
      }
      fs.mkdirSync(VIDEO_TMP, { recursive: true });
      fs.writeFileSync(path.join(VIDEO_TMP, id + "-" + i), req.file.buffer);
      res.json({ ref: String(i) });
    } catch (e) { console.error(e); res.status(storageStatus(e)).json({ error: e.code || "write_failed" }); }
  });
});
app.post("/api/video/finish", requireAuth, wrap(async (req, res) => {
  if (!canUploadVideo()) return res.status(400).json({ error: "video_unsupported" });
  const id = String((req.body && req.body.id) || "");
  const refs = Array.isArray(req.body && req.body.refs) ? req.body.refs.map(String) : [];
  if (!/^[a-f0-9]{16}$/.test(id) || !refs.length || refs.length > VIDEO_MAX_PARTS) return res.status(400).json({ error: "bad_request" });
  const parts = [];
  let total = 0;
  try {
    for (let k = 0; k < refs.length; k++) {
      let b;
      if (USE_GITHUB) {
        if (!/^[0-9a-f]{40}$/.test(refs[k])) return res.status(400).json({ error: "bad_request" });
        const r = await ghFetch("GET", "/repos/" + GITHUB_REPO + "/git/blobs/" + refs[k]);
        if (!r.ok) throw ghError(r);
        b = Buffer.from(r.json.content || "", "base64");
      } else {
        if (refs[k] !== String(k)) return res.status(400).json({ error: "bad_request" });
        b = fs.readFileSync(path.join(VIDEO_TMP, id + "-" + k));
      }
      total += b.length;
      if (total > VIDEO_MAX) return res.status(400).json({ error: "too_large" });
      parts.push(b);
    }
  } catch (e) {
    if (e.code === "ENOENT") return res.status(400).json({ error: "bad_request" });
    console.error(e); return res.status(storageStatus(e)).json({ error: e.code || "write_failed" });
  }
  const buf = Buffer.concat(parts);
  const ext = sniffVideo(buf);
  if (!ext) return res.status(400).json({ error: "unsupported_type" });
  const name = Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex") + "." + ext;
  try {
    if (USE_GITHUB) {
      const put = await ghPut("video/" + name, buf, "Upload video " + name + " (" + req.user.username + ")");
      const sha = put && put.commit && put.commit.sha;
      if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("github: no commit sha in the answer");
      return res.json({ url: "https://cdn.jsdelivr.net/gh/" + GITHUB_REPO + "@" + sha + "/video/" + name });
    }
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    refs.forEach((_, k) => { try { fs.unlinkSync(path.join(VIDEO_TMP, id + "-" + k)); } catch (e) { /* already gone */ } });
    res.json({ url: "/uploads/" + name });
  } catch (e) { console.error(e); res.status(storageStatus(e)).json({ error: e.code || "write_failed" }); }
}));

// Photos uploaded from the admin when Redis is used. Names are random and never change, so the CDN/browser can keep them for a year.
app.get("/api/img/:name", wrap(async (req, res) => {
  const name = String(req.params.name || "");
  if (!USE_REDIS || !IMG_NAME_RE.test(name)) return res.status(404).json({ error: "not_found" });
  const b64 = await redisCall(["GET", IMG_PREFIX + name]);
  if (!b64) return res.status(404).json({ error: "not_found" });
  res.setHeader("Content-Type", MIME[name.split(".").pop()]);
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.send(Buffer.from(b64, "base64"));
}));

// Local mode only: on Vercel static files come from public/ via the CDN.
if (!ON_VERCEL) {
  app.use("/uploads", express.static(UPLOADS, { maxAge: "30d", immutable: true, index: false, dotfiles: "deny", fallthrough: false }));
  app.use(express.static(PUBLIC, { extensions: ["html"], dotfiles: "deny" }));
}

// On Vercel the Express function also receives "/" (the CDN does not map it to public/index.html here),
// so hand the visitor to the static home page instead of showing a 404. Query strings (?lang=en) are kept.
if (ON_VERCEL) {
  app.get("/", (req, res) => {
    const q = req.originalUrl.indexOf("?");
    res.redirect(302, "/index.html" + (q > -1 ? req.originalUrl.slice(q) : ""));
  });
}

const NOT_FOUND_HTML = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<meta name="robots" content="noindex"><title>404 | UNI STEEL</title></head>' +
  '<body style="font-family:system-ui,sans-serif;background:#f5f3ef;color:#1b1b1b;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px">' +
  '<div><h1 style="font-size:4rem;margin:0;color:#f26b1d">404</h1><p style="margin:12px 0 4px">الصفحة غير موجودة</p><p style="margin:0 0 22px;color:#66707a">Page not found</p>' +
  '<a href="/" style="background:#f26b1d;color:#fff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:700">UNI STEEL</a></div></body></html>';
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "not_found" });
  res.status(404).type("html").send(NOT_FOUND_HTML);
});
// last resort: never leak stack traces / server paths
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  if (req.path.startsWith("/api/")) {
    const code = err.type === "entity.too.large" ? "too_large" : err.type === "entity.parse.failed" ? "bad_json" : "server_error";
    return res.status(status >= 400 && status < 600 ? status : 500).json({ error: code });
  }
  res.status(status === 404 ? 404 : status >= 400 && status < 500 ? status : 500).type("html").send(status === 404 ? NOT_FOUND_HTML : "Error");
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("UNI STEEL site:  http://localhost:" + PORT + "/");
    console.log("Admin panel:     http://localhost:" + PORT + "/admin/");
  });
}
