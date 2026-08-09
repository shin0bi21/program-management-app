import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoUrl from '../../../../assets/logo.webp';
import { useAuth } from '../../../../auth/authContext';
import { useFloatingMenu } from '../../../../common/components/FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../../../../common/components/FloatingMenu/FloatingMenuPanel';
import { HOMEPAGE_NAV_SECTIONS } from '../../homepageSections';
import { scrollToHomepageSection } from '../../hooks/useSectionRouting';
import './PublicTopBar.css';

export default function PublicTopBar() {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
        <img src={logoUrl} alt="Be Original Youth Group" className="topbar-logo" />
      </Link>

      <nav className="topbar-nav" aria-label="Page sections">
        {HOMEPAGE_NAV_SECTIONS.map(({ id, path, label }) => (
          <Link key={id} to={path} className="topbar-link" onClick={handleSectionClick}>
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
            {HOMEPAGE_NAV_SECTIONS.map(({ id, path, label }) => (
              <Link key={id} to={path} role="menuitem" onClick={handleSectionClick}>
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
