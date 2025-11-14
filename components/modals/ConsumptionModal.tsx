
import React, { useState } from 'react';
import type { InventoryItem } from '../../types';

interface ConsumptionModalProps {
    item: InventoryItem;
    onClose: () => void;
    onMessage: (msg: string, isError?: boolean) => void;
    handleConsume: (item: InventoryItem, quantity: number, logData: { consumedQuantity: number, reason: string }) => Promise<void>;
}

const ConsumptionModal: React.FC<ConsumptionModalProps> = ({ item, onClose, onMessage, handleConsume }) => {
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('');
    const maxQuantity = item.quantity;
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const quantityToConsume = Number(quantity);
        
        if (quantityToConsume <= 0 || quantityToConsume > maxQuantity) {
            onMessage(`Quantity must be between 1 and ${maxQuantity}.`, true);
            return;
        }

        const logData = {
            consumedQuantity: quantityToConsume,
            reason: reason.trim() || 'N/A',
        };

        try {
            await handleConsume(item, quantityToConsume, logData);
            onClose();
        } catch (error: any) {
            console.error('Error logging consumption: ', error);
            onMessage(error.message || 'Failed to log consumption.', true);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                <h3 className="text-xl font-bold text-red-700 mb-4 border-b pb-2">Log Item Consumption</h3>
                <p className='text-sm text-gray-600 mb-4'>Logging usage for: <span className='font-semibold'>{item.name}</span> (Stock: {item.quantity})</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Quantity Consumed *</span>
                        <input
                            type="number" required min="1" max={maxQuantity} value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="mt-1 block w-full rounded-md border-red-300 shadow-sm p-2 border focus:border-red-500 focus:ring-red-500"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Reason for Consumption</span>
                        <textarea
                            rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="e.g., Used for 12 routine CBC panels."
                        />
                    </label>

                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={onClose}
                            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            Cancel
                        </button>
                        <button type="submit"
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                            Log Consumption
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConsumptionModal;
