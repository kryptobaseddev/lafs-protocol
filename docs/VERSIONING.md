# Versioning Policy

- Protocol versioning follows SemVer.
- `MAJOR`: breaking changes to schema, invariants, or mandatory semantics.
- `MINOR`: backward-compatible additions.
- `PATCH`: corrections and clarifications without contract changes.

## Compatibility requirements

- Minor and patch releases MUST preserve prior valid payloads.
- Major releases MUST publish migration guidance and machine-readable manifests.
