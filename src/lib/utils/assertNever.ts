export function assertNever(x: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(x)}`);
}
