import { Outlet } from 'react-router-dom';
import './Outreach.css';

export default function Outreach() {
  return (
    <main className="page-container page-container--data outreach-page">
      <Outlet />
    </main>
  );
}
