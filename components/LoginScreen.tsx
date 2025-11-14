
import React, { useState } from 'react';
import { 
  signInAnonymously, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';

interface LoginScreenProps {
    auth: Auth;
    onLoginSuccess: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ auth, onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                if (!email || !password) {
                    setError('Email and password are required.');
                    setLoading(false);
                    return;
                }
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                onLoginSuccess(userCredential.user);
            } else {
                if (!displayName || !email || !password) {
                    setError('Display Name, email, and password are required for registration.');
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName });
                
                // Use the user from the credential directly, as it's the most up-to-date.
                onLoginSuccess(userCredential.user);
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            let userMessage = err.message.replace('Firebase: ', '');
            if (err.code === 'auth/operation-not-allowed') {
                userMessage = "Email/Password sign-in is not enabled for this project. Please contact the administrator or continue as a guest.";
            }
            setError(userMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const userCredential = await signInAnonymously(auth);
            onLoginSuccess(userCredential.user);
        } catch (err: any) {
            console.error("Guest Auth Error:", err);
            let userMessage = err.message.replace('Firebase: ', '');
            if (err.code === 'auth/operation-not-allowed') {
                userMessage = "Anonymous sign-in is not enabled for this project. Please contact the administrator.";
            }
            setError(userMessage);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
                <h1 className="text-3xl font-extrabold text-indigo-800 text-center mb-6">
                    Lab Inventory Manager
                </h1>
                
                <form onSubmit={handleAuthAction} className="space-y-4">
                    {!isLogin && (
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Display Name *</span>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="e.g., Dr. Jane Doe"
                            />
                        </label>
                    )}
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Email *</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="user@lab.com"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Password *</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="••••••••"
                        />
                    </label>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register')}
                    </button>
                </form>

                <button
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-500 mt-4"
                >
                    {isLogin ? "Need an account? Register" : "Already have an account? Sign In"}
                </button>
                
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleGuestLogin}
                    disabled={loading}
                    className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50"
                >
                    {loading ? 'Processing...' : 'Continue as Guest'}
                </button>

            </div>
        </div>
    );
};

export default LoginScreen;