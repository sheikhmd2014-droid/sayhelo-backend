import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Play } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Welcome back!');
      } else {
        if (formData.username.length < 3) {
          toast.error('Username must be at least 3 characters');
          setLoading(false);
          return;
        }
        await register(formData.username, formData.email, formData.password);
        toast.success('Account created successfully!');
      }
      navigate('/');
    } catch (error) {
      const message = error.response?.data?.detail || 'Something went wrong';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center glow-primary">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        <h1 className="font-unbounded font-black text-4xl tracking-tighter uppercase bg-gradient-to-r from-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
          FunMastis
        </h1>
        <p className="text-zinc-500 text-sm mt-2">Watch, Create & Share Masti Videos</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm glass rounded-2xl p-6 fade-in" data-testid="auth-card">
        <h2 className="font-unbounded font-bold text-xl text-center mb-6">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-400">Username</Label>
              <Input
                id="username"
                data-testid="username-input"
                type="text"
                placeholder="yourname"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl"
                required={!isLogin}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-400">Email</Label>
            <Input
              id="email"
              data-testid="email-input"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-400">Password</Label>
            <div className="relative">
              <Input
                id="password"
                data-testid="password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl pr-12"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            data-testid="auth-submit-button"
            disabled={loading}
            className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold text-base active-scale"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            data-testid="toggle-auth-mode"
            onClick={() => {
              setIsLogin(!isLogin);
              setFormData({ username: '', email: '', password: '' });
            }}
            className="text-zinc-400 hover:text-white transition-colors text-sm"
          >
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <span className="text-fuchsia-500 font-semibold">
              {isLogin ? 'Sign Up' : 'Sign In'}
            </span>
          </button>
          
          {isLogin && (
            <button
              data-testid="forgot-password-link"
              onClick={() => navigate('/forgot-password')}
              className="block w-full mt-3 text-zinc-500 hover:text-fuchsia-400 transition-colors text-sm"
            >
              Forgot Password?
            </button>
          )}
        </div>
      </div>

      {/* Skip for guests */}
      <button
        data-testid="continue-as-guest"
        onClick={() => navigate('/')}
        className="mt-6 text-zinc-600 hover:text-zinc-400 transition-colors text-sm"
      >
        Continue as guest
      </button>
    </div>
  );
}
