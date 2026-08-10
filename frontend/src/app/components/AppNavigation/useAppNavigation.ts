import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/authContext';
import { useFloatingMenu } from '../../../common/components/FloatingMenu/hooks/useFloatingMenu';

type MenuName = 'youth' | 'programming' | 'outreach' | 'settings';

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, permissions: grantedPermissions, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const youthRef = useRef<HTMLButtonElement>(null);
  const programmingRef = useRef<HTMLButtonElement>(null);
  const outreachRef = useRef<HTMLButtonElement>(null);
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
  const outreach = useFloatingMenu(
    outreachRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 160, heightEstimate: 120 },
  );
  const settings = useFloatingMenu(
    settingsRef,
    { side: 'right', align: 'start' },
    { widthEstimate: 180, heightEstimate: 165 },
  );
  const closeYouth = youth.close;
  const closeProgramming = programming.close;
  const closeOutreach = outreach.close;
  const closeSettings = settings.close;

  const closeAllMenus = useCallback((except?: MenuName) => {
    if (except !== 'youth') closeYouth();
    if (except !== 'programming') closeProgramming();
    if (except !== 'outreach') closeOutreach();
    if (except !== 'settings') closeSettings();
  }, [closeOutreach, closeProgramming, closeSettings, closeYouth]);

  const toggleMenu = (menu: MenuName) => {
    closeAllMenus(menu);
    ({ youth, programming, outreach, settings })[menu].toggle();
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

  return {
    isAuthenticated,
    logout,
    mobileOpen,
    setMobileOpen,
    refs: { youth: youthRef, programming: programmingRef, outreach: outreachRef, settings: settingsRef },
    menus: { youth, programming, outreach, settings },
    permissions: {
      canManageHomepage: grantedPermissions.includes('read:homepage'),
      canViewYouth: grantedPermissions.includes('read:youth_profiles'),
      canViewOutreach: grantedPermissions.includes('read:outreach'),
      canViewCohorts,
      canViewSessions,
      canViewProgramming: canViewCohorts || canViewSessions,
      canManageAccounts: grantedPermissions.includes('read:accounts'),
      canViewTimesheets: grantedPermissions.includes('read:timesheets'),
    },
    active: {
      settings: location.pathname.startsWith('/settings'),
      outreach: location.pathname.startsWith('/outreach'),
      youth: location.pathname.startsWith('/youth'),
      programming: location.pathname.startsWith('/programming'),
      staff: location.pathname.startsWith('/staff'),
    },
    isActive: (path: string) => location.pathname === path,
    go,
    toggleMenu,
  };
}
