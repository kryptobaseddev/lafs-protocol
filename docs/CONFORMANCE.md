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

## Adoption Tiers

| Tier | Checks Required | Use Case |
|---|---|---|
| **Core** | `envelope_schema_valid`, `envelope_invariants` | Quick adoption, prototyping |
| **Standard** | Core + `error_code_registered`, `meta_mvi_present`, `meta_strict_present`, `json_protocol_default` | Production APIs |
| **Complete** | Standard + `config_override_respected`, `flag_conflict_rejected`, `context_validation`, `pagination_validation` | Full compliance |

### Choosing a tier

Start with **Core** to validate basic envelope shape. Move to **Standard** once you've integrated the error registry and metadata flags. Target **Complete** for official conformance certification.

## Conformance runner

Use the toolkit in `src/conformance.ts` or CLI wrapper:

```bash
# Run all checks
npm run conformance -- --envelope fixtures/valid-success-envelope.json --flags fixtures/flags-valid.json
```
