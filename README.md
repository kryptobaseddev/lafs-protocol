# LAFS Protocol

**LLM-Agent-First Specification** — a response envelope contract for AI agent systems.

LAFS defines a standard envelope format for structured responses from LLM-powered agents and tools. It complements transport protocols like [MCP](https://modelcontextprotocol.io/) and [A2A](https://github.com/google/A2A) by standardizing what comes back — not how it gets there.

**Current version:** 1.0.0 | [📚 Documentation](https://codluv.gitbook.io/lafs-protocol/) | [Spec](lafs.md) | [Migration Guides](migrations/)

[![GitBook](https://img.shields.io/badge/docs-gitbook-blue)](https://codluv.gitbook.io/lafs-protocol/)
[![npm](https://img.shields.io/npm/v/@cleocode/lafs-protocol)](https://www.npmjs.com/package/@cleocode/lafs-protocol)

## What LAFS provides

| Layer | Files | Description |
|-------|-------|-------------|
| **Spec** | `lafs.md` | Protocol specification with RFC 2119 language |
| **Schemas** | `schemas/v1/envelope.schema.json` | Envelope schema (Draft-07) with conditional pagination validation |
| | `schemas/v1/context-ledger.schema.json` | Context ledger for state tracking across request/response cycles |
| | `schemas/v1/error-registry.json` | 12 registered error codes with HTTP/gRPC/CLI transport mappings |
| **Tooling** | `src/` | TypeScript validation, conformance runner, CLI diagnostic tool |
| **Tests** | `tests/` | 31 tests covering envelope, pagination, strict mode, error handling |
| **Fixtures** | `fixtures/` | 14 JSON fixtures (valid + invalid) for conformance testing |
| **Docs** | `docs/` | [GitBook documentation](https://codluv.gitbook.io/lafs-protocol/) with guides, SDK reference, and specs |

## Install

```bash
npm install @cleocode/lafs-protocol
```

## Usage

```typescript
import {
  validateEnvelope,
  runEnvelopeConformance,
  isRegisteredErrorCode,
} from "@cleocode/lafs-protocol";

// Validate an envelope against the schema
const result = validateEnvelope(envelope);
if (!result.valid) {
  console.error(result.errors);
}

// Run full conformance suite (schema + invariants + error codes + strict mode + pagination)
const report = runEnvelopeConformance(envelope);
console.log(report.ok); // true if all checks pass
```

## CLI

```bash
# Run conformance checks on a fixture
npm run conformance -- --envelope fixtures/valid-success-envelope.json

# Run tests
npm test

# Type check
npm run typecheck
```

## Envelope structure

```json
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "schemaVersion": "1.0.0",
    "timestamp": "2026-02-13T00:00:00Z",
    "operation": "example.list",
    "requestId": "req_01",
    "transport": "http",
    "strict": true,
    "mvi": "standard",
    "contextVersion": 1
  },
  "success": true,
  "result": { "items": [{ "id": "1", "title": "Example" }] },
  "page": {
    "mode": "cursor",
    "nextCursor": "eyJpZCI6IjEwIn0=",
    "hasMore": true
  }
}
```

## Key features

- **Conditional pagination** — cursor, offset, and none modes with mode-specific required fields
- **Strict/lenient mode** — `strict: true` rejects unknown properties; `strict: false` allows them
- **MVI disclosure levels** — `minimal`, `standard`, `full`, `custom` control response verbosity
- **Field selection** (`_fields`) and **expansion** (`_expand`) request parameters
- **Context ledger** — tracks state across request/response cycles with monotonic versioning
- **Error registry** — 12 codes with category, retryability, and transport-specific status mappings
- **Extension mechanism** — `_extensions` field for vendor metadata (`x-` prefix convention)
- **Adoption tiers** — Core, Standard, Complete with progressive conformance requirements

## Conformance checks

| Check | Description | Tier |
|-------|-------------|------|
| `envelope_schema_valid` | Validates against JSON Schema | Core |
| `envelope_invariants` | success/result/error consistency | Core |
| `error_code_registered` | Error code exists in registry | Core |
| `meta_mvi_present` | Valid MVI disclosure level | Standard |
| `meta_strict_present` | Strict mode declared | Standard |
| `strict_mode_behavior` | Optional fields omitted (not null) in strict mode | Standard |
| `strict_mode_enforced` | Additional properties rejected/allowed per mode | Standard |
| `pagination_mode_consistent` | Page fields match declared mode | Standard |

## Project layout

```
lafs.md                          # Protocol specification
schemas/v1/
  envelope.schema.json           # Envelope schema (Draft-07)
  context-ledger.schema.json     # Context ledger schema
  error-registry.json            # Error code registry
src/
  types.ts                       # TypeScript types (discriminated unions)
  validateEnvelope.ts            # Ajv-based schema validator
  conformance.ts                 # Conformance runner (8 checks)
  errorRegistry.ts               # Error code helpers
  flagSemantics.ts               # Format flag resolution
  cli.ts                         # CLI diagnostic tool
tests/                           # 31 tests (vitest)
fixtures/                        # 14 JSON test fixtures
docs/
  POSITIONING.md                 # MCP/A2A complementary positioning
  VISION.md                      # Project vision and primary persona
  CONFORMANCE.md                 # Conformance checks and adoption tiers
migrations/
  v0.3.0-to-v0.4.0.md           # Envelope rationalization migration
  v0.4.0-to-v0.5.0.md           # Pagination & MVI schema migration
CONTRIBUTING.md                  # Contributor guidelines, RFC process
```

## Version history

| Version | Phase | Description |
|---------|-------|-------------|
| **v1.0.0** | **3** | **Production release: Token budgets, agent discovery, MCP integration, complete SDKs** |
| v0.5.0 | 2B | Conditional pagination, MVI field selection/expansion, context ledger schema |
| v0.4.0 | 2A | Optional page/error, extensions, strict/lenient mode, warnings |
| v0.3.0 | 1 | Strategic positioning, vision alignment, adoption tiers |
| v0.2.0 | 0 | Protocol cleanup, fixtures, governance, security considerations |
| v0.1.1 | — | Initial npm publish |
| v0.1.0 | — | Bootstrap |

## License

MIT
