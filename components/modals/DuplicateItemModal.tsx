
import React from 'react';
import type { InventoryItem } from '../../types';

interface DuplicateItemModalProps {
    item: InventoryItem;
    isLot: boolean;
    onClose: () => void;
    onEdit: (item: InventoryItem) => void;
}

const DuplicateItemModal: React.FC<DuplicateItemModalProps> = ({ item, isLot, onClose, onEdit }) => {
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
                <h3 className="text-xl font-bold text-yellow-700 mb-4">Duplicate Item Warning</h3>
                <p className="text-gray-700 mb-6">
                    An item with this {isLot ? <strong>Lot #</strong> : <strong>Name</strong>} already exists:
                </p>
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200 mb-6">
                    <p><strong>Name:</strong> {item.name}</p>
                    <p><strong>Lot #:</strong> {item.lotNumber || 'N/A'}</p>
                    <p><strong>Current Stock:</strong> {item.quantity}</p>
                </div>
                <p className="text-gray-700 mb-6">
                    Would you like to edit this existing item instead of creating a new one?
                </p>
                <div className="flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Cancel (Create New)
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onEdit(item);
                            onClose();
                        }}
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                        Edit Existing Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateItemModal;
