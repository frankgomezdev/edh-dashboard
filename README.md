# EDH War Table 🃏

A dashboard for tracking EDH game stats across your playgroup.

---

## Setup Guide

### Step 1 — Clone or download this project

If you have this as a zip, unzip it somewhere you can find it (e.g. `~/projects/edh-dashboard`).

If you're starting from scratch:
```bash
git init edh-dashboard
cd edh-dashboard
# paste all these files in, then continue
```

---

### Step 2 — Install dependencies

```bash
npm install
```

---

### Step 3 — Run locally to verify it works

```bash
npm run dev
```

Open [http://localhost:5173/edh-dashboard/](http://localhost:5173/edh-dashboard/) in your browser. You should see the dashboard.

---

### Step 4 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it exactly `edh-dashboard` (must match the `base` in `vite.config.js`)
3. Set it to **Public**
4. Do **not** initialize with a README (you already have one)
5. Click **Create repository**

---

### Step 5 — Push your code to GitHub

GitHub will show you the exact commands after you create the repo. They'll look like this:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/edh-dashboard.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

### Step 6 — Enable GitHub Pages

1. Go to your repo on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. That's it — the workflow will trigger automatically on every push

Your site will be live at:
```
https://YOUR_USERNAME.github.io/edh-dashboard/
```

The first deploy takes ~2 minutes. After that, every push redeploys automatically.

---

## Updating Game Data

1. Open `public/games.csv`
2. Edit the data (add rows, update wins/losses, etc.)
3. Run:
```bash
git add public/games.csv
git commit -m "update game stats"
git push
```
4. Wait ~2 minutes — your live site will reflect the changes.

---

## If you rename the repo

Update the `base` field in `vite.config.js` to match:
```js
base: '/your-new-repo-name/',
```
