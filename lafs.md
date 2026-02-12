# LAFS: LLM-Agent-First Specification

## 1. Scope

LAFS defines a protocol for software systems whose primary consumer is an LLM agent.

LAFS is transport-agnostic and language-agnostic. It applies to CLI, SDK, HTTP, gRPC, and orchestrated multi-agent systems.

---

## 2. RFC 2119 Keywords

The keywords MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted per RFC 2119.

---

## 3. Non-Negotiable Protocol Rules

1. Output default MUST be machine-readable JSON.
2. Human-readable mode MUST be explicit opt-in.
3. Context continuity MUST be preserved across steps.
4. MVI (Minimal Viable Information) MUST be default response behavior.
5. Progressive disclosure MUST be used for expanded detail retrieval.
6. Contracts MUST be deterministic and testable.

---

## 4. Format Semantics

### 4.1 Required output semantics

- Default format MUST be `json`.
- `--human` MUST switch output mode to human-readable.
- `--json` MAY be supported as explicit alias/override and is RECOMMENDED.
- Providing both `--human` and `--json` MUST fail with `E_FORMAT_CONFLICT`.
- Explicit flags MUST override env/config defaults.

### 4.2 Recommended precedence

1. Explicit CLI/API request value
2. Project config
3. Global/user config
4. Protocol default (`json`)

---

## 5. Canonical Response Envelope

All responses MUST conform to `schemas/v1/envelope.schema.json`.

```json
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "schemaVersion": "1.0.0",
    "timestamp": "2026-02-11T00:00:00Z",
    "operation": "operation.name",
    "requestId": "req_123",
    "transport": "cli",
    "strict": true,
    "mvi": true,
    "contextVersion": 0
  },
  "success": true,
  "result": {},
  "error": null,
  "page": null
}
```

### 5.1 Envelope invariants

- Exactly one of `result` or `error` MUST be non-null.
- `success=true` implies `error=null`.
- `success=false` implies `result=null`.
- Unknown fields SHOULD be rejected when strict mode is enabled.

---

## 6. Error Contract

Errors MUST conform to envelope `error` shape and use codes from `schemas/v1/error-registry.json`.

```json
{
  "code": "E_VALIDATION_SCHEMA",
  "message": "Invalid input payload",
  "category": "VALIDATION",
  "retryable": false,
  "retryAfterMs": null,
  "details": {
    "field": "limit"
  }
}
```

### 6.1 Required behavior

- Error codes MUST be stable within major versions.
- Retry semantics MUST be encoded in `retryable` and `retryAfterMs`.
- CLI/HTTP/gRPC mappings SHOULD follow the registry.

---

## 7. Context Preservation

Multi-step operations MUST preserve a context ledger with at least:

- `objective`
- `constraints[]`
- `references[]`
- `decisions[]`
- `openIssues[]`
- `state`
- `version`

Rules:

- Version MUST increase monotonically by 1 for accepted mutations.
- Accepted active constraints MUST NOT be silently removed.
- Decisions affecting output MUST be represented in ledger state.
- Missing required context for a mutating step MUST fail with structured error.

---

## 8. MVI and Progressive Disclosure

### 8.1 MVI default

- Default list/batch outputs MUST only contain fields required for next action.
- Verbose fields SHOULD be omitted by default.
- Systems SHOULD publish operation-level MVI budgets.

### 8.2 Progressive disclosure

- Expanded detail retrieval MUST require explicit request.
- Unknown expansion fields SHOULD fail validation.

### 8.3 Pagination

- List operations SHOULD return deterministic `page` metadata.
- Pagination mode (offset or cursor) MUST be documented.
- Mixed pagination modes in one request MUST fail validation.

---

## 9. Strictness

- Agent surfaces SHOULD default `strict=true`.
- Strict mode violations SHOULD fail with contract/validation error codes.
- Response metadata MUST expose strict mode status.

---

## 10. Versioning and Deprecation

- Protocol versions MUST follow SemVer.
- Minor/patch changes MUST be backward compatible.
- Breaking changes MUST require major version increments.
- Deprecated fields MUST have documented sunset policy.

See `docs/VERSIONING.md` and `docs/DEPRECATION.md`.

---

## 11. Conformance

Conforming implementations MUST pass minimum checks in `docs/CONFORMANCE.md` and schema validation for the canonical envelope.
