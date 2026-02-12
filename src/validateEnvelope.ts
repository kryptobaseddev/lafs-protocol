import { createRequire } from "node:module";
import envelopeSchema from "../schemas/v1/envelope.schema.json" with { type: "json" };
import type { LAFSEnvelope } from "./types.js";

const require = createRequire(import.meta.url);
const AjvModule = require("ajv") as { default?: new (opts: object) => unknown } | (new (opts: object) => unknown);
const AddFormatsModule = require("ajv-formats") as { default?: (ajv: unknown) => void } | ((ajv: unknown) => void);

const AjvCtor = (typeof AjvModule === "function" ? AjvModule : AjvModule.default) as new (opts: object) => {
  compile: (schema: unknown) => {
    (input: unknown): boolean;
    errors?: Array<{ instancePath?: string; message?: string }>;
  };
};

const addFormats = (typeof AddFormatsModule === "function" ? AddFormatsModule : AddFormatsModule.default) as (ajv: unknown) => void;

const ajv = new AjvCtor({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);

const validate = ajv.compile(envelopeSchema);

export interface EnvelopeValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateEnvelope(input: unknown): EnvelopeValidationResult {
  const valid = validate(input);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validate.errors ?? []).map((error: { instancePath?: string; message?: string }) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "validation error"}`.trim();
  });

  return { valid: false, errors };
}

export function assertEnvelope(input: unknown): LAFSEnvelope {
  const result = validateEnvelope(input);
  if (!result.valid) {
    throw new Error(`Invalid LAFS envelope: ${result.errors.join("; ")}`);
  }
  return input as LAFSEnvelope;
}
