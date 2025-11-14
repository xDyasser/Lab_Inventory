
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, db } from './services/firebase';
import LoginScreen from './components/LoginScreen';
import InventoryDashboard from './components/InventoryDashboard';
import { registerSW } from 'virtual:pwa-register';


export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        registerSW({
            immediate: true
        });

        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setUser(null);
        } catch (error) {
            console.error("Sign out error:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-indigo-600 font-semibold text-lg animate-pulse">Loading Application...</div>
            </div>
        );
    }

    return (
        <>
            {!user ? (
                <LoginScreen auth={auth} onLoginSuccess={setUser} />
            ) : (
                <InventoryDashboard user={user} auth={auth} db={db} onSignOut={handleSignOut} />
            )}
        </>
    );
}