# Unified LAFS + A2A Architecture

**Date:** 2026-02-16  
**Purpose:** Address Context7 audit gaps by creating practical tooling that unifies A2A and LAFS  
**Scope:** Agent-to-Agent (A2A) + Agent-to-Program + Program-to-Agent

---

## The Problem

Context7 audit revealed:
1. **21/100** - No code showing how to construct LAFS messages programmatically
2. **65/100** - No examples of human-readable output configuration  
3. **58/100** - No guidance on extending validation toolkit

**Root cause:** We have specs but lack practical developer tooling.

---

## The Solution: Unified Communication Toolkit

Instead of LAFS vs A2A, create a **unified tool** that:

1. **Leverages A2A** for what it does well:
   - Agent discovery (Agent Cards)
   - Streaming
   - Multi-turn conversations
   - Authentication

2. **Adds LAFS value** where A2A is weak:
   - Token budget enforcement
   - Structured response envelopes
   - Type-safe message construction
   - Program-to-Agent I/O

3. **Provides developer tooling** for all three patterns:
   - Agent-to-Agent (A2A compliant)
   - Agent-to-Program (LAFS envelope)
   - Program-to-Agent (LAFS input)

---

## Architecture

```typescript
// Unified toolkit interface
import { 
  A2AClient,           // Agent-to-Agent (A2A compliant)
  A2AServer,
  LAFSClient,          // Agent-to-Program (LAFS envelope)
  LAFSServer,
  ProgramClient,       // Program-to-Agent (structured input)
  UnifiedEnvelope,     // Works with both
  TokenBudget,
  SchemaValidator
} from '@lafs/unified-toolkit';
```

### Pattern 1: Agent-to-Agent (A2A Compliant)

```typescript
import { A2AClient, LAFSArtifact } from '@lafs/unified-toolkit';

// A2A communication with LAFS enrichment
const client = new A2AClient({
  agentCardUrl: 'https://agent.example.com/.well-known/agent.json'
});

// Send message with LAFS envelope in artifact
const task = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ text: 'Analyze this data' }]
  },
  // LAFS enrichment: token budget
  lafsConfig: {
    budget: { maxTokens: 4000 },
    requireEnvelope: true  // Wrap response in LAFS envelope
  }
});

// Response includes LAFS envelope in artifact
const lafsEnvelope = task.artifacts[0].parts[0].data;
// {
//   "_meta": { "operation": "analysis.run", ... },
//   "success": true,
//   "result": { ... },
//   "_tokenEstimate": { "estimated": 2847, "budget": 4000 }
// }
```

### Pattern 2: Agent-to-Program (LAFS Server)

```typescript
import { LAFSServer, withBudget } from '@lafs/unified-toolkit';

// REST API serving LLM agents
const server = new LAFSServer({
  enforceBudgets: true,
  defaultMVI: 'standard'
});

// Endpoint with automatic LAFS envelope
server.addEndpoint({
  path: '/api/analyze',
  handler: withBudget({ maxTokens: 2000 }, async (request) => {
    // Request is already parsed LAFS envelope
    const { operation, params, _budget } = request.lafs;
    
    // Process with budget awareness
    const result = await analyze(params, { maxTokens: _budget.maxTokens });
    
    // Return is automatically wrapped in LAFS envelope
    return result;
  })
});
```

### Pattern 3: Program-to-Agent (Structured Input)

```typescript
import { ProgramClient } from '@lafs/unified-toolkit';

// Program calling an LLM agent with structured input
const client = new ProgramClient({
  agentUrl: 'https://agent.example.com/a2a'
});

// Construct type-safe LAFS message
const message = client.createMessage({
  operation: 'code.review',
  params: {
    language: 'typescript',
    code: 'function add(a, b) { return a + b; }'
  },
  // LAFS features
  budget: { maxTokens: 1000 },
  context: { 
    objective: 'Review for type safety',
    constraints: ['no-any-types']
  }
});

// Send via A2A or REST
const response = await client.send(message);
// Response is parsed LAFS envelope with type safety
```

---

## Addressing Context7 Audit Gaps

### Gap 1: Programmatic Construction (21/100 → 95/100)

**Before:** Just JSON schemas
**After:** Full TypeScript SDK with type safety

```typescript
import { 
  LAFSEnvelopeBuilder, 
  SchemaValidator,
  envelopeSchema  // JSON schema imported as TypeScript types
} from '@lafs/unified-toolkit';

// Type-safe construction
const envelope = new LAFSEnvelopeBuilder()
  .withSchema('https://lafs.dev/schemas/v1/envelope.schema.json')
  .withMeta({
    specVersion: '1.0.0',
    operation: 'users.create',
    requestId: generateId(),
    strict: true,
    mvi: 'standard'
  })
  .withSuccess()
  .withResult({
    user: { id: '123', name: 'Alice' }
  })
  .withTokenEstimate({ estimated: 150, budget: 1000 })
  .build();

// Compile-time type checking + runtime validation
const validator = new SchemaValidator(envelopeSchema);
const result = validator.validate(envelope);
if (!result.valid) {
  console.error(result.errors);
}
```

### Gap 2: Human-Readable Output (65/100 → 95/100)

**Before:** Flag resolution only
**After:** Complete output formatting

```typescript
import { 
  OutputFormatter, 
  resolveOutputFormat 
} from '@lafs/unified-toolkit';

// 1. Resolve format from flags/config
const format = resolveOutputFormat({
  flags: { human: true },
  config: { defaultFormat: 'json' }
});

// 2. Format output
const formatter = new OutputFormatter(format);

const envelope = { /* LAFS envelope */ };

// Human-readable format
const humanOutput = formatter.format(envelope, {
  style: 'table',  // or 'compact', 'detailed'
  colors: true,
  fields: ['operation', 'success', 'result.summary']
});

console.log(humanOutput);
// Output:
// ┌─────────────┬──────────────┐
// │ Operation   │ users.create │
// ├─────────────┼──────────────┤
// │ Success     │ ✓ Yes        │
// ├─────────────┼──────────────┤
// │ Result      │ User created │
// └─────────────┴──────────────┘
```

### Gap 3: Extending Validation (58/100 → 90/100)

**Before:** Schema structure only
**After:** Plugin architecture

```typescript
import { 
  ValidationToolkit,
  CustomValidator,
  LAFSExtension 
} from '@lafs/unified-toolkit';

// 1. Define custom message type
interface CustomMessage extends LAFSExtension {
  'x-custom-priority': 'low' | 'medium' | 'high';
  'x-custom-tags': string[];
}

// 2. Create custom validator
class PriorityValidator implements CustomValidator {
  validate(envelope: LAFSEnvelope): ValidationResult {
    const priority = envelope._extensions?.['x-custom-priority'];
    
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return {
        valid: false,
        errors: [{
          field: '_extensions.x-custom-priority',
          message: 'Priority must be low, medium, or high'
        }]
      };
    }
    
    return { valid: true };
  }
}

// 3. Register with toolkit
const toolkit = new ValidationToolkit();
toolkit.registerValidator(new PriorityValidator());

// 4. Use with standard LAFS validation
const result = toolkit.validate(envelope, {
  customValidators: true,
  strict: true
});
```

---

## Implementation Plan

### Phase 1: Unified Toolkit Core (This Week)

1. **TypeScript SDK** (`src/unified/`)
   - A2AClient (A2A compliance)
   - LAFSClient/LAFSServer (Agent-to-Program)
   - ProgramClient (Program-to-Agent)
   - LAFSEnvelopeBuilder (type-safe construction)
   - OutputFormatter (human-readable)
   - ValidationToolkit (extensible validation)

2. **Python SDK** (`python/lafs_unified/`)
   - Mirror TypeScript functionality
   - Full feature parity

### Phase 2: Documentation (Next Week)

1. **Implementation Guides**
   - `docs/implementation/typescript.md`
   - `docs/implementation/python.md`
   - `docs/implementation/extending.md`

2. **API Reference**
   - Auto-generated from TypeScript types
   - Interactive examples

3. **Cookbook**
   - Common patterns
   - Integration examples
   - Best practices

### Phase 3: A2A Integration (Following Week)

1. **A2A Compliance Testing**
   - Verify toolkit passes A2A test suite
   - Compatibility validation

2. **LAFS Extensions for A2A**
   - Token budgets in A2A messages
   - LAFS envelope as A2A artifact type

---

## Benefits of This Approach

### For Developers

1. **One Toolkit, All Patterns**
   - Don't learn multiple protocols
   - Consistent API across A2A/REST

2. **Type Safety**
   - Full TypeScript/JSON schema integration
   - Compile-time checking
   - Runtime validation

3. **Practical Examples**
   - Copy-paste ready code
   - Real-world patterns
   - Testing utilities

### For LAFS Adoption

1. **Leverages A2A Momentum**
   - Not competing, enhancing
   - A2A users get LAFS features "for free"

2. **Clear Value Proposition**
   - Token budgets (unique)
   - Structured envelopes (A2A compatible)
   - Developer tooling (missing in A2A)

3. **Ecosystem Growth**
   - Unified toolkit attracts more users
   - Both protocols benefit

---

## Deliverables

### Immediate (Today)

1. ✅ This architecture document
2. 🔄 TypeScript envelope builder
3. 🔄 Output formatter
4. 🔄 Validation toolkit

### This Week

1. Python equivalents
2. Integration tests
3. Updated documentation

### Next Week

1. A2A compliance verification
2. Example applications
3. GitBook updates

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Context7 score (construction) | 21/100 | 90/100 |
| Context7 score (human output) | 65/100 | 90/100 |
| Context7 score (extension) | 58/100 | 85/100 |
| Code examples in docs | 175 | 300+ |
| Working examples | 10 | 25+ |
| Test coverage | 168 tests | 250+ tests |

---

## Next Steps

1. **Review this architecture** - Does it address your concerns?
2. **Approve approach** - I'll start implementing the toolkit
3. **Define priorities** - Which gaps are most critical?

Ready to build this?
