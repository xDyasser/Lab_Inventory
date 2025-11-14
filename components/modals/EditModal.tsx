
import React, { useState, useMemo } from 'react';
import { updateDoc, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getSharedItemRef, logActivity } from '../../services/firebase';
import { TEMP_OPTIONS, LAB_SECTIONS, DEFAULT_MIN_STOCK } from '../../constants';
import { formatInputDate } from '../../utils/formatters';
import type { InventoryItem, AppUser } from '../../types';

interface EditModalProps {
    db: Firestore;
    item: InventoryItem;
    onClose: () => void;
    user: AppUser;
    onMessage: (msg: string, isError?: boolean) => void;
}

const EditModal: React.FC<EditModalProps> = ({ db, item, onClose, user, onMessage }) => {
  const [formData, setFormData] = useState({
    name: item.name || '',
    quantity: item.quantity || 0,
    minStock: item.minStock ?? DEFAULT_MIN_STOCK,
    expiryDate: item.expiryDate ? formatInputDate(item.expiryDate) : '',
    lotNumber: item.lotNumber || '',
    packagingType: item.packagingType || '',
    code: item.code || '',
    temperature: item.temperature || TEMP_OPTIONS[1],
    section: item.section || LAB_SECTIONS[1].name,
  });

  const [isConfirming, setIsConfirming] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const changes = useMemo(() => {
      const changeSet: { [key: string]: { old: any; new: any } } = {};
      const trimmedName = formData.name.trim();
      const newQuantity = Number(formData.quantity);
      const newMinStock = Number(formData.minStock);
  
      if (item.name !== trimmedName) changeSet.name = { old: item.name, new: trimmedName };
      if (item.quantity !== newQuantity) changeSet.quantity = { old: item.quantity, new: newQuantity };
      if ((item.minStock ?? DEFAULT_MIN_STOCK) !== newMinStock) changeSet.minStock = { old: item.minStock ?? DEFAULT_MIN_STOCK, new: newMinStock };
      if ((item.expiryDate ? formatInputDate(item.expiryDate) : '') !== formData.expiryDate) changeSet.expiryDate = { old: item.expiryDate ? formatInputDate(item.expiryDate) : 'N/A', new: formData.expiryDate || 'N/A' };
      if (item.lotNumber !== formData.lotNumber) changeSet.lotNumber = { old: item.lotNumber, new: formData.lotNumber };
      if (item.code !== formData.code) changeSet.code = { old: item.code, new: formData.code };
      if (item.temperature !== formData.temperature) changeSet.temperature = { old: item.temperature, new: formData.temperature };
      if (item.section !== formData.section) changeSet.section = { old: item.section, new: formData.section };
      if (item.packagingType !== formData.packagingType) changeSet.packagingType = { old: item.packagingType, new: formData.packagingType };
      
      return changeSet;
  }, [formData, item]);

  const hasChanges = Object.keys(changes).length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || Number(formData.quantity) < 0) {
        onMessage('Item Name and a valid Quantity are required.', true);
        return;
    }

    if (hasChanges) {
      setIsConfirming(true);
    } else {
      onMessage('No changes were made.');
      onClose();
    }
  };

  const handleConfirmSave = async () => {
    try {
      const itemRef = getSharedItemRef(db, item.id);
      await updateDoc(itemRef, {
        ...formData,
        name: formData.name.trim(),
        quantity: Number(formData.quantity),
        minStock: Number(formData.minStock),
        expiryDate: formData.expiryDate ? Timestamp.fromDate(new Date(formData.expiryDate)) : null,
        updatedAt: Timestamp.now(),
        updatedBy: {
            uid: user.uid,
            name: user.displayName || user.email,
            isAnonymous: user.isAnonymous,
        },
      });
      await logActivity(db, item.id, user, 'EDIT', { changes });
      onClose();
      onMessage(`Item "${item.name}" updated successfully!`);
    } catch (error) {
      console.error('Error updating document: ', error);
      onMessage('Failed to save changes.', true);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-indigo-700 mb-4 border-b pb-2">Edit Item: {item.name}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Item Name *</span>
              <input type="text" name="name" required value={formData.name} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Code #</span>
              <input type="text" name="code" value={formData.code} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Quantity *</span>
              <input type="number" name="quantity" required min="0" value={formData.quantity} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-700">Min Stock</span>
                <input type="number" name="minStock" min="0" value={formData.minStock} onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Lot #</span>
              <input type="text" name="lotNumber" value={formData.lotNumber} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Expiry Date</span>
              <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Lab Section *</span>
              <select name="section" required value={formData.section} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                {LAB_SECTIONS.slice(1).map((option) => (<option key={option.name} value={option.name}>{option.name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Storage Temperature</span>
              <select name="temperature" value={formData.temperature} onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                {TEMP_OPTIONS.slice(1).map((option) => (<option key={option} value={option}>{option}</option>))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Packaging Type</span>
            <input type="text" name="packagingType" value={formData.packagingType} onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="e.g., Box, Vial, Pouch"/>
          </label>
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit"
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400" disabled={!hasChanges}>
              Save Changes
            </button>
          </div>
        </form>
        {isConfirming && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center z-[60]">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-800">Confirm Changes</h3>
              <p className="mt-2 text-sm text-gray-600">
                You are about to save changes for "{item.name}". Are you sure you want to proceed?
              </p>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsConfirming(false)}
                  className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirmSave}
                  className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditModal;
