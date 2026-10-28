const sendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail }) }));
import { sendEmail } from '../../src/utils/emailService';

const previousNodeEnv = process.env.NODE_ENV;
const previousDisableOutbound = process.env.DISABLE_OUTBOUND;

describe('local outbound email isolation', () => {
  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousDisableOutbound === undefined) delete process.env.DISABLE_OUTBOUND;
    else process.env.DISABLE_OUTBOUND = previousDisableOutbound;
    sendMail.mockReset();
  });

  it('does not send email for a local snapshot environment', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DISABLE_OUTBOUND = 'true';
    await sendEmail('person@example.test', 'Subject', '<p>Private</p>');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('preserves production email delivery', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DISABLE_OUTBOUND = 'true';
    await sendEmail('person@example.test', 'Subject', '<p>Private</p>');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
