"use client";
import React from 'react';
import { useTheme, Theme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { UserRole } from '../types';
import { SunIcon, MoonIcon, UserCircleIcon, LogoutIcon, PlusCircleIcon, UserPlusIcon, UserCogIcon, SearchIcon } from './custom-icons';
import { APP_TITLE } from '../lib/constants';
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout } = useAuth();
  const { 
    setShowAddProjectModal, 
    setShowCreateUserModal, 
    setShowManageAccessModal,
    searchTerm,
    setSearchTerm,
    isFocusMode,
    setIsFocusMode,
  } = useData();

  const canCreateProject = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.ORG_MAINTAINER;
  const canCreateUser = currentUser?.role === UserRole.ADMIN;
  const canManageUsers = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.ORG_MAINTAINER;
  
  return (
    <nav className="bg-neutral-200 dark:bg-neutral-800 p-4 shadow-md flex justify-between items-center flex-wrap gap-4">
      <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{APP_TITLE}</h1>
      
      <div className="flex-1 flex justify-center items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="relative flex-grow max-w-xl">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-500 dark:text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Search by project or task title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md bg-neutral-100 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex items-center">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch
                  id="focus-mode-switch"
                  checked={isFocusMode}
                  onCheckedChange={setIsFocusMode}
                  aria-label="Toggle Focus Mode"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Focus Mode: {isFocusMode ? 'ON' : 'OFF'}</p>
              </TooltipContent>
            </Tooltip>

            {canCreateProject && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowAddProjectModal(true)}
                    className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Create New Project"
                  >
                    <PlusCircleIcon className="w-6 h-6" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create New Project</p>
                </TooltipContent>
              </Tooltip>
            )}

            {canCreateUser && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Create New User"
                  >
                    <UserPlusIcon className="w-6 h-6" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create New User</p>
                </TooltipContent>
              </Tooltip>
            )}

            {canManageUsers && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowManageAccessModal(true)}
                    className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                    aria-label="Manage User Access"
                  >
                    <UserCogIcon className="w-6 h-6" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Manage User Access</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                  aria-label={theme === Theme.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                >
                  {theme === Theme.LIGHT ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{theme === Theme.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</p>
              </TooltipContent>
            </Tooltip>

            {currentUser ? (
              <div className="flex items-center space-x-2">
                {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <UserCircleIcon className="w-8 h-8 text-neutral-600 dark:text-neutral-300" />
                )}
                <span className="text-sm hidden sm:inline">{currentUser.name} ({currentUser.role.replace('_', ' ')})</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={logout}
                      className="p-2 rounded-full hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                      aria-label="Logout"
                    >
                      <LogoutIcon className="w-6 h-6" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Logout</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="text-sm text-neutral-500 dark:text-neutral-400"></div>
            )}
          </div>
        </TooltipProvider>
      </div>
    </nav>
  );
};

export default Navbar;
