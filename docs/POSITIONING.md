# LAFS Positioning: Response Contract for the AI Protocol Stack

## The Problem

The AI protocol ecosystem has converged on standards for how to *call* tools and how agents *communicate* — but no standard exists for what the *response* looks like.

- **MCP** (Model Context Protocol) defines how LLMs discover and invoke tools, access resources, and receive context. It standardizes the *calling convention*.
- **A2A** (Agent-to-Agent) defines how autonomous agents find each other, negotiate capabilities, and exchange messages. It standardizes *agent communication*.

Neither defines the shape of the structured data that comes back. Tool responses are freeform JSON. Agent artifacts are opaque blobs. Every integration re-invents error formats, pagination, context threading, and token-efficient defaults from scratch.

The result: brittle multi-step workflows, inconsistent error handling, lost context between agent turns, and token-heavy payloads that increase cost and reduce throughput.

## Where LAFS Fits

LAFS occupies the **response contract layer** — below application logic, alongside (not competing with) MCP and A2A, and above transport.

```
┌─────────────────────────────────────────────┐
│  Application Layer                          │
│  Your API / Service / Agent                 │
├─────────────────────────────────────────────┤
│  Protocol Layer                             │
│  MCP (tool use)  │  A2A (agent comms)       │
├─────────────────────────────────────────────┤
│  Response Contract Layer                    │
│  ► LAFS                                     │
│    Envelope shape, structured errors,       │
│    pagination, MVI, context preservation    │
├─────────────────────────────────────────────┤
│  Transport Layer                            │
│  HTTP / gRPC / WebSocket / stdio            │
└─────────────────────────────────────────────┘
```

MCP defines *how you call the tool*. A2A defines *how agents talk to each other*. LAFS defines *what the structured response looks like* — the envelope, the error model, the pagination contract, and the context threading rules that make multi-step agent workflows deterministic and token-efficient.

## What LAFS Is

LAFS is a **response envelope contract** for agent-consumed services. It standardizes:

- **Envelope shape** — A deterministic JSON structure (`success`, `result`, `error`, `_meta`, `page`) so every consumer parses responses the same way.
- **Structured error taxonomy** — Registered error codes with machine-readable categories, retry semantics, and severity levels. No more guessing whether an error is transient.
- **Pagination contract** — Cursor and offset modes with explicit mode declaration, preventing mixed-mode ambiguity.
- **MVI (Minimal Viable Information)** — Token-efficient defaults that return only what the consumer needs, with progressive disclosure for expanded detail.
- **Context preservation** — Version-tracked context state across multi-step operations, enabling agents to detect stale state and maintain continuity.
- **Conformance checks** — Executable validation that an implementation actually honors these contracts, not just claims to.

## What LAFS Is Not

| LAFS is not...              | That concern belongs to...       |
|-----------------------------|----------------------------------|
| A transport protocol        | HTTP, gRPC, WebSocket, stdio     |
| A tool invocation protocol  | MCP                              |
| An agent communication protocol | A2A                          |
| An authentication system    | OAuth, API keys, transport middleware |
| A service discovery mechanism | `/.well-known/`, Agent Cards, MCP capability negotiation |
| A streaming specification   | SSE, WebSocket, transport layer  |

LAFS defines the *response shape*. How you get to that response (transport), how you call for it (MCP/A2A), and how you prove you are allowed to call for it (auth) are all separate concerns.

## Complementary Use Cases

### LAFS + MCP: Structured Tool Responses

An MCP tool server returns a result when a tool is invoked. Today, that result is freeform — each tool defines its own ad-hoc JSON. With LAFS, the tool response uses the LAFS envelope:

```
LLM ──► MCP Server ──► Tool ──► LAFS Envelope ──► MCP Server ──► LLM

         MCP defines         LAFS defines
         how to call         what comes back
```

**Without LAFS**: The LLM must infer error handling, pagination, and context from prompt conventions per tool. Every tool has a different error shape. Multi-step tool chains lose context.

**With LAFS**: The LLM knows every tool response has `success`, `error` (with registered codes and retry hints), `page` (with deterministic pagination), and `_meta.contextVersion` for continuity. One parsing contract, every tool.

### LAFS + A2A: Structured Agent Artifacts

An A2A agent produces artifacts in response to tasks. With LAFS, those artifacts use the LAFS envelope:

```
Agent A ──► A2A Protocol ──► Agent B ──► LAFS Envelope ──► A2A Protocol ──► Agent A

            A2A defines              LAFS defines
            how agents talk          artifact response shape
```

**Without LAFS**: Agent A must understand Agent B's custom response format. Error handling is ad-hoc. Pagination of large results varies per agent. Context threading is bespoke.

**With LAFS**: Every agent artifact is a LAFS envelope. Agent A knows how to parse errors, paginate through results, and track context state regardless of which agent produced the response.

## Adoption Spectrum

LAFS is designed for incremental adoption. You don't have to go all-in to get value.

| Level | What You Adopt | What You Get |
|-------|---------------|--------------|
| **Schema only** | Use `envelope.schema.json` to validate your response shape | Structural consistency, IDE autocompletion, basic contract guarantees |
| **Envelope + errors** | Return LAFS envelopes with registered error codes | Deterministic error handling across your toolchain, retry semantics for free |
| **Envelope + MVI** | Add MVI defaults and progressive disclosure | Token-efficient responses, reduced LLM cost, faster agent workflows |
| **Full conformance** | Pass all conformance checks including context preservation, pagination modes, and format semantics | Complete response contract with executable proof of compliance |

At the lightest level, LAFS is just a JSON Schema you validate against. At the deepest level, it is a full response contract with conformance tooling. Teams adopt the layer that matches their maturity and needs.

## The One-Sentence Pitch

> LAFS is the response style guide that MCP tool servers and A2A agents adopt — it defines what good structured responses look like for agent consumption.
