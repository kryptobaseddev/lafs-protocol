# LAFS Vision

## Problem

Every API, tool, and agent returns responses in a different shape. A REST endpoint wraps data in `{ data, error }`. An MCP tool returns plain objects. An A2A agent sends back its own bespoke format. The result: every consumer writes ad-hoc parsing and error-handling glue for every integration.

In LLM-driven systems this problem compounds. Agents chain tool calls across services. Each service speaks a different response dialect, which means:

- Brittle parsing logic at every integration boundary
- Inconsistent error handling that breaks multi-step workflows
- Context loss between chained operations
- Token-heavy payloads that waste budget on structural noise

## Who LAFS is for

LAFS is for **backend developers and API designers** who are tired of inconsistent response shapes across services — especially those building or integrating with AI/LLM tool ecosystems (MCP servers, A2A agents, REST APIs, CLI tools).

If you've ever written a wrapper to normalize responses from three different services into a common shape so your agent can reason over them, LAFS is the standard that eliminates that wrapper.

## What LAFS provides

LAFS is a **standard response envelope contract**. It defines the shape of what comes back — a common response language that any API, tool, or agent can speak:

- **A standard response envelope and error model** — one shape, everywhere
- **Strict JSON-default semantics** with explicit human-readable opt-in
- **Context preservation** for multi-step and chained operations
- **MVI (Minimum Viable Information) defaults** for token-efficient payloads
- **Progressive disclosure** for retrieving expanded detail on demand
- **Conformance schemas and executable checks** so compliance is testable, not aspirational

## Complementary positioning

LAFS does not replace MCP, A2A, or any transport protocol. It complements them.

- **MCP** defines how tools are discovered and invoked. **LAFS** defines the shape of what those tools return.
- **A2A** defines how agents communicate and delegate. **LAFS** defines the response contract those agents honor.
- **REST/gRPC/CLI** define transport mechanics. **LAFS** defines the envelope that rides on any transport.

Think of it this way: MCP and A2A are the roads. LAFS is the standard shipping container that travels on them. You don't need to rebuild the road — you just need every package to fit the same container.

## Design principles

1. **MVI (Minimum Viable Information)** — Responses carry only what the consumer needs by default. Less noise, fewer tokens, faster processing.
2. **Progressive disclosure** — Need more detail? Ask for it. Default responses are lean; expanded data is one request away.
3. **Transport agnosticism** — LAFS defines the envelope shape, not how it's delivered. HTTP, gRPC, CLI, message queues — the contract is the same.
4. **Schema-first design** — The spec is machine-verifiable. JSON Schemas define the contract; conformance is validated, not assumed.

## Boundary model

LAFS defines the response contract. Consumer projects define how they adopt it.

- The LAFS repository owns normative protocol semantics and conformance artifacts.
- Consumer repositories (e.g., CAAMP) own mappings, evidence, and local implementation profiles.
- Consumer repositories MUST reference LAFS protocol docs and MUST NOT redefine protocol semantics.
