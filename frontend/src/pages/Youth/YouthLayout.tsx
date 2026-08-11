import { Outlet } from 'react-router-dom';

export default function YouthLayout() {
  return (
    <main className="page-container page-container--data">
      <Outlet />
    </main>
  );
}
