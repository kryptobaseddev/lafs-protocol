# LAFS Architecture: Agent Communication Standard

**Version:** 1.0.0  
**Status:** Production Ready  
**Date:** 2026-02-16

---

## Overview

LAFS (LLM-Agent-First Specification) is a response envelope and communication standard for AI agents. It integrates with the official A2A protocol to provide comprehensive agent communication capabilities across three patterns:

1. **A2A (Agent-to-Agent)** - Via official `@a2a-js/sdk`
2. **A2P (Agent-to-Program)** - REST APIs with LAFS envelopes
3. **P2A (Program-to-Agent)** - Structured input to agents

---

## Core Components

### 1. LAFS Envelope Schema

The foundation of LAFS is a standardized JSON envelope for responses:

```json
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "operation": "users.create",
    "requestId": "req_abc123",
    "mvi": "standard",
    "contextVersion": 1
  },
  "success": true,
  "result": { "user": { "id": "123", "name": "Alice" } },
  "error": null
}
```

**Key Features:**
- **Token budgets** - Prevent context overflow (`_budget` in requests)
- **Context preservation** - Track state across operations (`contextVersion`)
- **MVI levels** - Control response verbosity (`minimal`, `standard`, `full`)
- **Structured errors** - Machine-readable error codes with retry semantics

### 2. Official A2A Integration

LAFS builds on the official `@a2a-js/sdk` for agent-to-agent communication:

```bash
npm install @a2a-js/sdk @lafs/envelope
```

```typescript
import { ClientFactory } from '@a2a-js/sdk/client';
import { withLafsEnvelope } from '@lafs/envelope/a2a';

// Create A2A client
const factory = new ClientFactory();
const client = await factory.createFromUrl('http://localhost:4000');

// Send message with LAFS envelope wrapping
const result = await withLafsEnvelope(client, {
  message: {
    role: 'user',
    parts: [{ kind: 'text', text: 'Analyze data' }]
  },
  // LAFS-specific: token budget
  budget: { maxTokens: 4000 }
});

// Result contains LAFS envelope in artifact
const envelope = result.artifacts[0].parts[0].data;
console.log(envelope._meta._tokenEstimate);
```

### 3. A2P (Agent-to-Program) Pattern

For agents calling traditional APIs:

```typescript
import { LAFSServer } from '@lafs/envelope/server';

const server = new LAFSServer({
  enforceBudgets: true
});

// REST endpoint returning LAFS envelopes
server.addEndpoint({
  path: '/api/users',
  method: 'GET',
  handler: async (request) => {
    const users = await db.users.findAll();
    
    return {
      _meta: {
        operation: 'users.list',
        requestId: request.id,
        mvi: 'standard'
      },
      success: true,
      result: { users }
    };
  }
});
```

### 4. P2A (Program-to-Agent) Pattern

For programs calling agents with structured input:

```typescript
import { ProgramClient } from '@lafs/envelope/client';

const client = new ProgramClient({
  agentUrl: 'http://agent.example.com/a2a'
});

// Structured input with LAFS envelope
const response = await client.call({
  operation: 'code.review',
  params: {
    language: 'typescript',
    code: 'function add(a, b) { return a + b; }'
  },
  // LAFS-specific
  budget: { maxTokens: 1000 },
  context: {
    objective: 'Review for type safety'
  }
});

// Response is LAFS envelope
if (response.success) {
  console.log(response.result.review);
}
```

---

## Package Structure

```
@lafs/envelope
├── src/
│   ├── schema/           # JSON Schema definitions
│   │   ├── envelope.json
│   │   ├── error-registry.json
│   │   └── context-ledger.json
│   ├── types/            # TypeScript types
│   │   ├── envelope.ts
│   │   ├── meta.ts
│   │   └── errors.ts
│   ├── validation/       # Schema validation
│   │   ├── validator.ts
│   │   └── rules/
│   ├── a2a/              # A2A integration
│   │   ├── bridge.ts     # Bridge to @a2a-js/sdk
│   │   └── wrapper.ts    # LAFS envelope wrapper
│   ├── server/           # A2P pattern
│   │   └── http-server.ts
│   ├── client/           # P2A pattern
│   │   └── http-client.ts
│   └── budget/           # Token budget enforcement
│       ├── estimator.ts
│       └── enforcer.ts
├── package.json
│   "dependencies": {
│     "@a2a-js/sdk": "^0.3.0"  # Official A2A SDK
│   }
└── README.md
```

---

## API Reference

### A2A Integration

```typescript
import { 
  withLafsEnvelope,
  createLafsArtifact,
  parseLafsResponse 
} from '@lafs/envelope/a2a';

// Wrap A2A client with LAFS
const lafsClient = withLafsEnvelope(a2aClient, {
  defaultBudget: { maxTokens: 2000 }
});

// Create LAFS artifact for A2A
const artifact = createLafsArtifact({
  success: true,
  result: { data: '...' }
});

// Parse LAFS envelope from A2A response
const envelope = parseLafsResponse(task.artifacts[0]);
```

### A2P Server

```typescript
import { LAFSServer } from '@lafs/envelope/server';

const server = new LAFSServer({
  port: 3000,
  enforceBudgets: true,
  defaultMVI: 'standard'
});

server.addEndpoint({
  path: '/api/data',
  middleware: [budgetMiddleware()],
  handler: async (req) => {
    return createEnvelope({
      operation: 'data.query',
      success: true,
      result: await queryData(req.params)
    });
  }
});
```

### P2A Client

```typescript
import { ProgramClient } from '@lafs/envelope/client';

const client = new ProgramClient({
  baseUrl: 'http://agent.example.com'
});

const response = await client.call({
  operation: 'task.execute',
  params: { ... },
  budget: { maxTokens: 4000 }
});
```

---

## Token Budgets (LAFS Unique Feature)

A2A doesn't provide token budget management. LAFS adds this:

```typescript
// Request with budget
const request = {
  operation: 'data.query',
  _budget: {
    maxTokens: 4000,
    maxItems: 100
  },
  params: { ... }
};

// Server enforces budget
const server = new LAFSServer({
  enforceBudgets: true,
  truncationStrategy: 'depth-first'
});

// Response includes token estimate
const response = {
  _meta: {
    _tokenEstimate: {
      estimated: 2847,
      budget: 4000,
      method: 'character_based'
    }
  },
  success: true,
  result: { ... }
};
```

---

## Error Handling

LAFS provides structured error codes:

```typescript
import { ErrorRegistry } from '@lafs/envelope/errors';

// Standard error codes
const error = {
  code: 'E_NOT_FOUND_RESOURCE',
  message: 'User not found',
  category: 'NOT_FOUND',
  retryable: false
};

// Registry provides retry guidance
const registry = new ErrorRegistry();
const errorInfo = registry.get('E_NOT_FOUND_RESOURCE');
console.log(errorInfo.retryable); // false
```

---

## Conformance

Validate LAFS compliance:

```typescript
import { ConformanceChecker } from '@lafs/envelope/conformance';

const checker = new ConformanceChecker();
const result = checker.validate(envelope);

if (!result.valid) {
  console.error(result.violations);
}
```

---

## Dependencies

```json
{
  "name": "@lafs/envelope",
  "version": "1.0.0",
  "dependencies": {
    "@a2a-js/sdk": "^0.3.0",
    "ajv": "^8.12.0"
  },
  "peerDependencies": {
    "typescript": ">=5.0.0"
  }
}
```

---

## Next Steps

1. **Install**: `npm install @lafs/envelope`
2. **Read**: [Getting Started Guide](./getting-started.md)
3. **Try**: [Examples](./examples/)
4. **Integrate**: [A2A Pattern](./a2a-integration.md)

---

## License

MIT
