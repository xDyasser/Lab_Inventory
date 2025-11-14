import { initializeApp, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { AppUser, ActivityLogType } from '../types';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDZ66yg2J3xmizWCNcE6WCv3-LnYEq6LC0",
  authDomain: "inventory-laboratory.firebaseapp.com",
  projectId: "inventory-laboratory",
  storageBucket: "inventory-laboratory.firebasestorage.app",
  messagingSenderId: "597619542444",
  appId: "1:597619542444:web:aa42b9e5a3f03fd6131209",
  measurementId: "G-PFK2BFW45T"
};


// --- Firebase Initialization (Singleton) ---
// This ensures we only initialize the app once, preventing errors in HMR environments.
let app: FirebaseApp;

try {
    app = getApp();
} catch (error) {
    app = initializeApp(firebaseConfig);
}

export const auth = getAuth(app);
export const db = getFirestore(app);


// --- Firebase Shared Path Utilities ---
// Simplified paths for a single-project setup.
export const getSharedCollectionRef = (db: Firestore) => {
    return collection(db, 'inventory');
};

export const getSharedItemRef = (db: Firestore, itemId: string) => {
    return doc(db, 'inventory', itemId);
};

export const getConsumptionLogCollectionRef = (db: Firestore, itemId: string) => {
    return collection(db, 'inventory', itemId, 'consumptionLog');
};

export const getActivityLogCollectionRef = (db: Firestore, itemId: string) => {
    return collection(db, 'inventory', itemId, 'activity_log');
};

export const logActivity = async (
    db: Firestore,
    itemId: string,
    user: AppUser,
    type: ActivityLogType,
    details: object
) => {
    try {
        const logCollectionRef = getActivityLogCollectionRef(db, itemId);
        const userPayload = {
            uid: user.uid,
            name: user.displayName || user.email,
            isAnonymous: user.isAnonymous,
        };
        await addDoc(logCollectionRef, {
            type,
            details,
            user: userPayload,
            timestamp: Timestamp.now(),
        });
    } catch (error) {
        console.error(`Failed to log activity of type ${type} for item ${itemId}:`, error);
    }
};
