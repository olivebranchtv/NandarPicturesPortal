import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader } from './ui/Card';

interface Admin {
  id: string;
  email: string;
  created_at: string;
}

export function AdminUserManagement() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);

    if (!supabase) {
      setError('Supabase not configured');
      setCreating(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create admin');
      }

      setSuccess('Admin account created successfully!');
      setEmail('');
      setPassword('');
      await fetchAdmins();
    } catch (err: any) {
      setError(err.message || 'Failed to create admin account');
    } finally {
      setCreating(false);
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
          <Shield className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Admin Management</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage administrator accounts
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <form onSubmit={createAdmin} className="space-y-4">
          <h3 className="font-semibold text-gray-900">Create New Admin</h3>

          <Input
            type="email"
            label="Admin Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
          />

          <Input
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Minimum 6 characters"
            minLength={6}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={creating}
            className="flex items-center space-x-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>{creating ? 'Creating...' : 'Create Admin Account'}</span>
          </Button>
        </form>

        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Current Administrators</h3>

          {admins.length === 0 ? (
            <p className="text-sm text-gray-500">No administrators found</p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{admin.email}</p>
                    <p className="text-xs text-gray-500">
                      Created {new Date(admin.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
