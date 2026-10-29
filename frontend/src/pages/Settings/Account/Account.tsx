import PageHeader from '../../../common/components/PageHeader/PageHeader';
import PageMessageOverlay from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import useAccountData from './hooks/data/useAccountData';
import type { AccountPageData } from './types';
import './Account.css';

export default function Account() {
  // Page data.
  const data: AccountPageData = useAccountData();
  const programError = data.programsError ? {
    message: data.programsError,
    action: { label: 'Retry', onClick: () => { void data.retryPrograms(); } },
  } : null;

  // Render.
  return <main className="page-container">
    <PageHeader title="My Account" />

    <div className="account-card">
      <div className="account-field">
        <span className="account-label">Name</span>
        <span className="account-value">{data.name}</span>
      </div>
      <div className="account-field">
        <span className="account-label">Email</span>
        <span className="account-value">{data.email}</span>
      </div>
      <div className="account-field">
        <span className="account-label">Role</span>
        <span className="account-value account-role">{data.role}</span>
      </div>
      <div className="account-field">
        <span className="account-label">Programs</span>
        <span className="account-value">
          {data.programsLoading ? 'Loading…' : data.programNames || '—'}
        </span>
      </div>
    </div>
    <PageMessageOverlay messages={[programError]} />
  </main>;
}
