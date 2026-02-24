# A2A Integration

LAFS integrates with A2A through the `@cleocode/lafs-protocol/a2a` subpath.

## Agent Card extension declaration

```typescript
import { buildLafsExtension } from "@cleocode/lafs-protocol/a2a";

const extension = buildLafsExtension({
  required: false,
  supportsContextLedger: true,
  supportsTokenBudgets: true,
});
```

## Extension negotiation middleware

```typescript
import { extensionNegotiationMiddleware } from "@cleocode/lafs-protocol/a2a";

app.use(
  extensionNegotiationMiddleware({
    extensions: [extension],
    enforceRequired: true,
  }),
);
```

## Artifact with LAFS envelope

```typescript
import { createEnvelope } from "@cleocode/lafs-protocol";
import { createLafsArtifact } from "@cleocode/lafs-protocol/a2a";

const envelope = createEnvelope({
  success: true,
  result: { answer: "done" },
  meta: { operation: "agent.solve", requestId: "req_a2a_1" },
});

const artifact = createLafsArtifact(envelope);
```

## Consumer parsing

```typescript
import { parseLafsResponse } from "@cleocode/lafs-protocol";

const result = parseLafsResponse(envelope);
```

## Related APIs

- Task lifecycle: `TaskManager`, `attachLafsEnvelope`
- Bindings: `@cleocode/lafs-protocol/a2a/bindings`
