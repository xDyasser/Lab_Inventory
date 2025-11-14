
import type { Timestamp } from 'firebase/firestore';
import type { UserRef } from '../types';

export const formatDisplayDate = (timestamp?: Timestamp | Date | null) => {
  if (!timestamp) return 'N/A';
  const date = (timestamp as Timestamp).toDate ? (timestamp as Timestamp).toDate() : new Date(timestamp as Date);
  return date.toLocaleString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

export const formatInputDate = (timestamp?: Timestamp | null) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const displayShortId = (id?: string) => id ? `${id.substring(0, 8)}...` : 'N/A';

export const displayUserName = (userObject?: UserRef | null) => {
    if (!userObject) return 'System';
    if (userObject.isAnonymous) return `Guest (${displayShortId(userObject.uid)})`;
    return userObject.name || `User (${displayShortId(userObject.uid)})`;
};
