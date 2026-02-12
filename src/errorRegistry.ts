import errorRegistry from "../schemas/v1/error-registry.json" with { type: "json" };

export interface RegistryCode {
  code: string;
  category: string;
  description: string;
  retryable: boolean;
  httpStatus: number;
  grpcStatus: string;
  cliExit: number;
}

export interface ErrorRegistry {
  version: string;
  codes: RegistryCode[];
}

export function getErrorRegistry(): ErrorRegistry {
  return errorRegistry as ErrorRegistry;
}

export function isRegisteredErrorCode(code: string): boolean {
  const registry = getErrorRegistry();
  return registry.codes.some((item) => item.code === code);
}
