import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faRightFromBracket, faHouse, faBars, faChevronLeft, faBullhorn } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role, permissions, logout } = useAuth();
  const canViewHome = role !== 'youth';
  const canViewYouth = permissions.includes('read:youth_profiles');
  const canViewOutreach = permissions.includes('read:outreach');
  const canManageAccounts = permissions.includes('read:accounts');
  const [mobileOpen, setMobileOpen] = useState(false);
  const outreachBtnRef = useRef<HTMLButtonElement>(null);
  const youthBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const {
    isOpen: isYouthFlyoutOpen,
    toggle: toggleYouthFlyout,
    close: closeYouthFlyout,
    position: youthFlyoutPosition,
    menuRef: youthFlyoutRef,
  } = useFloatingMenu(youthBtnRef, { side: 'right', align: 'start' }, { widthEstimate: 160, heightEstimate: 120 });

  const {
    isOpen: isSettingsFlyoutOpen,
    toggle: toggleSettingsFlyout,
    close: closeSettingsFlyout,
    position: settingsFlyoutPosition,
    menuRef: settingsFlyoutRef,
  } = useFloatingMenu(
    settingsBtnRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 120 },
  );
  const {
    isOpen: isOutreachFlyoutOpen,
    toggle: toggleOutreachFlyout,
    close: closeOutreachFlyout,
    position: outreachFlyoutPosition,
    menuRef: outreachFlyoutRef,
  } = useFloatingMenu(
    outreachBtnRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 120 },
  );

  const isActive = (path: string) => location.pathname === path;
  const isSettingsActive = location.pathname.startsWith('/settings');
  const isOutreachActive = location.pathname.startsWith('/outreach');
  const isYouthActive = location.pathname.startsWith('/youth');

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    closeOutreachFlyout();
    closeYouthFlyout();
    closeSettingsFlyout();
  };

  const handleOutreachToggle = () => {
    closeYouthFlyout();
    closeSettingsFlyout();
    toggleOutreachFlyout();
  };

  const handleSettingsToggle = () => {
    closeYouthFlyout();
    closeOutreachFlyout();
    toggleSettingsFlyout();
  };

  const handleYouthToggle = () => {
    closeOutreachFlyout();
    closeSettingsFlyout();
    toggleYouthFlyout();
  };

  // Close flyouts on route change
  useEffect(() => {
    closeOutreachFlyout();
    closeYouthFlyout();
    closeSettingsFlyout();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {canViewHome && (
                <button
                  onClick={() => go('/')}
                  className={`sidebar-link${isActive('/') && !isSettingsFlyoutOpen && !isOutreachFlyoutOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faHouse} /></span>
                  <span>Home</span>
                </button>
              )}

              {canViewYouth && (
                <button
                  ref={youthBtnRef}
                  onClick={handleYouthToggle}
                  aria-haspopup="menu"
                  aria-expanded={isYouthFlyoutOpen}
                  className={`sidebar-link${isYouthActive || isYouthFlyoutOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faUsers} /></span>
                  <span>Youth</span>
                </button>
              )}

              {canViewOutreach && (
                <button
                  ref={outreachBtnRef}
                  onClick={handleOutreachToggle}
                  aria-haspopup="menu"
                  aria-expanded={isOutreachFlyoutOpen}
                  className={`sidebar-link${isOutreachActive || isOutreachFlyoutOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faBullhorn} /></span>
                  <span>Outreach</span>
                </button>
              )}

              <button
                ref={settingsBtnRef}
                onClick={handleSettingsToggle}
                aria-haspopup="menu"
                aria-expanded={isSettingsFlyoutOpen}
                className={`sidebar-link${isSettingsActive || isSettingsFlyoutOpen ? ' active' : ''}`}
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

      {canViewYouth && youthFlyoutPosition && (
        <FloatingMenuPanel menuRef={youthFlyoutRef} position={youthFlyoutPosition} onClose={closeYouthFlyout} className="settings-flyout">
          <button role="menuitem" onClick={() => go('/youth/profiles')} className={`settings-flyout-item${isActive('/youth/profiles') ? ' active' : ''}`}>
            Profiles
          </button>
          <button role="menuitem" onClick={() => go('/youth/attendance')} className={`settings-flyout-item${isActive('/youth/attendance') ? ' active' : ''}`}>
            Attendance
          </button>
        </FloatingMenuPanel>
      )}

      {canViewOutreach && outreachFlyoutPosition && (
        <FloatingMenuPanel
          menuRef={outreachFlyoutRef}
          position={outreachFlyoutPosition}
          onClose={closeOutreachFlyout}
          className="settings-flyout"
        >
          <button
            role="menuitem"
            onClick={() => go('/outreach/expressions-of-interest')}
            className={`settings-flyout-item${isActive('/outreach/expressions-of-interest') ? ' active' : ''}`}
          >
            Expression of Interest
          </button>
          <button
            role="menuitem"
            onClick={() => go('/outreach/leads')}
            className={`settings-flyout-item${isActive('/outreach/leads') ? ' active' : ''}`}
          >
            Leads
          </button>
        </FloatingMenuPanel>
      )}

      {/* Settings flyout — portalled via FloatingMenuPanel */}
      {settingsFlyoutPosition && (
        <FloatingMenuPanel
          menuRef={settingsFlyoutRef}
          position={settingsFlyoutPosition}
          onClose={closeSettingsFlyout}
          className="settings-flyout"
        >
          <button
            role="menuitem"
            onClick={() => go('/settings/account')}
            className={`settings-flyout-item${isActive('/settings/account') ? ' active' : ''}`}
          >
            My Account
          </button>
          {canManageAccounts && (
            <button
              role="menuitem"
              onClick={() => go('/settings/users')}
              className={`settings-flyout-item${isActive('/settings/users') ? ' active' : ''}`}
            >
              Manage Accounts
            </button>
          )}
        </FloatingMenuPanel>
      )}
    </>
  );
}
