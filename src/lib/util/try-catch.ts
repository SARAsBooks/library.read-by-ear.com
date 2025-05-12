/**
 * A simplified Result type implementation that handles both synchronous and asynchronous operations
 * while maintaining a clean, intuitive API.
 */

// Type definitions with discriminated union
export type Success<T> = {
  ok: true;
  data: T;
  error: null;
};

export type Failure<E = Error> = {
  ok: false;
  data: null;
  error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;

// Type guards for safer type narrowing
export function isSuccess<T>(result: Result<T>): result is Success<T> {
  return result.ok === true;
}

export function isFailure<E = Error>(
  result: Result<unknown, E>,
): result is Failure<E> {
  return result.ok === false;
}

// Simple constructor functions
export function success<T>(data: T): Success<T> {
  return {
    ok: true,
    data,
    error: null,
  };
}

export function failure<E = Error>(error: E): Failure<E> {
  return {
    ok: false,
    data: null,
    error:
      error instanceof Error
        ? (error as E)
        : (new Error(String(error), { cause: error }) as E),
  };
}

/**
 * Wraps a Promise in a Result type
 * @example
 * const result = await tryCatch(fetch('https://api.example.com/data'));
 * if (isSuccess(result)) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return success(data);
  } catch (err) {
    return failure(err as E);
  }
}

/**
 * Creates a Result from a synchronous function or value
 * @example
 * const result = resultOf(() => {
 *   if (Math.random() > 0.5) return "success";
 *   throw new Error("random failure");
 * });
 */
export function resultOf<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return success(fn());
  } catch (err) {
    return failure(err as E);
  }
}

/**
 * Unified interface that handles both Promise and synchronous operations
 * @example
 * // Async usage
 * const asyncResult = await safeguard(() => fetchData());
 *
 * // Sync usage
 * const syncResult = safeguard(() => parseData(rawData));
 */
export function safeguard<T, E = Error>(
  fn: () => T | Promise<T>,
): Promise<Result<T, E>> | Result<T, E> {
  try {
    const result = fn();

    if (result instanceof Promise) {
      return result
        .then((data) => success(data))
        .catch((err) => failure(err as E));
    }

    return success(result);
  } catch (err) {
    return failure(err as E);
  }
}
