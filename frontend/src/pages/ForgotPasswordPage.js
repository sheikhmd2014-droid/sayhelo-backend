import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Key, CheckCircle } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: email, 2: code, 3: success
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedCode, setGeneratedCode] = useState(''); // For demo display
  
  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/forgot-password`, { email });
      if (response.data.success) {
        // For demo, show the code (in production, this would be sent via email)
        if (response.data.reset_code) {
          setGeneratedCode(response.data.reset_code);
          toast.success(`Reset code: ${response.data.reset_code}`);
        }
        setStep(2);
        toast.info('Enter the reset code to continue');
      }
    } catch (error) {
      toast.error('Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!resetCode) {
      toast.error('Please enter the reset code');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/reset-password`, {
        email,
        reset_code: resetCode,
        new_password: newPassword
      });
      
      if (response.data.success) {
        setStep(3);
        toast.success('Password reset successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4">
      {/* Back button */}
      <button
        onClick={() => navigate('/auth')}
        className="absolute top-4 left-4 p-2 hover:bg-zinc-800 rounded-full transition-colors"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="w-full max-w-sm">
        {/* Step 1: Enter Email */}
        {step === 1 && (
          <div className="glass rounded-2xl p-6 fade-in" data-testid="forgot-step-1">
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
                <Mail className="w-7 h-7 text-white" />
              </div>
            </div>
            
            <h2 className="font-unbounded font-bold text-xl text-center mb-2">
              Forgot Password?
            </h2>
            <p className="text-zinc-500 text-sm text-center mb-6">
              Enter your email and we'll send you a reset code
            </p>

            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-400">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl"
                  required
                  data-testid="forgot-email-input"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold"
                data-testid="send-code-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Send Reset Code'
                )}
              </Button>
            </form>

            <button
              onClick={() => navigate('/auth')}
              className="w-full mt-4 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Step 2: Enter Code & New Password */}
        {step === 2 && (
          <div className="glass rounded-2xl p-6 fade-in" data-testid="forgot-step-2">
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
                <Key className="w-7 h-7 text-white" />
              </div>
            </div>
            
            <h2 className="font-unbounded font-bold text-xl text-center mb-2">
              Reset Password
            </h2>
            <p className="text-zinc-500 text-sm text-center mb-6">
              Enter the code and your new password
            </p>

            {/* Demo: Show generated code */}
            {generatedCode && (
              <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
                <p className="text-xs text-zinc-400 mb-1">Your Reset Code (Demo)</p>
                <p className="font-mono text-2xl font-bold text-green-500 tracking-widest">
                  {generatedCode}
                </p>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-zinc-400">Reset Code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl text-center tracking-widest text-lg"
                  maxLength={6}
                  required
                  data-testid="reset-code-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-zinc-400">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl"
                  minLength={6}
                  required
                  data-testid="new-password-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-400">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-800 focus:border-primary h-12 rounded-xl"
                  minLength={6}
                  required
                  data-testid="confirm-password-input"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold"
                data-testid="reset-password-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>

            <button
              onClick={() => setStep(1)}
              className="w-full mt-4 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="glass rounded-2xl p-6 fade-in text-center" data-testid="forgot-step-3">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <h2 className="font-unbounded font-bold text-xl mb-2">
              Password Reset!
            </h2>
            <p className="text-zinc-500 text-sm mb-6">
              Your password has been successfully reset. You can now login with your new password.
            </p>

            <Button
              onClick={() => navigate('/auth')}
              className="w-full h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 font-semibold"
              data-testid="go-to-login-btn"
            >
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
