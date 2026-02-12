# LAFS Conformance

## Minimum required checks

1. Output defaults to JSON when no explicit format is requested.
2. `--human` yields non-JSON human output mode.
3. `--human --json` fails with `E_FORMAT_CONFLICT`.
4. Response envelope validates against `schemas/v1/envelope.schema.json`.
5. Success envelope satisfies result/error invariants.
6. Error envelope uses a registered error code.
7. Pagination metadata validates when present.
8. Context-critical mutation requests fail when required context is absent.

## Conformance runner

Use the toolkit in `src/conformance.ts` or CLI wrapper:

```bash
npm run conformance -- --envelope fixtures/valid-success-envelope.json --flags fixtures/flags-valid.json
```
