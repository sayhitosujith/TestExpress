import React from 'react';
import emblem from '../assets/emblem.png'; // Adjust path if needed
import { useAuth } from './context/AuthContext';

const Header = () => {
  const { user } = useAuth();
  const display = user && user.mobile ? user.mobile : 'Guest';

  return (
    <div className="flex items-center justify-between px-6 py-4 shadow-md bg-white fixed top-0 left-0 right-0 z-50">
      <a href="/HomePage">
        <img src={emblem} alt="App Logo" style={{ height: '40px', width: 'auto' }} />
      </a>
      <div className="text-sm text-gray-700">Signed in as <strong>{display}</strong></div>
    </div>
  );
};

export default Header;
