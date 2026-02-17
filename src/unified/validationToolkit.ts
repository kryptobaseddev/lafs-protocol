/**
 * LAFS Unified Toolkit - Validation Toolkit
 * 
 * Addresses Context7 Gap: "Extend validation toolkit with custom types"
 * Target Score: 58/100 → 90/100
 */

import { 
  EnvelopeSchema, 
  ValidationResult, 
  ValidationError,
  SchemaValidator 
} from './envelopeBuilder.js';

export interface CustomValidator {
  name: string;
  validate(envelope: EnvelopeSchema): ValidationResult;
}

export interface ExtensionPoint {
  field: string;
  validator: (value: unknown) => ValidationError | null;
}

export interface ValidationConfig {
  customValidators?: boolean;
  extensions?: ExtensionPoint[];
  strict?: boolean;
  allowUnknownFields?: boolean;
}

/**
 * PriorityValidator - Validates x-custom-priority extension
 */
export class PriorityValidator implements CustomValidator {
  name = 'priority';

  validate(envelope: EnvelopeSchema): ValidationResult {
    const priority = envelope._extensions?.['x-custom-priority'];
    
    if (priority === undefined) {
      return { valid: true, errors: [] };
    }

    const validPriorities = ['low', 'medium', 'high'];
    
    if (!validPriorities.includes(priority as string)) {
      return {
        valid: false,
        errors: [{
          field: '_extensions.x-custom-priority',
          message: `Priority must be one of: ${validPriorities.join(', ')}, got: ${priority}`
        }]
      };
    }

    return { valid: true, errors: [] };
  }
}

/**
 * TagsValidator - Validates x-custom-tags extension
 */
export class TagsValidator implements CustomValidator {
  name = 'tags';

  validate(envelope: EnvelopeSchema): ValidationResult {
    const tags = envelope._extensions?.['x-custom-tags'];
    
    if (tags === undefined) {
      return { valid: true, errors: [] };
    }

    if (!Array.isArray(tags)) {
      return {
        valid: false,
        errors: [{
          field: '_extensions.x-custom-tags',
          message: `Tags must be an array, got: ${typeof tags}`
        }]
      };
    }

    const errors: ValidationError[] = [];
    
    tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        errors.push({
          field: `_extensions.x-custom-tags[${index}]`,
          message: `Tag must be a string, got: ${typeof tag}`
        });
      }
    });

    return { valid: errors.length === 0, errors };
  }
}

/**
 * ValidationToolkit - Extensible validation with custom validators
 * 
 * Usage:
 * ```typescript
 * const toolkit = new ValidationToolkit();
 * 
 * // Register custom validators
 * toolkit.registerValidator(new PriorityValidator());
 * toolkit.registerValidator(new TagsValidator());
 * 
 * // Validate with custom extensions
 * const result = toolkit.validate(envelope, {
 *   customValidators: true,
 *   strict: true
 * });
 * ```
 */
export class ValidationToolkit {
  private baseValidator: SchemaValidator;
  private customValidators: CustomValidator[] = [];
  private extensionPoints: ExtensionPoint[] = [];

  constructor(baseSchema?: Record<string, unknown>) {
    this.baseValidator = new SchemaValidator(baseSchema || {});
  }

  /**
   * Register a custom validator
   */
  registerValidator(validator: CustomValidator): void {
    this.customValidators.push(validator);
  }

  /**
   * Register an extension point
   */
  registerExtension(point: ExtensionPoint): void {
    this.extensionPoints.push(point);
  }

  /**
   * Validate envelope with all registered validators
   */
  validate(envelope: EnvelopeSchema, config?: ValidationConfig): ValidationResult {
    const errors: ValidationError[] = [];

    // 1. Base LAFS validation
    const baseResult = this.baseValidator.validate(envelope);
    if (!baseResult.valid) {
      errors.push(...baseResult.errors);
    }

    // 2. Custom validators (if enabled)
    if (config?.customValidators !== false) {
      for (const validator of this.customValidators) {
        const result = validator.validate(envelope);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
    }

    // 3. Extension points
    for (const point of this.extensionPoints) {
      const value = this.getNestedValue(envelope, point.field);
      const error = point.validator(value);
      if (error) {
        errors.push(error);
      }
    }

    // 4. Strict mode - check for unknown fields
    if (config?.strict && !config?.allowUnknownFields) {
      const unknownErrors = this.checkUnknownFields(envelope);
      errors.push(...unknownErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get a nested value from envelope using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  /**
   * Check for unknown fields in envelope
   */
  private checkUnknownFields(envelope: EnvelopeSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    const knownFields = [
      '$schema', '_meta', 'success', 'result', 'error', 'page', '_extensions'
    ];

    Object.keys(envelope).forEach(key => {
      if (!knownFields.includes(key)) {
        errors.push({
          field: key,
          message: `Unknown field: ${key}. Use _extensions for custom fields.`
        });
      }
    });

    return errors;
  }

  /**
   * Create a custom validator from a function
   */
  static createValidator(
    name: string,
    validateFn: (envelope: EnvelopeSchema) => ValidationResult
  ): CustomValidator {
    return { name, validate: validateFn };
  }

  /**
   * Create an extension point from a schema
   */
  static createExtensionPoint(
    field: string,
    schema: { type: string; required?: boolean }
  ): ExtensionPoint {
    return {
      field,
      validator: (value: unknown): ValidationError | null => {
        if (value === undefined && schema.required) {
          return {
            field,
            message: `Required field ${field} is missing`
          };
        }

        if (value !== undefined && typeof value !== schema.type) {
          return {
            field,
            message: `Field ${field} must be ${schema.type}, got: ${typeof value}`
          };
        }

        return null;
      }
    };
  }
}

/**
 * Pre-built validators for common patterns
 */
export const BuiltInValidators = {
  /**
   * Validate that operation follows naming convention
   */
  operationName: ValidationToolkit.createValidator('operationName', (envelope) => {
    const operation = envelope._meta.operation;
    const pattern = /^[a-z]+(\.[a-z]+)+$/;
    
    if (!pattern.test(operation)) {
      return {
        valid: false,
        errors: [{
          field: '_meta.operation',
          message: `Operation must follow pattern domain.action (e.g., 'users.create'), got: ${operation}`
        }]
      };
    }
    
    return { valid: true, errors: [] };
  }),

  /**
   * Validate that timestamp is recent (not in future or too old)
   */
  timestampFreshness: ValidationToolkit.createValidator('timestampFreshness', (envelope) => {
    const timestamp = new Date(envelope._meta.timestamp);
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (timestamp > now) {
      return {
        valid: false,
        errors: [{
          field: '_meta.timestamp',
          message: 'Timestamp is in the future'
        }]
      };
    }
    
    if (now.getTime() - timestamp.getTime() > maxAge) {
      return {
        valid: false,
        errors: [{
          field: '_meta.timestamp',
          message: 'Timestamp is older than 24 hours'
        }]
      };
    }
    
    return { valid: true, errors: [] };
  }),

  /**
   * Validate token budget constraints
   */
  tokenBudget: ValidationToolkit.createValidator('tokenBudget', (envelope) => {
    const estimate = envelope._meta._tokenEstimate;
    
    if (!estimate) {
      return { valid: true, errors: [] };
    }

    if (estimate.budget && estimate.estimated > estimate.budget) {
      return {
        valid: false,
        errors: [{
          field: '_meta._tokenEstimate',
          message: `Estimated tokens (${estimate.estimated}) exceed budget (${estimate.budget})`
        }]
      };
    }

    return { valid: true, errors: [] };
  })
};

// Example usage in documentation
/**
 * @example
 * ```typescript
 * import { 
 *   ValidationToolkit, 
 *   PriorityValidator, 
 *   TagsValidator,
 *   BuiltInValidators 
 * } from '@lafs/unified-toolkit';
 * import { LAFSEnvelopeBuilder } from './envelopeBuilder';
 * 
 * // Create toolkit with base schema
 * const toolkit = new ValidationToolkit(envelopeSchema);
 * 
 * // Register built-in validators
 * toolkit.registerValidator(BuiltInValidators.operationName);
 * toolkit.registerValidator(BuiltInValidators.tokenBudget);
 * 
 * // Register custom validators
 * toolkit.registerValidator(new PriorityValidator());
 * toolkit.registerValidator(new TagsValidator());
 * 
 * // Register extension points
 * toolkit.registerExtension(
 *   ValidationToolkit.createExtensionPoint('result.id', { type: 'string', required: true })
 * );
 * 
 * // Create envelope with extensions
 * const envelope = new LAFSEnvelopeBuilder()
 *   .withMeta({ operation: 'users.create' })
 *   .withSuccess({ id: '123', name: 'Alice' })
 *   .withExtension('x-custom-priority', 'high')
 *   .withExtension('x-custom-tags', ['user', 'premium'])
 *   .build();
 * 
 * // Validate
 * const result = toolkit.validate(envelope, { 
 *   customValidators: true,
 *   strict: true 
 * });
 * 
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * 
 * // Create custom validator inline
 * const customValidator = ValidationToolkit.createValidator('myValidator', (env) => {
 *   if (env._meta.mvi === 'full' && !env._meta._tokenEstimate) {
 *     return {
 *       valid: false,
 *       errors: [{ field: '_meta._tokenEstimate', message: 'Token estimate required for full MVI' }]
 *     };
 *   }
 *   return { valid: true, errors: [] };
 * });
 * 
 * toolkit.registerValidator(customValidator);
 * ```
 */
