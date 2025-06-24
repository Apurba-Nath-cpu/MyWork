"use client";
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as supabaseService from '../services/supabaseService';
import { User, AuthContextType } from '../types';
import { useToast } from "@/hooks/use-toast";
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Maximum time to wait for initial authentication check (in milliseconds)
const AUTH_TIMEOUT = 10000; // 10 seconds

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const fetchPublicUsers = useCallback(async (organizationId: string) => {
        try {
            const publicUsers = await supabaseService.getUsers(organizationId);
            setUsers(publicUsers);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            setUsers([]);
        }
    }, []);

    const fetchUserProfile = useCallback(async (
        authUserId: string, 
        retryCount = 3, 
        delay = 300
    ): Promise<User | null> => {
        for (let i = 0; i < retryCount; i++) {
            try {
                const userProfile = await supabaseService.getUserProfile(authUserId);
                if (userProfile) {
                    return userProfile;
                }
            } catch (error) {
                console.error(`Attempt ${i + 1} to fetch profile failed:`, error);
            }
            if (i < retryCount - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    }, []);
    
    const handleSession = useCallback(async (session: Session | null) => {
        try {
            if (!session) {
                setCurrentUser(null);
                setSupabaseUser(null);
                setUsers([]);
                setIsResettingPassword(false);
                setLoadingAuth(false);
                return;
            }

            setSupabaseUser(session.user);
            const userProfile = await fetchUserProfile(session.user.id);

            if (userProfile) {
                setCurrentUser(userProfile);
                await fetchPublicUsers(userProfile.organization_id);
            } else {
                console.error('Could not retrieve user profile');
                toast({
                    title: "Login Error",
                    description: "Could not retrieve your user profile. Please try logging in again or contact support.",
                    variant: "destructive",
                });
                // Sign out the user since we can't get their profile
                await supabaseService.signOutUser();
                setCurrentUser(null);
                setSupabaseUser(null);
                setUsers([]);
                return; // Don't set loading to false here, let the SIGNED_OUT event handle it
            }
        } catch (error) {
            console.error('Error handling session:', error);
            toast({
                title: "Authentication Error",
                description: "An error occurred during authentication. Please try again.",
                variant: "destructive",
            });
            // Clear state on error
            setCurrentUser(null);
            setSupabaseUser(null);
            setUsers([]);
        } finally {
            setLoadingAuth(false);
        }
    }, [fetchUserProfile, fetchPublicUsers, toast]);

    // Function to force stop loading after timeout
    const forceStopLoading = useCallback(() => {
        console.warn('Authentication timeout reached, stopping loading state');
        setLoadingAuth(false);
    }, []);

    useEffect(() => {
        let authTimeout: NodeJS.Timeout;
        let subscription: any;

        const initializeAuth = async () => {
            if (!supabaseService.supabase) {
                console.error("Supabase client is not initialized. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.");
                toast({
                    title: "Application Not Configured",
                    description: "The connection to the backend is not set up. Please check your environment variables.",
                    variant: "destructive",
                    duration: Infinity,
                });
                setLoadingAuth(false);
                return;
            }

            // Set up timeout to prevent infinite loading
            authTimeout = setTimeout(forceStopLoading, AUTH_TIMEOUT);

            try {
                // First, try to get the current session immediately
                const { data: { session }, error } = await supabaseService.supabase.auth.getSession();
                
                if (error) {
                    console.error('Error getting initial session:', error);
                } else if (session) {
                    // We have an immediate session, handle it
                    console.log('Found immediate session');
                    clearTimeout(authTimeout);
                    await handleSession(session);
                    return; // Exit early since we handled the session
                }

                // Set up the auth state change listener
                const { data: { subscription: authSubscription } } = supabaseService.onAuthStateChange(async (event, session) => {
                    console.log('Auth state change:', event, !!session);
                    
                    // Clear timeout since we got an auth event
                    if (authTimeout) {
                        clearTimeout(authTimeout);
                    }

                    if (event === 'PASSWORD_RECOVERY') {
                        setIsResettingPassword(true);
                        setLoadingAuth(false);
                        return;
                    }

                    if (event === 'SIGNED_IN') {
                        setIsResettingPassword(false);
                    }
                    
                    await handleSession(session);
                });

                subscription = authSubscription;

                // If we don't have an immediate session, set a shorter timeout for the listener
                if (!session) {
                    authTimeout = setTimeout(() => {
                        console.log('No session found after timeout, user is not authenticated');
                        setLoadingAuth(false);
                    }, 3000); // Shorter timeout for listener-based auth
                }

            } catch (error) {
                console.error('Error initializing auth:', error);
                clearTimeout(authTimeout);
                setLoadingAuth(false);
                toast({
                    title: "Authentication Error",
                    description: "Failed to initialize authentication. Please refresh the page.",
                    variant: "destructive",
                });
            }
        };

        initializeAuth();

        return () => {
            if (authTimeout) {
                clearTimeout(authTimeout);
            }
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [handleSession, toast, forceStopLoading]);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { success, error } = await supabaseService.signInUser(email, password);
            if (success) {
                return { success: true };
            }
            return { success: false, error: error?.message || "An unknown error occurred." };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: "An unexpected error occurred during login." };
        }
    };

    const signUp = async (email: string, password: string, name: string, organizationName: string) => {
        try {
            const { success, error } = await supabaseService.signUpUserAndCreateOrg(email, password, name, organizationName);
            if (success) {
                toast({
                    title: "Account Created",
                    description: "Success! Please check your email to confirm your account.",
                });
                return { success: true };
            } else {
                return { 
                    success: false, 
                    error: error?.message, 
                    isOrgNameConflict: error?.isOrgNameConflict, 
                    isEmailConflict: error?.isEmailConflict 
                };
            }
        } catch (error) {
            console.error('Sign up error:', error);
            return { 
                success: false, 
                error: "An unexpected error occurred during sign up." 
            };
        }
    };

    const logout = async () => {
        try {
            // Set loading state to prevent UI flickering
            setLoadingAuth(true);
            
            const { error } = await supabaseService.signOutUser();
            
            if (error) {
                console.warn("Logout completed with warning:", error);
            }
            
            // Clear the user state immediately
            setCurrentUser(null);
            setSupabaseUser(null);
            setUsers([]);
            setIsResettingPassword(false);
            
            toast({
                title: "Logged Out",
                description: "You have been logged out successfully.",
            });
            
            // Navigate after clearing state
            router.push('/'); 
            
        } catch (error) {
            console.error("Unexpected error during logout:", error);
            
            // Even on error, clear the state and navigate
            setCurrentUser(null);
            setSupabaseUser(null);
            setUsers([]);
            setIsResettingPassword(false);
            
            toast({
                title: "Logged Out",
                description: "You have been logged out.",
            });
            router.push('/');
        } finally {
            setLoadingAuth(false);
        }
    };
    
    const sendPasswordResetEmail = async (email: string) => {
        try {
            const { error } = await supabaseService.sendPasswordResetEmail(email);
            if (error) {
                toast({
                    title: "Error Sending Email",
                    description: error.message,
                    variant: "destructive",
                });
                return { success: false, error: error.message };
            }
            toast({
                title: "Password Reset Email Sent",
                description: "If an account exists, you'll receive reset instructions.",
            });
            return { success: true };
        } catch (error) {
            console.error('Password reset error:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred. Please try again.",
                variant: "destructive",
            });
            return { success: false, error: "An unexpected error occurred." };
        }
    };

    const updatePassword = async (password: string) => {
        try {
            const { error } = await supabaseService.updateUserPassword(password);
            if (error) {
                toast({
                    title: "Error Updating Password",
                    description: error.message,
                    variant: "destructive",
                });
                return { success: false, error: error.message };
            }
            toast({
                title: "Password Updated",
                description: "Your password has been changed. Please log in with your new password.",
            });
            await logout();
            return { success: true };
        } catch (error) {
            console.error('Update password error:', error);
            toast({
                title: "Error",
                description: "An unexpected error occurred while updating your password.",
                variant: "destructive",
            });
            return { success: false, error: "An unexpected error occurred." };
        }
    };

    const value: AuthContextType = { 
        currentUser, 
        supabaseUser,
        users,
        loadingAuth, 
        isResettingPassword,
        setIsResettingPassword,
        login, 
        signUp, 
        logout,
        fetchPublicUsers,
        sendPasswordResetEmail,
        updatePassword
    };

    return (
        <AuthContext.Provider value={value}>
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
