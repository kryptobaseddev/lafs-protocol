# Welcome to LAFS

**What you'll learn:** This guide introduces LAFS (LLM-Agent-First Specification) — a response envelope contract that makes your API responses predictable and easy for LLM agents to consume.

## What is LAFS?

LAFS standardizes how structured responses are returned from APIs, tools, and agents. Think of it as a shipping container format for data — no matter what transport you use (HTTP, gRPC, MCP, A2A), the contents follow the same predictable structure.

### Why LAFS matters for agents

Without LAFS, every service returns data differently:
- REST API A: `{ data: {...}, error: null }`
- REST API B: `{ result: {...}, success: true }`
- MCP Tool: Plain object with no wrapper
- A2A Agent: Custom format per implementation

With LAFS, every response has the same shape:

```json
{
  "_meta": { /* metadata */ },
  "success": true,
  "result": { /* your data */ },
  "error": null,
  "page": null
}
```

This means your agent can write **one parser** that works everywhere.

## How do I use it?

### For API Developers

Wrap your API responses in a LAFS envelope:

```typescript
// Before: Ad-hoc response
{ "users": [{ "id": 1, "name": "Alice" }] }

// After: LAFS envelope
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "timestamp": "2026-02-16T10:00:00Z",
    "operation": "users.list",
    "requestId": "req_123",
    "strict": true,
    "mvi": true
  },
  "success": true,
  "result": {
    "users": [{ "id": 1, "name": "Alice" }]
  },
  "error": null
}
```

### For Agent Builders

Parse LAFS responses consistently:

```typescript
function parseLafsResponse(envelope: unknown): ParsedResult {
  // 1. Validate envelope structure
  if (!isValidLafsEnvelope(envelope)) {
    throw new Error('Invalid LAFS envelope');
  }

  // 2. Check success/error
  if (!envelope.success) {
    // Handle error with registered error codes
    const error = envelope.error;
    if (error.retryable) {
      // Retry logic
    }
    throw new LafsError(error.code, error.message);
  }

  // 3. Extract result
  return envelope.result;
}
```

## Quick start

Get started in 5 minutes:

1. **[Install the SDK](getting-started/quickstart.md)** — TypeScript or Python
2. **[Validate your first envelope](getting-started/envelope-basics.md)** — Understand the structure
3. **[Handle errors properly](getting-started/error-handling.md)** — Work with registered error codes
4. **[Manage token budgets](getting-started/token-budgets.md)** — Prevent context overflow

## Integration options

LAFS works with your existing infrastructure:

- **[MCP Integration](integrations/mcp.md)** — Return LAFS envelopes from MCP tools
- **[A2A Integration](integrations/a2a.md)** — Standardize agent-to-agent responses
- **[REST Integration](integrations/rest.md)** — Add LAFS to your existing APIs

## Next steps

- Read the [full specification](specification.md) for normative details
- Check [conformance requirements](CONFORMANCE.md) for testing
- Review the [error registry](../schemas/v1/error-registry.json) for all error codes
