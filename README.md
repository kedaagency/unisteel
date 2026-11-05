# UNI STEEL website

Static site (`public/`) + Express API/admin (`server.js`).
Runs locally with `npm start`, and on Vercel's free plan as one serverless function.

## Run locally

```
npm install
npm start
```

- Site: http://localhost:3000/
- Admin: http://localhost:3000/admin/

First run generates the admin password and saves it in `data/FIRST-ADMIN-PASSWORD.txt`.
Change it from the admin panel (Security tab), then delete that file.
Locally, content goes to `data/content.json` and images to `uploads/`.

## Deploy on Vercel (free)

Vercel functions have no writable disk, so edits and images need two free storage add-ons.
Without them the site still works, but with the built-in default content and a read-only admin.

1. Put the project on GitHub (or use `npx vercel` from this folder). `data/`, `uploads/` and `node_modules/` are ignored.
2. In Vercel: **Add New → Project → import the repo**. Leave all build settings empty (Framework: Other). Vercel detects `server.js` and serves `public/` from its CDN.
3. In the project: **Storage → Create / Connect Database → Upstash for Redis** (Marketplace, Free plan). Connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). It stores the site content.
4. **Storage → Create → Blob**, choose **Public** access, connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`. It stores the uploaded images.
5. **Settings → Environment Variables**: add `ADMIN_PASSWORD` (the admin password, 8+ characters). Optional: `SESSION_SECRET` (any long random text).
6. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables are picked up.
7. Open `https://YOUR-PROJECT.vercel.app/admin/`, log in, and edit. Open a second tab to check the public site.

Notes for Vercel:
- The password is changed in Vercel's environment variables, not from the admin panel. After changing it, redeploy; all old admin sessions stop working.
- Photos are compressed in the browser before upload; a single upload must stay under 4 MB (Vercel's request limit).
- Admin edits appear on the public site within about 20-30 seconds (short CDN cache).
- Content is saved with a backup history in Redis (last 30 versions under the key `unisteel:content:backups`).
- Free limits: Upstash 500K commands/month; Blob 1 GB storage, 2,000 uploads and 10,000 uncached reads per month. If Blob limits are exceeded, Vercel blocks Blob access for the rest of the 30 days (images stop loading), so keep uploads reasonable.
- Login attempt throttling is per server instance on serverless, so it is a soft limit there. Use a long password.
- Custom domain: Project → Settings → Domains.

## Admin users

- The built-in owner logs in with username `admin` (change it with `ADMIN_USERNAME`) and the password from `ADMIN_PASSWORD` (locally: the generated password).
- The owner (or any user with the "owner" role) adds more people from the admin panel: **المستخدمين** tab → **+ مستخدم جديد**. Each person gets a username and a password.
- Roles: **مدير** (everything, including managing users) and **محرر** (edit content only).
- Passwords are stored hashed (scrypt). A password reset or a deleted user ends that person's session immediately.
- Everyone can change their own password from the **الأمان** tab. The built-in owner changes it in the environment variable.
- On Vercel, users are stored in Upstash Redis, so that must be connected first.

## Contact people

Names, numbers and photos shown on the home page, contact page and footer are edited in the admin panel: **بيانات الشركة** → people list (name AR/EN, number, optional photo).

## Where things live

| Path | What |
| --- | --- |
| `public/` | The website (HTML, CSS, JS, logo files) |
| `public/admin/` | The admin panel |
| `public/js/data.js` | Default content (also loaded by the server as the starting content) |
| `server.js` | Express app: `/api/*`, login, uploads. Exported for Vercel, listens on a port when run directly |
| `data/`, `uploads/` | Local mode only: content, backups (last 40), images |

## Environment variables

| Variable | Needed | What |
| --- | --- | --- |
| `ADMIN_USERNAME` | no | Username of the built-in owner (default `admin`) |
| `ADMIN_PASSWORD` | Vercel: yes | Admin password. Locally optional (otherwise generated) |
| `SESSION_SECRET` | no | Cookie signing key; defaults to a value derived from the password |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | Vercel: yes | Content storage |
| `BLOB_READ_WRITE_TOKEN` | Vercel: yes | Image storage |
| `PORT` | no | Local port (default 3000) |
| `TRUST_PROXY` | non-Vercel proxy | Set to `1` behind nginx/Render/etc. so the login rate limit sees real IPs |

## Back up

- Local: copy `data/` and `uploads/`.
- Vercel: Upstash console (Data Browser) and Blob store in the Vercel dashboard.
