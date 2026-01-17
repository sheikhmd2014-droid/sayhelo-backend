import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Search, PlusSquare, User, LogIn, Radio, Coins } from 'lucide-react';

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
    { icon: Radio, path: '/live', label: 'Live', requiresAuth: false },
    { icon: PlusSquare, path: '/upload', label: 'Upload', requiresAuth: true },
    { icon: Coins, path: '/coins', label: 'Coins', requiresAuth: true },
    { icon: user ? User : LogIn, path: user ? `/profile/${user.id}` : '/auth', label: user ? 'Profile' : 'Login', requiresAuth: false },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/auth') return location.pathname === '/auth';
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-12 left-0 right-0 z-40 glass border-t border-white/5 rounded-t-2xl mx-2"
      data-testid="navbar"
    >
      <div className="max-w-lg mx-auto flex justify-around items-center h-14 px-4">
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
