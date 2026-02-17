# LAFS Conformance Guide

**What you'll learn:** How to validate your LAFS implementation, choose the right conformance tier, and run conformance checks programmatically.

## Quick conformance check

Validate an envelope in one command:

```bash
npx @cleocode/lafs-protocol validate --envelope ./my-envelope.json
```

Or programmatically:

```typescript
import { validateEnvelope, runEnvelopeConformance } from '@cleocode/lafs-protocol';

// Quick validation
const result = validateEnvelope(envelope);
console.log('Valid:', result.valid);

// Full conformance suite
const report = runEnvelopeConformance(envelope, { tier: 'standard' });
console.log('All checks passed:', report.ok);
```

## Minimum required checks

Every LAFS implementation must satisfy these basic requirements:

1. **Output defaults to JSON** when no explicit format is requested
2. **`--human` flag** yields non-JSON human output mode
3. **`--human --json` conflict** fails with `E_FORMAT_CONFLICT`
4. **Envelope validates** against `schemas/v1/envelope.schema.json`
5. **Result/error invariants** hold (exactly one is non-null)
6. **Error codes** are from the registered error registry
7. **Pagination metadata** validates when present
8. **Context preservation** works for multi-step operations

## Adoption Tiers

LAFS defines three conformance tiers. Each tier builds on the previous one.

| Tier | Checks | When to Use |
|------|--------|-------------|
| **Core** | Schema validation, invariants | Quick adoption, prototyping, internal tools |
| **Standard** | Core + error codes, MVI flags | Production APIs, third-party integrations |
| **Complete** | Standard + config handling, context validation | Official certification, reference implementations |

### Core tier

The minimum viable LAFS implementation. Validates envelope structure only.

**Code example:**

```typescript
import { validateEnvelope } from '@cleocode/lafs-protocol';

// Your API endpoint
app.get('/api/users', async (req, res) => {
  const envelope = {
    $schema: "https://lafs.dev/schemas/v1/envelope.schema.json",
    _meta: {
      specVersion: "1.0.0",
      operation: "users.list",
      requestId: req.requestId
    },
    success: true,
    result: { users: await getUsers() },
    error: null
  };

  // Validate before sending
  const validation = validateEnvelope(envelope);
  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
  }

  res.json(envelope);
});
```

### Standard tier (Recommended)

Adds error registry compliance and MVI support. **Recommended for production use.**

**Code example:**

```typescript
import { createEnvelope, isRegisteredErrorCode } from '@cleocode/lafs-protocol';

// Success response
const successEnvelope = createEnvelope({
  success: true,
  result: { users },
  meta: {
    operation: "users.list",
    requestId: req.requestId,
    mvi: true,  // Required for Standard tier
    strict: true  // Required for Standard tier
  }
});

// Error response with registered code
const errorEnvelope = createEnvelope({
  success: false,
  error: {
    code: "E_NOT_FOUND_RESOURCE",  // Must be registered
    message: "User not found",
    category: "NOT_FOUND",
    retryable: false
  },
  meta: {
    operation: "users.get",
    requestId: req.requestId
  }
});

// Verify error code is registered
console.log('Valid code:', isRegisteredErrorCode("E_NOT_FOUND_RESOURCE"));
```

### Complete tier

Full compliance including advanced features like context preservation and configuration handling.

**Code example:**

```typescript
import { runEnvelopeConformance } from '@cleocode/lafs-protocol';

// Run complete tier checks
const report = runEnvelopeConformance(envelope, {
  tier: 'complete',
  strict: true
});

// Check all passed
if (report.ok) {
  console.log('✓ Complete tier conformance achieved');
} else {
  console.log('Failed checks:', report.failed);
}
```

## Conformance runner

### CLI usage

```bash
# Run all checks on an envelope
npx @cleocode/lafs-protocol conformance --envelope ./envelope.json

# Run specific tier
npx @cleocode/lafs-protocol conformance --envelope ./envelope.json --tier standard

# Output as JSON for programmatic use
npx @cleocode/lafs-protocol conformance --envelope ./envelope.json --format json

# Run on multiple fixtures
for file in fixtures/valid-*.json; do
  npx @cleocode/lafs-protocol conformance --envelope "$file" --tier standard
done
```

### Programmatic usage

```typescript
import { runEnvelopeConformance } from '@cleocode/lafs-protocol';

// Test your implementation
async function testConformance() {
  const testCases = [
    { name: 'success', envelope: createSuccessEnvelope() },
    { name: 'error', envelope: createErrorEnvelope() },
    { name: 'pagination', envelope: createPaginatedEnvelope() }
  ];

  for (const testCase of testCases) {
    const report = runEnvelopeConformance(testCase.envelope, {
      tier: 'standard'
    });

    console.log(`${testCase.name}: ${report.ok ? 'PASS' : 'FAIL'}`);
    
    if (!report.ok) {
      console.log('  Failed checks:', report.failed);
    }
  }
}
```

## Conformance check reference

| Check | Tier | Description | Validation |
|-------|------|-------------|------------|
| `envelope_schema_valid` | Core | Validates against JSON Schema | Schema validation |
| `envelope_invariants` | Core | success/result/error consistency | Logical check |
| `error_code_registered` | Standard | Error code exists in registry | Registry lookup |
| `meta_mvi_present` | Standard | MVI disclosure level valid | Enum check |
| `meta_strict_present` | Standard | Strict mode declared | Boolean check |
| `strict_mode_behavior` | Standard | Optional fields handled correctly | Field presence |
| `strict_mode_enforced` | Standard | Unknown properties rejected | Additional properties |
| `pagination_mode_consistent` | Standard | Page fields match mode | Conditional validation |
| `config_override_respected` | Complete | Config-based overrides work | Flag resolution |
| `flag_conflict_rejected` | Complete | Conflicting flags rejected | Format conflict |
| `context_validation` | Complete | Context preservation works | Ledger validation |
| `pagination_validation` | Complete | Pagination metadata valid | Schema validation |

## CI/CD integration

Add conformance checks to your build pipeline:

```yaml
# .github/workflows/lafs-conformance.yml
name: LAFS Conformance

on: [push, pull_request]

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install LAFS CLI
        run: npm install -g @cleocode/lafs-protocol
      
      - name: Run conformance tests
        run: |
          failed=0
          for file in fixtures/valid-*.json; do
            if ! lafs conformance --envelope "$file" --tier standard --quiet; then
              echo "FAILED: $file"
              failed=1
            fi
          done
          exit $failed
```

## Next steps

- **[Error handling](../getting-started/error-handling.md)** — Work with registered error codes
- **[Envelope basics](../getting-started/envelope-basics.md)** — Understand envelope structure
- **[CLI Reference](../sdk/cli.md)** — Full CLI documentation
