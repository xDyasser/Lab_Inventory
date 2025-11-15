import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onSnapshot, query, addDoc, updateDoc, Timestamp, collection, setDoc, deleteDoc, doc } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import { getSharedCollectionRef, getSharedItemRef, logActivity } from '../services/firebase';
import * as XLSX from 'xlsx';
import { displayUserName as formatUser, formatDisplayDate } from '../utils/formatters';
import { TEMP_OPTIONS, LAB_SECTIONS, STATUS_OPTIONS, DEFAULT_MIN_STOCK } from '../constants';
import type { InventoryItem, AppUser, DuplicateItemInfo, ActivityLogEntry } from '../types';

import ItemForm from './ItemForm';
import MetricsPanel from './MetricsPanel';
import InventoryCard from './InventoryCard';
import EditModal from './modals/EditModal';
import ConsumptionModal from './modals/ConsumptionModal';
import ActivityLogModal from './modals/ActivityLogModal';
import DeleteConfirmationModal from './modals/DeleteConfirmationModal';
import DuplicateItemModal from './modals/DuplicateItemModal';
import BarcodeScannerInline, { shouldShowError } from './BarcodeScannerInline';

import ItemDetailsModal from './modals/ItemDetailsModal';

interface InventoryDashboardProps {
    user: AppUser;
    auth: Auth;
    db: Firestore;
    onSignOut: () => void;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({ user, db, onSignOut }) => {
    // Restore deleted item to inventory
    const handleRestore = async (item: InventoryItem) => {
      try {
        const inventoryRef = doc(db, 'inventory', item.id);
        // When restoring, reset notification flags
        const restoredItem = {
          ...item,
          lowStockNotified: false,
          expiryWarningNotified: false,
        };
        await setDoc(inventoryRef, restoredItem);
        const deletedRef = doc(db, 'deleted_inventory', item.id);
        await deleteDoc(deletedRef);
        await logActivity(db, item.id, user, 'RESTORE', { itemName: item.name, itemLot: item.lotNumber });
        handleMessage(`Item "${item.name}" restored.`, false);
      } catch (error) {
        console.error('Restore error:', error);
        handleMessage('Failed to restore item.', true);
      }
    };

    // Permanently delete item from deleted_inventory
    const handlePermanentDelete = async (item: InventoryItem) => {
      try {
        const deletedRef = doc(db, 'deleted_inventory', item.id);
        await deleteDoc(deletedRef);
        // Note: We can't log to the item's subcollection if it's about to be gone.
        handleMessage(`Item "${item.name}" permanently deleted.`, false);
      } catch (error) {
        console.error('Permanent delete error:', error);
        handleMessage('Failed to permanently delete item.', true);
      }
    };
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [deletedInventory, setDeletedInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [itemToConsume, setItemToConsume] = useState<InventoryItem | null>(null);
  const [itemToViewLog, setItemToViewLog] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState<InventoryItem | null>(null);
  const [duplicateItem, setDuplicateItem] = useState<DuplicateItemInfo | null>(null);
  const [itemFromScan, setItemFromScan] = useState<InventoryItem | null>(null);
  
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'expiryDate' | 'quantity' | 'lotNumber'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [barcode, setBarcode] = useState('');
  const [tempFilter, setTempFilter] = useState(TEMP_OPTIONS[0]);
  const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS[0]);  
  const [sectionFilter, setSectionFilter] = useState(LAB_SECTIONS[0].name);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);

  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
  
  useEffect(() => {
    setIsLoading(true);
    const inventoryCollectionPath = getSharedCollectionRef(db);
    const q = query(inventoryCollectionPath);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as InventoryItem));
        setInventory(items);
        setIsLoading(false);
    }, (error) => {
        console.error('Error fetching inventory:', error);
        setIsLoading(false);
        handleMessage('Error loading data from Firestore.', true);
    });

    // Listen for deleted items
    const deletedRef = collection(db, 'deleted_inventory');
    const unsubDeleted = onSnapshot(deletedRef, (snapshot) => {
      const deleted = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as InventoryItem));
      setDeletedInventory(deleted);
    });

    return () => {
      unsubscribe();
      unsubDeleted();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // Auto-close DeleteConfirmationModal if item is deleted
  useEffect(() => {
    if (itemToDelete && !inventory.find(item => item.id === itemToDelete.id)) {
      setItemToDelete(null);
    }
  }, [inventory, itemToDelete]);

  // Effect to keep the scanned item modal updated with live data
  useEffect(() => {
    if (itemFromScan) {
      const updatedItem = inventory.find(item => item.id === itemFromScan.id);
      if (updatedItem) {
        // Only update state if the data has actually changed to prevent re-render loops
        if (JSON.stringify(updatedItem) !== JSON.stringify(itemFromScan)) {
          setItemFromScan(updatedItem);
        }
      } else { // Item was deleted, so close the modal
        setItemFromScan(null);
      }
    }
  }, [inventory, itemFromScan]);

  const handleMessage = useCallback((msg: string, error = false) => {
    setMessage(msg);
    setIsError(error);
    setTimeout(() => setMessage(''), 3000); 
  }, []);

  const handleBarcodeSearch = useCallback((code: string) => {
    if (!code) return;
    const trimmedCode = code.trim().toLowerCase();
    const found = inventory.find(item =>
        item.code?.toLowerCase() === trimmedCode ||
        item.lotNumber?.toLowerCase() === trimmedCode
    );
    if (found) {
        setItemFromScan(found);
        setBarcode(''); // Clear input after successful search
        handleMessage(`Item found: ${found.name} (Lot: ${found.lotNumber || 'N/A'})`, false);
        setIsFormVisible(false); // Ensure form is hidden if item is found
    } else {
        handleMessage('No item found.', true);
        setBarcode(code); // Keep the scanned code in the input if not found
        setIsFormVisible(true); // Show the form to add a new item
    }
  }, [inventory, handleMessage, setIsFormVisible]);

  const handleScanSuccess = (decodedText: string) => {
    setIsScannerOpen(false);
    handleBarcodeSearch(decodedText);
  };

  const handleConsume = useCallback(async (item: InventoryItem, quantityToConsume: number, logData: { consumedQuantity: number; reason: string; }) => {
    const itemRef = getSharedItemRef(db, item.id);
    const newQuantity = item.quantity - quantityToConsume;
    if (newQuantity < 0) throw new Error("Stock cannot go below zero.");
    
    try {
        const userPayload = { 
            uid: user.uid, 
            name: user.displayName || user.email,
            isAnonymous: user.isAnonymous,
        };
        await logActivity(db, item.id, user, 'CONSUME', {
            consumedQuantity: logData.consumedQuantity,
            reason: logData.reason,
            newQuantity: newQuantity,
            itemName: item.name, 
            itemLot: item.lotNumber,
        });
        await updateDoc(itemRef, {
            quantity: newQuantity,
            updatedAt: Timestamp.now(),
            updatedBy: userPayload,
        });
        handleMessage(`Consumed ${quantityToConsume} of ${item.name}.`, false);
    } catch (error) {
        console.error("Error during consumption transaction:", error);
        throw error;
    }
  }, [db, user, handleMessage]);
  
  const metrics = useMemo(() => {
      let totalQuantity = 0, lowStockCount = 0, expiringItemsCount = 0;
      const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
      const now = new Date();

      inventory.forEach(item => {
          totalQuantity += item.quantity;
          const minStockThreshold = item.minStock ?? DEFAULT_MIN_STOCK;
          const isExpired = item.expiryDate && item.expiryDate.toDate() < now;
          const isExpiringSoon = item.expiryDate && item.expiryDate.toDate() < new Date(now.getTime() + oneWeekInMs) && !isExpired;
          if (item.quantity <= minStockThreshold) lowStockCount++;
          if (isExpired || isExpiringSoon) expiringItemsCount++;
      });
      return { totalItems: inventory.length, totalQuantity, lowStockCount, expiringItemsCount };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    let filtered = inventory;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.code?.toLowerCase().includes(term) ||
        item.lotNumber?.toLowerCase().includes(term) ||
        item.section?.toLowerCase().includes(term)
      );
    }
    if (tempFilter !== TEMP_OPTIONS[0]) {
      filtered = filtered.filter(item => item.temperature === tempFilter);
    }
    if (sectionFilter !== LAB_SECTIONS[0].name) {
      filtered = filtered.filter(item => item.section === sectionFilter);
    }
    if (statusFilter !== STATUS_OPTIONS[0]) {
        filtered = filtered.filter(item => {
            const minStockThreshold = item.minStock ?? DEFAULT_MIN_STOCK;
            const isExpired = item.expiryDate && item.expiryDate.toDate() < new Date();
            const isExpiringSoon = item.expiryDate && item.expiryDate.toDate() < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && !isExpired;
            const isLowStock = item.quantity <= minStockThreshold; 
            if (statusFilter === 'Low Stock') return isLowStock;
            if (statusFilter === 'Expiring/Expired') return isExpired || isExpiringSoon;
            return true;
        });
    }
    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'expiryDate':
          valA = a.expiryDate ? a.expiryDate.toDate().getTime() : Infinity;
          valB = b.expiryDate ? b.expiryDate.toDate().getTime() : Infinity;
          break;
        case 'quantity':
          valA = a.quantity;
          valB = b.quantity;
          break;
        case 'lotNumber':
          valA = a.lotNumber ? a.lotNumber.toLowerCase() : '';
          valB = b.lotNumber ? b.lotNumber.toLowerCase() : '';
          break;
        default:
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [inventory, searchTerm, tempFilter, statusFilter, sectionFilter, sortBy, sortOrder]);
  
  const convertToCSV = (data: InventoryItem[]) => {
    if (data.length === 0) return '';
    const columns = [
      { key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'quantity', header: 'Quantity' }, 
      { key: 'minStock', header: 'Min Stock' }, { key: 'code', header: 'Code' }, { key: 'lotNumber', header: 'Lot Number' },
      { key: 'packagingType', header: 'Packaging Type' }, { key: 'temperature', header: 'Temperature' }, { key: 'section', header: 'Section' },
      { key: 'expiryDate', header: 'Expiry Date' },
      { key: 'createdBy', header: 'Created By' }, { key: 'updatedBy', header: 'Last Modified By' },
      { key: 'createdAt', header: 'Created At' }, { key: 'updatedAt', header: 'Updated At' },
    ] as const;
    const header = columns.map(col => `"${col.header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(item => {
      const row = columns.map(col => {
        let value: any = item[col.key] || '';
        if (['expiryDate', 'createdAt', 'updatedAt'].includes(col.key)) value = formatDisplayDate(value);
        if (['createdBy', 'updatedBy'].includes(col.key)) value = formatUser(value);
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',');
      return row;
    });
    return [header, ...rows].join('\n');
  };
  
  const handleExport = () => {
    if (filteredInventory.length === 0) {
      handleMessage('No items to export based on current filters.', true);
      return;
    }
    try {
      // Prepare data for Excel
      const columns = [
        { key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'quantity', header: 'Quantity' },
        { key: 'minStock', header: 'Min Stock' }, { key: 'code', header: 'Code' }, { key: 'lotNumber', header: 'Lot Number' },
        { key: 'packagingType', header: 'Packaging Type' }, { key: 'temperature', header: 'Temperature' }, { key: 'section', header: 'Section' },
        { key: 'expiryDate', header: 'Expiry Date' },
        { key: 'createdBy', header: 'Created By' }, { key: 'updatedBy', header: 'Last Modified By' },
        { key: 'createdAt', header: 'Created At' }, { key: 'updatedAt', header: 'Updated At' },
      ];
      const data = filteredInventory.map(item => {
        const row = {};
        columns.forEach(col => {
          let value = item[col.key] || '';
          if ([ 'expiryDate', 'createdAt', 'updatedAt' ].includes(col.key)) value = formatDisplayDate(value);
          if ([ 'createdBy', 'updatedBy' ].includes(col.key)) value = formatUser(value);
          row[col.header] = value;
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      let fileName = 'lab_inventory';
      if (sectionFilter !== LAB_SECTIONS[0].name) fileName += `_${sectionFilter.replace(/\s/g, '')}`;
      fileName += `_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      handleMessage(`Exported ${filteredInventory.length} item(s) to Excel!`, false);
    } catch (e) {
      console.error('Export failed:', e);
      handleMessage('Export failed. Check console for details.', true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-indigo-600 font-semibold text-lg animate-pulse">Loading Inventory Data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="py-4 mb-6 border-b border-indigo-200 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-800">Lab Inventory Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Welcome, <span className="font-semibold text-indigo-700">{user.displayName || user.email || (user.isAnonymous ? `Guest (${user.uid.substring(0,6)})` : 'User')}</span>!
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Sign Out
          </button>
        </header>

        {message && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 p-3 rounded-lg shadow-lg text-center text-sm font-medium ${isError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {message}
          </div>
        )}

        {/* Tabs for Active/Deleted Items */}
        <div className="mb-6 flex space-x-4">
          <button
            className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${!showDeleted ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 bg-gray-100'}`}
            onClick={() => setShowDeleted(false)}
          >
            Active Items
          </button>
          <button
            className={`px-4 py-2 rounded-t-lg font-semibold border-b-2 ${showDeleted ? 'border-red-600 text-red-700 bg-white' : 'border-transparent text-gray-500 bg-gray-100'}`}
            onClick={() => setShowDeleted(true)}
          >
            Deleted Items
          </button>
        </div>

        {!showDeleted ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-white shadow-xl rounded-xl p-4 lg:p-0 lg:bg-transparent lg:shadow-none">
                {/* Collapsible Toggle for Mobile */}
                <div className="flex justify-between items-center lg:hidden">
                  <h2 className="text-2xl font-bold text-indigo-700">Add New Item</h2>
                  <button
                    onClick={() => setIsFormVisible(!isFormVisible)}
                    className="p-2 rounded-md hover:bg-gray-100"
                    aria-expanded={isFormVisible}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 transition-transform duration-300 ${isFormVisible ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {/* Form Container: hidden on mobile by default, always visible on desktop */}
                <div className={`${isFormVisible ? 'block' : 'hidden'} lg:block mt-4 lg:mt-0`}>
                  <ItemForm 
                    db={db} 
                    user={user} 
                    onClear={handleMessage} 
                    inventory={inventory}
                    deletedInventory={deletedInventory}
                    onDuplicate={(item, isLot) => setDuplicateItem({ item, isLot })}
                  />
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0 border-b pb-2 sm:border-b-0 sm:pb-0">Inventory Overview</h2>
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      className="border rounded p-1 text-sm"
                    >
                      <option value="name">Name</option>
                      <option value="expiryDate">Expiry Date</option>
                      <option value="quantity">Quantity</option>
                      <option value="lotNumber">Lot Number</option>
                    </select>
                    <button
                      type="button"
                      className="ml-1 px-2 py-1 border rounded text-xs font-semibold bg-gray-100 hover:bg-gray-200"
                      onClick={() => setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
                      title="Toggle sort order"
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                    <div className="ml-4 flex items-center space-x-2">
                      <label htmlFor="barcode-input" className="text-sm font-medium text-gray-700">Barcode:</label>
                      <div className="relative">
                        <input
                          id="barcode-input"
                          type="text"
                          value={barcode}
                          onChange={e => setBarcode(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleBarcodeSearch(barcode);
                            }
                          }}
                          className="border rounded p-1 text-sm pl-2 pr-8"
                          placeholder="Scan or enter barcode..."
                          style={{ minWidth: 180 }}
                        />
                        {isMobile && (
                          <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500 hover:text-indigo-600"
                            title="Open barcode scanner"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 0h10v10H5V5z" clipRule="evenodd" />
                              <path d="M6 7h2v6H6V7zm4 0h2v6h-2V7zm4 0h2v6h-2V7z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <MetricsPanel metrics={metrics} />

                <div className="bg-white p-4 shadow-md rounded-xl mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <label className="block sm:col-span-4">
                        <span className="text-sm font-medium text-gray-700">Search (Name, Code, Lot, Section)</span>
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="e.g., Antibody, Hematology, L1002A"/>
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Lab Section</span>
                        <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                            {LAB_SECTIONS.map((option) => (<option key={option.name} value={option.name}>{option.name}</option>))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Temperature</span>
                        <select value={tempFilter} onChange={(e) => setTempFilter(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                            {TEMP_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Status Alert</span>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                            {STATUS_OPTIONS.map((option) => (<option key={option} value={option}>{option}</option>))}
                        </select>
                    </label>
                    <div className="flex items-end space-x-2 sm:col-span-1">
                        <button onClick={handleExport}
                            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                            title="Export current filtered data to CSV">
                            Export
                        </button>
                        <button
                            onClick={() => {
                                setSearchTerm(''); setSectionFilter(LAB_SECTIONS[0].name);
                                setTempFilter(TEMP_OPTIONS[0]); setStatusFilter(STATUS_OPTIONS[0]);
                            }}
                            className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100">
                            Clear
                        </button>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mb-4 font-semibold">
                    Showing {filteredInventory.length} of {inventory.length} total items.
                </p>

                {filteredInventory.length === 0 ? (
                    <p className="text-gray-500 p-8 text-center bg-white rounded-xl shadow-inner">
                        {inventory.length > 0 ? "No items match the current filter criteria." : "Your inventory is empty. Add an item to get started!"}
                    </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredInventory.map((item) => (
                      <InventoryCard
                        key={item.id}
                        item={item}
                        db={db}
                        user={user}
                        onEdit={setSelectedItem}
                        onMessage={handleMessage}
                        onConsumeClick={setItemToConsume}
                        onLogView={setItemToViewLog}
                        onDelete={setItemToDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {isScannerOpen && (
              <BarcodeScannerInline
                onScan={handleScanSuccess}
                onClose={() => setIsScannerOpen(false)}
                /*onError={(err) => {
                  // Only show significant errors to the user to avoid noise.
                  if (shouldShowError(err)) {
                    handleMessage(err, true);
                  }
                }}*/
              />
            )}
            {selectedItem && (
              <EditModal
                db={db} item={selectedItem} user={user}
                onClose={() => setSelectedItem(null)} onMessage={handleMessage}
              />
            )}
            {itemToConsume && (
                <ConsumptionModal 
                    item={itemToConsume} 
                    onClose={() => setItemToConsume(null)} 
                    onMessage={handleMessage}
                    handleConsume={handleConsume}
                />
            )}
            {itemToViewLog && (
                <ActivityLogModal 
                    db={db} item={itemToViewLog} 
                    onClose={() => setItemToViewLog(null)} onMessage={handleMessage}
                />
            )}
            {itemToDelete && (
                <DeleteConfirmationModal
                    db={db} item={itemToDelete} user={user}
                    onClose={() => setItemToDelete(null)} onMessage={handleMessage}
                />
            )}
            {duplicateItem && (
                <DuplicateItemModal
                    item={duplicateItem.item}
                    isLot={duplicateItem.isLot}
                    onClose={() => setDuplicateItem(null)}
                    onEdit={setSelectedItem}
                />
            )}
            {itemFromScan && (
                <ItemDetailsModal
                    item={itemFromScan}
                    onClose={() => setItemFromScan(null)}
                    db={db}
                    user={user}
                    onEdit={setSelectedItem}
                    onMessage={handleMessage}
                    onConsumeClick={setItemToConsume}
                    onLogView={setItemToViewLog}
                    onDelete={setItemToDelete}
                />
            )}
          </>
        ) : (
          <div className="bg-white p-6 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-bold text-red-700 mb-4 border-b pb-2">Deleted Items</h2>
            {deletedInventory.length === 0 ? (
              <p className="text-gray-500 p-8 text-center bg-white rounded-xl shadow-inner">No deleted items.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {deletedInventory.map((item) => (
                  <div key={item.id} className="relative bg-gray-50 p-4 shadow-lg rounded-xl flex flex-col space-y-2 border-2 border-red-200">
                    <h4 className="text-lg font-bold text-gray-800">{item.name}</h4>
                    <p className="text-sm text-gray-600">Lot #: {item.lotNumber || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                    <div className="flex justify-end space-x-2 mt-4">
                      <button
                        className="py-1 px-3 bg-green-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-green-700"
                        onClick={() => handleRestore(item)}
                        title="Restore Item"
                      >
                        Restore
                      </button>
                      <button
                        className="py-1 px-3 bg-red-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-red-700"
                        onClick={() => setItemToPermanentDelete(item)}
                        title="Delete Permanently"
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {itemToPermanentDelete && (
                <DeleteConfirmationModal
                    db={db}
                    user={user}
                    item={itemToPermanentDelete}
                    onClose={() => setItemToPermanentDelete(null)}
                    onMessage={handleMessage}
                    isPermanentDelete={true}
                    onConfirmDelete={async (item) => {
                        await handlePermanentDelete(item);
                        setItemToPermanentDelete(null);
                    }}
                />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryDashboard;
