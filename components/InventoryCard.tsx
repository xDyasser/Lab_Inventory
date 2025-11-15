
import React from 'react';
import { updateDoc, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getSharedItemRef, logActivity } from '../services/firebase';
import { DEFAULT_MIN_STOCK, getSectionColor } from '../constants';
import { formatDisplayDate, displayUserName } from '../utils/formatters';
import type { InventoryItem, AppUser } from '../types';

interface InventoryCardProps {
    item: InventoryItem;
    db: Firestore;
    user: AppUser;
    onEdit: (item: InventoryItem) => void;
    onMessage: (msg: string, isError?: boolean) => void;
    onConsumeClick: (item: InventoryItem) => void;
    onLogView: (item: InventoryItem) => void;
    onDelete: (item: InventoryItem) => void;
}

const InventoryCard: React.FC<InventoryCardProps> = ({ item, db, user, onEdit, onMessage, onConsumeClick, onLogView, onDelete }) => {
  
  const handleQuantityIncrease = async (delta: number) => {
    const itemRef = getSharedItemRef(db, item.id);
    const newQuantity = item.quantity + delta;
    const updatePayload: any = {
      quantity: newQuantity,
      updatedAt: Timestamp.now(),
      updatedBy: {
        uid: user.uid,
        name: user.displayName || user.email,
        isAnonymous: user.isAnonymous,
      },
    };

    // If low stock notification was previously sent, reset it on restock.
    if (item.lowStockNotified) {
      updatePayload.lowStockNotified = false;
    }

    try {
      await updateDoc(itemRef, updatePayload);
      await logActivity(db, item.id, user, 'QUANTITY_ADJUST', {
        itemName: item.name,
        itemLot: item.lotNumber,
        change: delta,
        newQuantity: newQuantity,
      });
      onMessage(`Quantity of ${item.name} increased by ${delta}.`, false);
    } catch (error) {
      console.error('Error updating quantity: ', error);
      onMessage('Failed to update quantity.', true);
    }
  };

  const isExpired = item.expiryDate && item.expiryDate.toDate() < new Date();
  const isExpiringSoon = item.expiryDate && item.expiryDate.toDate() < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && !isExpired;
  
  const minStockThreshold = item.minStock ?? DEFAULT_MIN_STOCK;
  const isLowStock = item.quantity <= minStockThreshold;
  const isZeroStock = item.quantity === 0;

  let borderColor = 'border-gray-200';
  let badgeText = '';
  let badgeColor = '';

  if (isExpired) {
    borderColor = 'border-red-500'; badgeText = 'EXPIRED'; badgeColor = 'bg-red-500';
  } else if (isZeroStock) {
    borderColor = 'border-red-700'; badgeText = 'OUT OF STOCK'; badgeColor = 'bg-red-700';
  } else if (isExpiringSoon) {
    borderColor = 'border-yellow-500'; badgeText = 'EXPIRING SOON'; badgeColor = 'bg-yellow-500';
  } else if (isLowStock) {
    borderColor = 'border-orange-500'; badgeText = 'LOW STOCK'; badgeColor = 'bg-orange-500';
  }

  let quantityColor = 'text-indigo-600';
  if (isZeroStock) {
    quantityColor = 'text-red-700';
  } else if (isLowStock) {
    quantityColor = 'text-orange-500';
  }


  const modifier = item.updatedBy || item.createdBy;
  const creator = item.createdBy;

  return (
    <div className={`relative bg-white p-4 shadow-lg rounded-xl flex flex-col space-y-2 transform hover:scale-[1.01] transition duration-200 border-2 ${borderColor}`}>
      {badgeText && (
          <div className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold text-white rounded-bl-lg ${badgeColor} rounded-tr-xl`}>
            {badgeText}
          </div>
      )}
      <div className="flex justify-between items-start pt-2">
        <h4 className="text-lg font-bold text-gray-800 pr-20">{item.name}</h4>
        <div className="flex space-x-2 absolute top-7 right-4">
            <button onClick={() => onLogView(item)}
                className="p-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200" title="View Consumption Log">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-9 0V3h4v2m-4 8h4m-4 4h7" /></svg>
            </button>
            <button onClick={() => onEdit(item)}
                className="p-2 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200" title="Edit Item">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.232z" /></svg>
            </button>
            <button onClick={() => onDelete(item)}
                className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200" title="Remove Item">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <p><span className="font-semibold">Code #:</span> {item.code || 'N/A'}</p>
        <p><span className="font-semibold">Lot #:</span> {item.lotNumber || 'N/A'}</p>
        <p><span className="font-semibold">Min Stock:</span> {minStockThreshold}</p>
        <p className="flex items-center">
            <span className="font-semibold mr-1">Section:</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSectionColor(item.section)}`}>
                {item.section || 'N/A'}
            </span>
        </p>
        <p className={`font-semibold ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-yellow-500' : 'text-gray-700'}`}>
          <span className="font-semibold">Expires:</span> {formatDisplayDate(item.expiryDate)}
        </p>
      </div>
      
      <div className="text-xs text-gray-400 border-t pt-2 mt-auto">
        <p>
            <span className="font-semibold text-gray-600">Last Mod:</span> {formatDisplayDate(item.updatedAt)} by 
            <span className="font-medium text-indigo-500 ml-1">{displayUserName(modifier)}</span>
        </p>
        <p>
            <span className="font-semibold text-gray-600">Created:</span> {formatDisplayDate(item.createdAt)} by 
            <span className="font-medium text-indigo-500 ml-1">{displayUserName(creator)}</span>
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t mt-2">
        <p className="text-base font-semibold text-gray-900">In Stock:</p>
        <div className="flex items-center space-x-2">
            <button onClick={() => onConsumeClick(item)} disabled={isZeroStock}
                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50"
                title="Log Usage/Consumption">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
            </button>
          <span className={`text-2xl font-extrabold w-12 text-center ${quantityColor}`}>{item.quantity}</span>
          <button onClick={() => handleQuantityIncrease(1)}
            className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600"
            title="Increase Quantity (Quick Receive)">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryCard;
