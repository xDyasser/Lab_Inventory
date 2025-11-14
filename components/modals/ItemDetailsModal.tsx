import React from 'react';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import type { InventoryItem, AppUser } from '../../types';
import InventoryCard from '../InventoryCard';

interface ItemDetailsModalProps {
    item: InventoryItem;
    onClose: () => void;
    db: Firestore;
    user: AppUser;
    onEdit: (item: InventoryItem) => void;
    onMessage: (msg: string, isError?: boolean) => void;
    onConsumeClick: (item: InventoryItem) => void;
    onLogView: (item: InventoryItem) => void;
    onDelete: (item: InventoryItem) => void;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
    item,
    onClose,
    ...cardProps // Pass remaining props to InventoryCard
}) => {
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-40 p-4"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-md"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the card
            >
                <button
                    onClick={onClose}
                    className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 shadow-lg text-gray-600 hover:text-red-500 z-10"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <InventoryCard 
                    item={item} 
                    {...cardProps}
                />
            </div>
        </div>
    );
};

export default ItemDetailsModal;