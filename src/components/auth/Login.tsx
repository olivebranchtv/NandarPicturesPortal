import React, { useState } from 'react';
import { Film, LogIn } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface LoginProps {
  onToggleMode: () => void;
}

export function Login({ onToggleMode }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      setError(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Film className="h-8 w-8 text-blue-600" />
            <span className="font-bold text-xl text-gray-900">
              Nandar Pictures
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Sign in to your account
          </h2>
          <p className="text-sm text-gray-600">
            Access your distribution portal
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
            
            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2"
            >
              <LogIn className="h-4 w-4" />
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            </Button>
          </form>

          <div className="mt-6 text-center">
            {userType === 'creator' && (
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={onToggleMode}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up here
                </button>
              </p>
            )}
            {userType === 'admin' && (
              <p className="text-xs text-gray-500">
                Admin accounts can only be created by existing administrators.
              </p>
            )}
            {userType === 'creator' && (
              <p className="text-xs text-gray-500 mt-4">
                Admin? <a href="/admin/login" className="text-blue-600 hover:text-blue-500">Sign in here</a>
              </p>
            )}
            {userType === 'admin' && (
              <p className="text-xs text-gray-500 mt-4">
                Creator? <a href="/login" className="text-blue-600 hover:text-blue-500">Sign in here</a>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}