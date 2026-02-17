/**
 * LAFS Unified Toolkit - Output Formatter
 * 
 * Addresses Context7 Gap: "Configure human-readable output"
 * Target Score: 65/100 → 95/100
 */

import { EnvelopeSchema, MetaSchema, ErrorSchema, PageSchema } from './envelopeBuilder.js';

export type OutputFormat = 'json' | 'human-table' | 'human-compact' | 'human-detailed';

export interface FormatterConfig {
  format: OutputFormat;
  colors?: boolean;
  fields?: string[];
  indent?: number;
}

export interface FormatContext {
  flags?: {
    human?: boolean;
    json?: boolean;
  };
  config?: {
    defaultFormat?: OutputFormat;
  };
  env?: {
    LAFS_FORMAT?: string;
  };
}

/**
 * Resolve output format from flags, config, and defaults
 * 
 * Usage:
 * ```typescript
 * const format = resolveOutputFormat({
 *   flags: { human: true },
 *   config: { defaultFormat: 'json' }
 * });
 * // Returns: 'human-table'
 * ```
 */
export function resolveOutputFormat(context: FormatContext): OutputFormat {
  // Explicit flags take highest precedence
  if (context.flags?.human && context.flags?.json) {
    throw new Error('E_FORMAT_CONFLICT: Cannot use both --human and --json flags');
  }

  if (context.flags?.human) {
    return 'human-table';
  }

  if (context.flags?.json) {
    return 'json';
  }

  // Environment variable
  if (context.env?.LAFS_FORMAT) {
    const envFormat = context.env.LAFS_FORMAT as OutputFormat;
    if (['json', 'human-table', 'human-compact', 'human-detailed'].includes(envFormat)) {
      return envFormat;
    }
  }

  // Config default
  if (context.config?.defaultFormat) {
    return context.config.defaultFormat;
  }

  // Protocol default
  return 'json';
}

/**
 * OutputFormatter - Convert LAFS envelopes to human-readable formats
 * 
 * Usage:
 * ```typescript
 * const formatter = new OutputFormatter('human-table', { colors: true });
 * const output = formatter.format(envelope);
 * console.log(output);
 * ```
 */
export class OutputFormatter {
  private config: FormatterConfig;

  constructor(format: OutputFormat, options?: Partial<FormatterConfig>) {
    this.config = {
      format,
      colors: true,
      indent: 2,
      ...options
    };
  }

  /**
   * Format an envelope according to configuration
   */
  format(envelope: EnvelopeSchema): string {
    switch (this.config.format) {
      case 'json':
        return this.formatJson(envelope);
      case 'human-table':
        return this.formatTable(envelope);
      case 'human-compact':
        return this.formatCompact(envelope);
      case 'human-detailed':
        return this.formatDetailed(envelope);
      default:
        return this.formatJson(envelope);
    }
  }

  /**
   * JSON format (default)
   */
  private formatJson(envelope: EnvelopeSchema): string {
    return JSON.stringify(envelope, null, this.config.indent);
  }

  /**
   * Table format - key/value pairs
   */
  private formatTable(envelope: EnvelopeSchema): string {
    const lines: string[] = [];
    const meta = envelope._meta;

    // Header
    lines.push(this.formatHeader('LAFS Response'));
    lines.push('');

    // Metadata section
    lines.push(this.formatSection('Metadata'));
    lines.push(this.formatRow('Operation', meta.operation));
    lines.push(this.formatRow('Request ID', meta.requestId));
    lines.push(this.formatRow('Timestamp', meta.timestamp));
    lines.push(this.formatRow('Transport', meta.transport));
    lines.push(this.formatRow('Strict Mode', meta.strict ? 'Yes' : 'No'));
    lines.push(this.formatRow('MVI Level', meta.mvi));
    
    if (meta.contextVersion !== undefined) {
      lines.push(this.formatRow('Context Version', meta.contextVersion.toString()));
    }

    lines.push('');

    // Result section
    lines.push(this.formatSection('Result'));
    lines.push(this.formatRow('Success', envelope.success ? '✓ Yes' : '✗ No'));

    if (envelope._meta._tokenEstimate) {
      const est = envelope._meta._tokenEstimate;
      lines.push(this.formatRow('Token Estimate', `${est.estimated}${est.budget ? ` / ${est.budget}` : ''}`));
    }

    lines.push('');

    // Data section
    if (envelope.success && envelope.result) {
      lines.push(this.formatSection('Data'));
      lines.push(this.formatData(envelope.result));
    } else if (!envelope.success && envelope.error) {
      lines.push(this.formatSection('Error'));
      lines.push(this.formatError(envelope.error));
    }

    return lines.join('\n');
  }

  /**
   * Compact format - single line summary
   */
  private formatCompact(envelope: EnvelopeSchema): string {
    const meta = envelope._meta;
    const status = envelope.success ? '✓' : '✗';
    const operation = meta.operation;
    
    if (envelope.success) {
      const result = envelope.result ? JSON.stringify(envelope.result).substring(0, 50) + '...' : 'null';
      return `${status} ${operation}: ${result}`;
    } else {
      const errorCode = envelope.error?.code || 'Unknown';
      return `${status} ${operation}: ERROR ${errorCode}`;
    }
  }

  /**
   * Detailed format - full tree structure
   */
  private formatDetailed(envelope: EnvelopeSchema): string {
    const lines: string[] = [];
    
    lines.push(this.formatHeader('LAFS Envelope (Detailed)'));
    lines.push('');
    
    // Full envelope tree
    lines.push(this.formatTree(envelope, 0));
    
    return lines.join('\n');
  }

  /**
   * Format a header line
   */
  private formatHeader(text: string): string {
    const width = 50;
    const padding = Math.max(0, (width - text.length) / 2);
    const leftPad = '='.repeat(Math.floor(padding));
    const rightPad = '='.repeat(Math.ceil(padding));
    return `${leftPad} ${text} ${rightPad}`;
  }

  /**
   * Format a section header
   */
  private formatSection(name: string): string {
    return `[${name}]`;
  }

  /**
   * Format a key/value row
   */
  private formatRow(key: string, value: string): string {
    const keyWidth = 20;
    const paddedKey = key.padEnd(keyWidth, ' ');
    return `  ${paddedKey}: ${value}`;
  }

  /**
   * Format data section
   */
  private formatData(data: unknown): string {
    if (data === null || data === undefined) {
      return '  null';
    }
    
    const json = JSON.stringify(data, null, 2);
    return json.split('\n').map(line => '  ' + line).join('\n');
  }

  /**
   * Format error details
   */
  private formatError(error: ErrorSchema): string {
    const lines: string[] = [];
    lines.push(this.formatRow('Code', error.code));
    lines.push(this.formatRow('Message', error.message));
    lines.push(this.formatRow('Category', error.category));
    lines.push(this.formatRow('Retryable', error.retryable ? 'Yes' : 'No'));
    
    if (error.retryAfterMs) {
      lines.push(this.formatRow('Retry After', `${error.retryAfterMs}ms`));
    }
    
    if (error.details) {
      lines.push('');
      lines.push('  Details:');
      const detailsJson = JSON.stringify(error.details, null, 2);
      lines.push(detailsJson.split('\n').map(line => '    ' + line).join('\n'));
    }
    
    return lines.join('\n');
  }

  /**
   * Format object as tree
   */
  private formatTree(obj: unknown, depth: number): string {
    const indent = '  '.repeat(depth);
    
    if (obj === null || obj === undefined) {
      return `${indent}null`;
    }
    
    if (typeof obj !== 'object') {
      return `${indent}${JSON.stringify(obj)}`;
    }
    
    if (Array.isArray(obj)) {
      const lines: string[] = [];
      lines.push(`${indent}[`);
      obj.forEach((item, index) => {
        lines.push(`${indent}  [${index}]:`);
        lines.push(this.formatTree(item, depth + 2));
      });
      lines.push(`${indent}]`);
      return lines.join('\n');
    }
    
    const lines: string[] = [];
    lines.push(`${indent}{`);
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        lines.push(`${indent}  ${key}:`);
        lines.push(this.formatTree(value, depth + 2));
      } else {
        lines.push(`${indent}  ${key}: ${JSON.stringify(value)}`);
      }
    });
    
    lines.push(`${indent}}`);
    return lines.join('\n');
  }
}

/**
 * Convenience function for quick formatting
 */
export function formatEnvelope(
  envelope: EnvelopeSchema, 
  format: OutputFormat = 'json',
  options?: Partial<FormatterConfig>
): string {
  const formatter = new OutputFormatter(format, options);
  return formatter.format(envelope);
}

/**
 * Example usage in documentation
 * 
 * @example
 * ```typescript
 * import { createEnvelope, resolveOutputFormat, formatEnvelope } from '@lafs/unified-toolkit';
 * 
 * // Create envelope
 * const envelope = createEnvelope({
 *   operation: 'users.get',
 *   success: true,
 *   result: { user: { id: '123', name: 'Alice' } }
 * });
 * 
 * // Resolve format from CLI flags
 * const format = resolveOutputFormat({
 *   flags: { human: true },
 *   config: { defaultFormat: 'json' }
 * });
 * 
 * // Format output
 * const output = formatEnvelope(envelope, format, { colors: true });
 * console.log(output);
 * 
 * // Output (human-table):
 * // ==================================================
 * // LAFS Response
 * // 
 * // [Metadata]
 * //   Operation           : users.get
 * //   Request ID          : xxxx-xxxx-xxxx
 * //   Timestamp           : 2026-02-16T...
 * //   Transport           : http
 * //   Strict Mode         : Yes
 * //   MVI Level           : standard
 * //
 * // [Result]
 * //   Success             : ✓ Yes
 * //
 * // [Data]
 * //   {
 * //     "user": {
 * //       "id": "123",
 * //       "name": "Alice"
 * //     }
 * //   }
 * ```
 */
