import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-left">
        <button onClick={() => navigate('/')} className="header-link">
          Home
        </button>
        {isAuthenticated && (
          <>
            <button onClick={() => navigate('/staff')} className="header-link">
              Staff
            </button>
            <button onClick={() => navigate('/youth')} className="header-link">
              Youth
            </button>
          </>
        )}
      </div>
      <div className="header-right">
        {isAuthenticated ? (
          <button onClick={logout} className="header-link">
            Logout
          </button>
        ) : (
          <button onClick={() => navigate('/login')} className="header-link">
            Login
          </button>
        )}
      </div>
    </header>
  );
}
