/**
 * LAFS A2A Bridge
 * 
 * Integration with official @a2a-js/sdk for Agent-to-Agent communication.
 * LAFS provides envelope wrapping and token budget support.
 */

import { A2AClient } from '@a2a-js/sdk/client';
import { 
  Task, 
  Artifact, 
  Part, 
  SendMessageResponse,
  SendMessageSuccessResponse,
  JSONRPCErrorResponse,
  Message
} from '@a2a-js/sdk';

export interface LafsA2AConfig {
  defaultBudget?: {
    maxTokens?: number;
    maxItems?: number;
  };
  envelopeResponses?: boolean;
}

export interface LafsEnvelope {
  $schema: string;
  _meta: {
    specVersion: string;
    operation: string;
    requestId: string;
    mvi: string;
    _tokenEstimate?: {
      estimated: number;
      budget?: number;
    };
  };
  success: boolean;
  result: unknown;
  error: null | {
    code: string;
    message: string;
    category: string;
    retryable: boolean;
  };
}

/**
 * Wrap A2A client with LAFS envelope support
 * 
 * @example
 * ```typescript
 * import { ClientFactory } from '@a2a-js/sdk/client';
 * import { withLafsEnvelope } from '@lafs/envelope/a2a';
 * 
 * const factory = new ClientFactory();
 * const a2aClient = await factory.createFromUrl('http://localhost:4000');
 * 
 * const client = withLafsEnvelope(a2aClient, {
 *   envelopeResponses: true,
 *   defaultBudget: { maxTokens: 4000 }
 * });
 * 
 * const result = await client.sendMessage({
 *   message: { role: 'user', parts: [{ text: 'Hello' }] }
 * });
 * 
 * // Access LAFS envelope
 * const envelope = result.getLafsEnvelope();
 * console.log(envelope._meta._tokenEstimate);
 * ```
 */
export function withLafsEnvelope(
  client: A2AClient,
  config: LafsA2AConfig = {}
): LafsA2AClient {
  return new LafsA2AClient(client, config);
}

export class LafsA2AClient {
  constructor(
    private client: A2AClient,
    private config: LafsA2AConfig
  ) {}

  async sendMessage(params: {
    message: {
      role: 'user' | 'agent';
      parts: Part[];
    };
    budget?: {
      maxTokens?: number;
      maxItems?: number;
    };
  }): Promise<LafsA2AResult> {
    // Merge budget with defaults
    const budget = {
      ...this.config.defaultBudget,
      ...params.budget
    };

    // Send via official A2A SDK
    const result = await this.client.sendMessage({
      message: {
        kind: 'message',
        messageId: this.generateId(),
        role: params.message.role,
        parts: params.message.parts
      }
    });

    // Wrap result with LAFS envelope support
    return new LafsA2AResult(result, budget);
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export class LafsA2AResult {
  constructor(
    private result: SendMessageResponse,
    private budget: { maxTokens?: number; maxItems?: number }
  ) {}

  /**
   * Get the underlying A2A result
   */
  getA2AResult(): SendMessageResponse {
    return this.result;
  }

  /**
   * Check if result is an error
   */
  isError(): boolean {
    return 'error' in this.result;
  }

  /**
   * Get error details if result is an error
   */
  getError(): JSONRPCErrorResponse | null {
    if (this.isError()) {
      return this.result as JSONRPCErrorResponse;
    }
    return null;
  }

  /**
   * Extract LAFS envelope from A2A artifact
   */
  getLafsEnvelope(): LafsEnvelope | null {
    if (this.isError()) {
      return null;
    }

    const successResult = this.result as SendMessageSuccessResponse;
    
    // Check if result is a Task
    if (successResult.result?.kind !== 'task') {
      return null;
    }

    const task = successResult.result as unknown as Task;
    if (!task.artifacts || task.artifacts.length === 0) {
      return null;
    }

    // Find LAFS envelope in artifacts
    for (const artifact of task.artifacts) {
      for (const part of artifact.parts) {
        if (part.kind === 'data' && this.isLafsEnvelope(part.data)) {
          return part.data as unknown as LafsEnvelope;
        }
      }
    }

    return null;
  }

  /**
   * Check if result contains LAFS envelope
   */
  hasLafsEnvelope(): boolean {
    return this.getLafsEnvelope() !== null;
  }

  /**
   * Get token estimate from envelope
   */
  getTokenEstimate(): { estimated: number; budget?: number } | null {
    const envelope = this.getLafsEnvelope();
    return envelope?._meta?._tokenEstimate ?? null;
  }

  private isLafsEnvelope(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      '$schema' in (data as Record<string, unknown>) &&
      '_meta' in (data as Record<string, unknown>) &&
      'success' in (data as Record<string, unknown>)
    );
  }
}

/**
 * Create a LAFS artifact for A2A
 * 
 * @example
 * ```typescript
 * const artifact = createLafsArtifact({
 *   success: true,
 *   result: { data: '...' },
 *   meta: { operation: 'analysis.run' }
 * });
 * 
 * task.artifacts.push(artifact);
 * ```
 */
export function createLafsArtifact(envelope: LafsEnvelope): Artifact {
  return {
    artifactId: generateId(),
    name: 'lafs_response',
    parts: [{
      kind: 'data',
      data: envelope as unknown as Record<string, unknown>
    }]
  };
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
