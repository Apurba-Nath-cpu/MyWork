
"use client";
import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect, useRef } from 'react';
import type { User, UserRole } from '../types';
import * as supabaseService from '../services/supabaseService';
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';
import type { SignUpError } from '../services/supabaseService'; // Import the custom error types

interface AuthContextType {
  currentUser: User | null; 
  supabaseUser: SupabaseAuthUser | null; 
  users: User[]; 
  loadingAuth: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string, role: UserRole, avatarFile?: File) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  createUser: (name: string, email: string, role: UserRole) => Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean}>; 
  fetchPublicUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const loadingAuthRef = useRef(loadingAuth); // Ref to track loadingAuth state

  useEffect(() => {
    loadingAuthRef.current = loadingAuth;
  }, [loadingAuth]);

  useEffect(() => {
    setLoadingAuth(true);
    const { data: authListener } = supabaseService.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        try {
          const authUserFromSession = session?.user || null;
          setSupabaseUser(authUserFromSession);

          if (authUserFromSession) {
            const userProfile = await supabaseService.getUserProfile(authUserFromSession.id);
            setCurrentUser(userProfile); 
            if (!userProfile) {
              console.warn(`No profile found in public.users for authenticated user ID: ${authUserFromSession.id}. User may need to complete profile creation or there's a data inconsistency.`);
            }
          } else {
            setCurrentUser(null);
          }
        } catch (error) {
            console.error("Error processing auth state change:", error);
            setCurrentUser(null); // Ensure clean state on error
        } finally {
            setLoadingAuth(false);
        }
      }
    );
    
     supabaseService.getSession().then(({ data: { session } }) => {
      if (!session && loadingAuthRef.current) { 
        setLoadingAuth(false);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []); 

  const fetchPublicUsers = useCallback(async () => {
    const fetchedUsers = await supabaseService.getUsers();
    setUsers(fetchedUsers);
  }, []);

  useEffect(() => {
    if (currentUser?.role === UserRole.ADMIN) {
      fetchPublicUsers();
    } else {
      // If user is not admin, ensure they only see themselves if needed, or an empty list
      // For suggestions, it might be better to have all users if permissions allow reading all names/ids
      // Or fetch only relevant users based on context (e.g., project members)
      // For now, clearing or setting to self if not admin.
      // setUsers(currentUser ? [currentUser] : []); // Example: only self if not admin
      setUsers([]); // Or empty if non-admins shouldn't list users
    }
  }, [currentUser, fetchPublicUsers]);


  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoadingAuth(true); 
    const { success, error } = await supabaseService.signInUser(email, password);
    if (!success) {
        setLoadingAuth(false); 
        return { success: false, error: error?.message || 'Invalid credentials or network issue.'};
    }
    // onAuthStateChange handles success and setLoadingAuth(false)
    return { success: true };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, role: UserRole, avatarFile?: File): Promise<{ success: boolean; error?: string }> => {
    setLoadingAuth(true);
    const { success, error, user } = await supabaseService.signUpUser(email, password, name, role, avatarFile);
    
    if (!success) {
      setLoadingAuth(false);
      if (error?.isEmailConflict) {
        return { success: false, error: "This email is already registered. Please try logging in or use a different email." };
      }
      return { success: false, error: error?.message || 'Could not create account.' };
    }
    
    if (user) {
      const { data: sessionData } = await supabaseService.getSession();
      if (!user.email_confirmed_at && sessionData.session === null) { 
          alert('Sign up successful! Please check your email to confirm your account.');
      } else {
          console.log('Sign up successful, user state will be updated by onAuthStateChange.');
      }
    }
    // setLoadingAuth will be handled by onAuthStateChange.
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    setLoadingAuth(true);
    await supabaseService.signOutUser();
    // onAuthStateChange will handle setting currentUser to null and setLoadingAuth to false
  }, []);

  const createUser = useCallback(async (name: string, email: string, role: UserRole): Promise<{success: boolean; user: User | null; error?: string; isEmailConflict?: boolean}> => {
    if (currentUser?.role !== UserRole.ADMIN) {
      alert("Only admins can create user profiles using this function.");
      return { success: false, user: null, error: "Permission denied." };
    }
    const { user: newUserProfile, error } = await supabaseService.createUserAccount(name, email, role);
    if (newUserProfile) {
      setUsers(prevUsers => [...prevUsers, newUserProfile].sort((a,b) => a.name.localeCompare(b.name)));
      alert(`User profile for ${name} created successfully in public.users.`);
      return { success: true, user: newUserProfile };
    } else {
      const errorMessage = error?.isEmailConflict ? "Email already in use." : (error?.message || `Failed to create user profile for ${name}.`);
      return { success: false, user: null, error: errorMessage, isEmailConflict: error?.isEmailConflict };
    }
  }, [currentUser]); 

  return (
    <AuthContext.Provider value={{ currentUser, supabaseUser, users, loadingAuth, login, signUp, logout, createUser, fetchPublicUsers }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
