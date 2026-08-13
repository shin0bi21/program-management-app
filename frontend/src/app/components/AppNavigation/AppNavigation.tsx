import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGear, faRightFromBracket, faBars, faChevronLeft, faBullhorn, faBookOpen, faClock } from '@fortawesome/free-solid-svg-icons';
import logoUrl from '../../../assets/logo.webp';
import logo160Url from '../../../assets/logo-160.webp';
import logo320Url from '../../../assets/logo-320.webp';
import FloatingMenuPanel from '../../../common/components/FloatingMenu/FloatingMenuPanel';
import { useAppNavigation } from './useAppNavigation';
import './AppNavigation.css';

export default function AppNavigation() {
  const navigation = useAppNavigation();
  const {
    isAuthenticated, logout, mobileOpen, setMobileOpen, refs, menus,
    permissions, active, go, isActive, toggleMenu,
  } = navigation;
  const {
    canManageHomepage, canViewYouth, canViewOutreach, canViewCohorts,
    canViewSessions, canViewProgramming, canManageAccounts, canManageProgramming,
    canViewTasks, canViewTimesheets, canViewStaff,
  } = permissions;

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          type="button"
          className="header-logo-button mobile-topbar-logo-button"
          onClick={() => go('/')}
          aria-label="Go to homepage"
        >
          <img
            src={logo160Url}
            srcSet={`${logo160Url} 160w, ${logo320Url} 320w, ${logoUrl} 512w`}
            sizes="134px"
            width="160"
            height="101"
            alt=""
            className="mobile-topbar-logo"
          />
        </button>
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
          <button
            type="button"
            className="header-logo-button"
            onClick={() => go('/')}
            aria-label="Go to homepage"
          >
            <img
              src={logo160Url}
              srcSet={`${logo160Url} 160w, ${logo320Url} 320w, ${logoUrl} 512w`}
              sizes="134px"
              width="160"
              height="101"
              alt=""
              className="sidebar-logo"
            />
          </button>
        </div>
        <nav className="sidebar-nav">
          {isAuthenticated && (
            <>
              {canViewStaff && (
                <button
                  ref={refs.staff}
                  onClick={() => toggleMenu('staff')}
                  aria-haspopup="menu"
                  aria-expanded={menus.staff.isOpen}
                  className={`sidebar-link${active.staff || menus.staff.isOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faClock} /></span>
                  <span>Staff</span>
                </button>
              )}

              {canViewYouth && (
                <button
                  ref={refs.youth}
                  onClick={() => toggleMenu('youth')}
                  aria-haspopup="menu"
                  aria-expanded={menus.youth.isOpen}
                  className={`sidebar-link${active.youth || menus.youth.isOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faUsers} /></span>
                  <span>Youth</span>
                </button>
              )}

              {canViewProgramming && (
                <button
                  ref={refs.programming}
                  onClick={() => toggleMenu('programming')}
                  aria-haspopup="menu"
                  aria-expanded={menus.programming.isOpen}
                  className={`sidebar-link${active.programming || menus.programming.isOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faBookOpen} /></span>
                  <span>Programming</span>
                </button>
              )}

              {canViewOutreach && (
                <button
                  ref={refs.outreach}
                  onClick={() => toggleMenu('outreach')}
                  aria-haspopup="menu"
                  aria-expanded={menus.outreach.isOpen}
                  className={`sidebar-link${active.outreach || menus.outreach.isOpen ? ' active' : ''}`}
                >
                  <span className="sidebar-link-icon"><FontAwesomeIcon icon={faBullhorn} /></span>
                  <span>Outreach</span>
                </button>
              )}

              <button
                ref={refs.settings}
                onClick={() => toggleMenu('settings')}
                aria-haspopup="menu"
                aria-expanded={menus.settings.isOpen}
                className={`sidebar-link${active.settings || menus.settings.isOpen ? ' active' : ''}`}
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

      {canViewYouth && menus.youth.position && (
        <FloatingMenuPanel menuRef={menus.youth.menuRef} position={menus.youth.position} onClose={menus.youth.close} className="settings-flyout">
          <button role="menuitem" onClick={() => go('/youth/profiles')} className={`settings-flyout-item${isActive('/youth/profiles') ? ' active' : ''}`}>
            Profiles
          </button>
        </FloatingMenuPanel>
      )}

      {canViewOutreach && menus.outreach.position && (
        <FloatingMenuPanel
          menuRef={menus.outreach.menuRef}
          position={menus.outreach.position}
          onClose={menus.outreach.close}
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

      {canViewStaff && menus.staff.position && (
        <FloatingMenuPanel menuRef={menus.staff.menuRef} position={menus.staff.position} onClose={menus.staff.close} className="settings-flyout">
          {canViewTimesheets && <button role="menuitem" onClick={() => go('/staff/hours')} className={`settings-flyout-item${isActive('/staff/hours') ? ' active' : ''}`}>Hours</button>}
          {canViewTasks && <button role="menuitem" onClick={() => go('/staff/tasks')} className={`settings-flyout-item${isActive('/staff/tasks') ? ' active' : ''}`}>Tasks</button>}
        </FloatingMenuPanel>
      )}

      {canViewProgramming && menus.programming.position && (
        <FloatingMenuPanel
          menuRef={menus.programming.menuRef}
          position={menus.programming.position}
          onClose={menus.programming.close}
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
      {menus.settings.position && (
        <FloatingMenuPanel
          menuRef={menus.settings.menuRef}
          position={menus.settings.position}
          onClose={menus.settings.close}
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
          {canManageProgramming && (
            <button
              role="menuitem"
              onClick={() => go('/settings/programming')}
              className={`settings-flyout-item${isActive('/settings/programming') ? ' active' : ''}`}
            >
              Manage Programming
            </button>
          )}
          {canManageHomepage && (
            <button
              role="menuitem"
              onClick={() => go('/homepage/manage')}
              className={`settings-flyout-item${isActive('/homepage/manage') ? ' active' : ''}`}
            >
              Manage Homepage
            </button>
          )}
        </FloatingMenuPanel>
      )}
    </>
  );
}
