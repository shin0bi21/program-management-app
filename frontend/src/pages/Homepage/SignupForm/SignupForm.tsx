import { useAuth } from '../../../auth/authContext';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import HomepageSignupSetting from './components/HomepageSignupSetting/HomepageSignupSetting';

import '../common/homepageManagement.css';
import './SignupForm.css';

export default function SignupForm() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:homepage');

  return (
    <main className="page-container homepage-management-page">
      <PageHeader title="Sign-up Form" />
      <HomepageSignupSetting canWrite={canWrite} />
    </main>
  );
}
