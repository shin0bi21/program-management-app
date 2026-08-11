import type { Selectable } from "kysely";

export type CamelCase<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<CamelCase<Tail>>}`
    : S;

export type DbRow<T> = {
  [K in keyof Selectable<T> as K extends string ? CamelCase<K> : K]: Selectable<T>[K];
};
