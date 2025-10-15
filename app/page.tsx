// hooks/useUser.ts
import { useState, useEffect } from 'react';

interface UserInfo {
  firstName: string;
  lastName: string;
}

export const useUser = () => {
  const [user, setUser] = useState<UserInfo>({
    firstName: '',
    lastName: ''
  });

  const loadUser = () => {
    const firstName = localStorage.getItem('USER_FIRST_NAME') || '';
    const lastName = localStorage.getItem('USER_LAST_NAME') || '';
    
    console.log('Chargement user:', { firstName, lastName });
    
    setUser({ firstName, lastName });
  };

  useEffect(() => {
    // Charger au montage
    loadUser();

    // Écouter les changements
    window.addEventListener('user-updated', loadUser);
    window.addEventListener('storage', loadUser);

    return () => {
      window.removeEventListener('user-updated', loadUser);
      window.removeEventListener('storage', loadUser);
    };
  }, []);

  const getFullName = () => {
    return `${user.firstName} ${user.lastName}`.trim();
  };

  return { user, getFullName };
};
