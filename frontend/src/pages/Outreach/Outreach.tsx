import { NavLink, Outlet } from 'react-router-dom';
import Header from '../../common/components/Header/Header';
import './Outreach.css';

export default function Outreach() {
  return (
    <>
      <Header />
      <main className="page-container outreach-page">
        <div className="page-header outreach-header">
          <div className="page-title-row">
            <h1 className="page-title">Outreach</h1>
          </div>
          <nav className="outreach-tabs" aria-label="Outreach views">
            <NavLink
              to="submissions"
              className={({ isActive }) => `outreach-tab${isActive ? ' active' : ''}`}
            >
              Public Interest
            </NavLink>
            <NavLink
              to="leads"
              className={({ isActive }) => `outreach-tab${isActive ? ' active' : ''}`}
            >
              Leads
            </NavLink>
          </nav>
        </div>
        <Outlet />
      </main>
    </>
  );
}
