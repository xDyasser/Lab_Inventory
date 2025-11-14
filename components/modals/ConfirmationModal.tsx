import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmButtonText?: string;
    cancelButtonText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmButtonText = 'Confirm',
    cancelButtonText = 'Cancel',
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-60 flex justify-center items-center z-[60]">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md" role="dialog" aria-modal="true">
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                <p className="mt-2 text-sm text-gray-600">{message}</p>
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onCancel}
                        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        {cancelButtonText}
                    </button>
                    <button type="button" onClick={onConfirm}
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;