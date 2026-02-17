# Quick Start Guide

**What you'll learn:** Set up LAFS in your project and send your first conformant envelope in under 5 minutes.

## Prerequisites

- Node.js 18+ or Python 3.9+
- An API endpoint or tool you want to wrap with LAFS

## Installation

### TypeScript/JavaScript

```bash
npm install @cleocode/lafs-protocol
```

### Python

```bash
pip install lafs-protocol
```

## Your first LAFS envelope

### TypeScript Example

```typescript
import { validateEnvelope, createEnvelope } from '@cleocode/lafs-protocol';

// Create a success envelope
const envelope = createEnvelope({
  success: true,
  result: {
    message: "Hello from LAFS!",
    timestamp: new Date().toISOString()
  },
  meta: {
    operation: "hello.world",
    requestId: "req_001"
  }
});

// Validate it
const result = validateEnvelope(envelope);
console.log('Valid:', result.valid);
```

### Python Example

```python
from lafs_protocol import create_envelope, validate_envelope

# Create a success envelope
envelope = create_envelope(
    success=True,
    result={
        "message": "Hello from LAFS!",
        "timestamp": "2026-02-16T10:00:00Z"
    },
    meta={
        "operation": "hello.world",
        "requestId": "req_001"
    }
)

# Validate it
result = validate_envelope(envelope)
print(f"Valid: {result.valid}")
```

## Sending the envelope

### REST API

```typescript
import express from 'express';
import { createEnvelope, validateEnvelope } from '@cleocode/lafs-protocol';

const app = express();
app.use(express.json());

app.get('/api/hello', (req, res) => {
  const envelope = createEnvelope({
    success: true,
    result: { message: "Hello, World!" },
    meta: {
      operation: "hello.get",
      requestId: req.headers['x-request-id'] || 'req_unknown'
    }
  });

  res.json(envelope);
});

app.listen(3000);
```

### MCP Tool

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createEnvelope } from '@cleocode/lafs-protocol';

const server = new Server({
  name: "my-lafs-server",
  version: "1.0.0"
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_data") {
    const envelope = createEnvelope({
      success: true,
      result: { data: "your data here" },
      meta: {
        operation: "tool.get_data",
        requestId: request.params.requestId
      }
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify(envelope)
      }]
    };
  }
});
```

## Before and After

### Before LAFS

Your agent needs custom parsing for every integration:

```typescript
// API A returns this
const dataA = await fetch('/api/a').then(r => r.json());
// dataA = { data: {...}, status: "ok" }

// API B returns this  
const dataB = await fetch('/api/b').then(r => r.json());
// dataB = { result: {...}, error: null }

// Different parsing logic for each
const resultA = dataA.data;
const resultB = dataB.result;
```

### After LAFS

One parser handles everything:

```typescript
import { parseLafsResponse } from '@cleocode/lafs-protocol';

// Both APIs return LAFS envelopes
const dataA = await fetch('/api/a').then(r => r.json());
const dataB = await fetch('/api/b').then(r => r.json());

// Same parsing logic
const resultA = parseLafsResponse(dataA);
const resultB = parseLafsResponse(dataB);
```

## Next steps

- **[Understand envelope basics](envelope-basics.md)** — Deep dive into envelope structure
- **[Handle errors](error-handling.md)** — Work with LAFS error codes
- **[Integrate with MCP](integrations/mcp.md)** — Build MCP tools with LAFS
