import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/authContext';
import { useFloatingMenu } from '../../../common/components/FloatingMenu/hooks/useFloatingMenu';

type MenuName = 'staff' | 'leads' | 'settings' | 'programming';

/**
 * Supplies the user's visible sidebar groups, active destinations, and menu controls.
 * Requires auth/router providers; visibility uses the same permissions as App.tsx route guards.
 * Navigating through go closes mobile and flyout menus; pathname changes also close flyouts.
 * @returns Permission and active-route flags, trigger refs, flyout controls, and mobile sidebar state.
 * @example With only read:hours, Staff is visible with Hours and without Tasks.
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions: grantedPermissions, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const leadsRef = useRef<HTMLButtonElement>(null);
  const staffRef = useRef<HTMLButtonElement>(null);
  const programmingRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);

  const leads = useFloatingMenu(
    leadsRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 120 },
  );
  const staff = useFloatingMenu(staffRef, { side: 'right', align: 'start' }, { widthEstimate: 160, heightEstimate: 100 });
  const settings = useFloatingMenu(
    settingsRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 180, heightEstimate: 165 },
  );
  const programming = useFloatingMenu(programmingRef, { side: 'right', align: 'start' }, { widthEstimate: 160, heightEstimate: 100 });
  const closeProgramming = programming.close;
  const closeLeads = leads.close;
  const closeStaff = staff.close;
  const closeSettings = settings.close;

  /**
   * Closes every flyout except an optional menu about to be toggled.
   * @param except - Flyout to leave unchanged; omit to close all flyouts.
   * @example closeAllMenus('staff') dismisses Leads, Programming, and Settings.
   */
  const closeAllMenus = useCallback((except?: MenuName) => {
    if (except !== 'leads') closeLeads();
    if (except !== 'staff') closeStaff();
    if (except !== 'settings') closeSettings();
    if (except !== 'programming') closeProgramming();
  }, [closeLeads, closeSettings, closeStaff, closeProgramming]);

  /**
   * Toggles one flyout after dismissing all siblings.
   * @param menu - Sidebar group whose flyout should open or close.
   * @example Opening Programming while Staff is open closes Staff.
   */
  const toggleMenu = (menu: MenuName) => {
    closeAllMenus(menu);
    ({ staff, leads, settings, programming })[menu].toggle();
  };

  /**
   * Navigates to a caller-supplied canonical path and closes all navigation surfaces.
   * @param path - Application destination, such as '/staff/tasks'.
   * @example go('/staff/tasks') closes the mobile sidebar and open flyouts.
   */
  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    closeAllMenus();
  };

  useEffect(() => {
    closeAllMenus();
  }, [closeAllMenus, location.pathname]);

  const canViewSessions = grantedPermissions.includes('read:sessions');
  const canViewPrograms = grantedPermissions.includes('read:programs');
  const canViewTasks = grantedPermissions.includes('read:tasks');
  const canViewHours = grantedPermissions.includes('read:hours');

  return {
    isAuthenticated,
    logout,
    mobileOpen,
    setMobileOpen,
    refs: { staff: staffRef, leads: leadsRef, settings: settingsRef, programming: programmingRef },
    menus: { staff, leads, settings, programming },
    permissions: {
      canManageHomepage: grantedPermissions.includes('read:homepage'),
      canViewYouth: grantedPermissions.includes('read:youth_profiles'),
      canViewLeads: grantedPermissions.includes('read:outreach'),
      canViewProgramming: canViewSessions || canViewPrograms,
      canViewSessions,
      canViewPrograms,
      canManageUsers: grantedPermissions.includes('read:accounts'),
      canViewTasks,
      canViewHours,
      canViewStaff: canViewTasks || canViewHours,
    },
    active: {
      homepage: location.pathname.startsWith('/homepage/'),
      settings: location.pathname.startsWith('/settings'),
      leads: location.pathname.startsWith('/leads'),
      youth: location.pathname.startsWith('/youth'),
      programming: location.pathname.startsWith('/programming'),
      staff: location.pathname.startsWith('/staff'),
    },
    /**
     * Checks whether the current pathname exactly matches a destination, ignoring search and hash.
     * @param path - Destination pathname without a query string or fragment.
     * @example At /staff/hours?year=2026, isActive('/staff/hours') returns true.
     */
    isActive: (path: string) => location.pathname === path,
    go,
    toggleMenu,
  };
}
