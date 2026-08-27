import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/authContext';
import { useFloatingMenu } from '../../../common/components/FloatingMenu/hooks/useFloatingMenu';

type MenuName = 'youth' | 'programming' | 'staff' | 'leads' | 'settings';

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions: grantedPermissions, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const youthRef = useRef<HTMLButtonElement>(null);
  const programmingRef = useRef<HTMLButtonElement>(null);
  const leadsRef = useRef<HTMLButtonElement>(null);
  const staffRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);

  const youth = useFloatingMenu(
    youthRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 70 },
  );
  const programming = useFloatingMenu(
    programmingRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 150 },
  );
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
  const closeYouth = youth.close;
  const closeProgramming = programming.close;
  const closeLeads = leads.close;
  const closeStaff = staff.close;
  const closeSettings = settings.close;

  const closeAllMenus = useCallback((except?: MenuName) => {
    if (except !== 'youth') closeYouth();
    if (except !== 'programming') closeProgramming();
    if (except !== 'leads') closeLeads();
    if (except !== 'staff') closeStaff();
    if (except !== 'settings') closeSettings();
  }, [closeLeads, closeProgramming, closeSettings, closeStaff, closeYouth]);

  const toggleMenu = (menu: MenuName) => {
    closeAllMenus(menu);
    ({ youth, programming, staff, leads, settings })[menu].toggle();
  };

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
    closeAllMenus();
  };

  useEffect(() => {
    closeAllMenus();
  }, [closeAllMenus, location.pathname]);

  const canViewCohorts = grantedPermissions.includes('read:cohorts');
  const canViewSessions = grantedPermissions.includes('read:sessions');
  const canViewTasks = grantedPermissions.includes('read:tasks');
  const canViewHours = grantedPermissions.includes('read:hours');

  return {
    isAuthenticated,
    logout,
    mobileOpen,
    setMobileOpen,
    refs: { youth: youthRef, programming: programmingRef, staff: staffRef, leads: leadsRef, settings: settingsRef },
    menus: { youth, programming, staff, leads, settings },
    permissions: {
      canManageHomepage: grantedPermissions.includes('read:homepage'),
      canViewYouth: grantedPermissions.includes('read:youth_profiles'),
      canViewLeads: grantedPermissions.includes('read:outreach'),
      canViewCohorts,
      canViewSessions,
      canViewProgramming: canViewCohorts || canViewSessions,
      canManageAccounts: grantedPermissions.includes('read:accounts'),
      canManageProgramming: grantedPermissions.includes('write:programs'),
      canViewTasks,
      canViewHours,
      canViewStaff: canViewTasks || canViewHours,
    },
    active: {
      settings: location.pathname.startsWith('/settings'),
      leads: location.pathname.startsWith('/leads'),
      youth: location.pathname.startsWith('/youth'),
      programming: location.pathname.startsWith('/programming'),
      staff: location.pathname.startsWith('/staff'),
    },
    isActive: (path: string) => location.pathname === path,
    go,
    toggleMenu,
  };
}
