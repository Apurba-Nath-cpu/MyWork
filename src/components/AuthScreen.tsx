
"use client";
import React, { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types'; 
import { useTheme, Theme } from '../contexts/ThemeContext';
import { APP_TITLE } from '../lib/constants'; 
import { useToast } from "@/hooks/use-toast";
import { SunIcon, MoonIcon } from './custom-icons';
import * as supabaseService from '../services/supabaseService';

type AuthTab = 'login' | 'signup';

const AuthScreen: React.FC = () => {
  const { login, signUp, sendPasswordResetEmail, updatePassword } = useAuth(); 
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  const inputBaseClass = "w-full p-3 border rounded-md focus:ring-2 focus:border-transparent text-sm sm:text-base";
  const lightInputClass = "bg-white border-neutral-300 focus:ring-primary-500 placeholder-neutral-400 text-neutral-900";
  const darkInputClass = "bg-neutral-700 border-neutral-600 focus:ring-primary-400 placeholder-neutral-400 text-neutral-100";
  const buttonBaseClass = "w-full py-3 px-4 rounded-md font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm sm:text-base";
  const lightButtonClass = "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500 focus:ring-offset-neutral-100";
  const darkButtonClass = "bg-primary-500 hover:bg-primary-600 focus:ring-primary-400 focus:ring-offset-neutral-900";
  
  const currentInputClass = theme === 'dark' ? darkInputClass : lightInputClass;
  const currentButtonClass = theme === 'dark' ? darkButtonClass : lightButtonClass;
  const currentLabelClass = `block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-700'}`;
  const currentCardClass = `p-0 sm:p-0 rounded-xl shadow-2xl w-full max-w-md ${theme === 'dark' ? "bg-neutral-800" : "bg-white"}`;
  const errorTextClass = "text-xs sm:text-sm text-red-600 dark:text-red-400";
  const errorBoxClass = `mb-4 ${errorTextClass} bg-red-100 dark:bg-red-900 dark:bg-opacity-30 p-3 rounded-md text-center mx-6 sm:mx-8`;

  const tabButtonBaseClass = "flex-1 py-3 px-2 sm:px-4 font-medium text-sm sm:text-base focus:outline-none text-center transition-colors duration-200 ease-in-out";
  const activeTabClass = `${theme === 'dark' ? 'bg-neutral-700 text-primary-300' : 'bg-neutral-100 text-primary-600'} border-b-2 border-primary-500 dark:border-primary-400`;
  const inactiveTabClass = `${theme === 'dark' ? 'text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200' : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700'}`;

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupOrganizationName, setSignupOrganizationName] = useState(''); 
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  // Password Reset State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Effect to detect when user arrives from a password reset link
  useEffect(() => {
    const { data: authListener } = supabaseService.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResetMode(true);
        // Clear other form states for a clean UI
        setActiveTab('login'); 
        setLoginError(null);
        setSignupError(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Email and Password are required.");
      setLoginLoading(false);
      return;
    }
    if (!validateEmail(loginEmail)) {
      setLoginError("Please enter a valid email address.");
      setLoginLoading(false);
      return;
    }
    const result = await login(loginEmail, loginPassword);
    if (!result.success) {
      const errorMessage = result.error || "Login failed. Please check your credentials.";
      setLoginError(errorMessage);
    }
    setLoginLoading(false);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);
    let errors: string[] = [];
    if (!signupName.trim()) errors.push("Full Name is required.");
    if (!signupOrganizationName.trim()) errors.push("Organization Name is required."); 
    if (!signupEmail.trim()) errors.push("Email is required.");
    else if (!validateEmail(signupEmail)) errors.push("Please enter a valid email address.");
    if (!signupPassword.trim()) errors.push("Password is required.");
    else if (signupPassword.length < 6) errors.push("Password must be at least 6 characters long.");

    if (errors.length > 0) {
      const combinedError = errors.join(' ');
      setSignupError(combinedError);
      toast({
        title: "Validation Error",
        description: combinedError,
        variant: "destructive",
      });
      setSignupLoading(false);
      return;
    }

    const result = await signUp(signupEmail, signupPassword, signupName, signupOrganizationName);
    if (!result.success) {
      let errorMessage = result.error || "Sign up failed. Please try again.";
       if (result.isOrgNameConflict) {
        errorMessage = "This organization name is already taken. Please choose a different one.";
      } else if (result.isEmailConflict) {
        errorMessage = "This email is already registered. Please try logging in or use a different email.";
      }
      setSignupError(errorMessage); 
      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } else {
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupOrganizationName('');
      setSignupError(null); 
    }
    setSignupLoading(false);
  };

  const handleForgotPassword = async () => {
    setLoginError(null);
    const emailToReset = loginEmail;
    
    if (!emailToReset) {
      const errorMsg = "Please enter your email in the field above to reset your password.";
      setLoginError(errorMsg);
      toast({
        title: "Email Required",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    if (!validateEmail(emailToReset)) {
        const errorMsg = "Please enter a valid email address.";
        setLoginError(errorMsg);
        toast({
            title: "Invalid Email",
            description: errorMsg,
            variant: "destructive"
        });
        return;
    }

    setLoginLoading(true);
    await sendPasswordResetEmail(emailToReset);
    setLoginLoading(false);
  };
  
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError(null);
    if (!resetPassword || !confirmResetPassword) {
      setResetError("Both password fields are required.");
      return;
    }
    if (resetPassword !== confirmResetPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    if (resetPassword.length < 6) {
      setResetError("Password must be at least 6 characters long.");
      return;
    }
    setResetLoading(true);
    const result = await updatePassword(resetPassword);
    if (result.success) {
      setIsResetMode(false); // Go back to login screen
      setResetPassword('');
      setConfirmResetPassword('');
    } else {
      setResetError(result.error || "Failed to reset password. Please try again.");
    }
    setResetLoading(false);
  };

  const PasswordResetForm = () => (
    <div className="p-6 sm:p-8">
      <h2 className={`text-xl sm:text-2xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800'}`}>Reset Your Password</h2>
      <p className={`text-center text-sm mb-4 ${theme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}`}>
        You have successfully verified your email. Please enter a new password below.
      </p>
      {resetError && <p className={errorBoxClass}>{resetError}</p>}
      <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-5">
        <div>
          <label htmlFor="resetPassword" className={currentLabelClass}>New Password</label>
          <input type="password" id="resetPassword" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="Min. 6 characters" aria-required="true" />
        </div>
        <div>
          <label htmlFor="confirmResetPassword" className={currentLabelClass}>Confirm New Password</label>
          <input type="password" id="confirmResetPassword" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="••••••••" aria-required="true" />
        </div>
        <button type="submit" className={`${buttonBaseClass} ${currentButtonClass}`} disabled={resetLoading}>
          {resetLoading ? 'Updating Password...' : 'Update Password'}
        </button>
      </form>
    </div>
  );

  const AuthForms = () => (
    <>
      <div className="flex">
        <button 
          onClick={() => { setActiveTab('login'); setSignupError(null); setLoginError(null);}}
          className={`${tabButtonBaseClass} rounded-tl-xl ${activeTab === 'login' ? activeTabClass : inactiveTabClass}`}
        >
          Login
        </button>
        <button 
          onClick={() => { setActiveTab('signup'); setLoginError(null); setSignupError(null);}}
          className={`${tabButtonBaseClass} rounded-tr-xl ${activeTab === 'signup' ? activeTabClass : inactiveTabClass}`}
        >
          Create Organization
        </button>
      </div>
      <div className="p-6 sm:p-8">
        {activeTab === 'login' && (
          <>
            <h2 className={`text-xl sm:text-2xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800'}`}>Welcome Back!</h2>
            {loginError && <p className={errorBoxClass}>{loginError}</p>}
            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="loginEmail" className={currentLabelClass}>Email Address</label>
                <input type="email" id="loginEmail" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="you@example.com" aria-required="true" />
              </div>
              <div>
                <label htmlFor="loginPassword" className={currentLabelClass}>Password</label>
                <input type="password" id="loginPassword" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="••••••••" aria-required="true" />
              </div>
              <div className="text-right -mt-2 mb-4">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className={`text-xs sm:text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'text-primary-400 hover:text-primary-300'
                      : 'text-primary-600 hover:text-primary-700'
                  } focus:outline-none focus:underline`}
                >
                  Forgot Password?
                </button>
              </div>
              <button type="submit" className={`${buttonBaseClass} ${currentButtonClass}`} disabled={loginLoading}>
                {loginLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </>
        )}

        {activeTab === 'signup' && (
          <>
            <h2 className={`text-xl sm:text-2xl font-bold text-center mb-6 ${theme === 'dark' ? 'text-neutral-100' : 'text-neutral-800'}`}>Create Admin Account & Organization</h2>
            {signupError && <p className={errorBoxClass}>{signupError}</p>}
            <form onSubmit={handleSignup} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="signupName" className={currentLabelClass}>Your Full Name (Admin)</label>
                <input type="text" id="signupName" value={signupName} onChange={(e) => setSignupName(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="Your Name" aria-required="true" />
              </div>
              <div>
                <label htmlFor="signupOrganizationName" className={currentLabelClass}>Organization Name</label>
                <input type="text" id="signupOrganizationName" value={signupOrganizationName} onChange={(e) => setSignupOrganizationName(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="Your Company or Team Name" aria-required="true" />
              </div>
              <div>
                <label htmlFor="signupEmail" className={currentLabelClass}>Your Email Address (Admin)</label>
                <input type="email" id="signupEmail" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="you@example.com" aria-required="true" />
              </div>
              <div>
                <label htmlFor="signupPassword" className={currentLabelClass}>Password (Admin)</label>
                <input type="password" id="signupPassword" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className={`${inputBaseClass} ${currentInputClass}`} placeholder="Min. 6 characters" aria-required="true" />
              </div>
              <button type="submit" className={`${buttonBaseClass} ${currentButtonClass}`} disabled={signupLoading}>
                {signupLoading ? 'Creating Account...' : 'Create Account & Organization'}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 ${theme === 'dark' ? 'dark bg-neutral-900' : 'bg-neutral-50'} transition-colors duration-300 relative`}>
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-full focus:outline-none focus:ring-2 transition-colors ${
            theme === Theme.DARK
              ? 'text-yellow-400 hover:bg-neutral-700 focus:ring-yellow-500'
              : 'text-neutral-600 hover:bg-neutral-200 focus:ring-primary-500'
          }`}
          title={theme === Theme.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={theme === Theme.LIGHT ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === Theme.LIGHT ? (
            <MoonIcon className="w-5 h-5" />
          ) : (
            <SunIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className={`text-3xl sm:text-4xl font-bold ${theme === 'dark' ? 'text-primary-400' : 'text-primary-600'}`}>{APP_TITLE}</h1>
        <p className={`mt-1 sm:mt-2 text-sm ${theme === 'dark' ? 'text-neutral-400' : 'text-neutral-600'}`}>Organize your projects, streamline your workflow.</p>
      </div>

      <div className={currentCardClass}>
        {isResetMode ? <PasswordResetForm /> : <AuthForms />}
      </div>

       <p className={`mt-6 sm:mt-8 text-xs text-center ${theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
        Securely powered by Supabase. &copy; {new Date().getFullYear()} {APP_TITLE}
      </p>
    </div>
  );
};

export default AuthScreen;

    