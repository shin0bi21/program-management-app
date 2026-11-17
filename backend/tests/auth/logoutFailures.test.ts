import request from 'supertest';
import * as revocation from '../../src/services/auth/tokenRevocationService';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser } from '../shared/db';
import { generateAccessToken } from './helpers';

const app = createApp();

describe('Logout failure propagation', () => {
  it.each([
    ['database availability', Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }), 503],
    ['unexpected persistence', new Error('Revocation persistence failed'), 500],
  ])('reports %s failure while clearing the browser cookie', async (_label, failure, status) => {
    const user = await seedTestUser({ role: 'staff' });
    const token = generateAccessToken(user.userId, user.email, 'staff');
    const revoke = jest.spyOn(revocation, 'revokeAccessToken').mockRejectedValueOnce(failure);

    try {
      const response = await request(app).post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-ID', 'logout-failure');

      expect(response.status).toBe(status);
      expect(response.body).toMatchObject({ error: expect.any(String), requestId: 'logout-failure' });
      expect(response.body.message).toBeUndefined();
      expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([
        expect.stringContaining('refreshToken=;'),
      ]));
    } finally {
      revoke.mockRestore();
      await deleteTestUser(user.userId);
    }
  });

  it('still succeeds for invalid tokens without attempting revocation', async () => {
    const revoke = jest.spyOn(revocation, 'revokeAccessToken');
    try {
      const response = await request(app).post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .set('Cookie', 'refreshToken=invalid-token');

      expect(response.status).toBe(200);
      expect(revoke).not.toHaveBeenCalled();
    } finally {
      revoke.mockRestore();
    }
  });
});
