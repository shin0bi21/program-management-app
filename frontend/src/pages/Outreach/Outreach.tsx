import { Outlet } from 'react-router-dom';
import Header from '../../common/components/Header/Header';
import './Outreach.css';

export default function Outreach() {
  return (
    <>
      <Header />
      <main className="page-container outreach-page">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Outreach</h1>
          </div>
        </div>
        <Outlet />
      </main>
    </>
  );
}
