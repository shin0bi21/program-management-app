import { Outlet } from 'react-router-dom';
import Header from '../../common/components/Header/Header';
import './Programming.css';

export default function ProgrammingLayout() {
  return (
    <>
      <Header />
      <main className="page-container page-container--data">
        <Outlet />
      </main>
    </>
  );
}
