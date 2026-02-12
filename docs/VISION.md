# LAFS Vision

## Problem

LLM-driven tooling fails in production when outputs are optimized for humans instead of machines. Common failure modes include:

- ambiguous output formats
- non-deterministic errors
- context loss between steps
- token-heavy payloads that reduce throughput and increase cost

## Why LAFS exists

LAFS creates a single interoperable protocol for agent-first systems so developers and agents can build against stable machine contracts instead of prompt conventions.

## What LAFS solves

- A canonical response envelope and error model
- Strict JSON-default output semantics with explicit human opt-in
- Context preservation requirements for multi-step work
- MVI and progressive disclosure defaults for token efficiency
- Conformance-first adoption with schemas and executable checks

## Boundary model

LAFS defines protocol law. Consumer projects define implementation profiles.

- LAFS repository owns normative protocol semantics and conformance artifacts.
- Consumer repositories (for example CAAMP) own mappings, evidence, and local deltas.
- Consumer repositories MUST reference LAFS canonical docs and MUST NOT redefine protocol semantics.
