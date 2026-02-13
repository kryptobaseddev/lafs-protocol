import { isRegisteredErrorCode } from "./errorRegistry.js";
import { resolveOutputFormat, LAFSFlagError } from "./flagSemantics.js";
import type { ConformanceReport, FlagInput } from "./types.js";
import { validateEnvelope } from "./validateEnvelope.js";

function pushCheck(
  checks: ConformanceReport["checks"],
  name: string,
  pass: boolean,
  detail?: string,
) {
  checks.push({ name, pass, ...(detail ? { detail } : {}) });
}

export function runEnvelopeConformance(envelope: unknown): ConformanceReport {
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
    _meta: { mvi: string; strict: boolean };
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

  // error_code_registered: only checked when error is present
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
      "error field absent or null — skipped",
    );
  }

  const validMviLevels = ["minimal", "standard", "full", "custom"];
  pushCheck(
    checks,
    "meta_mvi_present",
    validMviLevels.includes(typed._meta.mvi),
    validMviLevels.includes(typed._meta.mvi) ? undefined : `invalid mvi level: ${String(typed._meta.mvi)}`,
  );
  pushCheck(checks, "meta_strict_present", typeof typed._meta.strict === "boolean");

  return { ok: checks.every((check) => check.pass), checks };
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
