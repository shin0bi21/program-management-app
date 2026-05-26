import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button/Button';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import './PublicTopBar.css';

const NAV_ITEMS = [
  { id: 'programming', label: 'Programming' },
  { id: 'about', label: 'Organizational History' },
  { id: 'impact', label: 'Impact' },
  { id: 'team', label: 'Staff' },
  { id: 'partners', label: 'Partners' },
];

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

  const scrollTo = (id: string) => {
    close();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className={`public-topbar${scrolled ? ' public-topbar--scrolled' : ''}`}>
      <button className="topbar-logo-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <img src="/logo.jpg" alt="Be Original Youth Group" className="topbar-logo" />
      </button>

      <nav className="topbar-nav" aria-label="Page sections">
        {NAV_ITEMS.map(({ id, label }) => (
          <button key={id} className="topbar-link" onClick={() => scrollTo(id)}>
            {label}
          </button>
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
            {NAV_ITEMS.map(({ id, label }) => (
              <button key={id} role="menuitem" onClick={() => scrollTo(id)}>
                {label}
              </button>
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

