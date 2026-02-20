# Changelog

All notable changes to the LAFS Protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-02-20

### Added

A2A v1.0+ compliance implementation (Wave 1):

- **Extension negotiation** (`src/a2a/extensions.ts`): `parseExtensionsHeader()`, `negotiateExtensions()`, `buildLafsExtension()`, Express middleware, `ExtensionSupportRequiredError` (code -32008)
- **Task lifecycle** (`src/a2a/task-lifecycle.ts`): `TaskManager` with CRUD/pagination, state machine enforcement (valid transitions, terminal state immutability), `attachLafsEnvelope()` integration helper
- **Protocol bindings** (`src/a2a/bindings/`): JSON-RPC method/error constants, HTTP endpoints with RFC 9457 Problem Details, gRPC status codes and service definitions (types only, no runtime dependency), cross-binding `getErrorCodeMapping()` for all 9 A2A error types
- **Discovery integration**: `autoIncludeLafsExtension` option in `DiscoveryConfig` to auto-declare LAFS in Agent Card
- **Subpath export**: `@cleocode/lafs-protocol/a2a/bindings` for standalone binding imports
- 130 new tests across extensions (32), task lifecycle (44), and bindings (54)

### Fixed

- Resolved type name conflicts between `discovery.ts` and `@a2a-js/sdk` re-exports in root `index.ts` (pre-existing from Wave 0)
- Made `DiscoveryConfig.agent` optional for backward compatibility with legacy `service` configs
- Fixed `examples/discovery-server.ts` references to optional `service` field

## [1.2.3] - 2026-02-18

### CI/CD Fixes

Fixed npm publish failures due to version conflicts:
- Bumped version to 1.2.3 (1.2.0, 1.2.1, 1.2.2 already published)
- Updated all version references (package.json, README, lafs.md)
- Fixed GitHub release workflow to create releases automatically

## [1.2.2] - 2026-02-18

### Documentation Fixes

Fixed documentation inaccuracies discovered after 1.2.0 release:
- Fixed CLI format option documentation (table → json/human)
- Synced specification.md with lafs.md (added format documentation and extensions examples)
- Added sessionId and warnings to envelope-basics.md field table

### Documentation Fixes

Fixed documentation inaccuracies discovered after 1.2.0 release:
- Fixed CLI format option documentation (table → json/human)
- Synced specification.md with lafs.md (added format documentation and extensions examples)
- Added sessionId and warnings to envelope-basics.md field table

## [1.2.0] - 2026-02-18

### Protocol Enhancement - Session Management & Format Documentation

This release adds session correlation support, quiet mode for scripting, and comprehensive documentation on format types and extension patterns.

### Added

#### Session Management
- **sessionId field** (`src/types.ts`) - Added to LAFSMeta for correlating multi-step agent workflows
- **Session tracking** - Enables context preservation across distributed operations
- **JSON Schema update** (`schemas/v1/envelope.schema.json`) - Added sessionId validation

#### Quiet Mode
- **quiet flag** (`src/types.ts`, `src/flagSemantics.ts`) - Suppresses non-essential output for scripting
- **Flag resolution** - Updated resolveOutputFormat() to handle quiet mode throughout all code paths
- **MVI compliance** - Aligns with Minimal Viable Information principle

#### Format Documentation
- **Section 5.3** (`lafs.md`) - Comprehensive format type documentation
- **Supported formats** - Explicitly documents json and human as only supported formats
- **Rejected formats table** - Documents why text, markdown, table, and jsonl were rejected
- **Human format definition** - Clear specification of human-readable output behavior
- **Tooling guidance** - Examples using jq and column commands for presentation needs

#### Extensions Documentation
- **Section 6.2** (`lafs.md`) - Expanded with comprehensive _extensions examples
- **4 complete examples** - Timing, source metadata, filters, and summaries
- **TypeScript interfaces** - Full type definitions for each extension pattern
- **Best practices** - 6 guidelines for extension usage including x- prefix convention
- **Decision matrix** - Clear guidance on Core Protocol vs Extensions

#### LLM Agent Guide
- **New guide** (`docs/guides/llm-agent-guide.md`) - Complete quick reference for AI agents
- **Envelope structure** - Full documentation with TypeScript interfaces
- **Format selection** - Guidance on choosing between json and human
- **Context preservation** - Session management and ledger usage patterns
- **Error handling** - Retry logic patterns for all error categories
- **Integration examples** - MCP, A2A, and HTTP API integration patterns
- **Best practices checklist** - 5 key patterns for robust agent implementation

### Design Principles Validated

- **MVI** - Rejected format bloat, kept only json|human
- **Progressive Disclosure** - Clear documentation on _fields, _expand, _budget
- **Transport Agnosticism** - No TTY-specific logic in protocol
- **Schema-First** - All changes reflected in JSON Schema and TypeScript types
- **Self-Documenting** - All code has JSDoc, comprehensive examples provided

## [1.1.0] - 2026-02-16

### Operations & Reliability Release

This release adds production operations features including health checks, graceful shutdown, circuit breakers, and comprehensive documentation.

### Added

#### Health Check Module
- **Health check endpoints** (`src/health/index.ts`)
- **Liveness probe** (`/health/live`)
- **Readiness probe** (`/health/ready`)
- **Custom health checks** for databases and external services
- **Kubernetes-compatible** health endpoints
- **Prometheus metrics** support

#### Graceful Shutdown
- **Graceful shutdown handler** (`src/shutdown/index.ts`)
- **SIGTERM/SIGINT signal handling**
- **Connection draining** - waits for active requests
- **Custom shutdown hooks** for cleanup
- **Force shutdown** option for emergencies
- **Shutdown state tracking**

#### Circuit Breaker Pattern
- **Circuit breaker implementation** (`src/circuit-breaker/index.ts`)
- **Three states**: CLOSED, OPEN, HALF_OPEN
- **Configurable thresholds** for failure detection
- **Auto-reset** after timeout
- **Circuit breaker registry** for multiple services
- **Express middleware** for easy integration

#### Documentation
- **Deployment Guide** (`docs/deployment.md`) - Complete deployment instructions
- **Operational Runbook** (`docs/runbook.md`) - Day-to-day operations
- **Troubleshooting Guide** (`docs/troubleshooting.md`) - Common issues and solutions
- **Architecture Document** (`docs/ARCHITECTURE.md`) - System design
- **Programmatic Construction Guide** (`docs/programmatic-construction.md`) - Code examples with type safety
- **Error Handling Implementation Guide** (`docs/error-handling-implementation.md`) - E_FORMAT_CONFLICT and error patterns
- **Roadmap** (`ROADMAP.md`) - Future improvements

### Changed

- **Removed competing "unified toolkit"** - Now uses official `@a2a-js/sdk`
- **Refactored A2A integration** - Proper bridge pattern using official SDK
- **Updated exports** - Added health, shutdown, circuit-breaker, a2a modules

---

## [1.0.0] - 2026-02-16

### Major Release - Agent-First Implementation

This release represents the completion of core LAFS protocol implementation with full agent-focused features, comprehensive documentation, and production-ready SDKs.

### Added

#### Token Budget Signaling
- **Token budget enforcement** (`_budget` parameter) with `maxTokens`, `maxBytes`, `maxItems` constraints
- **Normative token estimation algorithm** with 94-95% accuracy
- **E_MVI_BUDGET_EXCEEDED** error code with detailed retry guidance
- **Response truncation strategies** (depth-first, field priority, hybrid)
- **TypeScript implementation** in `src/budgetEnforcement.ts` with 42 tests
- **Python implementation** in `python/lafs_protocol/budget.py` with 21 tests

#### Agent Discovery Protocol
- **Well-known endpoint** `/.well-known/lafs.json` for automatic capability discovery
- **Discovery middleware** for Express/Fastify (`src/discovery.ts`)
- **JSON Schema** for discovery document validation (`schemas/v1/discovery.schema.json`)
- **ETag caching support** for efficient capability checks
- **26 integration tests** for discovery functionality

#### Context Ledger Query API
- **Projection modes** (full, delta, summary) for efficient context retrieval
- **Delta synchronization** with `sinceVersion` parameter
- **Query interface** at `GET /_lafs/context/{ledgerId}`
- **Checksum validation** for integrity verification
- **Complete API design** documented in `designs/context-query-v1.md`

#### MCP Integration
- **MCP adapter** (`src/mcpAdapter.ts`) for wrapping MCP tool results in LAFS envelopes
- **Example MCP server** (`examples/mcp-lafs-server.ts`) with 3 tools (weather, calculator, database_query)
- **Example MCP client** (`examples/mcp-lafs-client.ts`) demonstrating consumption
- **14 integration tests** proving LAFS complements MCP
- **Budget enforcement** within MCP tool context

#### Python SDK
- **Complete Python package** (`lafs-protocol`) pip-installable
- **Envelope module** with validation and creation functions
- **Budget module** with `TokenEstimator` and `BudgetEnforcer` classes
- **Client module** with `LAFSClient` for HTTP API calls
- **55 comprehensive tests** covering all functionality
- **Working examples** in `python/examples/basic_usage.py`

#### Documentation System
- **GitBook-compliant** documentation structure (24 markdown files, ~5,500 lines)
- **Agent-focused guides** in `docs/getting-started/` (4 guides)
- **Integration guides** for MCP, A2A, and REST (`docs/integrations/`)
- **SDK reference** documentation (`docs/sdk/`)
- **llms.txt** index for LLM agent consumption
- **Complete specification** merged into `lafs.md` Sections 8.1 and 9.5

#### Specifications
- **Token Budget Signaling Specification** (Section 9.5) with normative algorithm
- **Context Projection Modes Specification** (Section 8.1) with delta format
- **Agent Discovery Protocol** design document
- **Context Query API** design document

#### Testing & Conformance
- **113 TypeScript tests** (vitest) covering all new features
- **55 Python tests** (pytest) covering SDK functionality
- **14 MCP integration tests**
- **26 discovery middleware tests**
- **42 budget enforcement tests**
- **Total: 168 tests passing**

#### Prototypes & Design
- **Budget enforcement prototype** proving 94-95% accuracy with <1.3ms overhead
- **Agent reasoning chain fixtures** (3 workflow scenarios)
- **Complete decomposition** of pending work with agent-first lens

### Changed

#### Documentation Organization
- **Reorganized docs/** into structured GitBook format
- **Created SUMMARY.md** for navigation (11 sections, 18 entries)
- **Created .gitbook.yaml** configuration
- **Rewrote docs/README.md** as agent-focused landing page
- **Enhanced existing docs** with before/after examples

#### Specification Updates
- **lafs.md Section 8.1** - Added Context Retrieval with projection modes
- **lafs.md Section 9.5** - Added Token Budget Signaling (normative)
- **Error registry** - Added E_MVI_BUDGET_EXCEEDED and E_MVI_BUDGET_TRUNCATED

### Technical Details

#### TypeScript SDK
```typescript
// Token estimation
const estimator = new TokenEstimator();
const tokens = estimator.estimate({ data: "value" });

// Budget enforcement
app.use(withBudget({ budget: 1000, truncateOnExceed: true }));

// Discovery
app.use(discoveryMiddleware(config));
```

#### Python SDK
```python
# Client with discovery
client = LAFSClient("https://api.example.com")
discovery = client.discover()

# Budget enforcement
response = client.call(
    operation="data.query",
    budget={"maxTokens": 1000, "maxItems": 50}
)
```

### Migration Notes

This is a major release (1.0.0) marking production readiness. All previously deprecated features have been removed. The protocol is now stable for production use.

**For implementers:**
- Token budget signaling is optional but recommended for LLM-facing APIs
- Agent discovery is optional but enables auto-configuration
- All new features are backward compatible with v0.5.0 Core tier

### Statistics

- **24 new documentation files**
- **~5,500 lines of documentation**
- **~175 code examples**
- **168 passing tests**
- **4 integration guides**
- **3 SDK references**
- **100% LAFS compliant**

## [0.5.0] - 2026-02-12

### Phase 2B — Pagination & MVI Schema

### Added
- Conditional pagination (cursor, offset, none modes)
- MVI field selection (`_fields`) and expansion (`_expand`)
- Context ledger schema for state tracking
- Error registry with transport mappings
- Conformance runner with 8 checks

## [0.4.0] - 2026-02-11

### Phase 2A — Envelope Rationalization

### Added
- Optional page/error fields (can be omitted vs null)
- `_extensions` field for vendor metadata
- Strict/lenient mode toggle
- Schema validation for pagination modes
- CLI diagnostic tool

## [0.3.0] - 2026-02-10

### Phase 1 — Strategic Positioning

### Added
- Vision document with agent-first focus
- Positioning relative to MCP/A2A
- Adoption tiers (Core, Standard, Complete)
- Boundary model documentation

## [0.2.0] - 2026-02-09

### Phase 0 — Protocol Foundations

### Added
- Envelope schema (Draft-07)
- Error registry (12 codes)
- Fixtures for testing
- Governance documentation
- Security considerations

## [0.1.0] - 2026-02-08

### Initial Release

### Added
- Initial protocol specification
- Basic envelope structure
- TypeScript types
- Basic validation

---

## Release Checklist Template

### Pre-Release
- [ ] All tests passing
- [ ] Version bumped in package.json
- [ ] Version bumped in Python setup.py
- [ ] CHANGELOG.md updated
- [ ] GitBook docs synced
- [ ] Schema files validated

### Release
- [ ] Git tag created (`git tag -a vX.Y.Z -m "Release X.Y.Z"`)
- [ ] Tag pushed to GitHub (`git push origin vX.Y.Z`)
- [ ] npm package published (`npm publish`)
- [ ] Python package published (`twine upload dist/*`)
- [ ] GitHub release created

### Post-Release
- [ ] Documentation site updated
- [ ] Migration guides published
- [ ] Announcement shared

---

[Unreleased]: https://github.com/lafs-protocol/lafs-protocol/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lafs-protocol/lafs-protocol/releases/tag/v1.0.0
[0.5.0]: https://github.com/lafs-protocol/lafs-protocol/releases/tag/v0.5.0
[0.4.0]: https://github.com/lafs-protocol/lafs-protocol/releases/tag/v0.4.0
[0.3.0]: https://github.com/lafs-protocol/lafs-protocol/releases/tag/v0.3.0
[0.2.0]: https://github.com/lafs-protocol/lafs-protocol/releases/tag/v0.2.0
[0.1.0]: https://github.com/lafs-protocol/lafs-protocol/releases/tag/v0.1.0
