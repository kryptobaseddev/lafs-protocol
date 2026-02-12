export type LAFSTransport = "cli" | "http" | "grpc" | "sdk";

export type LAFSErrorCategory =
  | "VALIDATION"
  | "AUTH"
  | "PERMISSION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "TRANSIENT"
  | "INTERNAL"
  | "CONTRACT"
  | "MIGRATION";

export interface LAFSMeta {
  specVersion: string;
  schemaVersion: string;
  timestamp: string;
  operation: string;
  requestId: string;
  transport: LAFSTransport;
  strict: boolean;
  mvi: boolean;
  contextVersion: number;
}

export interface LAFSError {
  code: string;
  message: string;
  category: LAFSErrorCategory;
  retryable: boolean;
  retryAfterMs: number | null;
  details: Record<string, unknown>;
}

export interface LAFSPage {
  mode: "offset" | "cursor" | "none";
  limit: number;
  offset: number;
  nextCursor: string | null;
  hasMore: boolean;
  total: number | null;
}

export interface LAFSEnvelope {
  $schema: "https://lafs.dev/schemas/v1/envelope.schema.json";
  _meta: LAFSMeta;
  success: boolean;
  result: Record<string, unknown> | Record<string, unknown>[] | null;
  error: LAFSError | null;
  page: LAFSPage | null;
}

export interface FlagInput {
  requestedFormat?: "json" | "human";
  jsonFlag?: boolean;
  humanFlag?: boolean;
  projectDefault?: "json" | "human";
  userDefault?: "json" | "human";
}

export interface ConformanceReport {
  ok: boolean;
  checks: Array<{ name: string; pass: boolean; detail?: string }>;
}
