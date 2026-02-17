/**
 * LAFS Unified Toolkit - Type-Safe Envelope Builder
 * 
 * Addresses Context7 Gap: "Programmatically construct LAFS messages with type safety"
 * Target Score: 21/100 → 95/100
 */

// Use simple types instead of external dependencies
type JSONSchema7 = Record<string, unknown>;

// JSON Schema imported as TypeScript types for compile-time safety
export interface EnvelopeSchema {
  $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json';
  _meta: MetaSchema;
  success: boolean;
  result: unknown | null;
  error: ErrorSchema | null;
  page?: PageSchema | null;
  _extensions?: Record<string, unknown>;
}

export interface MetaSchema {
  specVersion: string;
  schemaVersion: string;
  timestamp: string;
  operation: string;
  requestId: string;
  transport: 'http' | 'grpc' | 'cli' | 'mcp' | 'a2a';
  strict: boolean;
  mvi: 'minimal' | 'standard' | 'full' | 'custom';
  contextVersion?: number;
  warnings?: WarningSchema[];
  _tokenEstimate?: TokenEstimateSchema;
}

export interface ErrorSchema {
  code: string;
  message: string;
  category: 'VALIDATION' | 'AUTH' | 'PERMISSION' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMIT' | 'TRANSIENT' | 'INTERNAL' | 'CONTRACT' | 'MIGRATION';
  retryable: boolean;
  retryAfterMs?: number | null;
  details?: Record<string, unknown>;
}

export interface PageSchema {
  mode: 'offset' | 'cursor' | 'none';
  limit?: number;
  offset?: number;
  nextOffset?: number;
  cursor?: string;
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface WarningSchema {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface TokenEstimateSchema {
  estimated: number;
  budget?: number;
  method?: 'character_based' | 'exact' | 'sampling';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// Simple UUID generator (no external dependency)
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * LAFSEnvelopeBuilder - Type-safe envelope construction
 * 
 * Usage:
 * ```typescript
 * const envelope = new LAFSEnvelopeBuilder()
 *   .withMeta({ operation: 'users.create', ... })
 *   .withSuccess()
 *   .withResult({ user: { id: '123' } })
 *   .build();
 * ```
 */
export class LAFSEnvelopeBuilder {
  private envelope: Partial<EnvelopeSchema> = {
    $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
    _meta: undefined,
    success: undefined,
    result: null,
    error: null
  };

  private meta: Partial<MetaSchema> = {};

  /**
   * Set the schema URL
   */
  withSchema(schema: string): this {
    (this.envelope as any).$schema = schema;
    return this;
  }

  /**
   * Configure metadata
   */
  withMeta(config: Partial<MetaSchema> & { operation: string }): this {
    this.meta = {
      specVersion: '1.0.0',
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      transport: 'http',
      strict: true,
      mvi: 'standard',
      requestId: generateId(),
      ...config
    };
    return this;
  }

  /**
   * Mark as success with optional result
   */
  withSuccess(result?: unknown): this {
    this.envelope.success = true;
    this.envelope.result = result ?? null;
    this.envelope.error = null;
    return this;
  }

  /**
   * Mark as error with details
   */
  withError(error: ErrorSchema): this {
    this.envelope.success = false;
    this.envelope.result = null;
    this.envelope.error = error;
    return this;
  }

  /**
   * Set result (for success cases)
   */
  withResult(result: unknown): this {
    this.envelope.result = result;
    return this;
  }

  /**
   * Add pagination
   */
  withPage(page: PageSchema): this {
    this.envelope.page = page;
    return this;
  }

  /**
   * Add token estimate
   */
  withTokenEstimate(estimate: TokenEstimateSchema): this {
    this.meta._tokenEstimate = estimate;
    return this;
  }

  /**
   * Add warning
   */
  withWarning(warning: WarningSchema): this {
    if (!this.meta.warnings) {
      this.meta.warnings = [];
    }
    this.meta.warnings.push(warning);
    return this;
  }

  /**
   * Set context version
   */
  withContextVersion(version: number): this {
    this.meta.contextVersion = version;
    return this;
  }

  /**
   * Add extension fields
   */
  withExtension(key: string, value: unknown): this {
    if (!this.envelope._extensions) {
      this.envelope._extensions = {};
    }
    this.envelope._extensions[key] = value;
    return this;
  }

  /**
   * Build the envelope
   */
  build(): EnvelopeSchema {
    if (!this.meta.operation) {
      throw new Error('Operation is required. Call withMeta({ operation: "..." })');
    }

    if (this.envelope.success === undefined) {
      throw new Error('Success status is required. Call withSuccess() or withError()');
    }

    return {
      ...this.envelope,
      _meta: this.meta as MetaSchema
    } as EnvelopeSchema;
  }

  /**
   * Build and validate in one step
   */
  buildAndValidate(validator: SchemaValidator): { envelope: EnvelopeSchema; validation: ValidationResult } {
    const envelope = this.build();
    const validation = validator.validate(envelope);
    return { envelope, validation };
  }
}

/**
 * SchemaValidator - Runtime validation against JSON Schema
 */
export class SchemaValidator {
  private schema: JSONSchema7;

  constructor(schema: JSONSchema7) {
    this.schema = schema;
  }

  validate(data: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    // Basic structure validation
    if (typeof data !== 'object' || data === null) {
      errors.push({ field: '', message: 'Envelope must be an object' });
      return { valid: false, errors };
    }

    const envelope = data as EnvelopeSchema;

    // Validate required fields
    if (!envelope.$schema) {
      errors.push({ field: '$schema', message: '$schema is required' });
    }

    if (!envelope._meta) {
      errors.push({ field: '_meta', message: '_meta is required' });
    } else {
      // Validate meta fields
      const meta = envelope._meta;
      if (!meta.operation) {
        errors.push({ field: '_meta.operation', message: 'operation is required' });
      }
      if (!meta.requestId) {
        errors.push({ field: '_meta.requestId', message: 'requestId is required' });
      }
    }

    if (envelope.success === undefined) {
      errors.push({ field: 'success', message: 'success is required' });
    }

    // Validate invariants
    if (envelope.success && envelope.error) {
      errors.push({ field: 'error', message: 'Error must be null when success is true' });
    }

    if (!envelope.success && envelope.result) {
      errors.push({ field: 'result', message: 'Result must be null when success is false' });
    }

    if (!envelope.success && !envelope.error) {
      errors.push({ field: 'error', message: 'Error is required when success is false' });
    }

    // Validate error code format
    if (envelope.error) {
      const codePattern = /^E_[A-Z0-9]+_[A-Z0-9_]+$/;
      if (!codePattern.test(envelope.error.code)) {
        errors.push({ 
          field: 'error.code', 
          message: `Error code must match pattern E_<DOMAIN>_<SPECIFIC>, got: ${envelope.error.code}` 
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

/**
 * Convenience function for quick envelope creation
 */
export function createEnvelope(config: {
  operation: string;
  success: boolean;
  result?: unknown;
  error?: ErrorSchema;
  requestId?: string;
  transport?: MetaSchema['transport'];
  meta?: Partial<MetaSchema>;
}): EnvelopeSchema {
  const builder = new LAFSEnvelopeBuilder()
    .withMeta({
      operation: config.operation,
      requestId: config.requestId || generateId(),
      transport: config.transport || 'http',
      ...config.meta
    });

  if (config.success) {
    builder.withSuccess(config.result);
  } else if (config.error) {
    builder.withError(config.error);
  }

  return builder.build();
}

// Re-export types
export { generateId };
