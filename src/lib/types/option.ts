export type Option<T> = { _tag: "Some"; value: T } | { _tag: "None" };
export const Some = <T>(value: T): Option<T> => ({ _tag: "Some", value });
export const None: Option<never> = { _tag: "None" };
export const fromNullable = <T>(v: T | null | undefined): Option<T> =>
  v == null ? None : Some(v);
export const isSome = <T>(o: Option<T>): o is { _tag: "Some"; value: T } =>
  o._tag === "Some";
export const isNone = <T>(o: Option<T>): o is { _tag: "None" } =>
  o._tag === "None";
export const fold =
  <T, R>(onNone: () => R, onSome: (t: T) => R) =>
  (o: Option<T>): R =>
    o._tag === "None" ? onNone() : onSome(o.value);
