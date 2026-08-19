// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import {
  convertExpressionOfInterest,
  getExpressionsOfInterest,
  updateExpressionOfInterestStatus,
} from './expressionsOfInterest.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}));

describe('expressionsOfInterest API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes filters, sorting, pagination, and cancellation options', () => {
    const options = { signal: new AbortController().signal };

    getExpressionsOfInterest(
      { search: ' Avery ', statuses: ['new', 'reviewed'], programIds: ['program-1'] },
      { key: 'createdAt', direction: 'desc', limit: 25, cursor: 'cursor-2' },
      options,
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      '/expressions-of-interest?search=Avery&statuses=new%2Creviewed&programIds=program-1&sort=createdAt&direction=desc&limit=25&cursor=cursor-2',
      options,
    );
  });

  it('uses focused status and conversion endpoints', () => {
    updateExpressionOfInterestStatus('expression-1', 'reviewed');
    convertExpressionOfInterest('expression-1');

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/expressions-of-interest/expression-1',
      { status: 'reviewed' },
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      '/expressions-of-interest/expression-1/convert',
      {},
    );
  });
});
