import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Shield } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/admin/login`, formData);
      const { access_token, user } = response.data;
      localStorage.setItem('adminToken', access_token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      toast.success('Welcome Admin!');
      navigate('/admin/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center glow-primary">
            <Shield className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="font-unbounded font-black text-3xl tracking-tighter uppercase bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
          Admin Panel
        </h1>
        <p className="text-zinc-500 text-sm mt-2">TikVerse Management</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm glass rounded-2xl p-6 fade-in" data-testid="admin-login-card">
        <h2 className="font-unbounded font-bold text-xl text-center mb-6">
          Admin Login
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-400">Admin Email</Label>
            <Input
              id="email"
              data-testid="admin-email-input"
              type="email"
              placeholder="admin@tikverse.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-zinc-900/50 border-zinc-800 focus:border-red-500 h-12 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-400">Password</Label>
            <div className="relative">
              <Input
                id="password"
                data-testid="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-zinc-900/50 border-zinc-800 focus:border-red-500 h-12 rounded-xl pr-12"
                required
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
            data-testid="admin-login-button"
            disabled={loading}
            className="w-full h-12 rounded-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 font-semibold text-base active-scale"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Access Admin Panel'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-zinc-500 hover:text-white transition-colors text-sm"
          >
            ← Back to TikVerse
          </button>
        </div>
      </div>
    </div>
  );
}
