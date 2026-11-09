import { z } from 'zod';

export const sortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * Defines list sorting and cursor inputs with a fixed 50-row pagination request.
 * Lists that also serve complete collections use an omitted limit for those reads.
 * @param sortKeys - Fields the list supports for sorting.
 * @param defaultSort - Field used when the request omits sort.
 * @param defaultDirection - Order used when the request omits direction.
 * @example cursorListFields(['name'], 'name', 'asc') // accepts limit=50 or no limit
 */
export function cursorListFields<T extends readonly [string, ...string[]]>(sortKeys: T, defaultSort: T[number], defaultDirection: 'asc' | 'desc') {
  return {
    sort: z.enum(sortKeys).optional().default(defaultSort),
    direction: sortDirectionSchema.optional().default(defaultDirection),
    cursor: z.string().max(2048).optional(),
    limit: z.coerce.number().pipe(z.literal(50)).optional(),
  };
}
