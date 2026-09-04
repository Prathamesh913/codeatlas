import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import '../styles/global.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.example.com';

export function LoginButton() {
  const { login, isLoading } = useAuthStore();

  const handleClick = async () => {
    await login();
  };

  return (
    <Button onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Signing in...' : 'Sign In'}
    </Button>
  );
}

export default LoginButton;
