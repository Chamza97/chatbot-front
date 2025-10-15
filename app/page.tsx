// components/UserProfile.tsx
import React from 'react';
import { useUser } from '../hooks/useUser';

export const UserProfile: React.FC = () => {
  const { user, getFullName } = useUser();

  if (!user.firstName && !user.lastName) {
    return null; // Ou un loader
  }

  return (
    <div className="user-profile">
      <p>Bonjour, {getFullName()}</p>
    </div>
  );
};

// hooks/useUser.ts
import { useState, useEffect } from 'react';

interface UserInfo {
  firstName: string;
  lastName: string;
}

export const useUser = () => {
  const [user, setUser] = useState<UserInfo>({
    firstName: localStorage.getItem('USER_FIRST_NAME') || '',
    lastName: localStorage.getItem('USER_LAST_NAME') || ''
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setUser({
        firstName: localStorage.getItem('USER_FIRST_NAME') || '',
        lastName: localStorage.getItem('USER_LAST_NAME') || ''
      });
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getFullName = () => {
    return `${user.firstName} ${user.lastName}`.trim();
  };

  return { user, getFullName };
};
