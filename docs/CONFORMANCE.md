# Conformance Guide

Conformance in LAFS has two layers:

1. Schema validation (`validateEnvelope`)
2. Semantic conformance (`runEnvelopeConformance`)

## Programmatic usage

```typescript
import {
  runEnvelopeConformance,
  runFlagConformance,
  validateEnvelope,
} from "@cleocode/lafs-protocol";

const validation = validateEnvelope(envelope);
if (!validation.valid) {
  console.error(validation.errors);
}

const envelopeReport = runEnvelopeConformance(envelope);
const flagReport = runFlagConformance({ jsonFlag: true });

console.log(envelopeReport.ok, flagReport.ok);
```

## Current envelope checks

- `envelope_schema_valid`
- `envelope_invariants`
- `error_code_registered`
- `meta_mvi_present`
- `meta_strict_present`
- `strict_mode_behavior`
- `pagination_mode_consistent`
- `strict_mode_enforced`

## CLI usage

The diagnostic binary is `lafs-conformance`.

```bash
lafs-conformance --envelope ./fixtures/valid-success-envelope.json
lafs-conformance --flags ./fixtures/flags-valid.json
lafs-conformance --envelope ./fixtures/valid-success-envelope.json --flags ./fixtures/flags-valid.json
```

## CI pattern

```bash
for file in fixtures/valid-*.json; do
  lafs-conformance --envelope "$file"
done
```

## Related references

- `src/conformance.ts`
- `src/validateEnvelope.ts`
- `schemas/v1/envelope.schema.json`
