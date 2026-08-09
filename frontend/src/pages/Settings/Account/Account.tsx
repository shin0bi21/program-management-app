import Header from '../../../common/components/Header/Header';
import { getUser } from '../../../auth/storage';
import { useAuth } from '../../../auth/authContext';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import { usePrograms } from '../../../common/features/programs/hooks/usePrograms';
import './Account.css';

export default function Account() {
  const user = getUser();
  const { role } = useAuth();
  const { programs, loading: programsLoading, error: programsError } = usePrograms({
    assignedOnly: true,
  });
  const programNames = programs.map(program => program.name).join(', ');

  return (
    <>
      <Header />
      <div className="page-container">
        <PageHeader title="My Account" />

        <div className="account-card">
          <div className="account-field">
            <span className="account-label">Name</span>
            <span className="account-value">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="account-field">
            <span className="account-label">Email</span>
            <span className="account-value">{user?.email ?? '—'}</span>
          </div>
          <div className="account-field">
            <span className="account-label">Role</span>
            <span className="account-value account-role">{role ?? '—'}</span>
          </div>
          <div className="account-field">
            <span className="account-label">Programs</span>
            <span className="account-value">
              {programsLoading ? 'Loading…' : programsError || programNames || '—'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
