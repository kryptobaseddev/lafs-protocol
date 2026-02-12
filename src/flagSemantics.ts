import type { FlagInput } from "./types.js";

export interface FlagResolution {
  format: "json" | "human";
  source: "flag" | "project" | "user" | "default";
}

export class LAFSFlagError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LAFSFlagError";
    this.code = code;
  }
}

export function resolveOutputFormat(input: FlagInput): FlagResolution {
  if (input.humanFlag && input.jsonFlag) {
    throw new LAFSFlagError(
      "E_FORMAT_CONFLICT",
      "Cannot combine --human and --json in the same invocation.",
    );
  }

  if (input.requestedFormat) {
    return { format: input.requestedFormat, source: "flag" };
  }
  if (input.humanFlag) {
    return { format: "human", source: "flag" };
  }
  if (input.jsonFlag) {
    return { format: "json", source: "flag" };
  }
  if (input.projectDefault) {
    return { format: input.projectDefault, source: "project" };
  }
  if (input.userDefault) {
    return { format: input.userDefault, source: "user" };
  }
  return { format: "json", source: "default" };
}
