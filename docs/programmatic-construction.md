# Programmatic Construction Guide

**Version:** 1.1.0  
**Purpose:** Complete code examples for constructing LAFS envelopes programmatically with type safety

---

## Overview

This guide provides detailed code examples showing how to construct LAFS protocol-compliant messages programmatically, leveraging JSON schemas for type safety.

---

## TypeScript/JavaScript

### Basic Envelope Construction

```typescript
import { createEnvelope, validateEnvelope } from '@cleocode/lafs-protocol';
import type { EnvelopeSchema, MetaSchema, ErrorSchema } from '@cleocode/lafs-protocol';

// Construct a success envelope with full type safety
const successEnvelope = createEnvelope({
  success: true,
  result: {
    users: [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' }
    ],
    total: 2
  },
  meta: {
    operation: 'users.list',
    requestId: 'req_' + Date.now(),
    specVersion: '1.1.0',
    mvi: 'standard'
  }
});

// TypeScript ensures type safety at compile time
// This would cause a type error:
// const badEnvelope = createEnvelope({
//   success: true,
//   result: { users: [] },
//   meta: { 
//     operation: 123  // ❌ Error: operation must be string
//   }
// });
```

### Schema-Validated Construction

```typescript
import Ajv from 'ajv';
import envelopeSchema from './schemas/v1/envelope.schema.json';

// Load and compile schema for validation
const ajv = new Ajv({ strict: true });
const validate = ajv.compile<EnvelopeSchema>(envelopeSchema);

// Construct envelope programmatically
function createUserEnvelope(userData: unknown, requestId: string): EnvelopeSchema {
  const envelope: EnvelopeSchema = {
    $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
    _meta: {
      specVersion: '1.1.0',
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      operation: 'users.create',
      requestId,
      transport: 'http',
      strict: true,
      mvi: 'standard'
    },
    success: true,
    result: userData,
    error: null
  };

  // Validate against schema
  const valid = validate(envelope);
  if (!valid) {
    throw new Error(`Schema validation failed: ${ajv.errorsText(validate.errors)}`);
  }

  return envelope;
}

// Usage
const userEnvelope = createUserEnvelope(
  { id: '123', name: 'Alice' },
  'req_abc123'
);
```

### Error Envelope Construction

```typescript
import { ErrorCategory } from '@cleocode/lafs-protocol';

// Construct error envelope with proper error codes
function createErrorEnvelope(
  errorCode: string,
  message: string,
  category: ErrorCategory,
  requestId: string
): EnvelopeSchema {
  return {
    $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
    _meta: {
      specVersion: '1.1.0',
      operation: 'users.create',
      requestId,
      mvi: 'standard'
    },
    success: false,
    result: null,
    error: {
      code: errorCode,
      message,
      category,
      retryable: category === 'TRANSIENT' || category === 'RATE_LIMIT',
      details: {
        timestamp: new Date().toISOString()
      }
    }
  };
}

// Usage examples
const notFoundError = createErrorEnvelope(
  'E_NOT_FOUND_RESOURCE',
  'User with ID 123 not found',
  'NOT_FOUND',
  'req_456'
);

const validationError = createErrorEnvelope(
  'E_VALIDATION_SCHEMA',
  'Invalid email format',
  'VALIDATION',
  'req_789'
);
```

### E_FORMAT_CONFLICT Detection and Handling

```typescript
import { LAFSFlagError } from '@cleocode/lafs-protocol';

interface OutputFlags {
  human?: boolean;
  json?: boolean;
}

/**
 * Check for format conflicts and throw E_FORMAT_CONFLICT error
 * 
 * @throws {LAFSFlagError} When both --human and --json are specified
 */
function checkFormatConflict(flags: OutputFlags): void {
  if (flags.human && flags.json) {
    throw new LAFSFlagError(
      'E_FORMAT_CONFLICT',
      'Cannot use --human and --json flags simultaneously'
    );
  }
}

/**
 * Resolve output format with conflict detection
 */
function resolveOutputFormat(flags: OutputFlags): 'json' | 'human' {
  // Check for conflict first
  checkFormatConflict(flags);

  if (flags.human) return 'human';
  if (flags.json) return 'json';
  
  // Default to JSON
  return 'json';
}

// Usage in agent/command line tool
try {
  const format = resolveOutputFormat({ 
    human: process.argv.includes('--human'),
    json: process.argv.includes('--json')
  });
  
  console.log(`Output format: ${format}`);
} catch (error) {
  if (error instanceof LAFSFlagError && error.code === 'E_FORMAT_CONFLICT') {
    console.error('Error:', error.message);
    console.error('Please choose either --human OR --json, not both');
    process.exit(1);
  }
  throw error;
}
```

### Complete Agent Example

```typescript
import { 
  createEnvelope, 
  validateEnvelope, 
  LAFSFlagError 
} from '@cleocode/lafs-protocol';
import type { EnvelopeSchema } from '@cleocode/lafs-protocol';

class LAFSAgent {
  private requestId = 0;

  /**
   * Generate next request ID
   */
  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Execute operation and return LAFS envelope
   */
  async execute<T>(
    operation: string,
    fn: () => Promise<T>,
    options: {
      humanOutput?: boolean;
      jsonOutput?: boolean;
    } = {}
  ): Promise<EnvelopeSchema> {
    // Check for format conflict
    if (options.humanOutput && options.jsonOutput) {
      return this.createErrorEnvelope(
        'E_FORMAT_CONFLICT',
        'Cannot generate both JSON and human-readable output simultaneously',
        'VALIDATION',
        this.generateRequestId()
      );
    }

    const requestId = this.generateRequestId();

    try {
      const result = await fn();
      
      return createEnvelope({
        success: true,
        result,
        meta: {
          operation,
          requestId,
          mvi: options.humanOutput ? 'full' : 'standard'
        }
      });
    } catch (error) {
      return this.createErrorEnvelope(
        'E_INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        'INTERNAL',
        requestId
      );
    }
  }

  /**
   * Create error envelope
   */
  private createErrorEnvelope(
    code: string,
    message: string,
    category: string,
    requestId: string
  ): EnvelopeSchema {
    return {
      $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
      _meta: {
        specVersion: '1.1.0',
        operation: 'agent.execute',
        requestId,
        mvi: 'standard'
      },
      success: false,
      result: null,
      error: {
        code,
        message,
        category: category as any,
        retryable: false
      }
    };
  }
}

// Usage
const agent = new LAFSAgent();

// This will succeed
const result = await agent.execute(
  'users.list',
  async () => ({ users: [] }),
  { jsonOutput: true }
);

// This will return E_FORMAT_CONFLICT error
const conflictResult = await agent.execute(
  'users.list',
  async () => ({ users: [] }),
  { jsonOutput: true, humanOutput: true }
);
```

---

## Python

### Basic Envelope Construction

```python
from lafs_protocol import create_envelope, validate_envelope
from typing import Dict, Any, Optional
import json

def create_user_envelope(user_data: Dict[str, Any], request_id: str) -> Dict[str, Any]:
    """Construct a LAFS envelope for user creation"""
    envelope = {
        "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
        "_meta": {
            "specVersion": "1.1.0",
            "schemaVersion": "1.0.0",
            "timestamp": "2026-02-16T10:00:00Z",
            "operation": "users.create",
            "requestId": request_id,
            "transport": "http",
            "strict": True,
            "mvi": "standard"
        },
        "success": True,
        "result": user_data,
        "error": None
    }
    
    # Validate against schema
    result = validate_envelope(envelope)
    if not result.valid:
        raise ValueError(f"Validation failed: {result.errors}")
    
    return envelope

# Usage
user_envelope = create_user_envelope(
    {"id": "123", "name": "Alice"},
    "req_abc123"
)
```

### Error Envelope Construction

```python
from typing import Literal

ErrorCategory = Literal[
    "VALIDATION", "AUTH", "PERMISSION", "NOT_FOUND", 
    "CONFLICT", "RATE_LIMIT", "TRANSIENT", "INTERNAL"
]

def create_error_envelope(
    error_code: str,
    message: str,
    category: ErrorCategory,
    request_id: str,
    retryable: bool = None
) -> Dict[str, Any]:
    """Create error envelope with proper structure"""
    
    if retryable is None:
        retryable = category in ("TRANSIENT", "RATE_LIMIT")
    
    return {
        "$schema": "https://lafs.dev/schemas/v1/envelope.schema.json",
        "_meta": {
            "specVersion": "1.1.0",
            "operation": "operation.failed",
            "requestId": request_id,
            "mvi": "standard"
        },
        "success": False,
        "result": None,
        "error": {
            "code": error_code,
            "message": message,
            "category": category,
            "retryable": retryable,
            "details": {
                "timestamp": "2026-02-16T10:00:00Z"
            }
        }
    }

# Usage
not_found = create_error_envelope(
    "E_NOT_FOUND_RESOURCE",
    "User not found",
    "NOT_FOUND",
    "req_456"
)
```

### E_FORMAT_CONFLICT Detection

```python
class LAFSFlagError(Exception):
    """LAFS flag/option error"""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)

def check_format_conflict(human: bool = False, json: bool = False) -> None:
    """
    Check for format conflict and raise E_FORMAT_CONFLICT error
    
    Raises:
        LAFSFlagError: When both human and json are True
    """
    if human and json:
        raise LAFSFlagError(
            "E_FORMAT_CONFLICT",
            "Cannot use --human and --json flags simultaneously"
        )

def resolve_output_format(human: bool = False, json: bool = False) -> str:
    """Resolve output format with conflict detection"""
    check_format_conflict(human, json)
    
    if human:
        return "human"
    if json:
        return "json"
    
    return "json"  # Default

# Usage in CLI tool
import sys

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--human", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    
    try:
        format_type = resolve_output_format(args.human, args.json)
        print(f"Output format: {format_type}")
    except LAFSFlagError as e:
        if e.code == "E_FORMAT_CONFLICT":
            print(f"Error: {e.message}", file=sys.stderr)
            print("Please choose either --human OR --json, not both", file=sys.stderr)
            sys.exit(1)
        raise
```

---

## JSON Schema Loading

### Loading Schemas at Runtime

```typescript
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Ajv from 'ajv';

// Load schema from file
const envelopeSchema = JSON.parse(
  readFileSync(
    resolve(__dirname, '../schemas/v1/envelope.schema.json'),
    'utf-8'
  )
);

// Compile validator
const ajv = new Ajv({ 
  strict: true,
  allErrors: true 
});

const validateEnvelope = ajv.compile(envelopeSchema);

// Use in application
function processRequest(data: unknown): EnvelopeSchema {
  const valid = validateEnvelope(data);
  
  if (!valid) {
    const errors = validateEnvelope.errors?.map(e => 
      `${e.instancePath}: ${e.message}`
    ).join(', ');
    
    throw new Error(`Invalid envelope: ${errors}`);
  }
  
  return data as EnvelopeSchema;
}
```

### Schema Validation Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

function validateEnvelopeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const valid = validateEnvelope(req.body);
  
  if (!valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'E_VALIDATION_SCHEMA',
        message: 'Request body does not match LAFS envelope schema',
        category: 'VALIDATION',
        retryable: false,
        details: {
          errors: validateEnvelope.errors
        }
      }
    });
  }
  
  next();
}

// Apply to routes
app.post('/api/endpoint', validateEnvelopeMiddleware, handler);
```

---

## Common Patterns

### Builder Pattern

```typescript
class EnvelopeBuilder {
  private envelope: Partial<EnvelopeSchema> = {
    $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
    error: null
  };

  withMeta(meta: Partial<MetaSchema>) {
    this.envelope._meta = {
      specVersion: '1.1.0',
      schemaVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      transport: 'http',
      strict: true,
      mvi: 'standard',
      ...meta
    } as MetaSchema;
    return this;
  }

  withSuccess(result: unknown) {
    this.envelope.success = true;
    this.envelope.result = result;
    this.envelope.error = null;
    return this;
  }

  withError(error: ErrorSchema) {
    this.envelope.success = false;
    this.envelope.result = null;
    this.envelope.error = error;
    return this;
  }

  build(): EnvelopeSchema {
    if (!this.envelope._meta?.operation) {
      throw new Error('Operation is required');
    }
    if (this.envelope.success === undefined) {
      throw new Error('Success status is required');
    }
    return this.envelope as EnvelopeSchema;
  }
}

// Usage
const envelope = new EnvelopeBuilder()
  .withMeta({ 
    operation: 'users.create',
    requestId: 'req_123'
  })
  .withSuccess({ id: '123', name: 'Alice' })
  .build();
```

### Factory Pattern

```typescript
class EnvelopeFactory {
  private requestCounter = 0;

  createSuccess<T>(
    operation: string,
    result: T,
    options: {
      mvi?: 'minimal' | 'standard' | 'full';
      requestId?: string;
    } = {}
  ): EnvelopeSchema {
    return {
      $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
      _meta: {
        specVersion: '1.1.0',
        operation,
        requestId: options.requestId || this.generateRequestId(),
        mvi: options.mvi || 'standard'
      },
      success: true,
      result,
      error: null
    };
  }

  createError(
    operation: string,
    code: string,
    message: string,
    category: string,
    options: {
      retryable?: boolean;
      requestId?: string;
    } = {}
  ): EnvelopeSchema {
    return {
      $schema: 'https://lafs.dev/schemas/v1/envelope.schema.json',
      _meta: {
        specVersion: '1.1.0',
        operation,
        requestId: options.requestId || this.generateRequestId(),
        mvi: 'standard'
      },
      success: false,
      result: null,
      error: {
        code,
        message,
        category: category as any,
        retryable: options.retryable ?? false
      }
    };
  }

  private generateRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }
}

// Usage
const factory = new EnvelopeFactory();

const success = factory.createSuccess('users.list', { users: [] });
const error = factory.createError(
  'users.create',
  'E_VALIDATION_SCHEMA',
  'Invalid input',
  'VALIDATION'
);
```

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { createEnvelope, validateEnvelope } from '@cleocode/lafs-protocol';

describe('Envelope Construction', () => {
  it('should create valid success envelope', () => {
    const envelope = createEnvelope({
      success: true,
      result: { data: 'test' },
      meta: {
        operation: 'test',
        requestId: 'req_1'
      }
    });

    const validation = validateEnvelope(envelope);
    expect(validation.valid).toBe(true);
    expect(envelope.success).toBe(true);
    expect(envelope.result).toEqual({ data: 'test' });
  });

  it('should detect format conflict', () => {
    const flags = { human: true, json: true };
    
    expect(() => {
      checkFormatConflict(flags);
    }).toThrow('E_FORMAT_CONFLICT');
  });

  it('should allow single format flag', () => {
    expect(() => {
      checkFormatConflict({ human: true });
    }).not.toThrow();

    expect(() => {
      checkFormatConflict({ json: true });
    }).not.toThrow();
  });
});
```

---

*Programmatic Construction Guide v1.1.0*
