import { useState, useEffect } from 'react';
import { User as AuthUser } from '@supabase/supabase-js';
import { supabase, User } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not configured') };
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // If login fails and this is an admin email, suggest they need to sign up first
    if (error && error.message === 'Invalid login credentials') {
      const adminEmails = [
        'nancycriss@yahoo.com',
        'sherri@olivebranch.tv',
        'nancy@olivebranch.tv',
        'info@olivebranchfilmstudios.com',
        'mail@nandarpictures.com'
      ];
      
      const isAdmin = adminEmails.includes(email.toLowerCase()) || 
                     email.toLowerCase().endsWith('@nandarpictures.com');
      
      if (isAdmin) {
        return { 
          error: new Error('Admin account not found. Please sign up first to create your admin account.') 
        };
      }
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Supabase not configured') };
    
    // Check if this is an admin email
    const adminEmails = [
      'nancycriss@yahoo.com',
      'sherri@olivebranch.tv',
      'nancy@olivebranch.tv',
      'info@olivebranchfilmstudios.com',
      'mail@nandarpictures.com'
    ];
    
    const isAdmin = adminEmails.includes(email.toLowerCase()) || 
                   email.toLowerCase().endsWith('@nandarpictures.com');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: isAdmin ? 'admin' : 'filmmaker'
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return { error: new Error('Supabase not configured') };
    
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };
}