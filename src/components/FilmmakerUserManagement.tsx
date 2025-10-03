import React, { useState, useEffect } from 'react';
import { UserPlus, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader } from './ui/Card';

interface Filmmaker {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

export function FilmmakerUserManagement() {
  const [filmmakers, setFilmmakers] = useState<Filmmaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  useEffect(() => {
    fetchFilmmakers();
  }, []);

  const fetchFilmmakers = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, created_at')
        .eq('role', 'filmmaker')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFilmmakers(data || []);
    } catch (err: any) {
      console.error('Error fetching filmmakers:', err);
    } finally {
      setLoading(false);
    }
  };

  const createFilmmaker = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTempPassword('');
    setCreating(true);

    if (!supabase) {
      setError('Supabase not configured');
      setCreating(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-filmmaker`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            first_name: firstName,
            last_name: lastName
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create filmmaker');
      }

      setSuccess(`Filmmaker created successfully! Temporary password: ${result.temporary_password}`);
      setTempPassword(result.temporary_password);
      setEmail('');
      setFirstName('');
      setLastName('');
      await fetchFilmmakers();
    } catch (err: any) {
      setError(err.message || 'Failed to create filmmaker account');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (filmmakerUserId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setResetError('');
    setResetSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-filmmaker-password`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: filmmakerUserId,
            new_password: newPassword
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setResetSuccess('Password reset successfully!');
      setNewPassword('');
      setTimeout(() => {
        setResettingPassword(null);
        setResetSuccess('');
      }, 2000);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <UserPlus className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Filmmaker Management</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage filmmaker accounts
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={createFilmmaker} className="space-y-4">
          <h3 className="font-semibold text-gray-900">Create New Filmmaker</h3>

          <Input
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="filmmaker@example.com"
          />

          <Input
            type="text"
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="John"
          />

          <Input
            type="text"
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="Doe"
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-2">
              <p className="text-sm text-green-600 font-medium">{success}</p>
              {tempPassword && (
                <div className="bg-white border border-green-300 rounded p-3 mt-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <Key className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold text-gray-700">Temporary Password:</span>
                  </div>
                  <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{tempPassword}</code>
                  <p className="text-xs text-gray-600 mt-2">
                    Share this password with the filmmaker. They can use it to sign in.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={creating}
            className="flex items-center space-x-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>{creating ? 'Creating...' : 'Create Filmmaker Account'}</span>
          </Button>
        </form>

        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">All Filmmakers</h3>

          {filmmakers.length === 0 ? (
            <p className="text-sm text-gray-500">No filmmakers found</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filmmakers.map((filmmaker) => (
                <div
                  key={filmmaker.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{filmmaker.email}</p>
                    <p className="text-sm text-gray-600">
                      {filmmaker.first_name} {filmmaker.last_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(filmmaker.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setResettingPassword(filmmaker.id);
                      setResetError('');
                      setResetSuccess('');
                      setNewPassword('');
                    }}
                    className="flex items-center space-x-1"
                  >
                    <Key className="h-3 w-3" />
                    <span>Reset Password</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Reset Password Modal */}
      {resettingPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Key className="h-5 w-5 mr-2 text-blue-600" />
                Reset Filmmaker Password
              </h3>

              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Filmmaker:</span>{' '}
                  {filmmakers.find(f => f.id === resettingPassword)?.email}
                </p>
              </div>

              <Input
                type="password"
                label="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                minLength={6}
              />

              {resetError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-sm text-red-600">{resetError}</p>
                </div>
              )}

              {resetSuccess && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm text-green-600">{resetSuccess}</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResettingPassword(null);
                    setNewPassword('');
                    setResetError('');
                    setResetSuccess('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleResetPassword(resettingPassword)}
                  disabled={!newPassword || newPassword.length < 6}
                >
                  Reset Password
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
