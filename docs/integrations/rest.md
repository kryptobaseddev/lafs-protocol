# REST API Integration

**What you'll learn:** How to add LAFS envelopes to existing REST APIs, making them predictable and agent-friendly while maintaining backward compatibility.

## The challenge

Your API returns:

```json
{ "users": [{ "id": 1, "name": "Alice" }] }
```

Agents have to guess:
- Is there pagination info?
- How are errors structured?
- What's the request ID for debugging?

## The LAFS solution

Wrap your responses in a standard envelope:

```json
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "timestamp": "2026-02-16T10:00:00Z",
    "operation": "users.list",
    "requestId": "req_123",
    "transport": "http",
    "strict": true
  },
  "success": true,
  "result": {
    "users": [{ "id": 1, "name": "Alice" }]
  },
  "page": {
    "mode": "cursor",
    "nextCursor": "eyJpZCI6IjIifQ==",
    "hasMore": true
  }
}
```

## Implementation with Express

### Basic setup

```typescript
import express from 'express';
import { createEnvelope, validateEnvelope } from '@cleocode/lafs-protocol';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Middleware to generate request IDs
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Helper to create envelopes
function createResponseEnvelope(req, success, result, error = null, page = null) {
  return createEnvelope({
    success,
    result,
    error,
    page,
    meta: {
      operation: `${req.baseUrl}.${req.route?.path || 'unknown'}`,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      transport: 'http',
      strict: req.query.strict !== 'false'
    }
  });
}
```

### Success responses

```typescript
// GET /api/users
app.get('/api/users', async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;
    const { users, nextCursor, hasMore } = await getUsers({ cursor, limit });

    const envelope = createResponseEnvelope(
      req,
      true,
      { users },
      null,
      {
        mode: 'cursor',
        nextCursor,
        hasMore
      }
    );

    res.json(envelope);
  } catch (error) {
    // Error handling (see below)
  }
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    
    if (!user) {
      const envelope = createResponseEnvelope(
        req,
        false,
        null,
        {
          code: 'E_NOT_FOUND_RESOURCE',
          message: `User with ID ${req.params.id} not found`,
          category: 'NOT_FOUND',
          retryable: false,
          details: { resourceType: 'user', resourceId: req.params.id }
        }
      );
      return res.status(404).json(envelope);
    }

    const envelope = createResponseEnvelope(
      req,
      true,
      { user }
    );

    res.json(envelope);
  } catch (error) {
    // Error handling
  }
});
```

### Error responses

```typescript
// Error handler middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);

  let errorCode = 'E_INTERNAL_ERROR';
  let statusCode = 500;
  let category = 'INTERNAL';

  // Map error types to LAFS codes
  if (error.name === 'ValidationError') {
    errorCode = 'E_VALIDATION_SCHEMA';
    statusCode = 400;
    category = 'VALIDATION';
  } else if (error.name === 'NotFoundError') {
    errorCode = 'E_NOT_FOUND_RESOURCE';
    statusCode = 404;
    category = 'NOT_FOUND';
  } else if (error.name === 'RateLimitError') {
    errorCode = 'E_RATE_LIMIT_EXCEEDED';
    statusCode = 429;
    category = 'RATE_LIMIT';
  }

  const envelope = createResponseEnvelope(
    req,
    false,
    null,
    {
      code: errorCode,
      message: error.message,
      category,
      retryable: category === 'RATE_LIMIT' || category === 'TRANSIENT',
      retryAfterMs: error.retryAfterMs || null,
      details: error.details || {}
    }
  );

  res.status(statusCode).json(envelope);
});
```

## Supporting token budgets

Handle `_budget` query parameter:

```typescript
app.get('/api/users', async (req, res) => {
  try {
    const budget = req.query._budget ? JSON.parse(req.query._budget) : null;
    const fields = req.query._fields?.split(',') || null;
    
    const result = await getUsers({
      cursor: req.query.cursor,
      limit: req.query.limit,
      budget,
      fields
    });

    const envelope = createEnvelope({
      success: true,
      result: { users: result.users },
      page: {
        mode: 'cursor',
        nextCursor: result.nextCursor,
        hasMore: result.hasMore
      },
      meta: {
        operation: 'users.list',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        warnings: result.truncated ? [{
          code: 'E_MVI_BUDGET_TRUNCATED',
          message: 'Response truncated to fit token budget'
        }] : undefined,
        _tokenEstimate: budget ? {
          estimated: result.tokenEstimate,
          budget: budget.maxTokens,
          method: 'character_based'
        } : undefined
      }
    });

    res.json(envelope);
  } catch (error) {
    if (error.code === 'E_MVI_BUDGET_EXCEEDED') {
      const envelope = createResponseEnvelope(
        req,
        false,
        null,
        {
          code: 'E_MVI_BUDGET_EXCEEDED',
          message: 'Response exceeds declared token budget',
          category: 'VALIDATION',
          retryable: true,
          details: {
            estimatedTokens: error.estimatedTokens,
            budget: error.budget,
            suggestion: 'Try with smaller _fields or higher maxTokens'
          }
        }
      );
      return res.status(400).json(envelope);
    }
    throw error;
  }
});
```

## HTTP status code mapping

Map LAFS categories to HTTP status codes:

| LAFS Category | HTTP Status | Retryable |
|---------------|-------------|-----------|
| VALIDATION | 400 | No |
| NOT_FOUND | 404 | No |
| AUTH | 401 | No |
| PERMISSION | 403 | No |
| RATE_LIMIT | 429 | Yes |
| CONFLICT | 409 | No |
| TRANSIENT | 503 | Yes |
| INTERNAL | 500 | No |

```typescript
const statusCodeMap = {
  VALIDATION: 400,
  NOT_FOUND: 404,
  AUTH: 401,
  PERMISSION: 403,
  RATE_LIMIT: 429,
  CONFLICT: 409,
  TRANSIENT: 503,
  INTERNAL: 500
};

function getHttpStatus(category: string): number {
  return statusCodeMap[category] || 500;
}
```

## Client consumption

### TypeScript client

```typescript
import { parseLafsResponse, LafsError } from '@cleocode/lafs-protocol';

class LafsHttpClient {
  constructor(private baseUrl: string) {}

  async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      budget?: { maxTokens: number };
      fields?: string[];
    } = {}
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    if (options.budget) {
      url.searchParams.set('_budget', JSON.stringify(options.budget));
    }
    if (options.fields) {
      url.searchParams.set('_fields', options.fields.join(','));
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': generateId()
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const envelope = await response.json();
    return parseLafsResponse(envelope);
  }
}

// Usage
const client = new LafsHttpClient('https://api.example.com');
const users = await client.request('GET', '/api/users', {
  budget: { maxTokens: 2000 },
  fields: ['id', 'name']
});
```

## Before and After

### Before: Ad-hoc responses

```json
// Success
{ "users": [...], "total": 100 }

// Error
{ "error": "Not found", "status": 404 }

// Different structure for each endpoint
```

### After: Standard LAFS

```json
// Success
{
  "_meta": { "operation": "users.list", "requestId": "req_123" },
  "success": true,
  "result": { "users": [...] },
  "page": { "mode": "cursor", "hasMore": true }
}

// Error
{
  "_meta": { "operation": "users.get", "requestId": "req_124" },
  "success": false,
  "error": {
    "code": "E_NOT_FOUND_RESOURCE",
    "message": "User not found",
    "category": "NOT_FOUND",
    "retryable": false
  }
}
```

## Next steps

- **[MCP Integration](mcp.md)** — Add LAFS to MCP tools
- **[A2A Integration](a2a.md)** — Use LAFS for agent communication
- **[Envelope basics](../getting-started/envelope-basics.md)** — Deep dive into envelope structure
