# Sogni Tattoo Ideas — Teaching Demo

A tiny, production‑grade scaffold that shows **how to build a Gen‑AI app with Sogni**:

- ✨ Simple but thoughtfully designed UI
- 🔌 Minimal Express API that calls the Sogni SDK
- 🛰️ Fire‑and‑stream pattern (start a render, stream progress/results via SSE)
- 🧩 Clear separation of frontend (React + Vite) and backend (Express)

> This is intentionally small so you can study and repurpose it.

---

## Quickstart

```bash
# from the repo root
pnpm install

# set env vars
cp server/.env.example server/.env
# edit server/.env (add your SOGNI_USERNAME / SOGNI_PASSWORD, etc.)

# optional: if deploying API separately, set a base URL for the web app:
cp web/.env.example web/.env
# edit VITE_API_BASE_URL if needed (leave empty for local dev/proxy)

# run both servers
pnpm dev
# web:  http://localhost:5173
# api:  http://localhost:3001
```

---

## How it works

- **Frontend (React)** builds a structured **prompt** from form fields.  
  When you click **Generate Sample**, it `POST /api/generate` and then opens an `EventSource` to `/api/progress/:projectId` to receive **progress / preview / final** events.

- **Backend (Express)** logs into Sogni **on the server** and creates a project with your prompt.  
  It forwards Sogni project/job events to the browser via **SSE**.

This *fire‑and‑stream* pattern keeps the UI highly responsive and the code easy to reason about.

---

## Environment

### Server (`server/.env`)
```ini
SOGNI_USERNAME=...
SOGNI_PASSWORD=...
SOGNI_APP_ID=sogni-tattoo-ideas
SOGNI_ENV=production          # local | staging | production
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

### Web (`web/.env`)
```ini
# If your API is on another origin in production, set this:
VITE_API_BASE_URL=https://your-api.example.com
```

> In local dev, Vite proxies `/api` to `http://localhost:3001`, so `VITE_API_BASE_URL` can be left empty.

---

## Design & Responsiveness

- Calm, modern surface with semantic emphasis.
- Works great on **mobile**, **tablet**, and **desktop**.
- Accessible focus states & live region announcements for progress.

---

## Project Structure

```
.
├─ server/          # Express API (Sogni SDK, SSE)
│  ├─ index.js
│  ├─ package.json
│  └─ .env.example
└─ web/             # React + Vite app
   ├─ src/
   │  ├─ main.tsx
   │  └─ App.tsx
   ├─ index.html
   ├─ vite.config.ts
   ├─ package.json
   └─ .env.example
```

---

## Deploying

- Deploy the **server** behind HTTPS (Node 18+).  
- Serve the **web** app (static build) and point it to your API by setting `VITE_API_BASE_URL`.

---

## License

MIT — use freely for your own prototypes and teaching.
