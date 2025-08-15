# Sogni Demo Superapp - Optimization Guide

## Current State Assessment ✅

Your project is well-structured with clean separation of concerns:
- **Backend**: Clean Express server with proper SSE implementation
- **Frontend**: Well-organized React app with TypeScript
- **Architecture**: Fire-and-stream pattern works perfectly for AI rendering
- **Code Quality**: Good error handling and accessibility features

## Immediate Optimizations Added

### 1. Development Tooling
- **ESLint**: Configured for both frontend and backend with appropriate rules
- **Prettier**: Code formatting with project-specific settings
- **VS Code**: Workspace settings for consistent development experience
- **Scripts**: Added `lint`, `format`, and `build` commands to root package.json

### 2. Environment Configuration
- Created `env.example` files for both server and web
- Updated `.gitignore` with comprehensive exclusions
- Added proper environment variable documentation

## Scaling Recommendations

### When App.tsx Reaches 500+ Lines
```
web/src/
├── components/
│   ├── TattooForm/
│   │   ├── index.tsx          # Main form component
│   │   ├── StyleSelector.tsx  # Style dropdown logic
│   │   └── PromptPreview.tsx  # Prompt display
│   ├── IdeaGrid/
│   │   ├── index.tsx          # Grid container
│   │   ├── IdeaCard.tsx       # Individual idea card
│   │   └── ProgressBar.tsx    # Progress visualization
│   └── shared/
│       ├── Button.tsx         # Reusable button component
│       └── LoadingSpinner.tsx # Loading states
├── hooks/
│   ├── useSSE.ts             # SSE connection management
│   ├── useIdeas.ts           # Ideas state management
│   └── useRender.ts          # Render logic
├── utils/
│   ├── api.ts                # API client functions
│   ├── prompts.ts            # Prompt composition logic
│   └── constants.ts          # App constants
└── types/
    └── index.ts              # TypeScript type definitions
```

### When server/index.js Reaches 800+ Lines
```
server/
├── routes/
│   ├── generate.js           # POST /api/generate
│   ├── progress.js           # GET /api/progress/:projectId
│   ├── cancel.js             # GET /api/cancel/:projectId
│   └── result.js             # GET /api/result/:projectId/:jobId
├── middleware/
│   ├── cors.js               # CORS configuration
│   ├── auth.js               # Future: API authentication
│   └── rateLimit.js          # Future: Rate limiting
├── services/
│   ├── sogni.js              # Sogni SDK wrapper
│   └── sse.js                # SSE connection management
├── utils/
│   ├── errors.js             # Error handling utilities
│   └── validation.js         # Input validation
└── config/
    └── index.js              # Environment configuration
```

### State Management Evolution
1. **Current**: React useState (perfect for current complexity)
2. **500+ lines**: Extract custom hooks (`useIdeas`, `useSSE`)
3. **1000+ lines**: Consider Zustand or Context API
4. **Complex flows**: Add state machines with XState

### Performance Optimizations

#### Frontend
```typescript
// Add React.memo for expensive components
const IdeaCard = React.memo(({ idea, onRender }) => {
  // Component implementation
});

// Implement virtualization for large idea lists (react-window)
import { FixedSizeList as List } from 'react-window';

// Add image optimization
const OptimizedImage = ({ src, alt }) => (
  <img
    src={src}
    alt={alt}
    loading="lazy"
    decoding="async"
    style={{ aspectRatio: '1/1' }}
  />
);
```

#### Backend
```javascript
// Add response compression
import compression from 'compression';
app.use(compression());

// Implement connection pooling for external APIs
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});

// Add request caching for repeated operations
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 600 });
```

## Production Deployment

### Environment Setup
```bash
# Production server environment
NODE_ENV=production
SOGNI_ENV=production
PORT=3001
CLIENT_ORIGIN=https://your-domain.com
SOGNI_USERNAME=prod_username
SOGNI_PASSWORD=prod_password

# Enable production optimizations
NODE_OPTIONS="--max-old-space-size=2048"
```

### Build Process
```json
{
  "scripts": {
    "build:web": "cd web && pnpm build",
    "build:server": "cd server && pnpm build",
    "deploy": "pnpm build && pnpm start",
    "docker:build": "docker build -t sogni-demo .",
    "docker:run": "docker run -p 3001:3001 sogni-demo"
  }
}
```

### Monitoring & Logging
```javascript
// Add structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Add health checks
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    sogniConnected: !!sogniClient
  });
});
```

## Security Hardening

### Server Security
```javascript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://cdn.sogni.ai"],
      connectSrc: ["'self'", "wss://socket.sogni.ai"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);
```

### Input Validation
```javascript
import joi from 'joi';

const generateSchema = joi.object({
  prompt: joi.string().min(3).max(500).required(),
  style: joi.string().max(100),
  numImages: joi.number().integer().min(1).max(4).default(1),
  seed: joi.number().integer().optional()
});

app.post('/api/generate', async (req, res) => {
  const { error, value } = generateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  // Continue with validated data
});
```

## Testing Strategy

### Frontend Testing
```bash
# Add testing dependencies
pnpm add -D @testing-library/react @testing-library/jest-dom vitest jsdom

# Test structure
web/src/
├── __tests__/
│   ├── App.test.tsx
│   ├── components/
│   └── utils/
└── test-utils.tsx  # Testing utilities
```

### Backend Testing
```bash
# Add testing dependencies
pnpm add -D jest supertest

# Test structure
server/
├── __tests__/
│   ├── routes/
│   ├── services/
│   └── integration/
└── test-setup.js
```

## Database Integration (Future)

### Schema Design
```sql
-- Users and authentication
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project history
CREATE TABLE projects (
  id VARCHAR(255) PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  prompt TEXT NOT NULL,
  style VARCHAR(100),
  status VARCHAR(50),
  result_urls JSON,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage analytics
CREATE TABLE render_analytics (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255),
  render_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Evolution
```javascript
// Add authentication middleware
app.use('/api/generate', requireAuth, generateHandler);

// Add project persistence
app.get('/api/projects', async (req, res) => {
  const projects = await db.projects.findByUserId(req.user.id);
  res.json({ projects });
});

// Add sharing functionality
app.get('/api/share/:projectId', async (req, res) => {
  const project = await db.projects.findByIdAndMakePublic(req.params.projectId);
  res.json({ shareUrl: `${BASE_URL}/share/${project.shareToken}` });
});
```

## Performance Monitoring

### Metrics to Track
- API response times
- SSE connection duration
- Sogni SDK success/failure rates
- Memory usage and garbage collection
- Frontend bundle size and load times
- User engagement metrics

### Implementation
```javascript
// Add performance monitoring
import { performance } from 'perf_hooks';

const trackRenderTime = (projectId) => {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    logger.info('Render completed', { projectId, duration });
  };
};
```

This guide provides a clear path for scaling your Sogni demo from its current clean state to a production-ready application while maintaining code quality and performance.
