import type { ColumnType } from "kysely";

export type CamelCase<S extends string> =
  S extends `${infer Head}_${infer Tail}`
    ? `${Head}${Capitalize<CamelCase<Tail>>}`
    : S;

// Unwrap ColumnType to get the select type (what comes out of DB)
type UnwrapColumnType<T> = T extends ColumnType<infer S, any, any> ? S : T;

export type DbRow<T> = {
  [K in keyof T as K extends string ? CamelCase<K> : K]: UnwrapColumnType<T[K]>;
};
