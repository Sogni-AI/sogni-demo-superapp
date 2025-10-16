# Claude Code Configuration - Sogni Demo Superapp

## Project Overview

**Sogni Tattoo Flash Generator** is a production-ready demo application that showcases the integration of AI-powered image generation using the Sogni Supernet render network. This app generates 16 tattoo design variations in real-time with an award-winning interactive UI.

### Architecture
- **Frontend**: React 18 + TypeScript + Vite (modern build tooling)
- **Backend**: Express.js with Server-Sent Events (SSE) for real-time streaming
- **AI Integration**: Sogni SDK v3.0.0-alpha.40 with Flux Schnell model
- **Package Management**: npm workspace monorepo structure
- **Development**: Hot reload, concurrent dev servers, TypeScript strict mode

## Key Technical Features

### Frontend (`/web/`)
- **Single-page application** with two main modes:
  - **Main Mode**: Circular layout with center input form and orbit of results
  - **Hero Mode**: Full-screen image viewer with refinement options
- **Real-time streaming**: EventSource connection for live progress updates
- **Mobile-optimized**: Touch gestures, responsive design, accessibility features
- **No external CSS framework**: Custom CSS-in-HTML with dark theme and tattoo shop aesthetics

### Backend (`/server/`)
- **Fire-and-stream pattern**: Start render → stream progress via SSE → deliver results
- **Sogni SDK integration**: Project creation, job monitoring, result URL management  
- **CORS configured**: Multi-origin support for flexible deployment
- **Error handling**: Robust error boundaries with SDK-specific noise filtering

## Development Setup

### Prerequisites
```bash
# No additional package manager required - uses npm workspaces
```

### Quick Start
```bash
# Install dependencies
npm install

# Configure environment
cp server/.env.example server/.env
# Edit server/.env with your Sogni credentials

# Run development servers (both frontend and backend)
npm run dev
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### Environment Variables

#### Server (`server/.env`)
```ini
SOGNI_USERNAME=your_username
SOGNI_PASSWORD=your_password
SOGNI_APP_ID=sogni-tattoo-ideas
SOGNI_ENV=production          # local | staging | production
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

#### Frontend (`web/.env`)
```ini
# Only needed for production deployment with separate API domain
VITE_API_BASE_URL=https://your-api.example.com
```

## Code Structure & Patterns

### Monorepo Organization
```
.
├── package.json              # Root workspace config
├── package.json              # Root workspace config with npm workspaces
├── server/                   # Express API
│   ├── index.js             # Main server file (871 lines)
│   ├── package.json         # Backend dependencies
│   └── ecosystem.config.cjs  # PM2 production config
└── web/                     # React frontend
    ├── src/
    │   ├── App.tsx          # Main application (768 lines)
    │   └── main.tsx         # React entry point
    ├── index.html           # HTML template with embedded CSS
    ├── vite.config.ts       # Build configuration
    └── package.json         # Frontend dependencies
```

### Key Design Patterns
1. **Fire-and-Stream**: POST to create project → EventSource for progress → Real-time UI updates
2. **Event-Driven Architecture**: Sogni SDK events → SSE → React state updates
3. **Unified Render Config**: Standardized Flux Schnell parameters across all generations
4. **Prompt Variation System**: 16 diverse prompt variations for creative exploration
5. **Hero Mode Refinement**: Click image → Show refinement options → Generate variations

### API Endpoints
- `POST /api/generate` - Start tattoo generation (16 images)
- `GET /api/progress/:projectId` - SSE stream for real-time progress
- `GET /api/cancel/:projectId` - Cancel running project
- `GET /api/result/:projectId/:jobId` - Proxy result images (CORS bypass)
- `GET /api/health` - Service health check

## Development Guidelines

### Code Style
- **ESLint + Prettier** configured with project-specific rules
- **TypeScript strict mode** with proper type definitions
- **Consistent formatting**: 100-char lines, semicolons, single quotes
- **Error handling**: Comprehensive try/catch with specific SDK error filtering

### State Management
- **Current approach**: React useState with custom hooks (appropriate for current scale)
- **Scaling path**: Extract hooks → Context API → External state management if needed

### Sogni SDK Integration
- **Client reuse**: Single lazy-initialized client instance
- **Error boundaries**: Handle "Project not found" SDK noise
- **Result URL management**: Fresh signed URLs via `job.getResultUrl()`
- **Token support**: Both SOGNI and Spark Points payment methods

## Production Deployment

### Build Process
```bash
# Build frontend static files
cd web && pnpm build

# Frontend deploys to any static host (Netlify, Vercel, S3)
# Backend deploys as Node.js service with PM2
```

### Nginx Configuration
Sample configs provided in `/nginx/` for full-stack deployment:
- Frontend: Static file serving with caching
- Backend: Reverse proxy with SSE support
- SSL: Cloudflare integration recommended

### Monitoring
- Health check endpoint: `/api/health`
- Structured logging with request tracking
- PM2 process management for production uptime

## Important Notes

### Sogni SDK Location
**CRITICAL**: The Sogni Client SDK source is at `/Users/markledford/Documents/git/sogni-client/` (parent directory). This contains the full API reference and implementation details.

### Key Dependencies
- `@sogni-ai/sogni-client`: v3.0.0-alpha.40 (AI rendering)
- `express`: ^4.21.2 (backend server)
- `react`: ^18.3.1 (frontend framework)
- `vite`: ^6.2.2 (build tooling)
- `typescript`: ^5.5.4 (type checking)

### File Scaling Thresholds
- **App.tsx**: Consider component extraction at 500+ lines
- **server/index.js**: Consider route separation at 800+ lines
- **Current state**: Well-organized, no immediate refactoring needed

## Development Workflow

### Common Commands
```bash
npm run dev       # Start both servers
npm run build     # Build production bundle
npm run lint      # Run ESLint
npm run format    # Run Prettier
./kill-ports.sh   # Kill processes on dev ports
```

### Git Workflow
- Clean commit history with descriptive messages  
- Recent commits show mobile optimization work
- Main branch used for development and deployment

## Additional Resources
- `README.md`: Comprehensive setup and deployment guide
- `SOGNI_SDK_REFERENCE.md`: Detailed SDK integration patterns
- `OPTIMIZATION_GUIDE.md`: Scaling and performance recommendations
- `/nginx/`: Production deployment configurations

This codebase demonstrates production-quality patterns for AI-powered applications with real-time streaming, making it an excellent reference for similar integrations.