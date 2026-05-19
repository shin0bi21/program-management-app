import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../Button/Button';
import './PublicTopBar.css';

export default function PublicTopBar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className={`public-topbar${scrolled ? ' public-topbar--scrolled' : ''}`}>
      <button className="topbar-logo-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <img src="/logo.jpg" alt="Be Original Youth Group" className="topbar-logo" />
      </button>

      <nav className="topbar-nav" aria-label="Page sections">
        <button className="topbar-link" onClick={() => scrollTo('programming')}>Programming</button>
        <button className="topbar-link" onClick={() => scrollTo('about')}>Organizational History</button>
        <button className="topbar-link" onClick={() => scrollTo('impact')}>Impact</button>
        <button className="topbar-link" onClick={() => scrollTo('team')}>Staff</button>
        <button className="topbar-link" onClick={() => scrollTo('partners')}>Partners</button>
      </nav>

      <Button className="topbar-login-btn" onClick={() => navigate('/login')}>
        Login
      </Button>

      <div className="topbar-mobile-controls" ref={menuRef}>
        <button
          className="topbar-hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(prev => !prev)}
        >
          <span className={`hamburger-icon${menuOpen ? ' hamburger-icon--open' : ''}`}>
            <span /><span /><span />
          </span>
        </button>

        {menuOpen && (
          <div className="topbar-mobile-menu">
            <button className="topbar-link" onClick={() => scrollTo('programming')}>Programming</button>
            <button className="topbar-link" onClick={() => scrollTo('about')}>Organizational History</button>
            <button className="topbar-link" onClick={() => scrollTo('impact')}>Impact</button>
            <button className="topbar-link" onClick={() => scrollTo('team')}>Staff</button>
            <button className="topbar-link" onClick={() => scrollTo('partners')}>Partners</button>
            <Button className="topbar-login-btn topbar-login-btn--mobile" onClick={() => { setMenuOpen(false); navigate('/login'); }}>
              Login
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
