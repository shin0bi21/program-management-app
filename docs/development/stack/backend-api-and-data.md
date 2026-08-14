# Backend API and data

Express routes compose the request pipeline. Controllers translate HTTP input and output. Services own SQL, business behavior, permissions, transactions, and audits.

## Route and controller

Keep protected middleware in the repository order:

```ts
router.post(
  '/',
  authenticateToken,
  requirePermission('write:examples'),
  generalLimiter,
  validateRequest(setExampleSchema),
  asyncHandler(handleSetExample),
);
```

Keep the controller thin:

```ts
export async function handleSetExample(req: Request, res: Response) {
  const id = req.params.id;
  const saved = await setExample(req.body, (req as AuthRequest).user!, id);
  res.status(id ? 200 : 201).json(saved);
}
```

Express 4 does not automatically forward rejected async handlers, so every async controller must use `asyncHandler`.

## Parameterized SQL

Use the shared Postgres.js `sql` tagged template. Interpolated values become query parameters:

```ts
const rows = await sql<ExampleRow[]>`
  SELECT id, name, program_id
  FROM examples
  WHERE id = ${id}
`;
```

Do not add quotes around `${id}` and do not build SQL with string concatenation. SQL fragments must also come from trusted repository code. See the [Postgres.js query and transaction reference](https://github.com/porsager/postgres).

## Transactions

Open one transaction for writes that must succeed together:

```ts
await sql.begin(async tx => {
  const trx = asTransactionSql(tx);
  const existing = await trx<ExampleRow[]>`
    SELECT id, name
    FROM examples
    WHERE id = ${id}
    FOR UPDATE
  `;

  if (!existing.length) throw new NotFoundError('Example not found');

  const [updated] = await trx<ExampleRow[]>`
    UPDATE examples SET name = ${input.name}
    WHERE id = ${id}
    RETURNING id, name
  `;

  await audit(trx, actor.userId, transactionId, 'examples', id, 'UPDATE', existing[0], updated);
});
```

Pass `trx` to nested helpers. Never open a nested transaction. Lock the current row when permissions or state rules must remain true through the write.

## Where to look

- Database client: `backend/src/db/client.ts`
- Route/controller example: `backend/src/routes/taskRoutes.ts` and `backend/src/controllers/taskController.ts`
- Service example: `backend/src/services/staff/tasks/`
- Service and policy ownership: [Backend services](../backend/services.md)
- Complete workflow: [Adding a backend domain](../backend/adding-a-domain.md)
