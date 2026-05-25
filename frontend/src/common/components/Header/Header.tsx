import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faRightFromBracket, faHouse, faBars, faChevronLeft, faSchool } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions, logout } = useAuth();
  const isAdmin = permissions.includes('read:staff');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsFlyoutTop, setSettingsFlyoutTop] = useState<number | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsFlyoutRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = location.pathname.startsWith('/settings');

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    setSettingsFlyoutTop(null);
  };

  const toggleSettingsFlyout = () => {
    if (settingsFlyoutTop !== null) {
      setSettingsFlyoutTop(null);
    } else {
      const rect = settingsBtnRef.current?.getBoundingClientRect();
      if (rect) setSettingsFlyoutTop(rect.top);
    }
  };

  // Close flyout on route change
  useEffect(() => { setSettingsFlyoutTop(null); }, [location.pathname]);

  // Close flyout on click outside
  useEffect(() => {
    if (settingsFlyoutTop === null) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        settingsBtnRef.current?.contains(e.target as Node) ||
        settingsFlyoutRef.current?.contains(e.target as Node)
      ) return;
      setSettingsFlyoutTop(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [settingsFlyoutTop]);

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
                className={`sidebar-link${isActive('/') && settingsFlyoutTop === null ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faHouse} /></span>
                <span>Home</span>
              </button>

              <button
                onClick={() => go('/youth')}
                className={`sidebar-link${isActive('/youth') && settingsFlyoutTop === null ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faUsers} /></span>
                <span>Youth</span>
              </button>

              <button
                onClick={() => go('/schools')}
                className={`sidebar-link${isActive('/schools') && settingsFlyoutTop === null ? ' active' : ''}`}
              >
                <span className="sidebar-link-icon"><FontAwesomeIcon icon={faSchool} /></span>
                <span>Schools</span>
              </button>

              <button
                ref={settingsBtnRef}
                onClick={toggleSettingsFlyout}
                className={`sidebar-link${isSettingsActive || settingsFlyoutTop !== null ? ' active' : ''}`}
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

      {/* Settings flyout — rendered outside the sidebar */}
      {settingsFlyoutTop !== null && (
        <div
          ref={settingsFlyoutRef}
          className="settings-flyout"
          style={{ top: settingsFlyoutTop }}
        >
          <button
            onClick={() => go('/settings/account')}
            className={`settings-flyout-item${isActive('/settings/account') ? ' active' : ''}`}
          >
            My Account
          </button>
          {isAdmin && (
            <button
              onClick={() => go('/settings/staff')}
              className={`settings-flyout-item${isActive('/settings/staff') ? ' active' : ''}`}
            >
              Manage Staff
            </button>
          )}
        </div>
      )}
    </>
  );
}

