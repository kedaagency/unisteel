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

## Deploy on Vercel (free: nothing stored on Vercel)

How it works: the **admin saves content and photos into this GitHub repo** (branch `content`, through the GitHub API). Visitors' browsers read them straight from GitHub (`raw.githubusercontent.com`), so Vercel needs no Blob, no Redis and no function calls for the public site. Vercel only serves the static pages and runs the small admin API.

1. Put the project on GitHub (public repo) and import it in Vercel: **Add New → Project → pick the repo**. Leave build settings empty (Framework: Other).
2. **Settings → Environment Variables**: add `ADMIN_PASSWORD` (8+ characters, not an easy one). Optional: `ADMIN_USERNAME` (default `admin`).
3. Create a GitHub token for the admin to write with (account that owns the repo): **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Resource owner: the repo owner. Repository access: **Only select repositories → unisteel**.
   - Repository permissions: **Contents → Read and write**. Expiration: the longest allowed (set a reminder to renew it).
   - If the owner is an organization that blocks fine-grained tokens, use a classic token with the `public_repo` scope instead.
4. In Vercel add the environment variable `GITHUB_TOKEN` = that token (mark it Sensitive). Optional: `GITHUB_REPO` (`owner/repo`, default `kedaagency/unisteel`) and `GITHUB_BRANCH` (default `content`).
5. **Redeploy** (Deployments → ⋯ → Redeploy).
6. Open `https://YOUR-PROJECT.vercel.app/admin/`, log in, change something and save. A branch named `content` appears in the GitHub repo with `content.json` and an `img/` folder. `vercel.json` stops Vercel from building that branch, so edits never trigger a deployment.

Notes:
- The repo must stay **public** (the site reads the files from raw.githubusercontent.com). The address is set in `public/js/config.js`; change it if the repo or branch is renamed.
- Edits show on the public site within about 1-5 minutes (GitHub's cache). Photos appear as soon as GitHub serves them.
- Photos are compressed in the browser before upload (one upload must stay under 4 MB, Vercel's request limit).
- Every save is a Git commit on the `content` branch, so the history is the backup and any version can be restored from GitHub.
- The owner password is changed in Vercel's environment variables, not from the admin panel. After changing it, redeploy; old admin sessions stop working.
- More admin users without any database: add `ADMIN_USERS` in Vercel, e.g. `sara:Pass12345:editor,omar:Pass67890:owner` (role `owner` or `editor`, passwords of 8+ characters without commas or colons). They show read-only in the Users tab. Creating users from the panel needs Redis (optional, see below).
- Until the first save, visitors get the built-in default content (from the code).
- Login attempt throttling is per server instance on serverless, so it is a soft limit there. Use long passwords.
- Custom domain: Project → Settings → Domains.
- **Vercel Hobby only builds commits authored by the account owner** (the GitHub account linked to Vercel). Commits from another GitHub user or e-mail are blocked with "the commit author doesn't have permission". Push from the owner's account, or set the owner's identity (`git config user.name` / `user.email`, e.g. the `ID+username@users.noreply.github.com` address) before committing.
- Optional alternative to GitHub: connect Upstash Redis (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`) to keep content and photos in Redis and to create users from the panel. If `GITHUB_TOKEN` is set, GitHub is used for content and photos.

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
| `public/js/config.js` | Address the public site reads content and photos from (GitHub raw) |
| `vercel.json` | Stops Vercel from building the `content` branch |
| `server.js` | Express app: `/api/*`, login, uploads. Exported for Vercel, listens on a port when run directly |
| `data/`, `uploads/` | Local mode only: content, backups (last 40), images |

## Environment variables

| Variable | Needed | What |
| --- | --- | --- |
| `ADMIN_USERNAME` | no | Username of the built-in owner (default `admin`) |
| `ADMIN_PASSWORD` | Vercel: yes | Admin password. Locally optional (otherwise generated) |
| `SESSION_SECRET` | no | Cookie signing key; defaults to a value derived from the password |
| `GITHUB_TOKEN` | Vercel: yes | Lets the admin save content and photos to the GitHub repo |
| `GITHUB_REPO` / `GITHUB_BRANCH` | no | Repo (`owner/repo`, default `kedaagency/unisteel`) and branch (default `content`) |
| `ADMIN_USERS` | no | Extra admin users: `name:password:role,...` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` / `KV_REST_API_TOKEN`) | no | Optional alternative to GitHub, and needed to create users from the panel |
| `PORT` | no | Local port (default 3000) |
| `TRUST_PROXY` | non-Vercel proxy | Set to `1` behind nginx/Render/etc. so the login rate limit sees real IPs |

## Back up

- Local: copy `data/` and `uploads/`.
- Vercel / GitHub mode: nothing to back up, the `content` branch of the repo is the copy (and its commit history).
- Redis mode: Upstash console (Data Browser). Keys: `unisteel:content`, `unisteel:users`, `unisteel:img:*`.
