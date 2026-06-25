import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faRightFromBracket, faHouse, faBars, faChevronLeft, faSchool } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions, logout } = useAuth();
  const isAdmin = permissions.includes('read:staff');
  const [mobileOpen, setMobileOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const {
    isOpen: isFlyoutOpen,
    toggle: toggleFlyout,
    close: closeFlyout,
    position: flyoutPosition,
    menuRef: flyoutRef,
  } = useFloatingMenu(
    settingsBtnRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 120 },
  );

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = location.pathname.startsWith('/settings');

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    closeFlyout();
  };

  // Close flyout on route change
  useEffect(() => { closeFlyout(); }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
                className={`sidebar-link${isActive('/') && !isFlyoutOpen ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faHouse} /></span>
                <span>Home</span>
              </button>

              <button
                onClick={() => go('/youth')}
                className={`sidebar-link${isActive('/youth') && !isFlyoutOpen ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faUsers} /></span>
                <span>Youth</span>
              </button>

              <button
                onClick={() => go('/schools')}
                className={`sidebar-link${isActive('/schools') && !isFlyoutOpen ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faSchool} /></span>
                <span>Schools</span>
              </button>

              <button
                ref={settingsBtnRef}
                onClick={toggleFlyout}
                aria-haspopup="menu"
                aria-expanded={isFlyoutOpen}
                className={`sidebar-link${isSettingsActive || isFlyoutOpen ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faGear} /></span>
                <span className="sidebar-link-label">Settings</span>
              </button>
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

      {/* Settings flyout — portalled via FloatingMenuPanel */}
      {flyoutPosition && (
        <FloatingMenuPanel
          menuRef={flyoutRef}
          position={flyoutPosition}
          onClose={closeFlyout}
          className="settings-flyout"
        >
          <button
            role="menuitem"
            onClick={() => go('/settings/account')}
            className={`settings-flyout-item${isActive('/settings/account') ? ' active' : ''}`}
          >
            My Account
          </button>
          {isAdmin && (
            <button
              role="menuitem"
              onClick={() => go('/settings/cohort-interest')}
              className={`settings-flyout-item${isActive('/settings/cohort-interest') ? ' active' : ''}`}
            >
              Cohort Interest
            </button>
          )}
          {isAdmin && (
            <button
              role="menuitem"
              onClick={() => go('/settings/staff')}
              className={`settings-flyout-item${isActive('/settings/staff') ? ' active' : ''}`}
            >
              Manage Staff
            </button>
          )}
        </FloatingMenuPanel>
      )}
    </>
  );
}
