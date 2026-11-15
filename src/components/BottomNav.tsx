import { NavLink, useLocation } from 'react-router-dom';
import { House, Dumbbell, Salad, ChefHat, UserRound } from 'lucide-react';

const items = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Salad },
  { to: '/kitchen', label: 'Kitchen', icon: ChefHat },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to || (to === '/workout' && location.pathname.startsWith('/workout'));
        return (
          <NavLink key={to} to={to} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon size={20} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}