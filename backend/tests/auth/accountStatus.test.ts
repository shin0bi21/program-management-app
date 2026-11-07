import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateAccessToken } from './helpers';

const app = createApp();

describe('Protected request account status', () => {
  it.each([
    ['active', 200],
    ['inactive', 403],
    ['invited', 403],
    ['missing', 403],
  ] as const)('checks current %s credentials for an already issued token', async (status, expectedStatus) => {
    const user = await seedTestUser({ role: 'staff' });

    try {
      const token = generateAccessToken(user.userId, user.email, 'staff');

      if (status === 'missing') {
        await sql`DELETE FROM user_credentials WHERE user_id = ${user.userId}`;
      } else {
        await sql`UPDATE user_credentials SET status = ${status} WHERE user_id = ${user.userId}`;
      }

      const response = await request(app)
        .get('/api/youth')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(response.body.error).toBe('Account is inactive');
      }
    } finally {
      await deleteTestUser(user.userId);
    }
  });
});
