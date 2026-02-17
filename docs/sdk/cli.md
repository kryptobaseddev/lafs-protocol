# CLI Reference

**What you'll learn:** How to use the LAFS CLI for validation, conformance testing, and diagnostics.

## Installation

The CLI is included with the SDK:

```bash
npm install -g @cleocode/lafs-protocol
```

Or use npx:

```bash
npx @cleocode/lafs-protocol <command>
```

## Commands

### `validate`

Validate an envelope against the JSON Schema.

```bash
# Validate a JSON file
lafs validate --envelope ./fixtures/valid-success-envelope.json

# Validate from stdin
cat envelope.json | lafs validate

# Validate with strict mode
lafs validate --envelope ./envelope.json --strict
```

**Output:**

```
✓ Envelope is valid

Schema: schemas/v1/envelope.schema.json
Checks passed: 8/8
```

Or on failure:

```
✗ Envelope validation failed

Errors:
  1. .result: must be object, received null
  2. .error: required when success=false
```

**Options:**

| Option | Description |
|--------|-------------|
| `--envelope, -e` | Path to envelope JSON file |
| `--strict` | Enable strict mode validation |
| `--schema` | Path to custom schema |

### `conformance`

Run the full conformance test suite.

```bash
# Run all conformance checks
lafs conformance --envelope ./envelope.json

# Run specific tier
lafs conformance --envelope ./envelope.json --tier core
lafs conformance --envelope ./envelope.json --tier standard
lafs conformance --envelope ./envelope.json --tier complete

# Output JSON
lafs conformance --envelope ./envelope.json --format json
```

**Output (table format):**

```
LAFS Conformance Report
======================

Tier: standard
Envelope: ./envelope.json
Timestamp: 2026-02-16T10:00:00Z

Checks:
  ✓ envelope_schema_valid       Core
  ✓ envelope_invariants         Core
  ✓ error_code_registered       Core
  ✓ meta_mvi_present            Standard
  ✓ meta_strict_present         Standard
  ✓ strict_mode_behavior        Standard
  ✓ strict_mode_enforced        Standard
  ✓ pagination_mode_consistent  Standard

Result: PASS (8/8)
```

**Output (JSON format):**

```json
{
  "ok": true,
  "tier": "standard",
  "timestamp": "2026-02-16T10:00:00Z",
  "passed": [
    "envelope_schema_valid",
    "envelope_invariants",
    "..."
  ],
  "failed": [],
  "checks": [
    {
      "name": "envelope_schema_valid",
      "passed": true,
      "tier": "core"
    },
    "..."
  ]
}
```

**Options:**

| Option | Description |
|--------|-------------|
| `--envelope, -e` | Path to envelope JSON file |
| `--tier, -t` | Conformance tier (core/standard/complete) |
| `--format, -f` | Output format (table/json) |
| `--strict` | Enable strict mode |

### `create`

Generate a sample envelope.

```bash
# Create success envelope
lafs create --success --result '{"message":"Hello"}' --operation hello.world

# Create error envelope
lafs create --error-code E_NOT_FOUND_RESOURCE --message "User not found"

# Create with pagination
lafs create --success --result '{"items":[]}' --operation items.list --page-mode cursor --has-more
```

**Output:**

```json
{
  "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
  "_meta": {
    "specVersion": "1.0.0",
    "timestamp": "2026-02-16T10:00:00Z",
    "operation": "hello.world",
    "requestId": "req_auto_abc123",
    "transport": "cli",
    "strict": true,
    "mvi": true
  },
  "success": true,
  "result": {
    "message": "Hello"
  },
  "error": null
}
```

**Options:**

| Option | Description |
|--------|-------------|
| `--success` | Create success envelope |
| `--result, -r` | JSON result data |
| `--error-code, -c` | Error code for error envelope |
| `--message, -m` | Error message |
| `--operation, -o` | Operation identifier |
| `--page-mode` | Pagination mode (cursor/offset/none) |
| `--has-more` | Indicate more pages available |

### `schema`

Display or validate against schemas.

```bash
# Show envelope schema
lafs schema --name envelope

# Show error registry
lafs schema --name error-registry

# Validate against specific schema
lafs schema --name envelope --validate ./envelope.json
```

### `errors`

List registered error codes.

```bash
# List all errors
lafs errors

# Search by category
lafs errors --category RATE_LIMIT

# Get specific error details
lafs errors --code E_NOT_FOUND_RESOURCE
```

**Output:**

```
Registered Error Codes
=====================

E_VALIDATION_SCHEMA
  Category: VALIDATION
  Retryable: No
  Description: Input failed schema validation

E_NOT_FOUND_RESOURCE
  Category: NOT_FOUND
  Retryable: No
  Description: Requested resource does not exist

E_RATE_LIMIT_EXCEEDED
  Category: RATE_LIMIT
  Retryable: Yes
  Description: Request rate limit exceeded
  ...
```

## Examples

### Validate fixtures

```bash
# Validate all fixtures
for file in fixtures/*.json; do
  echo "Testing $file..."
  lafs validate --envelope "$file"
done
```

### CI integration

```yaml
# .github/workflows/conformance.yml
name: LAFS Conformance

on: [push, pull_request]

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install LAFS CLI
        run: npm install -g @cleocode/lafs-protocol
      
      - name: Validate fixtures
        run: |
          for file in fixtures/valid-*.json; do
            lafs conformance --envelope "$file" --tier standard
          done
      
      - name: Verify invalid fixtures fail
        run: |
          for file in fixtures/invalid-*.json; do
            if lafs validate --envelope "$file"; then
              echo "Expected validation to fail for $file"
              exit 1
            fi
          done
```

### Pre-commit hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Validate envelope fixtures before commit
for file in fixtures/*.json; do
  if [[ $file == *"valid"* ]]; then
    if ! lafs validate --envelope "$file" --quiet; then
      echo "Invalid envelope: $file"
      exit 1
    fi
  fi
done
```

## Global options

| Option | Description |
|--------|-------------|
| `--version, -v` | Show version |
| `--help, -h` | Show help |
| `--quiet, -q` | Suppress non-error output |
| `--verbose` | Show detailed output |

## Environment variables

| Variable | Description |
|----------|-------------|
| `LAFS_SCHEMA_PATH` | Path to custom schemas |
| `LAFS_STRICT` | Default strict mode (true/false) |
| `LAFS_TIER` | Default conformance tier |

## Next steps

- **[TypeScript SDK](typescript.md)** — Programmatic TypeScript usage
- **[Python SDK](python.md)** — Python SDK reference
- **[Conformance Guide](../CONFORMANCE.md)** — Understanding conformance tiers
