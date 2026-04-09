import './AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-container">
      {/* ── Left brand panel ── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-logo">
          <img src="/logo.jpg" alt="Be Original Youth Group" className="auth-brand-logo-img" />
        </div>
        <div className="auth-brand-shapes" aria-hidden="true">
          <div className="auth-shape auth-shape--sq-lg" />
          <div className="auth-shape auth-shape--sq-lg2" />
          <div className="auth-shape auth-shape--sq-md" />
          <div className="auth-shape auth-shape--sq-md2" />
          <div className="auth-shape auth-shape--sq-sm" />
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-panel">
        {children}
      </div>
    </div>
  );
}
