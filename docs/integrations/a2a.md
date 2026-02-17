# A2A (Agent-to-Agent) Integration

**What you'll learn:** How to use LAFS envelopes for structured agent-to-agent communication, enabling deterministic parsing of artifacts and task results.

## Why LAFS + A2A?

A2A defines how agents discover each other and exchange messages. LAFS defines the shape of the artifacts and results those agents produce.

```
Agent A ──► A2A Protocol ──► Agent B ──► LAFS Envelope ──► A2A Protocol ──► Agent A

         A2A defines              LAFS defines
         how agents talk          artifact response shape
```

## A2A task with LAFS artifacts

### Scenario: Research agent delegates to analysis agent

**Agent A (Researcher)** sends a task to **Agent B (Analyzer)**:

```json
{
  "id": "task_research_001",
  "sessionId": "session_abc123",
  "status": {
    "state": "input-required",
    "message": "Please provide research topic"
  }
}
```

**Agent B** responds with a LAFS envelope in the artifact:

```json
{
  "id": "task_research_001",
  "sessionId": "session_abc123",
  "status": {
    "state": "completed"
  },
  "artifacts": [
    {
      "name": "research_results",
      "parts": [
        {
          "type": "text",
          "text": "{\n  \"$schema\": \"https://lafs.dev/schemas/v1/envelope.schema.json\",\n  \"_meta\": {\n    \"specVersion\": \"1.0.0\",\n    \"operation\": \"research.analyze\",\n    \"requestId\": \"req_001\",\n    \"contextVersion\": 3\n  },\n  \"success\": true,\n  \"result\": {\n    \"topic\": \"AI Safety\",\n    \"summary\": \"...\",\n    \"sources\": [...],\n    \"confidence\": 0.94\n  },\n  \"error\": null\n}"
        }
      ]
    }
  ]
}
```

## Implementation pattern

### TypeScript: Creating LAFS artifacts

```typescript
import { createEnvelope } from '@cleocode/lafs-protocol';
import { Task, Artifact } from '@google/a2a-sdk';

class AnalysisAgent {
  async handleTask(task: Task): Promise<Task> {
    // Update status
    task.status = { state: 'working', message: 'Analyzing data...' };

    try {
      // Perform analysis
      const analysisResult = await this.analyze(task.input);

      // Create LAFS envelope for the result
      const envelope = createEnvelope({
        success: true,
        result: {
          analysis: analysisResult,
          metadata: {
            processedAt: new Date().toISOString(),
            confidence: analysisResult.confidence
          }
        },
        meta: {
          operation: 'analysis.run',
          requestId: task.id,
          contextVersion: await this.getContextVersion(task.sessionId)
        }
      });

      // Add as artifact
      task.artifacts = [
        {
          name: 'analysis_result',
          parts: [{
            type: 'text',
            text: JSON.stringify(envelope)
          }]
        }
      ];

      task.status = { state: 'completed' };
    } catch (error) {
      // Return structured error
      const envelope = createEnvelope({
        success: false,
        error: {
          code: 'E_ANALYSIS_FAILED',
          message: error.message,
          category: 'INTERNAL',
          retryable: error.retryable ?? false,
          details: { phase: error.phase }
        },
        meta: {
          operation: 'analysis.run',
          requestId: task.id
        }
      });

      task.artifacts = [
        {
          name: 'analysis_error',
          parts: [{
            type: 'text',
            text: JSON.stringify(envelope)
          }]
        }
      ];

      task.status = { state: 'failed', message: error.message };
    }

    return task;
  }
}
```

### TypeScript: Consuming LAFS artifacts

```typescript
import { parseLafsResponse } from '@cleocode/lafs-protocol';

class DelegatorAgent {
  async delegateAnalysis(topic: string): Promise<AnalysisResult> {
    // Send task to analysis agent
    const task = await this.sendTask({
      id: `task_${generateId()}`,
      input: { topic },
      acceptedOutputModes: ['text']
    });

    // Extract LAFS envelope from artifact
    const artifact = task.artifacts?.find(a => a.name === 'analysis_result');
    if (!artifact) {
      throw new Error('No analysis artifact found');
    }

    const envelopeText = artifact.parts.find(p => p.type === 'text')?.text;
    if (!envelopeText) {
      throw new Error('Artifact has no text content');
    }

    // Parse the LAFS envelope
    const envelope = JSON.parse(envelopeText);
    const result = parseLafsResponse(envelope);

    // Handle context continuity
    if (envelope._meta.contextVersion) {
      await this.updateContext(task.sessionId, envelope._meta.contextVersion);
    }

    return result;
  }
}
```

## Context preservation across agents

Use LAFS context ledger for multi-step agent workflows:

```typescript
// Agent A initiates workflow
const contextLedger = {
  objective: "Research AI safety and generate report",
  constraints: ["Use peer-reviewed sources only"],
  references: [],
  decisions: [],
  openIssues: ["Need more data on alignment"],
  state: "in_progress",
  version: 1
};

// Include in initial task
const initialTask = {
  id: "workflow_001",
  input: {
    topic: "AI Safety",
    _context: contextLedger
  }
};

// Agent B returns updated context
const envelope = createEnvelope({
  success: true,
  result: { findings: [...] },
  meta: {
    operation: "research.conduct",
    requestId: task.id,
    contextVersion: 2  // Incremented
  },
  _extensions: {
    "x-updated-context": {
      objective: "Research AI safety and generate report",
      constraints: ["Use peer-reviewed sources only"],
      references: ["paper1.pdf", "paper2.pdf"],
      decisions: ["Focused on alignment subtopic"],
      openIssues: ["Report generation pending"],
      state: "analysis_complete",
      version: 2
    }
  }
});
```

## Error handling between agents

Structured errors enable agents to reason about failures:

```typescript
// Agent B encounters an error
const envelope = createEnvelope({
  success: false,
  error: {
    code: "E_RATE_LIMIT_EXCEEDED",
    message: "External API rate limit hit",
    category: "RATE_LIMIT",
    retryable: true,
    retryAfterMs: 60000,
    details: {
      api: "research-papers-db",
      quotaReset: "2026-02-16T11:00:00Z"
    }
  },
  meta: {
    operation: "research.query",
    requestId: task.id
  }
});

// Agent A can implement intelligent retry
const handleAgentResponse = async (envelope) => {
  if (!envelope.success) {
    if (envelope.error.retryable && envelope.error.retryAfterMs) {
      await sleep(envelope.error.retryAfterMs);
      return retryTask(task);
    }
    
    if (envelope.error.category === "RATE_LIMIT") {
      // Switch to alternative agent
      return delegateToAlternativeAgent(task);
    }
    
    throw new AgentError(envelope.error);
  }
};
```

## Multi-agent chains with LAFS

Chain multiple agents with consistent envelopes:

```typescript
async function runAgentChain(input: string) {
  // Agent 1: Research
  const researchResult = await researchAgent.process({
    input: { query: input },
    outputMode: 'lafs'
  });
  
  // Agent 2: Analyze (receives LAFS from Agent 1)
  const analysisResult = await analysisAgent.process({
    input: { 
      data: researchResult.envelope.result.findings 
    },
    outputMode: 'lafs'
  });
  
  // Agent 3: Summarize
  const summaryResult = await summaryAgent.process({
    input: {
      analysis: analysisResult.envelope.result.insights
    },
    outputMode: 'lafs'
  });

  return summaryResult.envelope;
}
```

## Before and After

### Before LAFS: Custom formats per agent

```typescript
// Agent A returns this
{ findings: [...], metadata: {...} }

// Agent B returns this  
{ insights: [...], confidence: 0.9 }

// Agent C returns this
{ summary: "...", sources: [...] }

// You need different parsing for each
```

### After LAFS: Standard envelope

All agents return LAFS envelopes with `result` containing their specific data:

```typescript
// All agents return LAFS envelopes
{ 
  _meta: {...},
  success: true,
  result: { /* agent-specific data */ },
  error: null
}

// One parser handles all agents
const result = parseLafsResponse(agentResponse);
```

## Next steps

- **[MCP Integration](mcp.md)** — Model Context Protocol integration
- **[REST Integration](rest.md)** — HTTP API integration
- **[Context preservation](../getting-started/envelope-basics.md)** — Learn about context ledgers
