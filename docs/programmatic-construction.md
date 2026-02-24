# Programmatic Construction

Build, validate, gate, and parse envelopes with first-class SDK APIs.

## Construct

```typescript
import { createEnvelope } from "@cleocode/lafs-protocol";

const envelope = createEnvelope({
  success: true,
  result: { users: [] },
  meta: {
    operation: "users.list",
    requestId: "req_001",
    transport: "http",
    strict: true,
    mvi: "standard",
    contextVersion: 1,
  },
});
```

## Validate + conformance

```typescript
import { runEnvelopeConformance, validateEnvelope } from "@cleocode/lafs-protocol";

const schema = validateEnvelope(envelope);
const conformance = runEnvelopeConformance(envelope);
```

## Enforce pipeline compliance

```typescript
import { assertCompliance, withCompliance } from "@cleocode/lafs-protocol";

assertCompliance(envelope, {
  checkConformance: true,
  requireJsonOutput: true,
  flags: { jsonFlag: true },
});

const producer = async () => envelope;
const compliantProducer = withCompliance(producer, { checkConformance: true });
```

## Parse in consumers

```typescript
import { LafsError, parseLafsResponse } from "@cleocode/lafs-protocol";

try {
  const result = parseLafsResponse<{ users: unknown[] }>(envelope);
  console.log(result.users.length);
} catch (error) {
  if (error instanceof LafsError) {
    console.error(error.code, error.message);
  }
}
```

## Schema imports

```typescript
import envelopeSchema from "@cleocode/lafs-protocol/schemas/v1/envelope.schema.json";
```
