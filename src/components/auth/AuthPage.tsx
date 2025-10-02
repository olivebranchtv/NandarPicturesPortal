import React, { useState } from 'react';
import { Login } from './Login';
import { SignUp } from './SignUp';

interface AuthPageProps {
  userType?: 'admin' | 'creator';
}

export function AuthPage({ userType = 'creator' }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);

  // Admins can only login, not sign up publicly
  if (userType === 'admin') {
    return <Login onToggleMode={() => {}} userType={userType} />;
  }

  return isLogin ? (
    <Login onToggleMode={() => setIsLogin(false)} userType={userType} />
  ) : (
    <SignUp onToggleMode={() => setIsLogin(true)} userType={userType} />
  );
}
