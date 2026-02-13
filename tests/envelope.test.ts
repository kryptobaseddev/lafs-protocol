import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isRegisteredErrorCode, runEnvelopeConformance, validateEnvelope } from "../src/index.js";

function load(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

describe("LAFS envelope", () => {
  it("accepts valid success envelope", () => {
    const envelope = load("fixtures/valid-success-envelope.json");
    const result = validateEnvelope(envelope);
    expect(result.valid).toBe(true);
  });

  it("rejects invariant-violating envelope", () => {
    const envelope = load("fixtures/invalid-conflict-envelope.json");
    const report = runEnvelopeConformance(envelope);
    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.name === "envelope_schema_valid" && !check.pass)).toBe(true);
  });
});

describe("LAFS error envelope", () => {
  it("isRegisteredErrorCode returns true for registered code E_VALIDATION_SCHEMA", () => {
    expect(isRegisteredErrorCode("E_VALIDATION_SCHEMA")).toBe(true);
  });

  it("isRegisteredErrorCode returns false for unregistered code E_FAKE_UNREGISTERED", () => {
    expect(isRegisteredErrorCode("E_FAKE_UNREGISTERED")).toBe(false);
  });

  it("accepts valid error envelope fixture", () => {
    const envelope = load("fixtures/valid-error-envelope.json");
    const result = validateEnvelope(envelope);
    expect(result.valid).toBe(true);

    const report = runEnvelopeConformance(envelope);
    expect(report.ok).toBe(true);
    expect(report.checks.every((check) => check.pass)).toBe(true);
  });

  it("detects unregistered error code via conformance", () => {
    const envelope = load("fixtures/invalid-unregistered-error.json");
    const report = runEnvelopeConformance(envelope);
    expect(report.ok).toBe(false);
    expect(report.checks.some((check) => check.name === "error_code_registered" && !check.pass)).toBe(true);
  });

  it("rejects error envelope with non-null result (invariant violation)", () => {
    const envelope = load("fixtures/invalid-error-with-result.json");
    const report = runEnvelopeConformance(envelope);
    expect(report.ok).toBe(false);
  });
});
