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

export interface Warning {
  code: string;
  message: string;
  deprecated?: string;
  replacement?: string;
  removeBy?: string;
}

export interface LAFSMeta {
  specVersion: string;
  schemaVersion: string;
  timestamp: string;
  operation: string;
  requestId: string;
  transport: LAFSTransport;
  strict: boolean;
  mvi: 'minimal' | 'standard' | 'full' | 'custom';
  contextVersion: number;
  warnings?: Warning[];
}

export interface LAFSError {
  code: string;
  message: string;
  category: LAFSErrorCategory;
  retryable: boolean;
  retryAfterMs: number | null;
  details: Record<string, unknown>;
}

export interface LAFSPageCursor {
  mode: "cursor";
  nextCursor: string | null;
  hasMore: boolean;
  limit?: number;
  total?: number | null;
}

export interface LAFSPageOffset {
  mode: "offset";
  limit: number;
  offset: number;
  hasMore: boolean;
  total?: number | null;
}

export interface LAFSPageNone {
  mode: "none";
}

export type LAFSPage = LAFSPageCursor | LAFSPageOffset | LAFSPageNone;

export interface ContextLedgerEntry {
  entryId: string;
  timestamp: string;
  operation: string;
  contextDelta: Record<string, unknown>;
  requestId?: string;
}

export interface ContextLedger {
  ledgerId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  entries: ContextLedgerEntry[];
  checksum: string;
  maxEntries: number;
}

export interface LAFSEnvelope {
  $schema: "https://lafs.dev/schemas/v1/envelope.schema.json";
  _meta: LAFSMeta;
  success: boolean;
  result: Record<string, unknown> | Record<string, unknown>[] | null;
  error?: LAFSError | null;
  page?: LAFSPage | null;
  _extensions?: Record<string, unknown>;
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
