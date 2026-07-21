import { Outlet } from 'react-router-dom';
import Header from '../../common/components/Header/Header';

export default function YouthLayout() {
  return (
    <>
      <Header />
      <main className="page-container">
        <Outlet />
      </main>
    </>
  );
}
