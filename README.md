# Sogni Tattoo Ideas — Teaching Demo

A tiny, production‑grade scaffold that shows **how to build a Gen‑AI app powered by the dePIN Sogni Supernet render network**:

- ✨ Simple but thoughtfully designed UI
- 🔌 Minimal Express API that calls the Sogni SDK
- 🛰️ Fire‑and‑stream pattern (start a render, stream progress/results via SSE)
- 🧩 Clear separation of frontend (React + Vite) and backend (Express)

> This is intentionally small so you can study and repurpose it.

---

## Quickstart

```bash
# we're using the recently popular pnpm package manager for this repo so you can install it if you don't already have it
npm install -g pnpm

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

### Production Build

The frontend compiles to static files that can be hosted anywhere (Netlify, Vercel, S3, etc.):

```bash
# Build the frontend into static files
cd web
pnpm build
# Creates a dist/ folder with all static files
```

**Important:** Before building, configure `web/.env` to point to your production API:
```ini
# web/.env
VITE_API_BASE_URL=https://your-api-server.com
```

### Deployment Steps

1. **Frontend**: 
   - Set `VITE_API_BASE_URL` in `web/.env` to your backend API URL
   - Run `pnpm build` to create static files in `web/dist/`
   - Deploy the `dist/` folder to any static hosting service

2. **Backend**: 
   - Deploy the Express server (Node 18+) behind HTTPS
   - Configure `server/.env` with production Sogni credentials

### Nginx Deployment (like ink.sogni.ai)

If you want to host this project with Nginx like we do on ink.sogni.ai, sample configuration files are included in the `nginx/` folder:

1. **Setup Frontend (ink.sogni.ai)**:
   ```bash
   # Build the frontend
   cd web
   echo "VITE_API_BASE_URL=https://ink-api.sogni.ai" > .env
   pnpm build
   
   # Deploy to server
   sudo mkdir -p /var/www/ink.sogni.ai
   sudo cp -r dist/* /var/www/ink.sogni.ai/
   
   # Setup Nginx
   sudo cp nginx/ink.sogni.ai.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/ink.sogni.ai.conf /etc/nginx/sites-enabled/
   ```

2. **Setup Backend API (ink-api.sogni.ai)**:
   ```bash
   # Install and run the Node.js server (using PM2)
   cd server
   npm install -g pm2
   pm2 start index.js --name sogni-api
   pm2 save
   pm2 startup
   
   # Setup Nginx reverse proxy
   sudo cp nginx/ink-api.sogni.ai.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/ink-api.sogni.ai.conf /etc/nginx/sites-enabled/
   ```

3. **SSL Certificates**: Use Cloudflare to handle your SSL for free - just proxy your domain through Cloudflare and set SSL mode to "Full (strict)"

4. **Reload Nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

The included Nginx configs handle:
- SSL/HTTPS with proper security headers
- CORS for API access from the frontend
- Server-Sent Events (SSE) for progress streaming
- Static file caching and compression
- Rate limiting for API protection

---

## License

MIT — use freely for your own prototypes and teaching.
