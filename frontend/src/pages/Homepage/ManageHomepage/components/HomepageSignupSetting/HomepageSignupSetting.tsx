import { useAuth } from '../../../../../auth/authContext';
import { DashboardCardLoading } from '../../../../../common/components/DashboardCard/DashboardCard';
import Button from '../../../../../common/components/Button/Button';
import { useHomepageSignupSetting } from '../../hooks/useHomepageSignupSetting';

export default function HomepageSignupSetting() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:homepage');
  const signup = useHomepageSignupSetting();
  const hasSettings = signup.signupEnabled !== undefined;

  return (
    <section className="homepage-management-card homepage-signup-setting" aria-labelledby="homepage-signup-setting-title">
      <div>
        <h2 id="homepage-signup-setting-title">Signup Form</h2>
        {signup.loading && !hasSettings && <DashboardCardLoading label="Loading signup setting…" />}
        {hasSettings && <p>
          {signup.signupEnabled
            ? 'Visible on the public homepage and accepting submissions.'
            : 'Hidden from the public homepage and closed to submissions.'}
        </p>}
        {signup.error && <div role="alert">
          <p>{signup.error}</p>
          <Button size="sm" onClick={() => void signup.refresh()}>Retry</Button>
        </div>}
      </div>
      {hasSettings && <div className="homepage-signup-setting__controls">
        <span className={`status-badge ${signup.signupEnabled ? 'status-active' : 'status-inactive'}`}>
          {signup.signupEnabled ? 'Open' : 'Closed'}
        </span>
        {canWrite && <Button
          variant={signup.signupEnabled ? 'secondary' : 'primary'}
          role="switch"
          aria-checked={signup.signupEnabled}
          disabled={signup.saving}
          onClick={() => signup.setSignupEnabled(!signup.signupEnabled)}
        >
          {signup.saving ? 'Saving…' : signup.signupEnabled ? 'Disable signups' : 'Enable signups'}
        </Button>}
      </div>}
    </section>
  );
}
