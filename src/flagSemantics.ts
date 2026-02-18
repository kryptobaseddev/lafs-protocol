import type { FlagInput } from "./types.js";

export interface FlagResolution {
  format: "json" | "human";
  source: "flag" | "project" | "user" | "default";
  /** When true, suppress non-essential output for scripting */
  quiet: boolean;
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

  const quiet = input.quiet ?? false;

  if (input.requestedFormat) {
    return { format: input.requestedFormat, source: "flag", quiet };
  }
  if (input.humanFlag) {
    return { format: "human", source: "flag", quiet };
  }
  if (input.jsonFlag) {
    return { format: "json", source: "flag", quiet };
  }
  if (input.projectDefault) {
    return { format: input.projectDefault, source: "project", quiet };
  }
  if (input.userDefault) {
    return { format: input.userDefault, source: "user", quiet };
  }
  return { format: "json", source: "default", quiet };
}
