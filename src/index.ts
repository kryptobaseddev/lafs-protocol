export * from "./types.js";
export * from "./errorRegistry.js";
export * from "./validateEnvelope.js";
export * from "./envelope.js";
export * from "./flagSemantics.js";
export * from "./conformance.js";
export * from "./compliance.js";
export * from "./tokenEstimator.js";
export * from "./budgetEnforcement.js";
export * from "./mcpAdapter.js";
export * from "./discovery.js";

// Operations & Reliability
export * from "./health/index.js";
export * from "./shutdown/index.js";
export * from "./circuit-breaker/index.js";

// A2A Integration
// Explicitly re-export to avoid naming conflicts with discovery types
// (AgentCard, AgentSkill, AgentCapabilities, AgentExtension).
// For full A2A types, import from '@cleocode/lafs-protocol/a2a'.
export {
  // Bridge
  LafsA2AResult,
  createLafsArtifact,
  createTextArtifact,
  createFileArtifact,
  isExtensionRequired,
  getExtensionParams,
  AGENT_CARD_PATH,
  HTTP_EXTENSION_HEADER,

  // Extensions (T098)
  LAFS_EXTENSION_URI,
  A2A_EXTENSIONS_HEADER,
  parseExtensionsHeader,
  negotiateExtensions,
  formatExtensionsHeader,
  buildLafsExtension,
  ExtensionSupportRequiredError,
  extensionNegotiationMiddleware,

  // Task Lifecycle (T099)
  TERMINAL_STATES,
  INTERRUPTED_STATES,
  VALID_TRANSITIONS,
  isValidTransition,
  isTerminalState,
  isInterruptedState,
  InvalidStateTransitionError,
  TaskImmutabilityError,
  TaskNotFoundError,
  TaskManager,
  attachLafsEnvelope,
} from "./a2a/index.js";

export type {
  LafsA2AConfig,
  LafsSendMessageParams,
  LafsExtensionParams,
  ExtensionNegotiationResult,
  BuildLafsExtensionOptions,
  ExtensionNegotiationMiddlewareOptions,
  CreateTaskOptions,
  ListTasksOptions,
  ListTasksResult,
} from "./a2a/index.js";

// A2A SDK types (non-conflicting subset)
export type {
  Task,
  TaskState,
  TaskStatus,
  Artifact,
  Part,
  Message,
  PushNotificationConfig,
  MessageSendConfiguration,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  SendMessageResponse,
  SendMessageSuccessResponse,
  JSONRPCErrorResponse,
  TextPart,
  DataPart,
  FilePart,
} from "./a2a/index.js";
