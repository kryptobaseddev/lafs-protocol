# MCP (Model Context Protocol) Integration

**What you'll learn:** How to return LAFS-compliant envelopes from MCP tools so LLM hosts can parse responses deterministically.

## Why LAFS + MCP?

MCP defines how tools are discovered and invoked. LAFS defines what those tools return.

```
LLM Host ──► MCP Server ──► Tool ──► LAFS Envelope ──► MCP Server ──► LLM Host

     MCP defines           LAFS defines
     how to call           what comes back
```

## Basic MCP tool with LAFS

### TypeScript

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createEnvelope, validateEnvelope } from '@cleocode/lafs-protocol';

const server = new Server(
  { name: 'my-lafs-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Define a tool that returns LAFS envelopes
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search_users') {
    try {
      // Perform the search
      const users = await searchUsers(args.query, args.limit);

      // Create LAFS envelope
      const envelope = createEnvelope({
        success: true,
        result: { users },
        meta: {
          operation: 'users.search',
          requestId: request.params.meta?.requestId || generateId()
        }
      });

      // Return as JSON string in MCP content
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(envelope)
        }]
      };
    } catch (error) {
      // Return structured error
      const envelope = createEnvelope({
        success: false,
        error: {
          code: 'E_INTERNAL_ERROR',
          message: error.message,
          category: 'INTERNAL',
          retryable: false
        },
        meta: {
          operation: 'users.search',
          requestId: request.params.meta?.requestId || generateId()
        }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(envelope)
        }]
      };
    }
  }
});
```

### Python

```python
from mcp.server import Server
from mcp.types import TextContent
from lafs_protocol import create_envelope

server = Server("my-lafs-server")

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict) -> list:
    if name == "search_users":
        try:
            users = await search_users(arguments.get("query"), arguments.get("limit"))
            
            envelope = create_envelope(
                success=True,
                result={"users": users},
                meta={
                    "operation": "users.search",
                    "requestId": generate_id()
                }
            )
            
            return [TextContent(type="text", text=json.dumps(envelope))]
        except Exception as e:
            envelope = create_envelope(
                success=False,
                error={
                    "code": "E_INTERNAL_ERROR",
                    "message": str(e),
                    "category": "INTERNAL",
                    "retryable": False
                },
                meta={
                    "operation": "users.search",
                    "requestId": generate_id()
                }
            )
            
            return [TextContent(type="text", text=json.dumps(envelope))]
```

## Before and After

### Before LAFS: Custom format per tool

```json
{
  "users": [{"id": 1, "name": "Alice"}],
  "total": 1,
  "error": null
}
```

Another tool returns:

```json
{
  "results": [{"id": 1, "name": "Alice"}],
  "count": 1,
  "status": "ok"
}
```

Your agent needs different parsing logic for each tool.

### After LAFS: Standard envelope

Both tools return:

```json
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "operation": "users.search",
    "requestId": "req_123",
    "strict": true
  },
  "success": true,
  "result": {
    "users": [{"id": 1, "name": "Alice"}]
  },
  "error": null
}
```

One parser handles all tools.

## Handling pagination in MCP tools

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'list_users') {
    const { cursor, limit = 10 } = request.params.arguments;
    
    const { users, nextCursor, hasMore } = await listUsers({ cursor, limit });

    const envelope = createEnvelope({
      success: true,
      result: { users },
      meta: {
        operation: 'users.list',
        requestId: request.params.meta?.requestId
      },
      page: {
        mode: 'cursor',
        nextCursor,
        hasMore
      }
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(envelope) }]
    };
  }
});
```

## Token budget support

Handle `_budget` parameter for LLM-optimized responses:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_user_details') {
    const { userId, _budget } = request.params.arguments;
    
    try {
      // Respect token budget if provided
      const user = await getUserDetails(userId, _budget);
      
      const envelope = createEnvelope({
        success: true,
        result: { user },
        meta: {
          operation: 'users.get',
          requestId: request.params.meta?.requestId,
          mvi: _budget ? true : 'standard'
        }
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(envelope) }]
      };
    } catch (error) {
      if (error.code === 'E_MVI_BUDGET_EXCEEDED') {
        const envelope = createEnvelope({
          success: false,
          error: {
            code: 'E_MVI_BUDGET_EXCEEDED',
            message: 'User details exceed token budget',
            category: 'VALIDATION',
            retryable: true,
            details: {
              suggestion: 'Request with _fields=["id", "name"] for minimal data'
            }
          },
          meta: {
            operation: 'users.get',
            requestId: request.params.meta?.requestId
          }
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(envelope) }]
        };
      }
      throw error;
    }
  }
});
```

## Consuming LAFS responses in MCP clients

When your MCP client receives a tool response:

```typescript
import { parseLafsResponse } from '@cleocode/lafs-protocol';

async function callTool(server, toolName, args) {
  const response = await server.callTool({
    name: toolName,
    arguments: args
  });

  // Extract the envelope from MCP content
  const envelopeText = response.content.find(c => c.type === 'text')?.text;
  if (!envelopeText) {
    throw new Error('No LAFS envelope in response');
  }

  // Parse the LAFS envelope
  const envelope = JSON.parse(envelopeText);
  
  // Validate and extract result
  return parseLafsResponse(envelope);
}
```

## Next steps

- **[A2A Integration](a2a.md)** — Agent-to-Agent protocol integration
- **[REST Integration](rest.md)** — Traditional HTTP API integration
- **[Envelope basics](../getting-started/envelope-basics.md)** — Deep dive into envelopes
