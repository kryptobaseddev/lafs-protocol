# LAFS Task Decomposition: Agent-First Challenge Analysis

**Date:** 2026-02-16  
**Philosophy:** FOR LLM AGENTS by LLM AGENTS  
**Challenge Question:** *Does this help agents consume APIs, or is it bureaucratic overhead?*

---

## Executive Summary

Current pending work spans 5 epics and 33 tasks. **Critical finding:** Many tasks assume human developers will adopt LAFS through documentation. **Reality:** LLM agents need machine-verifiable, self-describing contracts that reduce cognitive load at runtime. 

### Agent-First Redesign Principles

1. **Cognitive Load Reduction** - Every byte must earn its place in context window
2. **Self-Validation** - Agents must verify conformance without human review
3. **Progressive Discovery** - Agents learn capabilities incrementally, not from docs
4. **Zero-Config Onboarding** - Default behaviors must be agent-optimal
5. **Transport Agnostic** - Same mental model everywhere

---

## Phase 3A: Conformance Suite Completion (T053)

### Current Tasks Analysis

| Task | Current Focus | Agent Challenge | Redesign |
|------|---------------|-----------------|----------|
| T054 | Context preservation validation | Assumes ledger exists; doesn't specify HOW agents use it | → Decompose into: ledger format, projection modes, agent query interface |
| T055 | Conformance check 8 | Vague "context mutation failure" | → Concrete: "Agent must receive E_CONTEXT_MISSING when attempting mutation without prior objective declaration" |
| T056 | Context preservation fixtures | Static test data | → Living fixtures that demonstrate agent reasoning chains |
| T057 | MVI conformance checks | Validates `_meta.mvi` enum | → **CRITICAL:** Actually validate token budget enforcement, not just flag presence |
| T059 | Transport mapping helper | Human-readable mapping table | → **REDESIGN:** Agent-accessible transport negotiation protocol |
| T060 | Transport mapping conformance | Static validation | → Runtime capability advertisement via discovery |
| T061 | Full conformance test suite | Internal test coverage | → Public conformance profiles agents can reference |

### Decomposed Tasks

#### Epic: T053 - Agent-Capable Conformance Suite

**Wave 0: Core Ledger Semantics**

**T054a - Implement Context Ledger Validation Engine**
- **Agent Value:** Agents can verify context continuity across tool chains
- **Acceptance:**
  - Ledger format validates against `context-ledger.schema.json`
  - Monotonic version enforcement with clear error messages
  - Constraint persistence check (active constraints cannot vanish)
  - **NEW:** Agent-accessible ledger query: `GET /_lafs/context?ledgerId={id}&projection=minimal`
- **Why:** Current ledger schema exists but no validation logic. Agents need to trust context.

**T054b - Define Context Projection Modes for Agents**
- **Agent Value:** Agents choose disclosure level based on their context budget
- **Acceptance:**
  - Three projection modes: `full`, `delta`, `summary`
  - `full`: Complete ledger (expensive, for context recovery)
  - `delta`: Changes since version N (efficient for active chains)
  - `summary`: Hash/checksum + version only (for validation)
  - Document when agents should use each mode
- **Why:** Current spec says "preserve context" but doesn't say HOW agents retrieve it efficiently.

**T055 - Implement Context-Critical Operation Guardrails**
- **Agent Value:** Prevents agents from making state changes without proper context
- **Acceptance:**
  - Define "context-critical" operations (mutations, destructive actions)
  - Server MUST reject mutation requests without `X-LAFS-Context-Version` header
  - Error `E_CONTEXT_MISSING` when contextVersion absent
  - Error `E_CONTEXT_STALE` when provided version < current
  - **NEW:** Error includes server's current ledger summary for agent reconciliation
- **Why:** Agents must know WHEN they need context, not just how to pass it.

**Wave 1: Test Infrastructure**

**T056a - Create Agent Reasoning Chain Fixtures**
- **Agent Value:** Demonstrates real multi-step agent workflows
- **Acceptance:**
  - Fixture: Agent queries API → discovers capability → executes operation → validates result
  - 3 scenarios: simple query, chained operations, error recovery
  - Each fixture includes expected ledger state transitions
  - Valid and invalid variants (stale context, missing constraints)
- **Why:** Static envelopes don't show how agents USE context. Need living examples.

**T056b - Build Context-Aware Conformance Runner**
- **Agent Value:** Agents can self-validate their context handling
- **Acceptance:**
  - Function: `validateContextChain(operations[])` 
  - Verifies each operation's context version increments correctly
  - Validates constraints aren't silently dropped
  - Reports ledger drift with actionable guidance
- **Why:** Current conformance validates envelopes; agents need to validate CHAINS.

**Wave 2: MVI Reality Check**

**T057 - Implement Token Budget Enforcement Validation**
- **Agent Value:** Ensures servers respect agent's resource constraints
- **Acceptance:**
  - **CRITICAL:** Verify `_meta.mvi` isn't just a flag—verify it affects response size
  - Test: Request with `_budget=maxTokens:100` MUST receive ≤100 tokens in result
  - Error `E_MVI_BUDGET_EXCEEDED` when server cannot satisfy constraint
  - Document server-side budget calculation methodology
- **Challenge:** Current spec says MVI "SHOULD" be default but has no enforcement. This is useless for agents.

---

## Phase 3B: Deprecation & Migration (T062)

### Agent Challenge Analysis

**Core Question:** Do agents benefit from deprecation notices, or do they just break?

Current tasks (T063, T064, T065, T066) focus on human-centric deprecation workflows. **Agent reality:**
- Agents don't read CHANGELOGs
- Agents parse schemas at runtime
- Breaking changes should be version-gated, not "warned"

### Decomposed Tasks

**T062a - Schema-Driven Deprecation for Agents**
- **Agent Value:** Agents detect deprecated fields programmatically
- **Acceptance:**
  - Deprecation registry schema: `{field, deprecatedIn, sunsetVersion, replacement, migrationPath}`
  - Deprecation metadata included in `_meta.warnings` (already in schema, need population)
  - Server MUST include sunset version for all deprecated fields
  - **NEW:** Schema endpoint exposes deprecation timeline: `GET /.well-known/lafs/deprecations`
- **Why:** Agents need to plan migrations BEFORE they break.

**T062b - Version-Negotiated Breaking Changes**
- **Agent Value:** Agents request compatible behavior
- **Acceptance:**
  - Header: `X-LAFS-Accept-Version: 1.0.0` (SemVer negotiation)
  - Server responds with actual version used: `_meta.specVersion`
  - If requested version sunset, error `E_VERSION_UNSUPPORTED` with migration link
  - Server maintains N-1 version compatibility during deprecation window
- **Challenge:** Current spec has versioning but no negotiation. Agents break on updates.

**T063 - Fix Migration Manifest (Keep as-is, deprioritize)**
- **Reality Check:** Migration manifests are for human operators, not agents
- **Action:** Fix inconsistency but don't expand scope
- **Priority:** Medium → Low (not agent-critical)

---

## Phase 3C: Token Budget & Context Projection (T067)

### Agent Challenge Analysis

**CRITICAL FINDING:** This is the most agent-critical epic, but current tasks are underspecified.

Current tasks (T068-T071) touch budget signaling but miss the agent-centric design:
- Budgets aren't just numbers—they're CONTEXT WINDOW constraints
- Agents need to know BEFORE requesting if result will fit
- Pagination without budget awareness is useless for agents

### Decomposed Tasks

#### Epic: T067 - Agent Resource Management

**Wave 0: Budget Signaling**

**T068a - Design Token Budget Request Protocol**
- **Agent Value:** Agents declare resource constraints explicitly
- **Acceptance:**
  - Request parameter: `_budget` object with `maxTokens`, `maxBytes`, `maxItems`
  - Server MUST respect budgets or fail with `E_MVI_BUDGET_EXCEEDED`
  - Server SHOULD include actual usage in `_meta` (actualTokens, actualBytes)
  - Budget negotiation: if exact match impossible, server proposes alternatives
- **Why:** Agents have limited context windows. Every token matters.

**T068b - Implement Budget-Aware Pagination**
- **Agent Value:** Pagination respects token budgets, not just item counts
- **Acceptance:**
  - `page.limit` interpreted as "items fitting in remaining budget"
  - Server estimates per-item token cost
  - If single item exceeds budget, error with item size estimate
  - `_meta` includes `remainingBudget` for next page planning
- **Challenge:** Current pagination is item-based. Agents need token-based.

**T068c - Schema-Based Cost Estimation**
- **Agent Value:** Agents predict costs before requesting
- **Acceptance:**
  - Schema extension: `x-lafs-token-estimate` on fields
  - Discovery endpoint: `POST /.well-known/lafs/cost-estimate` with proposed request
  - Returns estimated response size without executing
  - **Game-changer:** Agents can plan multi-step workflows within budget

**Wave 1: Context Projection**

**T069a - Implement Context Projection Modes**
- **Agent Value:** Agents retrieve only context they need
- **Acceptance:**
  - Header: `X-LAFS-Context-Scope: full|delta|summary`
  - `full`: Entire ledger (recovery mode)
  - `delta`: Changes since provided version (normal operation)
  - `summary`: Version + checksum only (validation)
  - Default: `delta` (agent-optimal)
- **Why:** Current spec says "preserve context" but makes it expensive to retrieve.

**T069b - Context-Ledger Query Interface**
- **Agent Value:** Agents can query ledger state programmatically
- **Acceptance:**
  - Endpoint: `GET /_lafs/context/{ledgerId}`
  - Query params: `projection`, `sinceVersion`, `filterByOperation`
  - Response: Context ledger subset matching query
  - **Security:** Only ledger owner or explicit delegates can query
- **Why:** Agents need to be able to say "what happened since I last checked?"

**Wave 2: Lazy Loading (Deprioritize)**

**T071 - Lazy Loading Specification**
- **Agent Challenge:** Do agents benefit from lazy loading, or is it complexity?
- **Analysis:** Lazy loading helps humans browsing UIs. Agents know what they need upfront.
- **Decision:** Defer to Phase 4. Not agent-critical.

---

## Phase 4: Ecosystem & Integration (T072)

### Agent Challenge Analysis

**Core Question:** How do agents discover and adopt LAFS without human intervention?

Current tasks (T073-T079) assume human developers will:
1. Read adoption guides
2. Implement LAFS manually
3. Validate conformance themselves

**Agent reality:**
- Agents discover capabilities via well-known endpoints
- Agents validate conformance programmatically
- Agents need SDKs that handle complexity

### Decomposed Tasks

#### Epic: T072 - Agent-Driven Ecosystem

**Wave 0: Discovery**

**T073a - Design Agent Discovery Protocol**
- **Agent Value:** Agents automatically detect LAFS support
- **Acceptance:**
  - Endpoint: `GET /.well-known/lafs.json`
  - Response includes: specVersion, conformanceTier, availableMviLevels, budgetSupport, contextSupport
  - **NEW:** Include schema URL for runtime validation
  - **NEW:** Include cost estimation endpoint URL
  - Cache-friendly: ETag support for change detection
- **Why:** Current task defines endpoint but not what agents need from it.

**T073b - Implement Service Capability Advertisement**
- **Agent Value:** Agents know what features are available
- **Acceptance:**
  - Extend discovery with capabilities array
  - Examples: `token-budget`, `context-ledger`, `field-selection`, `expansion`
  - Capability metadata: version, constraints (maxBudget, maxContextEntries)
  - **Future-proof:** Unknown capabilities ignored, not rejected
- **Why:** Agents need to know "can I use token budgets with this service?"

**Wave 1: Multi-Language Support**

**T074a - Build Python Validation Library**
- **Agent Value:** Python agents can validate conformance
- **Acceptance:**
  - Package: `lafs-protocol` on PyPI
  - Functions: `validate_envelope()`, `check_conformance()`, `discover_capabilities(url)`
  - Async support: `validate_envelope_async()` for agent workflows
  - **NEW:** Agent helper: `LafsClient(base_url)` with automatic conformance checking
- **Why:** Many agents run in Python. They need first-class support.

**T074b - Build TypeScript Agent SDK**
- **Agent Value:** TypeScript agents have high-level client
- **Acceptance:**
  - Extend existing toolkit with `LafsClient` class
  - Methods: `.call(operation, params)`, `.withContext(ledgerId)`, `.withBudget(tokens)`
  - Automatic conformance validation on every response
  - Context preservation across chained calls
- **Why:** Current toolkit is low-level. Agents need ergonomic API.

**Wave 2: Integration Proof Points**

**T075a - MCP Integration with LAFS Envelopes**
- **Agent Value:** MCP tool calls return LAFS-structured results
- **Acceptance:**
  - Example MCP server that wraps native APIs in LAFS envelopes
  - Demonstrates: error handling, pagination, context preservation
  - **Key:** MCP tools are FOR agents—this proves LAFS value proposition
- **Why:** MCP is the dominant agent-tool protocol. LAFS must complement it seamlessly.

**T075b - A2A Agent Integration**
- **Agent Value:** A2A agents speak LAFS to each other
- **Acceptance:**
  - Example A2A agent that returns LAFS envelopes
  - Demonstrates: cross-agent context preservation
  - **Key:** Shows LAFS enables multi-agent workflows
- **Why:** A2A defines agent-agent communication. LAFS defines what they say.

**Wave 3: Adoption Guides (Refocus)**

**T076-T078 - Create Implementation Guides**
- **Agent Challenge:** Do agents read guides?
- **Reality:** No. But developers of agent tools do.
- **Refocus:** 
  - "LAFS for CLI Tools" → Show how `opencode`-style tools benefit
  - "LAFS for REST APIs" → Show server-side implementation
  - "LAFS for MCP Tool Servers" → Critical: MCP + LAFS is the sweet spot
- **Each guide must include:**
  - Before/after code comparison
  - Token savings calculation
  - Agent reasoning chain example

**T079 - Language-Independent Conformance Suite**
- **Agent Value:** Any language can validate conformance
- **Acceptance:**
  - JSON Schema + fixtures ONLY (no code)
  - Test vectors: valid/invalid envelopes with expected results
  - CI validates against multiple validators (ajv, jsonschema, etc.)
  - **NEW:** Conformance profile format: `lafs-conformance.json` that services publish
- **Why:** Agents in any language need to validate. Don't make them use Node.

---

## Phase 5: v1.0.0 Release (T080)

### Agent Challenge Analysis

**Core Question:** What blocks agents from adopting LAFS at v1.0.0?

Current tasks (T081-T086) focus on governance and release mechanics. **Agent blockers:**
1. No conformance verification without human review
2. No way to discover LAFS support
3. No budget enforcement guarantees
4. No context retrieval protocol

### Decomposed Tasks

**T080a - Define Agent-Certification Conformance**
- **Agent Value:** Agents can trust "v1.0.0 compliant" means useful
- **Acceptance:**
  - Complete tier MUST include: budget enforcement, context projection, discovery
  - Machine-readable conformance profile (not just human checkmarks)
  - **NEW:** Conformance badge API: `GET /.well-known/lafs/conformance-badge.svg` + JSON variant
- **Why:** Current conformance is human-focused. Agents need programmatic verification.

**T081a - Governance for Agent Evolution**
- **Agent Value:** LAFS evolves without breaking agents
- **Acceptance:**
  - RFC process includes agent-impact assessment
  - Breaking changes require N-month deprecation with agent migration guide
  - **NEW:** Agent advisory board (agent developers as stakeholders)
- **Why:** Agents can't adapt as fast as humans. Stability is paramount.

**T083a - Automated v1.0.0 Conformance Validation**
- **Agent Value:** Continuous verification, not one-time certification
- **Acceptance:**
  - CI runs conformance suite on every PR
  - Services can self-validate via `npx lafs-protocol validate`
  - **NEW:** Public conformance registry: services can register and be tested
- **Why:** Conformance at release doesn't mean conformance at runtime.

**T084-T086 - Release Mechanics**
- Keep as-is but prioritize agent-critical packages first:
  1. Python library (T074a)
  2. TypeScript SDK (T074b)
  3. Conformance suite (T079)
  4. MCP integration (T075a)

---

## Cross-Phase Dependencies & Execution Waves

### Wave 0: Foundation (Critical Path)
**Prerequisites for everything else**

1. **T073a** - Agent Discovery Protocol
   - *Why first:* Everything else assumes agents can detect LAFS support
   - *Blocks:* T074, T075, T080

2. **T054a** - Context Ledger Validation
   - *Why first:* Core LAFS differentiator needs implementation
   - *Blocks:* T055, T056, T069

3. **T068a** - Token Budget Protocol
   - *Why first:* MVI isn't real without budget enforcement
   - *Blocks:* T068b, T057

### Wave 1: Validation Infrastructure
**Enable agent self-verification**

4. **T056a** - Agent Reasoning Chain Fixtures
   - *Demonstrates:* How agents actually use LAFS
   - *Validates:* T054, T055 designs

5. **T079** - Language-Independent Conformance
   - *Enables:* Multi-language agent adoption
   - *Blocks:* T074, T080a

6. **T057** - Token Budget Validation
   - *Validates:* T068a implementation
   - *Critical for:* Agent trust

### Wave 2: SDK Implementation
**Make adoption easy**

7. **T074a** - Python Library
   - *Enables:* Python agent ecosystem

8. **T074b** - TypeScript SDK
   - *Enables:* Modern agent frameworks

9. **T073b** - Capability Advertisement
   - *Enhances:* SDK usability

### Wave 3: Integration Proof
**Show don't tell**

10. **T075a** - MCP Integration
    - *Proof:* LAFS complements MCP
    - *Validates:* Real agent usage

11. **T075b** - A2A Integration
    - *Proof:* Multi-agent scenarios

### Wave 4: Convergence
**Prepare for v1.0.0**

12. **T080a** - Agent Certification
    - *Defines:* What v1.0.0 means for agents

13. **T083a** - Automated Validation
    - *Ensures:* Quality at scale

14. **T081a** - Agent Governance
    - *Protects:* Long-term agent investment

---

## Challenging Questions for Each Epic

### Phase 3A Challenge: Is context preservation worth the complexity?
**Current answer:** Yes, but only if agents can actually USE it.
**Proof needed:** Show 3 real agent workflows that require context preservation.

### Phase 3B Challenge: Do agents need deprecation?
**Current answer:** Agents need version negotiation, not warnings.
**Redesign:** Deprecation registry → Version negotiation protocol.

### Phase 3C Challenge: Is token budget enforcement implementable?
**Current answer:** Unknown—no reference implementation exists.
**Risk:** This could be too hard for servers. Need prototype FIRST.

### Phase 4 Challenge: Will anyone adopt without big players?
**Current answer:** MCP integration is the Trojan horse.
**Strategy:** Make LAFS the default envelope for MCP tool results.

### Phase 5 Challenge: Is v1.0.0 too early?
**Current answer:** Yes, if we can't demonstrate 3 production use cases.
**Requirement:** Before v1.0.0, must have:
- 1 MCP server using LAFS
- 1 Python agent consuming LAFS
- 1 demonstration of token savings vs. vanilla JSON

---

## Immediate Next Actions

### Priority 1: Validate Core Hypotheses (This Week)

1. **Prototype token budget enforcement**
   - File: `/prototypes/budget-enforcement.md`
   - Question: Can a server realistically estimate and enforce token budgets?
   - If NO: Deprioritize T068, redesign MVI as advisory only

2. **Prototype context ledger retrieval**
   - File: `/prototypes/context-retrieval.md`
   - Question: Can agents efficiently retrieve and validate context?
   - If NO: Simplify context to request-scoped only

3. **Design review: Agent discovery protocol**
   - File: `/designs/agent-discovery-v1.md`
   - Question: What is the MINIMAL information agents need to start?
   - Deliver: Specification for T073a

### Priority 2: Update CLEO Tasks (Next)

- Deprioritize T063, T071 (not agent-critical)
- Split T054, T057, T068, T073, T074, T075, T080 into agent-focused subtasks
- Add new tasks: T054a/b, T068a/b/c, T073a/b, T074a/b, etc.
- Reorder dependencies according to Wave plan above

### Priority 3: Build Integration Proof (Parallel)

- Start T075a (MCP integration) immediately
- This validates entire LAFS proposition
- If MCP integration is awkward, rethink complementary positioning

---

## Conclusion

**The brutal truth:** Most pending tasks assume human adoption patterns. LLM agents are different:

| Human Pattern | Agent Pattern |
|--------------|---------------|
| Read documentation | Query discovery endpoint |
| Validate conformance manually | Self-validate at runtime |
| Handle deprecation warnings | Version-negotiate upfront |
| Browse paginated results | Request exact token budget |
| Review context manually | Programmatic ledger queries |

**The opportunity:** LAFS can be the FIRST protocol designed FOR agents BY agents. But only if we challenge every assumption about how adoption happens.

**The risk:** If we ship v1.0.0 with human-centric design, agents will ignore it and build their own solutions.

**The call:** Decompose boldly. Build for the agent consumer, not the human developer.
