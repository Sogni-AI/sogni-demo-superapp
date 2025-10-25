# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Information

**Sogni SDK Location**: The Sogni Client SDK source is at `./server/node_modules/@sogni-ai`. Consult this for full API reference.

**File Size Alert**:
- `server/index.js`: 1177 lines - NEEDS REFACTORING. Extract routes and utilities before adding features.
- `web/src/App.tsx`: 676 lines - Approaching 500 line threshold for component extraction.

## Development Commands

```bash
# Install dependencies (uses npm workspaces)
npm install

# Development (runs both frontend and backend concurrently)
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3001

# Build production
npm run build

# Build individual packages
npm run build:web      # Frontend only
npm run build:server   # Backend only (no build step, Node.js)

# Development utilities
./kill-ports.sh        # Kill processes on ports 5173 and 3001
```

## Architecture Overview

### Fire-and-Stream Pattern
This app implements a production-grade real-time streaming pattern:
1. **POST** `/api/generate` - Creates Sogni project, returns `projectId`
2. **EventSource** `/api/progress/:projectId` - SSE stream for real-time updates
3. **Events Flow**: `progress` → `preview` → `result` → `complete`/`error`

### Monorepo Structure
- **Root**: npm workspace configuration
- **`/server`**: Express.js API with Sogni SDK integration
- **`/web`**: React 18 + TypeScript + Vite frontend

### Key Architectural Decisions

#### Backend (`server/index.js`)
- **Single file architecture** (1177 lines - needs splitting)
- **Lazy Sogni client initialization** to avoid startup issues
- **In-memory project tracking** via Map for result URL management
- **Unified render config** for all generations (Flux Schnell, 512x512, 16 images)
- **Sticky compare context** - Caches sketch URLs for spacebar toggling in Hero Mode

#### Frontend (`web/src/App.tsx`)
- **Two UI modes**:
  - **Main Mode**: Circular orbit layout with 16 results
  - **Hero Mode**: Full-screen viewer with refinement options
- **EventSource reconnection** with exponential backoff
- **Mobile-first responsive** with touch gestures
- **No external CSS framework** - Custom styles in `index.html`

### State Management
- Frontend: React `useState` with derived state calculations
- Backend: In-memory Map for active projects
- Real-time: Server-Sent Events (no WebSockets/polling)

## Sogni SDK Integration Details

### Authentication & Client Management
```javascript
// Lazy initialization pattern (server/index.js:156-174)
let sogniClient = null;
const getSogniClient = async () => {
  if (!sogniClient) {
    const { SogniClient } = await import('@sogni-ai/sogni-client');
    sogniClient = await SogniClient.createInstance({
      appId: process.env.SOGNI_APP_ID,
      network: 'fast',
      testnet: false  // Mainnet by default
    });
    await sogniClient.account.login(username, password);
  }
  return sogniClient;
};
```

### Project Configuration
All renders use these unified settings:
- Model: `flux1-schnell-fp8`
- Steps: 4 (minimum 20 for ControlNet)
- Size: 512x512
- Count: 16 images per generation
- Payment: Spark Points (`tokenType: 'spark'`)

### Error Handling Patterns
- Filter "Project not found" SDK noise (server/index.js:648)
- Handle SSE connection drops with reconnection
- Graceful degradation for missing result URLs

## Common Development Tasks

### Adding New API Endpoints
Due to file size, extract to separate modules:
```javascript
// server/routes/newFeature.js
export const newFeatureRouter = express.Router();
// ... route definitions

// server/index.js
import { newFeatureRouter } from './routes/newFeature.js';
app.use('/api', newFeatureRouter);
```

### Extracting Frontend Components
App.tsx is approaching the 500-line threshold:
```typescript
// web/src/components/HeroMode.tsx
// web/src/components/MainMode.tsx
// web/src/components/ProgressIndicator.tsx
```

### Modifying Render Parameters
Update the unified config in server/index.js:
- Text-to-image: Lines 265-281
- ControlNet: Lines 452-468
- Refinement: Lines 559-575

### Testing SSE Connections
```bash
# Monitor SSE stream
curl -N http://localhost:3001/api/progress/PROJECT_ID

# Test with multiple concurrent clients
for i in {1..5}; do
  curl -N http://localhost:3001/api/progress/PROJECT_ID &
done
```

## Environment Configuration

### Required Server Variables (`server/.env`)
```ini
SOGNI_USERNAME=your_username       # Sogni account
SOGNI_PASSWORD=your_password       # Sogni password
SOGNI_APP_ID=sogni-tattoo-ideas   # Unique app identifier
SOGNI_ENV=production               # local|staging|production
PORT=3001                          # Backend port
CLIENT_ORIGIN=http://localhost:5173 # Frontend origin for CORS
```

### Optional Frontend Variables (`web/.env`)
```ini
VITE_API_BASE_URL=https://api.example.com  # Only for production
```

## Production Deployment

### PM2 Process Management
```bash
cd server
pm2 start ecosystem.config.cjs     # Uses included PM2 config
pm2 logs sogni-api                 # View logs
pm2 monit                          # Real-time monitoring
```

### Nginx Configuration
Sample configs in `/nginx/` handle:
- SSL termination with security headers
- SSE streaming with proper buffering disabled
- CORS for cross-origin API access
- Rate limiting (10 req/s for /api/generate)

## Performance Considerations

### Current Bottlenecks
1. **server/index.js size** (1177 lines) - Context window issues, needs refactoring
2. **Synchronous prompt generation** - Could be async for better performance
3. **No caching layer** - Consider Redis for production scale

### Optimization Opportunities
- Implement request queuing for high load
- Add database for project persistence
- Cache Sogni client authentication tokens
- Implement WebSocket fallback for SSE issues

## Known Issues & Workarounds

### Sogni SDK Quirks
- "Project not found" errors are SDK noise - filter these (server/index.js:648)
- Result URLs expire - always fetch fresh with `job.getResultUrl()`
- Model availability varies - implement `waitForModels()` on startup

### Frontend Edge Cases
- Hero Mode spacebar toggle needs cached sketch URL
- Mobile Safari SSE issues - may need polyfill
- Large result sets (16 images) can cause memory pressure on low-end devices

## Cursor AI Rules Integration
The `.cursorrules` file contains additional context about:
- File splitting thresholds (500 lines for React, 800 for Node.js)
- TypeScript strict mode requirements
- State management patterns
- Common anti-patterns to avoid

Refer to `.cursorrules` for detailed coding standards and patterns specific to this project.
