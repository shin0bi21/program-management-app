import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../Button/Button';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import { HOMEPAGE_NAV_SECTIONS } from '../../utils/homepageSections';
import './PublicTopBar.css';

export default function PublicTopBar() {
  const navigate = useNavigate();
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

  return (
    <header className={`public-topbar${scrolled ? ' public-topbar--scrolled' : ''}`}>
      <Link
        to="/"
        className="topbar-logo-btn"
        onClick={() => {
          close();
        }}
      >
        <img src="/logo.jpg" alt="Be Original Youth Group" className="topbar-logo" />
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

      <Button className="topbar-login-btn" onClick={() => navigate('/login')}>
        Login
      </Button>
    </header>
  );
}
