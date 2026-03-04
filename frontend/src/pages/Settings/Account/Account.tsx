import Header from '../../../common/components/Header/Header';
import { getUser } from '../../../common/utils/storage';
import { useAuth } from '../../../common/context/AuthContext';
import './Account.css';

export default function Account() {
  const user = getUser();
  const { permission } = useAuth();

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">My Account</h1>
          </div>
        </div>

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
            <span className="account-value account-role">{permission ?? '—'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
