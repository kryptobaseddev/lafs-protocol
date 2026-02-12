import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runEnvelopeConformance, validateEnvelope } from "../src/index.js";

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
