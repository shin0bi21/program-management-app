import { getSheetsClient } from '../../integrations/googleSheets/client';

jest.mock('googleapis', () => ({
  google: { auth: { GoogleAuth: jest.fn() }, sheets: jest.fn(() => ({ spreadsheets: {} })) },
}));
const previousNodeEnv = process.env.NODE_ENV;
const previousDisableOutbound = process.env.DISABLE_OUTBOUND;
const previousCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

describe('local integration isolation', () => {
  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousDisableOutbound === undefined) delete process.env.DISABLE_OUTBOUND;
    else process.env.DISABLE_OUTBOUND = previousDisableOutbound;
    if (previousCredentials === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = previousCredentials;
  });

  it('blocks outbound Sheets access before reading credentials', () => {
    process.env.NODE_ENV = 'development';
    process.env.DISABLE_OUTBOUND = 'true';
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    expect(() => getSheetsClient()).toThrow('Outbound integrations are disabled');
  });
});
