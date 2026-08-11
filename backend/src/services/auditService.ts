import { sql } from '../db/client';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Writes one audit entry to audit_log.
 * Pass the transaction sql (trx) when inside sql.begin, or root sql otherwise.
 */
export async function audit(
  trx: typeof sql,
  userId: string,
  transactionId: string,
  tableName: string,
  recordId: string,
  action: AuditAction,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
): Promise<void> {
  await trx`
    INSERT INTO audit_log (transaction_id, user_id, table_name, record_id, action, old_data, new_data)
    VALUES (
      ${transactionId}::uuid,
      ${userId}::uuid,
      ${tableName},
      ${recordId}::uuid,
      ${action},
      ${oldData !== null ? trx.json(oldData as Parameters<typeof trx.json>[0]) : null},
      ${newData !== null ? trx.json(newData as Parameters<typeof trx.json>[0]) : null}
    )
  `;
}
