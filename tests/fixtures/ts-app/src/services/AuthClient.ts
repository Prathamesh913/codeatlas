const API_BASE = process.env.REACT_APP_API_URL || 'https://api.example.com';

export const AuthClient = {
  login: async () => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
    });
    return response.json();
  },
  logout: () => {
    // Clear session
  },
};
