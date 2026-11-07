import './AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Displays an authentication form inside the shared centered panel.
 * @param children - Authentication page content, including its form and messages.
 * @example <AuthLayout><LoginForm /></AuthLayout>
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-container">
      <div className="auth-form-panel">
        {children}
      </div>
    </div>
  );
}
