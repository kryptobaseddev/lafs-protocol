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
    error: null | { code: string };
    _meta: { mvi: boolean; strict: boolean };
  };

  const invariant = typed.success ? typed.error === null : typed.result === null;
  pushCheck(
    checks,
    "envelope_invariants",
    invariant,
    invariant ? undefined : "success/result/error invariant violated",
  );

  if (typed.error) {
    const registered = isRegisteredErrorCode(typed.error.code);
    pushCheck(
      checks,
      "error_code_registered",
      registered,
      registered ? undefined : `unregistered code: ${typed.error.code}`,
    );
  } else {
    pushCheck(checks, "error_code_registered", true);
  }

  pushCheck(checks, "meta_mvi_present", typeof typed._meta.mvi === "boolean");
  pushCheck(checks, "meta_strict_present", typeof typed._meta.strict === "boolean");

  return { ok: checks.every((check) => check.pass), checks };
}

export function runFlagConformance(flags: FlagInput): ConformanceReport {
  const checks: ConformanceReport["checks"] = [];

  try {
    const resolved = resolveOutputFormat(flags);
    pushCheck(checks, "flag_conflict_rejected", !(flags.humanFlag && flags.jsonFlag));
    pushCheck(checks, "json_default_when_unspecified", resolved.format === "json" || Boolean(flags.projectDefault || flags.userDefault));
  } catch (error) {
    if (error instanceof LAFSFlagError && error.code === "E_FORMAT_CONFLICT") {
      pushCheck(checks, "flag_conflict_rejected", true);
      pushCheck(checks, "json_default_when_unspecified", true);
      return { ok: true, checks };
    }
    pushCheck(checks, "flag_resolution", false, error instanceof Error ? error.message : String(error));
    return { ok: false, checks };
  }

  return { ok: checks.every((check) => check.pass), checks };
}
