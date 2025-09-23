import React, { useState, useEffect } from 'react';
import { User, Mail, MapPin, CreditCard, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSettings({ isOpen, onClose }: ProfileSettingsProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    paypal_email: '',
    venmo_username: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile && isOpen) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip_code: profile.zip_code || '',
        paypal_email: profile.paypal_email || '',
        venmo_username: profile.venmo_username || '',
      });
    }
  }, [profile, isOpen]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          paypal_email: formData.paypal_email,
          venmo_username: formData.venmo_username,
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update email in auth if changed
      if (formData.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email
        });

        if (emailError) {
          // If email update fails, show warning but don't fail the whole update
          setSuccess('Profile updated successfully! Email change requires verification - check your inbox.');
        } else {
          setSuccess('Profile updated successfully!');
        }
      } else {
        setSuccess('Profile updated successfully!');
      }

      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <User className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="flex items-center space-x-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter your first name"
                  />
                  <Input
                    label="Last Name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
                <Input
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email address"
                />
                <p className="text-xs text-gray-500">
                  Changing your email will require verification
                </p>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Address Information
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Street Address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter your street address"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="City"
                  />
                  <Input
                    label="State"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    placeholder="State"
                  />
                  <Input
                    label="ZIP Code"
                    value={formData.zip_code}
                    onChange={(e) => handleInputChange('zip_code', e.target.value)}
                    placeholder="ZIP"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-medium flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment Methods
                </h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="PayPal Email"
                  type="email"
                  value={formData.paypal_email}
                  onChange={(e) => handleInputChange('paypal_email', e.target.value)}
                  placeholder="Enter your PayPal email"
                />
                <Input
                  label="Venmo Username"
                  value={formData.venmo_username}
                  onChange={(e) => handleInputChange('venmo_username', e.target.value)}
                  placeholder="Enter your Venmo username"
                />
                <p className="text-xs text-gray-500">
                  Payment methods are used for revenue distributions and payments
                </p>
              </CardContent>
            </Card>

            {/* Status Messages */}
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}