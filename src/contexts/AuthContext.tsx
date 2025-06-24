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
    const [isSigningUp, setIsSigningUp] = useState(false); // Add this flag
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
        retryCount = 5, // Increased retry count for new users
        delay = 500 // Increased delay
    ): Promise<User | null> => {
        for (let i = 0; i < retryCount; i++) {
            try {
                const userProfile = await supabaseService.getUserProfile(authUserId);
                if (userProfile) {
                    return userProfile;
                }
                
                // If no profile found and this is not the last attempt, wait and retry
                if (i < retryCount - 1) {
                    console.log(`Profile not found for user ${authUserId}, attempt ${i + 1}/${retryCount}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    // Increase delay for subsequent attempts
                    delay = Math.min(delay * 1.5, 2000);
                }
            } catch (error) {
                console.error(`Attempt ${i + 1} to fetch profile failed:`, error);
                if (i < retryCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay = Math.min(delay * 1.5, 2000);
                }
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

            // If we're in the middle of signup, skip profile fetching
            // The signup process will handle the profile creation
            if (isSigningUp) {
                console.log('Signup in progress, skipping profile fetch');
                setSupabaseUser(session.user);
                return;
            }

            setSupabaseUser(session.user);
            
            const userProfile = await fetchUserProfile(session.user.id);

            if (userProfile) {
                setCurrentUser(userProfile);
                await fetchPublicUsers(userProfile.organization_id);
            } else {
                console.error('Could not retrieve user profile after multiple attempts');
                
                // Check if this might be a new user who just signed up
                const isNewUser = session.user.created_at && 
                    new Date(session.user.created_at).getTime() > Date.now() - 60000;
                
                if (isNewUser) {
                    toast({
                        title: "Account Setup",
                        description: "Your account is being set up. Please wait a moment and try refreshing the page.",
                        variant: "default",
                    });
                } else {
                    toast({
                        title: "Login Error",
                        description: "Could not retrieve your user profile. Please try logging in again or contact support.",
                        variant: "destructive",
                    });
                }
                
                await supabaseService.signOutUser();
                return;
            }
        } catch (error) {
            console.error('Error handling session:', error);
            toast({
                title: "Authentication Error",
                description: "An error occurred during authentication. Please try again.",
                variant: "destructive",
            });
        } finally {
            if (session && !isSigningUp) {
                setLoadingAuth(false);
            }
        }
    }, [fetchUserProfile, fetchPublicUsers, toast, isSigningUp]);

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
            // Set up the auth state change listener first
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

                if (event === 'SIGNED_OUT') {
                    // Handle sign out
                    setCurrentUser(null);
                    setSupabaseUser(null);
                    setUsers([]);
                    setIsResettingPassword(false);
                    setLoadingAuth(false);
                    router.push('/');
                    return;
                }
                
                await handleSession(session);
            });

            subscription = authSubscription;

            // Then try to get the current session
            const { data: { session }, error } = await supabaseService.supabase.auth.getSession();
            
            if (error) {
                console.error('Error getting initial session:', error);
                setLoadingAuth(false);
            } else {
                // Handle the initial session
                await handleSession(session);
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
}, [handleSession, toast, forceStopLoading, router]);


    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            setLoadingAuth(true); // Set loading state during login
            const { success, error } = await supabaseService.signInUser(email, password);
            
            if (success) {
                // Don't set loading to false here - let the auth state change handle it
                return { success: true };
            } else {
                setLoadingAuth(false); // Only set loading to false on error
                return { success: false, error: error?.message || "An unknown error occurred." };
            }
        } catch (error) {
            console.error('Login error:', error);
            setLoadingAuth(false);
            return { success: false, error: "An unexpected error occurred during login." };
        }
    };


    const signUp = async (email: string, password: string, name: string, organizationName: string) => {
        try {
            setIsSigningUp(true); // Set the signup flag
            setLoadingAuth(true);
            
            const { success, error } = await supabaseService.signUpUserAndCreateOrg(email, password, name, organizationName);
            
            if (success) {
                // After successful signup, we need to manually fetch the profile
                // since we skipped it in handleSession
                try {
                    // Get the current session to get the user ID
                    const { data: { session } } = await supabaseService.supabase!.auth.getSession();
                    
                    if (session?.user) {
                        // Fetch the newly created profile
                        const userProfile = await fetchUserProfile(session.user.id, 8, 1000); // More retries with longer delay
                        
                        if (userProfile) {
                            setCurrentUser(userProfile);
                            await fetchPublicUsers(userProfile.organization_id);
                            
                            toast({
                                title: "Account Created",
                                description: "Welcome! Your account and organization have been created successfully.",
                            });
                        } else {
                            throw new Error('Profile not found after signup');
                        }
                    }
                } catch (profileError) {
                    console.error('Error fetching profile after signup:', profileError);
                    toast({
                        title: "Account Created",
                        description: "Account created successfully! Please refresh the page to continue.",
                    });
                }
                
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
        } finally {
            setIsSigningUp(false); // Clear the signup flag
            setLoadingAuth(false);
        }
    };


    const logout = async () => {
        try {
            const { error } = await supabaseService.signOutUser();
            
            if (error) {
                console.warn("Logout completed with warning:", error);
            }
            
            toast({
                title: "Logged Out",
                description: "You have been logged out successfully.",
            });
            
            // Don't manually clear state here - let the auth listener handle it
            // Don't navigate here either - let the auth state change trigger the UI update
            
        } catch (error) {
            console.error("Unexpected error during logout:", error);
            toast({
                title: "Logged Out",
                description: "You have been logged out.",
            });
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
