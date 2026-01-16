import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Search, PlusSquare, User, LogIn } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleNavClick = (path, requiresAuth = false) => {
    if (requiresAuth && !user) {
      navigate('/auth');
    } else {
      navigate(path);
    }
  };

  const navItems = [
    { icon: Home, path: '/', label: 'Home', requiresAuth: false },
    { icon: Search, path: '/search', label: 'Search', requiresAuth: false },
    { icon: PlusSquare, path: '/upload', label: 'Upload', requiresAuth: true },
    { icon: user ? User : LogIn, path: user ? `/profile/${user.id}` : '/auth', label: user ? 'Profile' : 'Login', requiresAuth: false },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/auth') return location.pathname === '/auth';
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/5 pb-safe"
      data-testid="navbar"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div className="max-w-lg mx-auto flex justify-around items-center h-16 px-4">
        {navItems.map(({ icon: Icon, path, label, requiresAuth }) => (
          <button
            key={label}
            onClick={() => handleNavClick(path, requiresAuth)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors active-scale ${
              isActive(path) 
                ? 'text-white' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            data-testid={`nav-${label.toLowerCase()}`}
          >
            <Icon 
              className={`w-6 h-6 ${isActive(path) ? 'stroke-[2.5]' : ''}`}
              fill={isActive(path) && path === '/' ? 'currentColor' : 'none'}
            />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
