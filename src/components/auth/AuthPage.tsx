import React, { useState } from 'react';
import { Login } from './Login';
import { SignUp } from './SignUp';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return isLogin ? (
    <Login onToggleMode={() => setIsLogin(false)} />
  ) : (
    <SignUp onToggleMode={() => setIsLogin(true)} />
  );
}