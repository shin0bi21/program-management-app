export const HOMEPAGE_SECTIONS = [
  { id: 'home', path: '/', label: 'Home', showInNav: false },
  { id: 'programming', path: '/programming', label: 'Programming', showInNav: true },
  { id: 'signup', path: '/sign-up', label: 'Sign Up', showInNav: true },
  { id: 'about', path: '/about', label: 'Organizational History', showInNav: true },
  { id: 'team', path: '/team', label: 'Staff', showInNav: true },
  { id: 'partners', path: '/partners', label: 'Partners', showInNav: true },
] as const;

export type HomepageSectionId = (typeof HOMEPAGE_SECTIONS)[number]['id'];

export const HOMEPAGE_ROUTE_PATHS = HOMEPAGE_SECTIONS.map((section) => section.path);
export const HOMEPAGE_NAV_SECTIONS = HOMEPAGE_SECTIONS.filter((section) => section.showInNav);

function normalizePathname(pathname: string) {
  if (!pathname) return '/';
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

export function getHomepageSectionByPath(pathname: string) {
  const normalizedPathname = normalizePathname(pathname);
  return HOMEPAGE_SECTIONS.find((section) => section.path === normalizedPathname);
}

export function getHomepagePathBySectionId(sectionId: string) {
  return HOMEPAGE_SECTIONS.find((section) => section.id === sectionId)?.path;
}
