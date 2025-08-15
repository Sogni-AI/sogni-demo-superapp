# Sogni Client SDK Reference

## SDK Location & Access
**CRITICAL REMINDER**: The Sogni Client SDK is located at `/Users/markledford/Documents/git/sogni-client/` (parent directory of this project). This is essential for understanding the full API surface and implementation details.

**LATEST VERSION**: v3.0.0-alpha.42 - **NOW ON MAINNET** with Spark Points support!

## Core Architecture

### Client Initialization
```typescript
import { SogniClient } from '@sogni-ai/sogni-client';

const client = await SogniClient.createInstance({
  appId: 'unique-app-id',           // Required, must be unique
  network: 'fast' | 'relaxed',     // Network type
  testnet?: boolean,               // Default FALSE (Base Mainnet)
  logger?: Logger,                 // Optional custom logger
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
});

await client.account.login(username, password);
await client.projects.waitForModels(); // Wait for available models
```

### **BREAKING CHANGE: Mainnet Default**
- **Default network**: Base Mainnet (Chain ID: 8453)
- **Testnet**: Base Sepolia (Chain ID: 84532) - use `testnet: true`
- **Token name**: SOGNI (no longer tSOGNI)
- **EIP712 domain**: "Sogni AI" (was "Sogni-testnet")

### Key Classes & Types

#### SogniClient
- `account: AccountApi` - Account management
- `projects: ProjectsApi` - Project/job management
- `stats: StatsApi` - Statistics
- `currentAccount: CurrentAccount` - Current account state

#### Project Lifecycle
1. **Project**: Container for one or more image generation requests
2. **Job**: Individual image generation within a project
3. **States**: `pending → queued → processing → completed/failed/canceled`

#### ProjectParams (Full Interface)
```typescript
interface ProjectParams {
  modelId: string;                    // Required: Model to use
  positivePrompt: string;             // What to create
  negativePrompt: string;             // What to avoid
  stylePrompt: string;                // Style description
  steps: number;                      // Inference steps (20 for SD, 4 for Flux)
  guidance: number;                   // Guidance scale (7.5 for SD, 1 for Flux)
  numberOfImages: number;             // How many images

  // Optional parameters
  network?: 'fast' | 'relaxed';      // Override default network
  disableNSFWFilter?: boolean;       // Allow NSFW content
  seed?: number;                     // Uint32 seed for reproducibility
  numberOfPreviews?: number;         // Preview images during generation
  scheduler?: Scheduler;             // Sampling scheduler
  timeStepSpacing?: TimeStepSpacing; // Time step algorithm
  tokenType?: 'sogni' | 'spark';    // NEW: Token type to use

  // Size control
  sizePreset?: string | 'custom';    // Predefined size or custom
  width?: number;                    // Custom width (256-2048)
  height?: number;                   // Custom height (256-2048)

  // Image-to-image
  startingImage?: File | Buffer | Blob; // Guide image
  startingImageStrength?: number;    // 0-1, how much to follow guide

  // ControlNet (experimental)
  controlNet?: ControlNetParams;
}
```

## Event-Driven Architecture

### Project Events
```typescript
project.on('progress', (percentage: number) => {}); // 0-100
project.on('completed', (imageUrls: string[]) => {});
project.on('failed', (error: ErrorData) => {});
project.on('jobCompleted', (job: Job) => {});
project.on('jobFailed', (job: Job) => {});
```

### ProjectsApi Events
```typescript
client.projects.on('availableModels', (models: AvailableModel[]) => {});
client.projects.on('project', (event: ProjectEvent) => {});
client.projects.on('job', (event: JobEvent) => {});
```

### Job Events (via ProjectsApi)
- `initiating`: Worker assigned, model loading
- `started`: Generation started
- `progress`: Step progress (step/stepCount)
- `preview`: Preview image available
- `completed`: Job finished with result
- `error`: Job failed

## Fire-and-Stream Pattern

### Basic Usage
```typescript
// 1. Create project (fire) - NEW: tokenType parameter
const project = await client.projects.create({
  modelId: 'flux1-schnell-fp8',
  positivePrompt: 'A cat wearing a hat',
  negativePrompt: 'blurry, low quality',
  stylePrompt: 'anime',
  steps: 4,
  guidance: 1,
  numberOfImages: 1,
  tokenType: 'spark'  // NEW: Use Spark Points instead of SOGNI
});

// 2. Stream events
project.on('progress', (progress) => {
  console.log(`Progress: ${progress}%`);
});

// 3. Wait for completion or handle events
const imageUrls = await project.waitForCompletion();
// OR handle events individually
```

### Server-Sent Events Integration
Perfect for Express + SSE:
```typescript
// Express route
app.post('/api/generate', async (req, res) => {
  const project = await client.projects.create(params);
  res.json({ projectId: project.id });
});

app.get('/api/progress/:projectId', (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Forward project events to SSE
  const project = findProject(req.params.projectId);
  project.on('progress', (progress) => {
    res.write(`data: ${JSON.stringify({type: 'progress', progress})}\n\n`);
  });

  project.on('completed', (urls) => {
    res.write(`data: ${JSON.stringify({type: 'completed', urls})}\n\n`);
    res.end();
  });
});
```

## Network Types & Billing

### Networks
- **fast**: High-end GPUs, ~1 SOGNI per render, optimized for speed
- **relaxed**: Apple Mac devices, ~0.5 SOGNI per render, optimized for cost

### Token System - **DUAL TOKEN SUPPORT**
- **SOGNI**: Main token on Base Mainnet for production use
- **Spark Points**: Alternative token system for rewards/promotions
- Cost varies by complexity, steps, image size, ControlNet usage
- Free tokens available through web/Mac app signup and daily claims

### Token Types
```typescript
export type TokenType = 'sogni' | 'spark';

// Balance structure (per token type)
interface BalanceData {
  settled: string;    // Confirmed balance
  credit: string;     // Credits received
  debit: string;      // Debits spent
  net: string;        // Net balance (credit - debit)
  unclaimed?: string; // Worker earnings (experimental)
}

// Account balance contains both token types
type Balances = Record<TokenType, BalanceData>;
```

### Accessing Balances
```typescript
const account = client.currentAccount;
console.log(account.balance.sogni.net);    // SOGNI balance
console.log(account.balance.spark.net);    // Spark Points balance
```

### Cost Estimation
```typescript
const cost = await client.projects.estimateCost({
  network: 'fast',
  model: 'flux1-schnell-fp8',
  imageCount: 1,
  stepCount: 4,
  previewCount: 0,
  cnEnabled: false,
  width: 1024,
  height: 1024,
  tokenType: 'sogni'  // NEW: Specify token type
});
// Returns: { token: number, usd: number }

// Enhancement cost estimation
const enhancementCost = await client.projects.estimateEnhancementCost(
  'medium',     // strength
  'spark'       // NEW: token type parameter
);
```

## Models & Size Presets

### Available Models
```typescript
const models = client.projects.availableModels; // Updated via events
const mostPopular = models.reduce((a, b) =>
  a.workerCount > b.workerCount ? a : b
);
```

### Size Presets
```typescript
const presets = await client.projects.getSizePresets('fast', 'flux1-schnell-fp8');
// Returns array of: { id, label, width, height, ratio, aspect }
```

## Error Handling & Edge Cases

### Common Error Patterns
1. **"Project not found"**: Normal SDK noise, filter out in logs
2. **NSFW Filter**: Images blocked unless `disableNSFWFilter: true`
3. **Network Disconnection**: Projects fail, need retry logic
4. **Token Insufficient**: Check balance before creating projects
5. **Model Unavailable**: Check `availableModels` for worker count > 0

### Robust Implementation
```typescript
try {
  const project = await client.projects.create(params);

  // Handle timeout
  const timeout = setTimeout(() => {
    project.cancel();
  }, 300000); // 5 minutes

  project.on('completed', () => clearTimeout(timeout));
  project.on('failed', () => clearTimeout(timeout));

  return await project.waitForCompletion();
} catch (error) {
  if (error.message.includes('Project not found')) {
    // Ignore SDK noise
    return;
  }
  throw error;
}
```

## Advanced Features

### ControlNet (Experimental)
```typescript
controlNet: {
  name: 'canny' | 'depth' | 'openpose' | 'lineart' | ...,
  image: File | Buffer | Blob,
  strength: 0.5,                    // 0-1
  mode: 'balanced' | 'prompt_priority' | 'cn_priority',
  guidanceStart: 0,                 // When to start applying
  guidanceEnd: 1                    // When to stop applying
}
```

### Image Enhancement
```typescript
// Enhance completed job - NEW: tokenType parameter
const enhancedUrl = await job.enhance('medium', {
  positivePrompt: 'high resolution, detailed',
  stylePrompt: 'photorealistic',
  tokenType: 'spark'  // NEW: Specify token type for enhancement
});
```

### Account Management
```typescript
const account = client.currentAccount;
console.log(account.balance.net);        // Available tokens
console.log(account.networkStatus);      // Connection state
console.log(account.network);            // Current network
```

## Integration Best Practices

### For Demo Superapp
1. **Single Client Instance**: Reuse across requests, lazy initialize
2. **Environment Variables**: Store credentials server-side only
3. **Event Forwarding**: Use SSE to stream progress to frontend
4. **Error Boundaries**: Handle disconnections and SDK noise gracefully
5. **Token Management**: Check balance, estimate costs, handle insufficient funds
6. **Result URLs**: Proxy through your server, URLs expire in 24 hours
7. **Project Cleanup**: Remove completed projects from memory after timeout

### Connection Management
```typescript
// Lazy initialization
let sogniClient = null;

async function getSogniClient() {
  if (!sogniClient) {
    sogniClient = await SogniClient.createInstance({
      appId: process.env.SOGNI_APP_ID,
      network: process.env.SOGNI_ENV === 'production' ? 'fast' : 'relaxed'
    });
    await sogniClient.account.login(
      process.env.SOGNI_USERNAME,
      process.env.SOGNI_PASSWORD
    );
    await sogniClient.projects.waitForModels();
  }
  return sogniClient;
}
```

## Key Files in SDK
- `src/index.ts` - Main exports and SogniClient class
- `src/Projects/index.ts` - ProjectsApi implementation
- `src/Projects/Project.ts` - Project class with events
- `src/Projects/Job.ts` - Job class with enhancement
- `src/Projects/types/index.ts` - All type definitions
- `src/ApiClient/WebSocketClient/events.ts` - WebSocket event types
- `examples/` - Usage examples including Express integration

This reference should be consulted when implementing Sogni SDK integration patterns in the demo superapp.
