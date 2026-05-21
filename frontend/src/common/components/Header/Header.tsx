import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faChevronDown, faRightFromBracket, faHouse, faBars, faChevronLeft, faSchool } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions, logout } = useAuth();
  const isAdmin = permissions.includes('read:staff');
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = location.pathname.startsWith('/settings');

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <img src="/logo.jpg" alt="Be Original" className="mobile-topbar-logo" />
        <button
          className="mobile-topbar-toggle"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(o => !o)}
        >
          <FontAwesomeIcon icon={mobileOpen ? faChevronLeft : faBars} />
        </button>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo.jpg" alt="Be Original Youth Group" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          {isAuthenticated && (
            <>
              <button
                onClick={() => go('/')}
                className={`sidebar-link${isActive('/') ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faHouse} /></span>
                <span>Home</span>
              </button>

              <button
                onClick={() => go('/youth')}
                className={`sidebar-link${isActive('/youth') ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faUsers} /></span>
                <span>Youth</span>
              </button>

              <button
                onClick={() => go('/schools')}
                className={`sidebar-link${isActive('/schools') ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faSchool} /></span>
                <span>Schools</span>
              </button>

              <button
                onClick={() => setSettingsOpen(o => !o)}
                className={`sidebar-link${isSettingsActive ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faGear} /></span>
                <span className="sidebar-link-label">Settings</span>
                <FontAwesomeIcon icon={faChevronDown} style={{ transition: 'transform 0.2s', transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>

              {settingsOpen && (
                <div className="sidebar-subnav">
                  <button
                    onClick={() => go('/settings/account')}
                    className={`sidebar-sublink${isActive('/settings/account') ? ' active' : ''}`}
                  >
                    My Account
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => go('/settings/staff')}
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
            <button onClick={() => go('/login')} className="sidebar-link">
              Login
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

