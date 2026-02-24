# Pay2Win Pod Dashboard

A personal Commander dashboard for tracking game stats across our playgroup.

Built with React + Vite. Data lives in `public/Game Tracking.xlsx` and is read client-side — no backend needed.

---

## Running locally

```bash
npm install
npm run dev
```

---

## Updating game data

1. Open `public/Game Tracking.xlsx` and update the relevant sheets
2. Push the changes:

```bash
git add "public/Game Tracking.xlsx"
git commit -m "update game stats"
git push
```

The live site redeploys automatically via GitHub Actions in ~2 minutes.
