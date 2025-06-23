"use client";
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as supabaseService from '../services/supabaseService';
import { User, AuthContextType } from '../types';
import { useToast } from "@/hooks/use-toast";
import type { Session, User as SupabaseAuthUser } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const fetchPublicUsers = useCallback(async (organizationId: string) => {
        const publicUsers = await supabaseService.getUsers(organizationId);
        setUsers(publicUsers);
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
    
    const handleSession = useCallback(async (session: Session) => {
        setSupabaseUser(session.user);
        const userProfile = await fetchUserProfile(session.user.id);

        if (userProfile) {
            setCurrentUser(userProfile);
            await fetchPublicUsers(userProfile.organization_id);
            setLoadingAuth(false); // Set loading false ONLY on full success
        } else {
            toast({
                title: "Login Error",
                description: "Could not retrieve your user profile. Please try logging in again or contact support.",
                variant: "destructive",
            });
            // This will trigger the 'SIGNED_OUT' event in the listener, which will then set loading to false.
            await supabaseService.signOutUser(); 
        }
    }, [fetchUserProfile, fetchPublicUsers, toast]);

    useEffect(() => {
        if (!supabaseService.supabase) {
            console.error("Supabase client is not initialized. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.");
            toast({
                title: "Application Not Configured",
                description: "The connection to the backend is not set up. Please check your environment variables.",
                variant: "destructive",
                duration: Infinity,
            });
            setLoadingAuth(false); // Unblock the UI
            return;
        }

        const { data: { subscription } } = supabaseService.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsResettingPassword(true);
                setLoadingAuth(false);
                return;
            }

            if (event === 'SIGNED_IN') {
                setIsResettingPassword(false);
            }
            
            if (session) {
                await handleSession(session);
            } else {
                setCurrentUser(null);
                setSupabaseUser(null);
                setUsers([]);
                setIsResettingPassword(false);
                setLoadingAuth(false);
            }
        });

        return () => {
            subscription?.unsubscribe();
        };
    }, [handleSession, toast]);

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        const { success, error } = await supabaseService.signInUser(email, password);
        if (success) {
            return { success: true };
        }
        return { success: false, error: error?.message || "An unknown error occurred." };
    };

    const signUp = async (email: string, password: string, name: string, organizationName: string) => {
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
    };

    const logout = async () => {
        try {
            const { error } = await supabaseService.signOutUser();
            
            // Even if there's an error, we'll proceed with the logout
            // because the improved signOutUser function handles most error cases gracefully
            if (error) {
                console.warn("Logout completed with warning:", error);
                // Show a toast but don't prevent the logout
                toast({
                    title: "Logged Out",
                    description: "You have been logged out successfully.",
                });
            }
            
            // Always redirect to home page after logout attempt
            router.push('/'); 
        } catch (error) {
            console.error("Unexpected error during logout:", error);
            // Even on unexpected errors, redirect to home
            toast({
                title: "Logged Out",
                description: "You have been logged out.",
            });
            router.push('/');
        }
    };
    
    const sendPasswordResetEmail = async (email: string) => {
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
    };

    const updatePassword = async (password: string) => {
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
