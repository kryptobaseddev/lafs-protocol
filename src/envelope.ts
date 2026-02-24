import { isRegisteredErrorCode } from "./errorRegistry.js";
import type {
  LAFSEnvelope,
  LAFSError,
  LAFSErrorCategory,
  LAFSMeta,
  LAFSTransport,
  MVILevel,
} from "./types.js";
import { assertEnvelope } from "./validateEnvelope.js";

export const LAFS_SCHEMA_URL = "https://lafs.dev/schemas/v1/envelope.schema.json" as const;

export interface CreateEnvelopeMetaInput {
  operation: string;
  requestId: string;
  transport?: LAFSTransport;
  specVersion?: string;
  schemaVersion?: string;
  timestamp?: string;
  strict?: boolean;
  mvi?: MVILevel | boolean;
  contextVersion?: number;
  sessionId?: string;
  warnings?: LAFSMeta["warnings"];
}

export interface CreateEnvelopeSuccessInput {
  success: true;
  result: LAFSEnvelope["result"];
  page?: LAFSEnvelope["page"];
  error?: null;
  _extensions?: LAFSEnvelope["_extensions"];
  meta: CreateEnvelopeMetaInput;
}

export interface CreateEnvelopeErrorInput {
  success: false;
  error: Partial<LAFSError> & Pick<LAFSError, "code" | "message">;
  result?: null;
  page?: LAFSEnvelope["page"];
  _extensions?: LAFSEnvelope["_extensions"];
  meta: CreateEnvelopeMetaInput;
}

export type CreateEnvelopeInput = CreateEnvelopeSuccessInput | CreateEnvelopeErrorInput;

function resolveMviLevel(input: CreateEnvelopeMetaInput["mvi"]): MVILevel {
  if (typeof input === "boolean") {
    return input ? "minimal" : "standard";
  }
  return input ?? "standard";
}

function createMeta(input: CreateEnvelopeMetaInput): LAFSMeta {
  return {
    specVersion: input.specVersion ?? "1.0.0",
    schemaVersion: input.schemaVersion ?? "1.0.0",
    timestamp: input.timestamp ?? new Date().toISOString(),
    operation: input.operation,
    requestId: input.requestId,
    transport: input.transport ?? "sdk",
    strict: input.strict ?? true,
    mvi: resolveMviLevel(input.mvi),
    contextVersion: input.contextVersion ?? 0,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.warnings ? { warnings: input.warnings } : {}),
  };
}

function normalizeError(error: CreateEnvelopeErrorInput["error"]): LAFSError {
  return {
    code: error.code,
    message: error.message,
    category: (error.category ?? "INTERNAL") as LAFSErrorCategory,
    retryable: error.retryable ?? false,
    retryAfterMs: error.retryAfterMs ?? null,
    details: error.details ?? {},
  };
}

export function createEnvelope(input: CreateEnvelopeInput): LAFSEnvelope {
  const meta = createMeta(input.meta);

  if (input.success) {
    return {
      $schema: LAFS_SCHEMA_URL,
      _meta: meta,
      success: true,
      result: input.result,
      ...(input.page !== undefined ? { page: input.page } : {}),
      ...(input.error !== undefined ? { error: null } : {}),
      ...(input._extensions !== undefined ? { _extensions: input._extensions } : {}),
    };
  }

  return {
    $schema: LAFS_SCHEMA_URL,
    _meta: meta,
    success: false,
    result: null,
    error: normalizeError(input.error),
    ...(input.page !== undefined ? { page: input.page } : {}),
    ...(input._extensions !== undefined ? { _extensions: input._extensions } : {}),
  };
}

export class LafsError extends Error implements LAFSError {
  code: string;
  category: LAFSErrorCategory;
  retryable: boolean;
  retryAfterMs: number | null;
  details: Record<string, unknown>;
  registered: boolean;

  constructor(error: LAFSError) {
    super(error.message);
    this.name = "LafsError";
    this.code = error.code;
    this.category = error.category;
    this.retryable = error.retryable;
    this.retryAfterMs = error.retryAfterMs;
    this.details = error.details;
    this.registered = isRegisteredErrorCode(error.code);
  }
}

export interface ParseLafsResponseOptions {
  requireRegisteredErrorCode?: boolean;
}

export function parseLafsResponse<T = unknown>(
  input: unknown,
  options: ParseLafsResponseOptions = {},
): T {
  const envelope = assertEnvelope(input);
  if (envelope.success) {
    return envelope.result as T;
  }

  const error = envelope.error;
  if (!error) {
    throw new Error("Invalid LAFS envelope: success=false requires error object");
  }

  if (options.requireRegisteredErrorCode && !isRegisteredErrorCode(error.code)) {
    throw new Error(`Unregistered LAFS error code: ${error.code}`);
  }

  throw new LafsError(error);
}
