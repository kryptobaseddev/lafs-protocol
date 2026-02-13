# LAFS: LLM-Agent-First Specification

## 1. Scope

LAFS defines a protocol for software systems whose primary consumer is an LLM agent.

LAFS is transport-agnostic and language-agnostic. It applies to CLI, SDK, HTTP, gRPC, and orchestrated multi-agent systems.

---

## 2. Non-Goals

The following capabilities are intentionally outside the scope of LAFS. This section exists to prevent scope creep and to clarify boundaries with complementary protocols.

1. **Streaming responses.** LAFS defines discrete request/response envelopes. Streaming mechanisms such as SSE or WebSocket are transport concerns and MUST NOT be defined by LAFS.

2. **Asynchronous processing.** LAFS envelopes are synchronous response contracts. Async job patterns (polling, webhooks, callback queues) are application-layer concerns and are outside LAFS scope.

3. **Authentication and authorization.** LAFS is transport-agnostic; auth is a transport or middleware concern. LAFS MAY carry auth-related error codes (e.g., `E_AUTH_*`) but MUST NOT define authentication or authorization flows.

4. **Multi-modal content.** LAFS envelopes carry structured JSON data. Binary payloads, media content negotiation, and multi-modal encoding are outside scope.

5. **Transport binding.** LAFS defines the response envelope shape, not how it maps to HTTP status codes, gRPC metadata, or other transport semantics. Transport mapping specifications are a separate concern.

6. **Service discovery.** LAFS does not define how consumers locate or enumerate LAFS-conformant endpoints. Discovery mechanisms SHOULD be provided by the deployment layer or complementary protocols.

---

## 3. RFC 2119 Keywords

The keywords MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are interpreted per RFC 2119.

---

## 4. Non-Negotiable Protocol Rules

1. Output default MUST be machine-readable JSON.
2. Human-readable mode MUST be explicit opt-in.
3. Context continuity MUST be preserved across steps.
4. MVI (Minimal Viable Information) MUST be default response behavior.
5. Progressive disclosure MUST be used for expanded detail retrieval.
6. Contracts MUST be deterministic and testable.

---

## 5. Format Semantics

### 5.1 Required output semantics

- Default format MUST be `json`.
- `--human` MUST switch output mode to human-readable.
- `--json` MAY be supported as explicit alias/override and is RECOMMENDED.
- Providing both `--human` and `--json` MUST fail with `E_FORMAT_CONFLICT`.
- Explicit flags MUST override env/config defaults.

### 5.2 Recommended precedence

1. Explicit CLI/API request value
2. Project config
3. Global/user config
4. Protocol default (`json`)

---

## 6. Canonical Response Envelope

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

### 6.1 Envelope invariants

- Exactly one of `result` or `error` MUST be non-null.
- `success=true` implies `error=null`.
- `success=false` implies `result=null`.
- Unknown fields SHOULD be rejected when strict mode is enabled.

---

## 7. Error Contract

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

### 7.1 Error code naming convention

Error codes MUST match the pattern: `^E_[A-Z0-9]+_[A-Z0-9_]+$`

The structure is **E\_\<DOMAIN\>\_\<SPECIFIC\>**, where:

- **E\_** — required prefix identifying the value as an error code.
- **DOMAIN** — a short uppercase token describing the error's semantic area (e.g., `VALIDATION`, `CONTEXT`, `RATE`, `MIGRATION`). The domain is descriptive; it does not need to equal the `category` enum value.
- **SPECIFIC** — one or more uppercase tokens (separated by `_`) that distinguish the error within its domain (e.g., `SCHEMA`, `MISSING`, `UNSUPPORTED_VERSION`).

Examples from the registry:

| Code | Domain | Specific | Category |
|---|---|---|---|
| `E_VALIDATION_SCHEMA` | `VALIDATION` | `SCHEMA` | VALIDATION |
| `E_NOT_FOUND_RESOURCE` | `NOT` | `FOUND_RESOURCE` | NOT_FOUND |
| `E_CONTEXT_MISSING` | `CONTEXT` | `MISSING` | CONTRACT |
| `E_MIGRATION_UNSUPPORTED_VERSION` | `MIGRATION` | `UNSUPPORTED_VERSION` | MIGRATION |

Registered categories (the `category` field in error objects): `VALIDATION`, `AUTH`, `PERMISSION`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMIT`, `TRANSIENT`, `INTERNAL`, `CONTRACT`, `MIGRATION`.

Custom error codes MUST match the same regex pattern. Implementations SHOULD choose a domain token that clearly communicates the error's origin.

### 7.2 Required behavior

- Error codes MUST be stable within major versions.
- Retry semantics MUST be encoded in `retryable` and `retryAfterMs`.
- CLI/HTTP/gRPC mappings SHOULD follow the registry.

---

## 8. Context Preservation

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

## 9. MVI and Progressive Disclosure

### 9.1 MVI default

- Default list/batch outputs MUST only contain fields required for next action.
- Verbose fields SHOULD be omitted by default.
- Systems SHOULD publish operation-level MVI budgets.

### 9.2 Progressive disclosure

- Expanded detail retrieval MUST require explicit request.
- Unknown expansion fields SHOULD fail validation.

### 9.3 Pagination

- List operations SHOULD return deterministic `page` metadata.
- Pagination mode (offset or cursor) MUST be documented.
- Mixed pagination modes in one request MUST fail validation.

---

## 10. Strictness

- Agent surfaces SHOULD default `strict=true`.
- Strict mode violations SHOULD fail with contract/validation error codes.
- Response metadata MUST expose strict mode status.

---

## 11. Versioning and Deprecation

- Protocol versions MUST follow SemVer.
- Minor/patch changes MUST be backward compatible.
- Breaking changes MUST require major version increments.
- Deprecated fields MUST have documented sunset policy.

See `docs/VERSIONING.md` and `docs/DEPRECATION.md`.

---

## 12. Conformance

Conforming implementations MUST pass minimum checks in `docs/CONFORMANCE.md` and schema validation for the canonical envelope.

---

## 13. Security Considerations

This section addresses security threats relevant to LAFS envelope production and consumption. LAFS is transport-agnostic and does not define its own cryptographic or authentication mechanisms; implementers MUST rely on the underlying transport and application layers for those controls.

### 13.1 Injection attacks

LAFS envelopes carry user-provided data in `result`, `error`, and `details` fields. Implementers MUST sanitize all envelope contents before rendering in HTML, constructing shell commands, or executing in eval-like contexts. Error messages MUST NOT contain unsanitized user input. Implementations that embed envelope values in SQL, LDAP, or similar query languages MUST use parameterized interfaces.

### 13.2 Tampering

LAFS does not define integrity protection at the envelope level. If envelope integrity is required, implementers SHOULD use transport-level security (e.g., TLS) and MAY implement envelope signing as an extension. Consumers MUST NOT trust envelope contents without verifying the transport channel. Implementations that relay envelopes across trust boundaries SHOULD re-validate against `schemas/v1/envelope.schema.json` at each boundary.

### 13.3 Information disclosure

Error details MAY contain sensitive information such as stack traces, internal paths, or database identifiers. Implementations SHOULD distinguish between development and production error detail levels. The `details` field in error objects MUST NOT expose internal system information in production environments. Implementations SHOULD define an explicit allow-list of fields permitted in production error responses.

### 13.4 Replay attacks

LAFS includes `requestId` and `timestamp` in `_meta` for correlation (Section 6). Implementers MAY use these fields for replay detection but MUST NOT rely solely on them, as LAFS does not mandate uniqueness or freshness guarantees for these values. Transport-level replay protection (e.g., TLS with appropriate session management) is RECOMMENDED.

### 13.5 Denial of service

Large envelope payloads could be used for resource exhaustion. Implementations SHOULD enforce maximum envelope size limits appropriate to their deployment context. Pagination (Section 9.3) SHOULD be used to bound response sizes for list operations. Implementations SHOULD reject envelopes that exceed the configured size limit with a structured error.
