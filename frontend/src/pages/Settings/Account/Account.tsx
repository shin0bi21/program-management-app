import Header from '../../../common/components/Header/Header';
import { getUser } from '../../../common/utils/storage';
import { useAuth } from '../../../common/context/AuthContext';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import './Account.css';

export default function Account() {
  const user = getUser();
  const { role } = useAuth();

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
        </div>
      </div>
    </>
  );
}
