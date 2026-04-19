import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PublicTopBar.css';

export default function PublicTopBar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
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
        <button className="topbar-link" onClick={() => scrollTo('about')}>Program History</button>
        <button className="topbar-link" onClick={() => scrollTo('team')}>Staff</button>
      </nav>

      <button className="topbar-login" onClick={() => navigate('/login')}>
        Login
      </button>
    </header>
  );
}
