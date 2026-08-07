import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faRightFromBracket, faBars, faChevronLeft, faBullhorn, faBookOpen } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../context/AuthContext';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import './Header.css';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions, logout } = useAuth();
  const canManageHomepage = permissions.includes('read:homepage');
  const canViewYouth = permissions.includes('read:youth_profiles');
  const canViewOutreach = permissions.includes('read:outreach');
  const canViewCohorts = permissions.includes('read:cohorts');
  const canViewSessions = permissions.includes('read:sessions');
  const canViewProgramming = canViewCohorts || canViewSessions;
  const canManageAccounts = permissions.includes('read:accounts');
  const [mobileOpen, setMobileOpen] = useState(false);
  const outreachBtnRef = useRef<HTMLButtonElement>(null);
  const programmingBtnRef = useRef<HTMLButtonElement>(null);
  const youthBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const {
    isOpen: isYouthFlyoutOpen,
    toggle: toggleYouthFlyout,
    close: closeYouthFlyout,
    position: youthFlyoutPosition,
    menuRef: youthFlyoutRef,
  } = useFloatingMenu(youthBtnRef, { side: 'right', align: 'start' }, { widthEstimate: 160, heightEstimate: 70 });

  const {
    isOpen: isProgrammingFlyoutOpen,
    toggle: toggleProgrammingFlyout,
    close: closeProgrammingFlyout,
    position: programmingFlyoutPosition,
    menuRef: programmingFlyoutRef,
  } = useFloatingMenu(
    programmingBtnRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 150 },
  );

  const {
    isOpen: isSettingsFlyoutOpen,
    toggle: toggleSettingsFlyout,
    close: closeSettingsFlyout,
    position: settingsFlyoutPosition,
    menuRef: settingsFlyoutRef,
  } = useFloatingMenu(
    settingsBtnRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 180, heightEstimate: 165 },
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
  const isProgrammingActive = location.pathname.startsWith('/programming');

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    closeOutreachFlyout();
    closeProgrammingFlyout();
    closeYouthFlyout();
    closeSettingsFlyout();
  };

  const handleOutreachToggle = () => {
    closeYouthFlyout();
    closeProgrammingFlyout();
    closeSettingsFlyout();
    toggleOutreachFlyout();
  };

  const handleSettingsToggle = () => {
    closeYouthFlyout();
    closeOutreachFlyout();
    closeProgrammingFlyout();
    toggleSettingsFlyout();
  };

  const handleYouthToggle = () => {
    closeOutreachFlyout();
    closeProgrammingFlyout();
    closeSettingsFlyout();
    toggleYouthFlyout();
  };

  const handleProgrammingToggle = () => {
    closeYouthFlyout();
    closeOutreachFlyout();
    closeSettingsFlyout();
    toggleProgrammingFlyout();
  };

  // Close flyouts on route change
  useEffect(() => {
    closeOutreachFlyout();
    closeProgrammingFlyout();
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

              {canViewProgramming && (
                <button
                  ref={programmingBtnRef}
                  onClick={handleProgrammingToggle}
                  aria-haspopup="menu"
                  aria-expanded={isProgrammingFlyoutOpen}
                  className={`sidebar-link${isProgrammingActive || isProgrammingFlyoutOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faBookOpen} /></span>
                  <span>Programming</span>
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

      {canViewProgramming && programmingFlyoutPosition && (
        <FloatingMenuPanel
          menuRef={programmingFlyoutRef}
          position={programmingFlyoutPosition}
          onClose={closeProgrammingFlyout}
          className="settings-flyout"
        >
          {canViewCohorts && (
            <button
              role="menuitem"
              onClick={() => go('/programming/cohorts')}
              className={`settings-flyout-item${isActive('/programming/cohorts') ? ' active' : ''}`}
            >
              Cohorts
            </button>
          )}
          {canViewSessions && (
            <button
              role="menuitem"
              onClick={() => go('/programming/sessions')}
              className={`settings-flyout-item${isActive('/programming/sessions') ? ' active' : ''}`}
            >
              Sessions
            </button>
          )}
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
          {canManageHomepage && (
            <button
              role="menuitem"
              onClick={() => go('/homepage/manage')}
              className={`settings-flyout-item${isActive('/homepage/manage') ? ' active' : ''}`}
            >
              Manage Homepage
            </button>
          )}
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
