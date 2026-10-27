import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoUrl from '../../../../../assets/logo.webp';
import logo160Url from '../../../../../assets/logo-160.webp';
import logo320Url from '../../../../../assets/logo-320.webp';
import { useAuth } from '../../../../../auth/authContext';
import { useFloatingMenu } from '../../../../../common/components/FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../../../../../common/components/FloatingMenu/FloatingMenuPanel';
import { scrollToHomepageSection } from '../../hooks/useSectionRouting';
import { getHomepageSectionByPath, HOMEPAGE_NAV_SECTIONS } from '../../utils/homepageSections';
import usePublicTopBarScroll from './hooks/usePublicTopBarScroll';
import './PublicTopBar.css';

interface PublicTopBarProps {
  signupEnabled: boolean;
}

export default function PublicTopBar({ signupEnabled }: PublicTopBarProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const activeSectionId = getHomepageSectionByPath(location.pathname)?.id;
  const visibleSections = HOMEPAGE_NAV_SECTIONS.filter(
    ({ id }) => signupEnabled || id !== 'signup',
  );
  const scrolled = usePublicTopBarScroll();
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const {
    isOpen: menuOpen,
    toggle,
    close,
    position: menuPosition,
    menuRef,
  } = useFloatingMenu(
    hamburgerRef,
    { side: 'bottom', align: 'end' },
    { widthEstimate: 220, heightEstimate: 240 },
  );

  const handleSectionClick = () => {
    close();
  };

  const handleLogoClick = () => {
    close();
    scrollToHomepageSection('home');
  };

  return (
    <header className={`public-topbar${scrolled ? ' public-topbar--scrolled' : ''}`}>
      <Link
        to="/"
        className="topbar-logo-btn"
        onClick={handleLogoClick}
      >
        <img
          src={logo160Url}
          srcSet={`${logo160Url} 160w, ${logo320Url} 320w, ${logoUrl} 512w`}
          sizes="(min-width: 1360px) 5.1vw, 70px"
          width="160"
          height="101"
          alt="Be Original Youth Group"
          className="topbar-logo"
        />
      </Link>

      <nav className="topbar-nav" aria-label="Page sections">
        {visibleSections.map(({ id, path, label }) => (
          <Link
            key={id}
            to={path}
            className={`topbar-link${activeSectionId === id ? ' topbar-link--active' : ''}`}
            aria-current={activeSectionId === id ? 'page' : undefined}
            onClick={handleSectionClick}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="topbar-mobile-controls">
        <button
          ref={hamburgerRef}
          className="topbar-hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={toggle}
        >
          <span className={`hamburger-icon${menuOpen ? ' hamburger-icon--open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>

        {menuPosition && (
          <FloatingMenuPanel
            menuRef={menuRef}
            position={menuPosition}
            onClose={close}
            className="topbar-mobile-menu"
          >
            {visibleSections.map(({ id, path, label }) => (
              <Link
                key={id}
                to={path}
                role="menuitem"
                className={activeSectionId === id ? 'topbar-mobile-link--active' : undefined}
                aria-current={activeSectionId === id ? 'page' : undefined}
                onClick={handleSectionClick}
              >
                {label}
              </Link>
            ))}
          </FloatingMenuPanel>
        )}
      </div>

      <Link
        to={isAuthenticated ? '/settings/account' : '/login'}
        className="btn topbar-login-btn"
      >
        {isAuthenticated ? 'My Account' : 'Login'}
      </Link>
    </header>
  );
}
