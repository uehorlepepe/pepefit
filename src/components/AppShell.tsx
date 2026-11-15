import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <>
      <main className="app" key={location.pathname}>
        <Outlet />
      </main>
      <BottomNav />
    </>
  );
}