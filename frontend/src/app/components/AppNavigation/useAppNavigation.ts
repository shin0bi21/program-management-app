import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/authContext';
import { useFloatingMenu } from '../../../common/components/FloatingMenu/hooks/useFloatingMenu';

type MenuName = 'staff' | 'leads' | 'settings' | 'programming' | 'homepage';

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions: grantedPermissions, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const leadsRef = useRef<HTMLButtonElement>(null);
  const staffRef = useRef<HTMLButtonElement>(null);
  const programmingRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const homepageRef = useRef<HTMLButtonElement>(null);

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
  const homepage = useFloatingMenu(homepageRef, { side: 'right', align: 'start' }, { widthEstimate: 180, heightEstimate: 100 });
  const closeProgramming = programming.close;
  const closeLeads = leads.close;
  const closeStaff = staff.close;
  const closeSettings = settings.close;
  const closeHomepage = homepage.close;

  const closeAllMenus = useCallback((except?: MenuName) => {
    if (except !== 'leads') closeLeads();
    if (except !== 'staff') closeStaff();
    if (except !== 'settings') closeSettings();
    if (except !== 'programming') closeProgramming();
    if (except !== 'homepage') closeHomepage();
  }, [closeLeads, closeSettings, closeStaff, closeProgramming, closeHomepage]);

  const toggleMenu = (menu: MenuName) => {
    closeAllMenus(menu);
    ({ staff, leads, settings, programming, homepage })[menu].toggle();
  };

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
    refs: { staff: staffRef, leads: leadsRef, settings: settingsRef, programming: programmingRef, homepage: homepageRef },
    menus: { staff, leads, settings, programming, homepage },
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
    isActive: (path: string) => location.pathname === path,
    go,
    toggleMenu,
  };
}
