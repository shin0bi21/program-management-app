import { Outlet } from 'react-router-dom';
import Header from '../../common/components/Header/Header';
import './Outreach.css';

export default function Outreach() {
  return (
    <>
      <Header />
      <main className="page-container page-container--data outreach-page">
        <Outlet />
      </main>
    </>
  );
}
