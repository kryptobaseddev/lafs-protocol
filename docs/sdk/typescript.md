# TypeScript SDK Reference

**What you'll learn:** How to use the LAFS TypeScript SDK for envelope creation, validation, and conformance testing.

## Installation

```bash
npm install @cleocode/lafs-protocol
```

## Core functions

### `createEnvelope(options)`

Create a LAFS-compliant envelope.

```typescript
import { createEnvelope } from '@cleocode/lafs-protocol';

const envelope = createEnvelope({
  success: true,
  result: { message: "Hello, World!" },
  meta: {
    operation: "hello.world",
    requestId: "req_123"
  }
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `success` | `boolean` | Yes | Success indicator |
| `result` | `unknown` | Conditional | Result data (required if success=true) |
| `error` | `LafsError` | Conditional | Error details (required if success=false) |
| `page` | `PageMetadata` | No | Pagination info |
| `meta` | `object` | Yes | Metadata including operation, requestId |

### `validateEnvelope(envelope)`

Validate an envelope against the JSON Schema.

```typescript
import { validateEnvelope } from '@cleocode/lafs-protocol';

const result = validateEnvelope(envelope);

if (result.valid) {
  console.log('Envelope is valid');
} else {
  console.error('Validation errors:', result.errors);
}
```

**Returns:**

```typescript
interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}
```

### `parseLafsResponse(envelope)`

Parse and validate a LAFS response, extracting the result or throwing on error.

```typescript
import { parseLafsResponse } from '@cleocode/lafs-protocol';

try {
  const result = parseLafsResponse(envelope);
  console.log('Result:', result);
} catch (error) {
  if (error instanceof LafsError) {
    console.error('LAFS Error:', error.code, error.message);
    if (error.retryable) {
      // Retry logic
    }
  }
}
```

### `isRegisteredErrorCode(code)`

Check if an error code is in the LAFS registry.

```typescript
import { isRegisteredErrorCode } from '@cleocode/lafs-protocol';

if (isRegisteredErrorCode('E_NOT_FOUND_RESOURCE')) {
  console.log('Valid error code');
}
```

## Conformance testing

### `runEnvelopeConformance(envelope, options)`

Run the full conformance test suite on an envelope.

```typescript
import { runEnvelopeConformance } from '@cleocode/lafs-protocol';

const report = runEnvelopeConformance(envelope, {
  tier: 'standard',  // 'core', 'standard', or 'complete'
  strict: true
});

console.log('All checks passed:', report.ok);
console.log('Passed:', report.passed);
console.log('Failed:', report.failed);

// Individual check results
report.checks.forEach(check => {
  console.log(`${check.name}: ${check.passed ? 'PASS' : 'FAIL'}`);
  if (!check.passed) {
    console.log('  Error:', check.error);
  }
});
```

**Conformance checks:**

| Check | Tier | Description |
|-------|------|-------------|
| `envelope_schema_valid` | Core | Validates against JSON Schema |
| `envelope_invariants` | Core | Checks success/result/error consistency |
| `error_code_registered` | Core | Verifies error code exists in registry |
| `meta_mvi_present` | Standard | Validates MVI disclosure level |
| `meta_strict_present` | Standard | Checks strict mode declaration |
| `strict_mode_behavior` | Standard | Validates optional field handling |
| `strict_mode_enforced` | Standard | Checks unknown property rejection |
| `pagination_mode_consistent` | Standard | Validates pagination metadata |

## Types

### `LafsEnvelope`

```typescript
interface LafsEnvelope {
  $schema?: string;
  _meta: MetaData;
  success: boolean;
  result: unknown | null;
  error: LafsError | null;
  page?: PageMetadata | null;
  _extensions?: Record<string, unknown>;
}
```

### `LafsError`

```typescript
interface LafsError {
  code: string;
  message: string;
  category: ErrorCategory;
  retryable: boolean;
  retryAfterMs?: number | null;
  details?: Record<string, unknown>;
}

type ErrorCategory = 
  | 'VALIDATION' 
  | 'NOT_FOUND' 
  | 'AUTH' 
  | 'PERMISSION' 
  | 'RATE_LIMIT' 
  | 'CONFLICT' 
  | 'TRANSIENT' 
  | 'INTERNAL' 
  | 'CONTRACT' 
  | 'MIGRATION';
```

### `PageMetadata`

```typescript
type PageMetadata = 
  | CursorPageMetadata 
  | OffsetPageMetadata;

interface CursorPageMetadata {
  mode: 'cursor';
  nextCursor: string;
  hasMore: boolean;
}

interface OffsetPageMetadata {
  mode: 'offset';
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
```

## Error handling

### `LafsError` class

```typescript
import { LafsError } from '@cleocode/lafs-protocol';

try {
  const result = parseLafsResponse(envelope);
} catch (error) {
  if (error instanceof LafsError) {
    console.log('Code:', error.code);
    console.log('Category:', error.category);
    console.log('Retryable:', error.retryable);
    
    if (error.retryable) {
      // Implement retry
    }
  }
}
```

## Advanced usage

### Custom validation

```typescript
import { Ajv } from 'ajv';
import envelopeSchema from '@cleocode/lafs-protocol/schemas/envelope.schema.json';

const ajv = new Ajv({ strict: false });
const validate = ajv.compile(envelopeSchema);

const isValid = validate(envelope);
if (!isValid) {
  console.error(validate.errors);
}
```

### Token estimation

```typescript
import { estimateTokens } from '@cleocode/lafs-protocol';

const data = { users: [{ id: 1, name: "Alice" }] };
const tokens = estimateTokens(data);
console.log(`Estimated tokens: ${tokens}`);
```

## Next steps

- **[Python SDK](python.md)** — Python SDK reference
- **[CLI Reference](cli.md)** — Command-line tools
- **[Envelope basics](../getting-started/envelope-basics.md)** — Learn about envelopes
