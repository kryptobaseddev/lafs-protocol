import { getTransportMapping, isRegisteredErrorCode } from "./errorRegistry.js";
import { resolveOutputFormat, LAFSFlagError } from "./flagSemantics.js";
import type { ConformanceReport, FlagInput } from "./types.js";
import { getChecksForTier, type ConformanceTier } from "./conformanceProfiles.js";
import { validateEnvelope } from "./validateEnvelope.js";

function pushCheck(
  checks: ConformanceReport["checks"],
  name: string,
  pass: boolean,
  detail?: string,
) {
  checks.push({ name, pass, ...(detail ? { detail } : {}) });
}

export interface EnvelopeConformanceOptions {
  tier?: ConformanceTier;
}

export function runEnvelopeConformance(
  envelope: unknown,
  options: EnvelopeConformanceOptions = {},
): ConformanceReport {
  const checks: ConformanceReport["checks"] = [];

  const validation = validateEnvelope(envelope);
  pushCheck(
    checks,
    "envelope_schema_valid",
    validation.valid,
    validation.valid ? undefined : validation.errors.join("; "),
  );

  if (!validation.valid) {
    return { ok: false, checks };
  }

  const typed = envelope as {
    success: boolean;
    result: unknown;
    error?: null | { code: string };
    page?: unknown;
    _extensions?: Record<string, unknown>;
    _meta: {
      mvi: string;
      strict: boolean;
      warnings?: unknown[];
      operation: string;
      contextVersion: number;
      sessionId?: string;
      transport: "http" | "grpc" | "cli" | "sdk";
    };
  };

  // envelope_invariants: success=true allows error to be null OR omitted;
  // success=false requires error to be a non-null object and result===null.
  const invariant = typed.success
    ? typed.error == null  // null or undefined (omitted) both valid for success
    : typed.result === null && typed.error != null;
  pushCheck(
    checks,
    "envelope_invariants",
    invariant,
    invariant
      ? undefined
      : typed.success
        ? "success=true but error is present and non-null"
        : "success=false requires result===null and error to be a non-null object",
  );

  // error_code_registered: only checked when error is present (error is optional when success=true)
  if (typed.error) {
    const registered = isRegisteredErrorCode(typed.error.code);
    pushCheck(
      checks,
      "error_code_registered",
      registered,
      registered ? undefined : `unregistered code: ${typed.error.code}`,
    );
  } else {
    pushCheck(
      checks,
      "error_code_registered",
      true,
      "error field absent or null — skipped (optional when success=true)",
    );
  }

  // transport_mapping_consistent: when an error is present, ensure the code has
  // a transport-specific mapping in the registry for the declared transport.
  if (typed.error) {
    if (typed._meta.transport === "sdk") {
      pushCheck(
        checks,
        "transport_mapping_consistent",
        true,
        "sdk transport does not require external status-code mapping",
      );
    } else {
      const mapping = getTransportMapping(typed.error.code, typed._meta.transport);
      const mappingOk = mapping !== null;
      pushCheck(
        checks,
        "transport_mapping_consistent",
        mappingOk,
        mappingOk
          ? undefined
          : `no ${typed._meta.transport} mapping found for code ${typed.error.code}`,
      );
    }
  } else {
    pushCheck(
      checks,
      "transport_mapping_consistent",
      true,
      "no error present — mapping check skipped",
    );
  }

  // context_mutation_failure: if the producer marks context as required for a
  // mutation operation, missing context must fail with a context error code.
  {
    const ext = (typed._extensions ?? {}) as Record<string, unknown>;
    const contextObj = (ext["context"] ?? {}) as Record<string, unknown>;
    const lafsObj = (ext["lafs"] ?? {}) as Record<string, unknown>;
    const contextRequired =
      ext["lafsContextRequired"] === true ||
      contextObj["required"] === true ||
      lafsObj["contextRequired"] === true;

    if (!contextRequired) {
      pushCheck(
        checks,
        "context_mutation_failure",
        true,
        "context not marked required — skipped",
      );
    } else {
      const hasContextIdentity = typed._meta.contextVersion > 0 || Boolean(typed._meta.sessionId);

      if (typed.success) {
        const pass = hasContextIdentity;
        pushCheck(
          checks,
          "context_mutation_failure",
          pass,
          pass ? undefined : "context required but missing identity (expect E_CONTEXT_MISSING)",
        );
      } else {
        const code = typed.error?.code;
        const pass = code === "E_CONTEXT_MISSING" || code === "E_CONTEXT_STALE";
        pushCheck(
          checks,
          "context_mutation_failure",
          pass,
          pass
            ? undefined
            : `context required failures should return E_CONTEXT_MISSING or E_CONTEXT_STALE, got ${String(code)}`,
        );
      }
    }
  }

  const validMviLevels = ["minimal", "standard", "full", "custom"];
  pushCheck(
    checks,
    "meta_mvi_present",
    validMviLevels.includes(typed._meta.mvi),
    validMviLevels.includes(typed._meta.mvi) ? undefined : `invalid mvi level: ${String(typed._meta.mvi)}`,
  );
  pushCheck(checks, "meta_strict_present", typeof typed._meta.strict === "boolean");

  // strict_mode_behavior: when strict=true, the envelope MUST NOT contain
  // explicit null for optional fields that can be omitted (page, error on success).
  if (typed._meta.strict) {
    const obj = envelope as Record<string, unknown>;
    const hasExplicitNullError = typed.success && "error" in obj && obj["error"] === null;
    const hasExplicitNullPage = "page" in obj && obj["page"] === null;
    const strictClean = !hasExplicitNullError && !hasExplicitNullPage;
    pushCheck(
      checks,
      "strict_mode_behavior",
      strictClean,
      strictClean
        ? undefined
        : "strict mode: optional fields should be omitted rather than set to null",
    );
  }

  // pagination_mode_consistent: when page is present and is an object, verify
  // that the fields present match the declared pagination mode.
  if (typed.page && typeof typed.page === "object") {
    const page = typed.page as Record<string, unknown>;
    const mode = page["mode"] as string | undefined;
    let consistent = true;
    let detail: string | undefined;

    if (mode === "cursor") {
      if (page["offset"] !== undefined) {
        consistent = false;
        detail = "cursor mode should not include offset field";
      }
    } else if (mode === "offset") {
      if (page["nextCursor"] !== undefined) {
        consistent = false;
        detail = "offset mode should not include nextCursor field";
      }
    } else if (mode === "none") {
      const extraFields = Object.keys(page).filter((k) => k !== "mode");
      if (extraFields.length > 0) {
        consistent = false;
        detail = `none mode should only have mode field, found: ${extraFields.join(", ")}`;
      }
    }

    pushCheck(
      checks,
      "pagination_mode_consistent",
      consistent,
      consistent ? undefined : detail,
    );
  } else {
    pushCheck(
      checks,
      "pagination_mode_consistent",
      true,
      "page absent — skipped",
    );
  }

  // strict_mode_enforced: verify the schema enforces additional-property rules.
  // When strict=true, extra top-level properties must be rejected by validation.
  // When strict=false, extra top-level properties must be allowed.
  {
    const extraPropEnvelope = { ...(envelope as Record<string, unknown>), _unknown_extra: true };
    const extraResult = validateEnvelope(extraPropEnvelope);
    if (typed._meta.strict) {
      pushCheck(
        checks,
        "strict_mode_enforced",
        !extraResult.valid,
        extraResult.valid ? "strict=true but additional properties were accepted" : undefined,
      );
    } else {
      pushCheck(
        checks,
        "strict_mode_enforced",
        extraResult.valid,
        !extraResult.valid ? "strict=false but additional properties were rejected" : undefined,
      );
    }
  }

  const tier = options.tier;
  if (!tier) {
    return { ok: checks.every((check) => check.pass), checks };
  }

  const allowed = new Set(getChecksForTier(tier));
  const tierChecks = checks.filter((check) => allowed.has(check.name));
  return { ok: tierChecks.every((check) => check.pass), checks: tierChecks };
}

export function runFlagConformance(flags: FlagInput): ConformanceReport {
  const checks: ConformanceReport["checks"] = [];

  try {
    const resolved = resolveOutputFormat(flags);
    pushCheck(checks, "flag_conflict_rejected", !(flags.humanFlag && flags.jsonFlag));

    // Protocol-default check: when nothing is specified (source === "default"),
    // the protocol requires JSON as the default format.
    const isProtocolDefault = resolved.source === "default";
    pushCheck(
      checks,
      "json_protocol_default",
      !isProtocolDefault || resolved.format === "json",
      isProtocolDefault && resolved.format !== "json"
        ? `protocol default should be json, got ${resolved.format}`
        : undefined,
    );

    // Config-override check: when a project or user default is active,
    // the resolved format must match the config-provided value.
    const hasConfigOverride = resolved.source === "project" || resolved.source === "user";
    const expectedOverride =
      resolved.source === "project" ? flags.projectDefault : flags.userDefault;
    pushCheck(
      checks,
      "config_override_respected",
      !hasConfigOverride || resolved.format === expectedOverride,
      hasConfigOverride && resolved.format !== expectedOverride
        ? `config override expected ${String(expectedOverride)}, got ${resolved.format}`
        : undefined,
    );
  } catch (error) {
    if (error instanceof LAFSFlagError && error.code === "E_FORMAT_CONFLICT") {
      pushCheck(checks, "flag_conflict_rejected", true);
      return { ok: checks.every((check) => check.pass), checks };
    }
    pushCheck(checks, "flag_resolution", false, error instanceof Error ? error.message : String(error));
    return { ok: false, checks };
  }

  return { ok: checks.every((check) => check.pass), checks };
}
