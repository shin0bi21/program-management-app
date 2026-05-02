import './AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-container">
      <div className="auth-form-panel">
        {children}
      </div>
    </div>
  );
}
