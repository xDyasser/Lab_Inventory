import React, { useState } from 'react';
import { deleteDoc, setDoc, doc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getSharedItemRef, logActivity } from '../../services/firebase';
import type { InventoryItem, AppUser } from '../../types';

interface DeleteConfirmationModalProps {
    db: Firestore;
    item: InventoryItem;
    onClose: () => void;
    user: AppUser;
    onMessage: (msg: string, isError?: boolean) => void;
    isPermanentDelete?: boolean;
    onConfirmDelete?: (item: InventoryItem) => Promise<void>;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ db, item, onClose, user, onMessage, isPermanentDelete = false, onConfirmDelete }) => {
    const [loading, setLoading] = useState(false);
    
    const handleDelete = async () => {
        setLoading(true);
        try {
            if (isPermanentDelete && onConfirmDelete) {
                await onConfirmDelete(item);
                onClose();
                return;
            }
            // Move item to 'deleted_inventory' collection
            const deletedRef = doc(db, 'deleted_inventory', item.id);
            await setDoc(deletedRef, item);
            // Delete from 'inventory' collection
            const itemRef = getSharedItemRef(db, item.id);
            await logActivity(db, item.id, user, 'DELETE', { itemName: item.name, itemLot: item.lotNumber });
            await deleteDoc(itemRef);
            onMessage(`Item "${item.name}" moved to Deleted Items.`, false);
            onClose();
        } catch (error) {
            console.error('Error deleting document: ', error);
            onMessage(`Failed to delete item "${item.name}".`, true);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
                <h3 className="text-xl font-bold text-red-700 mb-4">{isPermanentDelete ? 'Permanently Delete Item' : 'Confirm Deletion'}</h3>
                <p className="text-gray-700 mb-6">
                    {isPermanentDelete
                        ? <>Are you sure you want to <span className="font-bold text-red-700">permanently delete</span> item: <strong className="font-semibold">{item.name}</strong> (Lot: {item.lotNumber || 'N/A'})? This action <span className="font-bold">cannot be undone</span>.</>
                        : <>Are you sure you want to delete item: <strong className="font-semibold">{item.name}</strong> (Lot: {item.lotNumber || 'N/A'})? This will move the item to Deleted Items.</>
                    }
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={loading}
                        className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isPermanentDelete ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
                    >
                        {loading ? (isPermanentDelete ? 'Deleting...' : 'Deleting...') : (isPermanentDelete ? 'Permanently Delete' : 'Delete Item')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
