import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { AppShell } from './components/AppShell';
import { BrandGlyph, Toaster } from './components/ui';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { Forgot } from './pages/auth/Forgot';
import { Reset } from './pages/auth/Reset';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Workout } from './pages/Workout';
import { SessionPage } from './pages/Session';
import { Nutrition } from './pages/Nutrition';
import { Kitchen } from './pages/Kitchen';
import { Profile } from './pages/Profile';
import { Progress } from './pages/Progress';
import { Admin } from './pages/Admin';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-logo"><BrandGlyph /></div>
      <span className="tiny faint">Loading…</span>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.onboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  if (!user?.isAdmin) return <Navigate to="/home" replace />;
  return <Outlet />;
}

function IndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={user ? (user.onboarded ? '/home' : '/onboarding') : '/login'} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <Routes>
          <Route path="/" element={<IndexRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password" element={<Reset />} />

          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<AppShell />}>
              <Route path="/home" element={<Home />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/workout/session/:id" element={<SessionPage />} />
              <Route path="/nutrition" element={<Nutrition />} />
              <Route path="/kitchen" element={<Kitchen />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/progress" element={<Progress />} />
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </UIProvider>
    </AuthProvider>
  );
}