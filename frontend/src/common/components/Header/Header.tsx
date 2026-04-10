import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faChevronDown, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permission, logout } = useAuth();
  const isAdmin = permission === 'admin';
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  );

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.jpg" alt="Be Original Youth Group" className="sidebar-logo" />
      </div>
      <nav className="sidebar-nav">
        {isAuthenticated && (
          <button
            onClick={() => navigate('/youth')}
            className={`sidebar-link${isActive('/youth') ? ' active' : ''}`}
          >
            <span className="sidebar-link-icon"><FontAwesomeIcon icon={faUsers} /></span>
            <span>Youth</span>
          </button>
        )}

        {isAuthenticated && (
          <>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className={`sidebar-link sidebar-link-accordion${isSettingsActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon"><FontAwesomeIcon icon={faGear} /></span>
              <span className="sidebar-link-label">Settings</span>
              <FontAwesomeIcon icon={faChevronDown} style={{ transition: 'transform 0.2s', transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {settingsOpen && (
              <div className="sidebar-subnav">
                <button
                  onClick={() => navigate('/settings/account')}
                  className={`sidebar-sublink${isActive('/settings/account') ? ' active' : ''}`}
                >
                  My Account
                </button>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/settings/staff')}
                    className={`sidebar-sublink${isActive('/settings/staff') ? ' active' : ''}`}
                  >
                    Manage Staff
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {isAuthenticated ? (
          <button onClick={logout} className="sidebar-logout">
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>Logout</span>
          </button>
        ) : (
          <button onClick={() => navigate('/login')} className="sidebar-link">
            Login
          </button>
        )}
      </div>
    </aside>
  );
}

