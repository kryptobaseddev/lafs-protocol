# LAFS for LLM Agents

> **Quick Reference Guide for AI Agents**  
> What you need to know to interact with LAFS-compliant services

## Overview

LAFS (LLM-Agent-First Specification) defines a standard response envelope that APIs and tools return. As an LLM agent, you interact with LAFS-compliant services to:

1. **Parse predictable responses** — Same structure everywhere
2. **Preserve context** — Track state across multi-step workflows  
3. **Handle errors consistently** — Structured error codes and retry logic
4. **Control verbosity** — Request only the data you need

---

## Quick Start

### 1. Make a Request

```typescript
// Request JSON format (default)
const response = await fetch('https://api.example.com/users', {
  headers: { 'Accept': 'application/json' }
});

const envelope = await response.json();
```

### 2. Parse the Envelope

```typescript
// All LAFS responses follow this structure
interface LAFSEnvelope {
  $schema: string;           // Schema URL
  _meta: {
    specVersion: string;     // "1.0.0"
    schemaVersion: string;   // "1.0.0"
    timestamp: string;       // ISO 8601
    operation: string;       // "users.list"
    requestId: string;       // "req_abc123"
    transport: string;       // "http" | "cli" | "grpc" | "sdk"
    strict: boolean;         // Schema validation mode
    mvi: string;            // "minimal" | "standard" | "full" | "custom"
    contextVersion: number;  // Ledger version
    sessionId?: string;      // For correlating workflows
    warnings?: Warning[];    // Non-fatal issues
  };
  success: boolean;          // true = success, false = error
  result: object | array | null;  // Success data
  error: Error | null;       // Error details if success=false
  page: Page | null;         // Pagination metadata
  _extensions: object;       // Vendor-specific data
}
```

### 3. Handle Success

```typescript
if (envelope.success) {
  // Access your data
  const users = envelope.result;
  
  // Check for warnings (soft errors)
  if (envelope._meta.warnings) {
    for (const warning of envelope._meta.warnings) {
      console.warn(`${warning.code}: ${warning.message}`);
    }
  }
  
  // Check pagination
  if (envelope.page?.hasMore) {
    // Fetch next page using page.nextCursor or page.offset
  }
}
```

### 4. Handle Errors

```typescript
if (!envelope.success) {
  const error = envelope.error;
  
  console.error(`Error ${error.code}: ${error.message}`);
  console.error(`Category: ${error.category}`);
  
  // Check if retryable
  if (error.retryable) {
    if (error.retryAfterMs) {
      await sleep(error.retryAfterMs);
      // Retry request
    }
  }
  
  // Access error details
  console.error('Details:', error.details);
}
```

---

## Format Selection

LAFS supports exactly two formats:

| Format | Use Case | How to Request |
|--------|----------|----------------|
| `json` | Default. Machine-readable for agents. | Default or `--json` |
| `human` | Terminal display for humans. | `--human` flag |

### Choosing a Format

```typescript
// As an LLM agent, ALWAYS prefer JSON
const response = await fetch('/api/endpoint', {
  headers: {
    'Accept': 'application/json',
    'X-Requested-Format': 'json'  // Some APIs support this
  }
});

// Or via CLI
// $ caamp users list --json

// NEVER use these (not supported):
// ❌ --format text
// ❌ --format markdown
// ❌ --format table
// ❌ --format jsonl
```

### Why Only Two Formats?

LAFS is a **response envelope contract**, not a presentation layer:

- **json** → Structured data for programmatic consumption
- **human** → Terminal-optimized display

Need markdown, tables, or other formats? Transform JSON using standard tools:

```bash
# Markdown from JSON
$ caamp users list --json | jq -r '.result[] | "- \(.name)"'

# Table from JSON  
$ caamp users list --json | jq -r '.result[] | "\(.id)\t\(.name)"' | column -t
```

---

## Context Preservation

### Session Management

Use `sessionId` to correlate multi-step workflows:

```typescript
// Start a session
const sessionId = generateSessionId(); // e.g., "session_abc123"

// Pass session ID in requests
const step1 = await callLafsService({
  operation: 'analyze',
  sessionId,
  data: { /* ... */ }
});

// Continue with same session
const step2 = await callLafsService({
  operation: 'process',
  sessionId,
  data: { 
    previousResult: step1.result,
    /* ... */ 
  }
});

// Access session from response
console.log(step2._meta.sessionId); // "session_abc123"
```

### Context Ledger

For complex workflows, use the context ledger:

```typescript
// Retrieve full context
const context = await fetch('/_lafs/context/{ledgerId}?mode=full');

// Get only changes since version N
const delta = await fetch('/_lafs/context/{ledgerId}?mode=delta&sinceVersion=5');

// Quick validation
const summary = await fetch('/_lafs/context/{ledgerId}?mode=summary');
```

---

## MVI and Progressive Disclosure

### Minimum Viable Information (MVI)

By default, LAFS returns only essential fields:

```typescript
// Default response (minimal)
{
  "success": true,
  "result": {
    "id": "123",
    "name": "Alpha"
    // Other fields omitted by default
  }
}
```

### Request More Data

```typescript
// Request specific fields
const response = await fetch('/api/users/123?_fields=name,email,createdAt');

// Request expanded data
const response = await fetch('/api/users/123?_expand=department,manager');

// Request full disclosure
const response = await fetch('/api/users/123?_meta.mvi=full');
```

### Token Budgets

Declare your resource constraints:

```typescript
const response = await fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify({
    _budget: {
      maxTokens: 4000,
      maxBytes: 32768,
      maxItems: 100
    }
  })
});
```

---

## Extensions (_extensions)

Vendor-specific metadata goes in `_extensions`:

```typescript
const envelope = {
  success: true,
  result: { /* ... */ },
  _extensions: {
    "x-caamp-timing": {
      executionMs: 42,
      queryMs: 15
    },
    "x-caamp-source": {
      gitRef: "abc123",
      apiVersion: "2.1.0"
    }
  }
};

// Access extensions (optional - may be undefined)
const timing = envelope._extensions?.["x-caamp-timing"];
if (timing) {
  console.log(`Request took ${timing.executionMs}ms`);
}
```

**Key points:**
- Extensions are optional — don't rely on them for core logic
- Keys use `x-` prefix convention
- Different vendors use different extension names
- Check documentation for vendor-specific extensions

---

## Error Handling Patterns

### Common Error Categories

| Category | Meaning | Example |
|----------|---------|---------|
| VALIDATION | Input invalid | Missing required field |
| AUTH | Not authenticated | Invalid token |
| PERMISSION | Not authorized | Insufficient scope |
| NOT_FOUND | Resource missing | User ID doesn't exist |
| CONFLICT | State conflict | Duplicate entry |
| RATE_LIMIT | Too many requests | Throttling applied |
| TRANSIENT | Temporary failure | Database timeout |
| INTERNAL | Server error | Bug in service |
| CONTRACT | Protocol violation | Invalid envelope |
| MIGRATION | Version mismatch | Schema deprecated |

### Retry Logic

```typescript
async function callWithRetry(operation: () => Promise<LAFSEnvelope>) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const envelope = await operation();
    
    if (envelope.success) {
      return envelope;
    }
    
    const error = envelope.error;
    
    // Don't retry non-retryable errors
    if (!error.retryable) {
      throw new Error(`${error.code}: ${error.message}`);
    }
    
    // Last attempt failed
    if (attempt === maxRetries) {
      throw new Error(`Max retries exceeded: ${error.code}`);
    }
    
    // Wait before retry
    const delay = error.retryAfterMs ?? (attempt * 1000);
    await sleep(delay);
  }
}
```

---

## Quiet Mode

Use `--quiet` for scripting (suppresses non-essential output):

```typescript
// Quiet mode reduces verbosity
const response = await fetch('/api/users', {
  headers: {
    'X-Quiet': 'true'
  }
});

// Or via CLI
// $ caamp users list --json --quiet

// Quiet mode may:
// - Omit warnings
// - Reduce metadata
// - Skip human-readable messages
// But always returns valid envelope structure
```

---

## Best Practices

### 1. Always Check Success First

```typescript
// ❌ Don't assume success
const data = envelope.result.items;  // May throw if error

// ✅ Check success flag
if (!envelope.success) {
  handleError(envelope.error);
  return;
}
const data = envelope.result;
```

### 2. Handle Warnings Gracefully

```typescript
// Warnings don't fail the request
if (envelope._meta.warnings) {
  for (const warning of envelope._meta.warnings) {
    if (warning.deprecated) {
      console.warn(`Deprecation: ${warning.deprecated} will be removed by ${warning.removeBy}`);
      console.warn(`Use ${warning.replacement} instead`);
    }
  }
}
```

### 3. Respect Pagination

```typescript
async function* fetchAllPages(endpoint: string) {
  let page = await fetchPage(endpoint);
  yield page.result;
  
  while (page.page?.hasMore) {
    const nextUrl = page.page.mode === 'cursor'
      ? `${endpoint}?cursor=${page.page.nextCursor}`
      : `${endpoint}?offset=${page.page.offset + page.page.limit}`;
    
    page = await fetchPage(nextUrl);
    yield page.result;
  }
}
```

### 4. Use Session IDs for Workflows

```typescript
// Generate consistent session ID for related operations
const sessionId = `workflow_${Date.now()}_${randomId()}`;

// Pass to all operations in workflow
const step1 = await callService({ operation: 'step1', sessionId });
const step2 = await callService({ operation: 'step2', sessionId });
const step3 = await callService({ operation: 'step3', sessionId });
```

### 5. Don't Hardcode Extension Fields

```typescript
// ❌ Don't assume extension exists
const timing = envelope._extensions["x-caamp-timing"].executionMs;  // May throw

// ✅ Check existence
const timing = envelope._extensions?.["x-caamp-timing"]?.executionMs;
if (timing) {
  console.log(`Duration: ${timing}ms`);
}
```

---

## Integration Examples

### MCP Tool Integration

```typescript
// LAFS response from MCP tool
const result = await mcpClient.callTool('list_users', {});

// Parse LAFS envelope from tool result
const envelope = JSON.parse(result.content[0].text);

if (envelope.success) {
  return envelope.result;
} else {
  throw new Error(envelope.error.message);
}
```

### A2A Agent Integration

```typescript
// LAFS response from A2A agent
const task = await a2aClient.sendTask({
  message: { role: 'user', parts: [{ text: 'get users' }] }
});

// Parse LAFS envelope from artifacts
const envelope = JSON.parse(task.artifacts[0].parts[0].text);

// Process LAFS response
if (envelope.success) {
  console.log(`Found ${envelope.result.length} users`);
}
```

### HTTP API Integration

```typescript
// Direct LAFS HTTP API
const response = await fetch('https://api.example.com/v1/users', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});

const envelope = await response.json();

// Validate envelope structure
if (!envelope.$schema?.includes('lafs.dev')) {
  console.warn('Response may not be LAFS-compliant');
}
```

---

## Summary Checklist

When working with LAFS-compliant services:

- [ ] Parse the envelope structure correctly
- [ ] Check `success` flag before accessing `result`
- [ ] Handle `error` objects with retry logic when appropriate
- [ ] Use `sessionId` for multi-step workflows
- [ ] Respect `warnings` for deprecations and hints
- [ ] Request only needed fields using `_fields` and `_expand`
- [ ] Handle pagination using `page` metadata
- [ ] Access `_extensions` safely (optional fields)
- [ ] Prefer `json` format for programmatic access
- [ ] Use `--quiet` mode for scripting

---

## Resources

- **Full Protocol Spec:** `/mnt/projects/lafs-protocol/lafs.md`
- **Vision Document:** `/mnt/projects/lafs-protocol/docs/VISION.md`
- **JSON Schema:** `/mnt/projects/lafs-protocol/schemas/v1/envelope.schema.json`
- **TypeScript Types:** `/mnt/projects/lafs-protocol/src/types.ts`

---

## Design Principles Reminder

1. **MVI (Minimum Viable Information)** — Default responses are lean
2. **Progressive Disclosure** — Request more detail when needed
3. **Transport Agnosticism** — Same envelope on HTTP, gRPC, CLI
4. **Schema-First** — Contracts are validated, not assumed

LAFS eliminates wrapper code. One parser works everywhere.
