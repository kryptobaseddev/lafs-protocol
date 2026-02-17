/**
 * LAFS Agent Discovery - Express/Fastify Middleware
 * Serves discovery document at /.well-known/lafs.json
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createRequire } from "node:module";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handle ESM/CommonJS interop for AJV
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

/**
 * Capability definition for service advertisement
 */
export interface Capability {
  name: string;
  version: string;
  description?: string;
  operations: string[];
  optional?: boolean;
}

/**
 * Service configuration for discovery document
 */
export interface ServiceConfig {
  name: string;
  version: string;
  description?: string;
}

/**
 * Endpoint configuration for discovery document
 */
export interface EndpointConfig {
  envelope: string;
  context?: string;
  discovery: string;
}

/**
 * Complete discovery document served at /.well-known/lafs.json
 */
export interface DiscoveryDocument {
  $schema: string;
  lafs_version: string;
  service: ServiceConfig;
  capabilities: Capability[];
  endpoints: EndpointConfig;
}

/**
 * Configuration for the discovery middleware
 */
export interface DiscoveryConfig {
  /** Service information */
  service: ServiceConfig;
  /** List of capabilities this service provides */
  capabilities: Capability[];
  /** Endpoint URLs - can be relative paths or absolute URLs */
  endpoints: {
    /** URL for envelope submission endpoint */
    envelope: string;
    /** Optional URL for context ledger endpoint */
    context?: string;
    /** URL for this discovery document (usually auto-detected) */
    discovery?: string;
  };
  /** Cache duration in seconds (default: 3600) */
  cacheMaxAge?: number;
  /** LAFS protocol version (default: "1.0.0") */
  lafsVersion?: string;
  /** Schema URL override */
  schemaUrl?: string;
  /** Base URL for constructing absolute URLs */
  baseUrl?: string;
  /** Optional custom headers to include in response */
  headers?: Record<string, string>;
}

/**
 * Discovery middleware options
 */
export interface DiscoveryMiddlewareOptions {
  /** Path to serve discovery document (default: /.well-known/lafs.json) */
  path?: string;
  /** Enable HEAD requests (default: true) */
  enableHead?: boolean;
  /** Enable ETag caching (default: true) */
  enableEtag?: boolean;
}

// AJV instance and validator
type AjvInstance = InstanceType<typeof AjvCtor>;
let ajvInstance: AjvInstance | null = null;
let validateDiscovery: ReturnType<AjvInstance["compile"]> | null = null;

/**
 * Initialize AJV validator for discovery documents
 */
function initValidator(): void {
  if (ajvInstance && validateDiscovery) return;
  
  ajvInstance = new AjvCtor({ strict: true, allErrors: true });
  addFormats(ajvInstance);
  
  try {
    // Try to load schema from schemas directory
    const schemaPath = join(__dirname, "..", "..", "schemas", "v1", "discovery.schema.json");
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
    validateDiscovery = ajvInstance.compile(schema);
  } catch (e) {
    // Fallback to inline schema if file not found
    const fallbackSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      required: ["$schema", "lafs_version", "service", "capabilities", "endpoints"],
      properties: {
        $schema: { type: "string", format: "uri" },
        lafs_version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
        service: {
          type: "object",
          required: ["name", "version"],
          properties: {
            name: { type: "string", minLength: 1 },
            version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
            description: { type: "string" }
          }
        },
        capabilities: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "version", "operations"],
            properties: {
              name: { type: "string", minLength: 1 },
              version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
              description: { type: "string" },
              operations: { type: "array", items: { type: "string" } },
              optional: { type: "boolean" }
            }
          }
        },
        endpoints: {
          type: "object",
          required: ["envelope", "discovery"],
          properties: {
            envelope: { type: "string", minLength: 1 },
            context: { type: "string", minLength: 1 },
            discovery: { type: "string", minLength: 1 }
          }
        }
      }
    };
    validateDiscovery = ajvInstance.compile(fallbackSchema);
  }
}

/**
 * Build absolute URL from base and path
 */
function buildUrl(base: string | undefined, path: string, req?: Request): string {
  // If path is already absolute, return it
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  // If base is provided, use it
  if (base) {
    const separator = base.endsWith("/") || path.startsWith("/") ? "" : "/";
    return `${base}${separator}${path}`;
  }
  
  // Otherwise try to construct from request
  if (req) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers.host || "localhost";
    const separator = path.startsWith("/") ? "" : "/";
    return `${protocol}://${host}${separator}${path}`;
  }
  
  // Fallback to relative path
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Generate ETag from document content
 */
function generateETag(content: string): string {
  return `"${createHash("sha256").update(content).digest("hex").slice(0, 32)}"`;
}

/**
 * Build discovery document from configuration
 */
function buildDiscoveryDocument(
  config: DiscoveryConfig,
  req?: Request
): DiscoveryDocument {
  const schemaUrl = config.schemaUrl || "https://lafs.dev/schemas/v1/discovery.schema.json";
  const lafsVersion = config.lafsVersion || "1.0.0";
  
  return {
    $schema: schemaUrl,
    lafs_version: lafsVersion,
    service: config.service,
    capabilities: config.capabilities,
    endpoints: {
      envelope: buildUrl(config.baseUrl, config.endpoints.envelope, req),
      context: config.endpoints.context 
        ? buildUrl(config.baseUrl, config.endpoints.context, req)
        : undefined,
      discovery: config.endpoints.discovery 
        ? buildUrl(config.baseUrl, config.endpoints.discovery, req)
        : buildUrl(config.baseUrl, "/.well-known/lafs.json", req)
    }
  };
}

/**
 * Validate discovery document against schema
 */
function validateDocument(doc: DiscoveryDocument): void {
  initValidator();
  
  if (!validateDiscovery) {
    throw new Error("Discovery document validator not initialized");
  }
  
  const valid = validateDiscovery(doc);
  
  if (!valid) {
    const errors = validateDiscovery.errors;
    const errorMessages = errors?.map((e: { instancePath?: string; message?: string }) => 
      `${e.instancePath || "root"}: ${e.message}`
    ).join("; ");
    throw new Error(`Discovery document validation failed: ${errorMessages}`);
  }
}

/**
 * Create Express middleware for serving LAFS discovery document
 * 
 * @param config - Discovery configuration
 * @param options - Middleware options
 * @returns Express RequestHandler
 * 
 * @example
 * ```typescript
 * import express from "express";
 * import { discoveryMiddleware } from "./discovery.js";
 * 
 * const app = express();
 * 
 * app.use(discoveryMiddleware({
 *   service: {
 *     name: "my-lafs-service",
 *     version: "1.0.0",
 *     description: "A LAFS-compliant API service"
 *   },
 *   capabilities: [
 *     {
 *       name: "envelope-processor",
 *       version: "1.0.0",
 *       operations: ["process", "validate"],
 *       description: "Process LAFS envelopes"
 *     }
 *   ],
 *   endpoints: {
 *     envelope: "/api/v1/envelope",
 *     context: "/api/v1/context"
 *   }
 * }));
 * ```
 */
export function discoveryMiddleware(
  config: DiscoveryConfig,
  options: DiscoveryMiddlewareOptions = {}
): RequestHandler {
  const path = options.path || "/.well-known/lafs.json";
  const enableHead = options.enableHead !== false;
  const enableEtag = options.enableEtag !== false;
  const cacheMaxAge = config.cacheMaxAge || 3600;
  
  // Validate configuration
  if (!config.service?.name || !config.service?.version) {
    throw new Error("Discovery config requires service.name and service.version");
  }
  
  if (!Array.isArray(config.capabilities)) {
    throw new Error("Discovery config requires capabilities array");
  }
  
  if (!config.endpoints?.envelope) {
    throw new Error("Discovery config requires endpoints.envelope");
  }
  
  return function discoveryHandler(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Only handle requests to the discovery path
    if (req.path !== path) {
      next();
      return;
    }
    
    // Handle HEAD requests
    if (req.method === "HEAD") {
      if (!enableHead) {
        res.status(405).json({
          error: "Method Not Allowed",
          message: "HEAD requests are disabled for this endpoint"
        });
        return;
      }
      
      // For HEAD, we still need to build the document to get the ETag
      const doc = buildDiscoveryDocument(config, req);
      const json = JSON.stringify(doc);
      
      // Generate stable ETag from config hash (not request-dependent document)
      const configHash = generateETag(JSON.stringify({
        schemaUrl: config.schemaUrl,
        lafsVersion: config.lafsVersion,
        service: config.service,
        capabilities: config.capabilities,
        endpoints: config.endpoints,
        cacheMaxAge: config.cacheMaxAge
      }));
      const etag = enableEtag ? configHash : undefined;
      
      res.set({
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${cacheMaxAge}`,
        ...(etag && { "ETag": etag }),
        "Content-Length": Buffer.byteLength(json)
      });
      
      res.status(200).end();
      return;
    }
    
    // Only handle GET requests
    if (req.method !== "GET") {
      res.status(405).json({
        error: "Method Not Allowed",
        message: `Method ${req.method} not allowed. Use GET or HEAD.`
      });
      return;
    }
    
    try {
      // Build discovery document
      const doc = buildDiscoveryDocument(config, req);
      
      // Validate against schema
      validateDocument(doc);
      
      // Serialize document
      const json = JSON.stringify(doc);
      
      // Generate ETag from config hash (stable) rather than request-dependent document
      // This ensures ETag is consistent across requests even when URLs are constructed from request
      const configHash = generateETag(JSON.stringify({
        schemaUrl: config.schemaUrl,
        lafsVersion: config.lafsVersion,
        service: config.service,
        capabilities: config.capabilities,
        endpoints: config.endpoints,
        cacheMaxAge: config.cacheMaxAge
      }));
      const etag = enableEtag ? configHash : undefined;
      
      // Check If-None-Match for conditional request
      if (enableEtag && req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }
      
      // Set response headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${cacheMaxAge}`,
        ...config.headers
      };
      
      if (etag) {
        headers["ETag"] = etag;
      }
      
      res.set(headers);
      res.status(200).send(json);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Fastify plugin for LAFS discovery (for Fastify users)
 * 
 * @param fastify - Fastify instance
 * @param options - Plugin options
 */
export async function discoveryFastifyPlugin(
  fastify: unknown,
  options: { config: DiscoveryConfig; path?: string }
): Promise<void> {
  const path = options.path || "/.well-known/lafs.json";
  const config = options.config;
  const cacheMaxAge = config.cacheMaxAge || 3600;
  
  const handler = async (request: { raw?: Request }, reply: { header: (k: string, v: string) => void }) => {
    const doc = buildDiscoveryDocument(config, request.raw);
    validateDocument(doc);
    
    const json = JSON.stringify(doc);
    const etag = generateETag(json);
    
    reply.header("Content-Type", "application/json");
    reply.header("Cache-Control", `public, max-age=${cacheMaxAge}`);
    reply.header("ETag", etag);
    
    return doc;
  };
  
  // Note: Actual route registration depends on Fastify's API
  // This is a type-safe signature for the plugin
}

export default discoveryMiddleware;
