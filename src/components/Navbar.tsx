
"use client";
import React from 'react';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole } from '../types';
import { SunIcon, MoonIcon, UserCircleIcon, LogoutIcon, PlusCircleIcon, UserPlusIcon } from './custom-icons';
import { APP_TITLE } from '../lib/constants';

const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const { setShowAddProjectModal, setShowCreateUserModal } = useData();
  
  return (
    <nav className="bg-neutral-200 dark:bg-neutral-800 p-4 shadow-md flex justify-between items-center flex-wrap gap-2">
      <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{APP_TITLE}</h1>
      <div className="flex items-center space-x-2 sm:space-x-4">
        {currentUser?.role === UserRole.ADMIN && (
          <>
            <button
              onClick={() => setShowAddProjectModal(true)}
              className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              title="Create New Project"
              aria-label="Create New Project"
            >
              <PlusCircleIcon className="w-6 h-6" />
            </button>
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              title="Create New User Profile"
              aria-label="Create New User Profile"
            >
              <UserPlusIcon className="w-6 h-6" />
            </button>
          </>
        )}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          title={theme === Theme.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={theme === Theme.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === Theme.LIGHT ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
        </button>
        {currentUser ? (
          <div className="flex items-center space-x-2">
            {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
                <UserCircleIcon className="w-8 h-8 text-neutral-600 dark:text-neutral-300" />
            )}
            <span className="text-sm hidden sm:inline">{currentUser.name} ({currentUser.role})</span>
            <button
              onClick={logout}
              className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogoutIcon className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <div className="text-sm text-neutral-500 dark:text-neutral-400"></div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
