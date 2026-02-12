# lafs-protocol

LLM-Agent-First Specification (LAFS) as a standalone protocol repository.

This repository is language-neutral at the protocol layer and TypeScript-first for reference tooling.

## What this repo provides

- Canonical protocol spec: `lafs.md`
- Versioned JSON schemas: `schemas/v1/`
- Error registry and transport mappings: `schemas/v1/error-registry.json`
- TypeScript validation/conformance toolkit: `src/`
- Automated conformance tests: `tests/`
- Vision and governance boundary docs: `docs/VISION.md`, `docs/BOUNDARY-MODEL.md`
- Consumer adoption template: `docs/CONSUMER-PROFILE-TEMPLATE.md`

## Install

```bash
npm install
```

## Commands

```bash
npm run typecheck
npm test
npm run conformance -- --envelope fixtures/valid-success-envelope.json --flags fixtures/flags-valid.json
```

## Canonical policy

- JSON default output is REQUIRED.
- Human-readable output is explicit opt-in (`--human`).
- `--json` is optional but recommended explicit alias/override.
- `--human --json` is invalid and MUST fail with `E_FORMAT_CONFLICT`.

## Layout

```text
lafs.md
schemas/v1/
src/
tests/
fixtures/
docs/
```
