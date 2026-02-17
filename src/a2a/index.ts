/**
 * LAFS Agent-to-Agent (A2A) Integration
 * 
 * This module provides integration between LAFS and the official 
 * @a2a-js/sdk for Agent-to-Agent communication.
 * 
 * @example
 * ```typescript
 * import { ClientFactory } from '@a2a-js/sdk/client';
 * import { withLafsEnvelope } from '@cleocode/lafs-protocol/a2a';
 * 
 * // Create official A2A client
 * const factory = new ClientFactory();
 * const a2aClient = await factory.createFromUrl('http://agent.example.com');
 * 
 * // Wrap with LAFS support
 * const client = withLafsEnvelope(a2aClient, {
 *   defaultBudget: { maxTokens: 4000 }
 * });
 * 
 * // Send message
 * const result = await client.sendMessage({
 *   message: {
 *     role: 'user',
 *     parts: [{ text: 'Analyze data' }]
 *   }
 * });
 * 
 * // Extract LAFS envelope from response
 * const envelope = result.getLafsEnvelope();
 * if (envelope) {
 *   console.log(envelope._meta._tokenEstimate);
 * }
 * ```
 */

export {
  withLafsEnvelope,
  LafsA2AClient,
  LafsA2AResult,
  createLafsArtifact,
  type LafsA2AConfig,
  type LafsEnvelope
} from './bridge.js';
