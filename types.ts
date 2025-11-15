
import type { Timestamp } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';

export interface UserRef {
    uid: string;
    name: string | null;
    isAnonymous: boolean;
}

export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    minStock?: number;
    expiryDate?: Timestamp | null;
    lotNumber?: string;
    packagingType?: string;
    code?: string;
    temperature?: string;
    section?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: UserRef;
    updatedBy: UserRef;
    lowStockNotified?: boolean;
    expiryWarningNotified?: boolean;
}

export interface ConsumptionLogEntry {
    id: string;
    consumedQuantity: number;
    reason: string;
    consumedAt: Timestamp;
    consumedBy: UserRef;
    itemName: string;
    itemLot?: string;
}

export type ActivityLogType = 'CONSUME' | 'EDIT' | 'DELETE' | 'CREATE' | 'RESTORE' | 'QUANTITY_ADJUST';

export interface ActivityLogEntry {
    id: string;
    timestamp: Timestamp;
    user: {
        uid: string;
        name: string | null;
        isAnonymous: boolean;
    };
    type: ActivityLogType;
    details: any; // Using 'any' for simplicity, can be a more specific discriminated union
}


export interface DuplicateItemInfo {
    item: InventoryItem;
    isLot: boolean;
}

export type AppUser = FirebaseUser;
