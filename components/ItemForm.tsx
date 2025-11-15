import React, { useState, useEffect } from 'react';
import { addDoc, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getSharedCollectionRef } from '../services/firebase';
import { TEMP_OPTIONS, LAB_SECTIONS, DEFAULT_MIN_STOCK, LAST_SECTION_KEY } from '../constants';
import { formatInputDate } from '../utils/formatters';
import type { InventoryItem, AppUser } from "../types";
import BarcodeScannerInline, { shouldShowError } from "./BarcodeScannerInline";

interface ItemFormProps {
  db: Firestore;
  user: AppUser;
  onClear: (msg: string, isError?: boolean) => void;
  inventory: InventoryItem[];
  deletedInventory?: InventoryItem[];
  onDuplicate: (item: InventoryItem, isLot: boolean) => void;
}

const ItemForm: React.FC<ItemFormProps> = ({ db, user, onClear, inventory, deletedInventory = [], onDuplicate }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [minStock, setMinStock] = useState(DEFAULT_MIN_STOCK);
  const [expiryDate, setExpiryDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [code, setCode] = useState('');
  const [temperature, setTemperature] = useState(TEMP_OPTIONS[1]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lotSuggestions, setLotSuggestions] = useState<string[]>([]);
  const [showLotScanner, setShowLotScanner] = useState(false);
  
  const [section, setSection] = useState(() => {
    try {
        const storedSection = localStorage.getItem(LAST_SECTION_KEY);
        if (storedSection && LAB_SECTIONS.find(s => s.name === storedSection) && storedSection !== LAB_SECTIONS[0].name) {
            return storedSection;
        }
        return LAB_SECTIONS[1].name; 
    } catch (error) {
        return LAB_SECTIONS[1].name;
    }
  });
  
  const [debouncedName, setDebouncedName] = useState('');
  const [debouncedLotNumber, setDebouncedLotNumber] = useState(''); 

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedName(name); }, 200);
    return () => { clearTimeout(handler); };
  }, [name]);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedLotNumber(lotNumber); }, 400);
    return () => { clearTimeout(handler); };
  }, [lotNumber]);

    useEffect(() => {
        if (debouncedName.length < 2) {
            setSuggestions([]);
            setLotSuggestions([]);
            return;
        }
        // Combine names from inventory and deletedInventory
        const allNames = [
          ...inventory.map(item => item.name),
          ...deletedInventory.map(item => item.name)
        ];
        const uniqueNames = [...new Set(allNames)];
        const filteredSuggestions = uniqueNames.filter((itemName: string) => 
            itemName.toLowerCase().includes(debouncedName.toLowerCase())
        ).sort((a: string, b: string) => a.localeCompare(b));
        setSuggestions(filteredSuggestions);

        // Lot suggestions for selected name (only from active inventory)
        const lots = inventory
          .filter(item => item.name === debouncedName && item.lotNumber)
          .map(item => item.lotNumber as string)
          .filter((lot, idx, arr) => lot && arr.indexOf(lot) === idx);
        setLotSuggestions(lots);
    }, [debouncedName, inventory, deletedInventory]);
  
  useEffect(() => {
    const lot = debouncedLotNumber.trim();
    if (lot.length < 3) return; 
    const matchingItem = inventory.find(item => 
        item.lotNumber && item.lotNumber.trim().toLowerCase() === lot.toLowerCase()
    );
    if (matchingItem) {
        setName(matchingItem.name || '');
        setCode(matchingItem.code || '');
        setPackagingType(matchingItem.packagingType || '');
        setTemperature(matchingItem.temperature || TEMP_OPTIONS[1]);
        setSection(matchingItem.section || LAB_SECTIONS[1].name); 
        setMinStock(matchingItem.minStock || DEFAULT_MIN_STOCK);
        setExpiryDate(matchingItem.expiryDate ? formatInputDate(matchingItem.expiryDate) : '');
        onClear(`Details for Lot # ${lot} recalled successfully!`, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedLotNumber, inventory]);

    const handleSuggestionClick = (suggestedName: string) => {
        setName(suggestedName);
        setSuggestions([]);
        setLotNumber(''); // Clear lot number so user can pick or enter
        setLotSuggestions(
          inventory
            .filter(item => item.name === suggestedName && item.lotNumber)
            .map(item => item.lotNumber as string)
            .filter((lot, idx, arr) => lot && arr.indexOf(lot) === idx)
        );
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || Number(quantity) <= 0) return;

    const trimmedName = name.trim();
    const trimmedLot = lotNumber.trim();

    let existingItem: InventoryItem | undefined = undefined;
    let isLotDuplicate = false;
    
    if (trimmedLot) {
        existingItem = inventory.find(item => item.lotNumber && item.lotNumber.trim().toLowerCase() === trimmedLot.toLowerCase());
        if (existingItem) isLotDuplicate = true;
    }
    
    if (!existingItem) {
        existingItem = inventory.find(item => item.name.trim().toLowerCase() === trimmedName.toLowerCase() && !item.lotNumber);
        isLotDuplicate = false;
    }
    
    if (existingItem) {
        onDuplicate(existingItem, isLotDuplicate);
        return;
    }

    const inventoryCollectionRef = getSharedCollectionRef(db);
    try {
      const userRef = {
          uid: user.uid,
          name: user.displayName || user.email,
          isAnonymous: user.isAnonymous,
      };

      await addDoc(inventoryCollectionRef, {
        name: trimmedName,
        quantity: Number(quantity),
        minStock: Number(minStock),
        expiryDate: expiryDate ? Timestamp.fromDate(new Date(expiryDate)) : null,
        lotNumber: trimmedLot,
        packagingType: packagingType.trim(),
        code: code.trim(),
        temperature,
        section, 
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: userRef,
        updatedBy: userRef,
        lowStockNotified: false,
        expiryWarningNotified: false,

      });

      localStorage.setItem(LAST_SECTION_KEY, section);

      setName('');
      setQuantity(1);
      setMinStock(DEFAULT_MIN_STOCK);
      setExpiryDate('');
      setLotNumber('');
      setPackagingType('');
      setCode('');
      setTemperature(TEMP_OPTIONS[1]);
      setSuggestions([]);

      onClear('Item added successfully!', false);
    } catch (error) {
      console.error('Error adding document: ', error);
      onClear('Failed to add item.', true);
    }
  };

  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);

  return (
    <div className="lg:p-4 lg:bg-white lg:shadow-xl lg:rounded-xl">
      <h2 className="text-2xl font-bold text-indigo-700 mb-4 border-b pb-2 hidden lg:block">Add New Inventory Item</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="block relative sm:col-span-2">
            <span className="text-sm font-medium text-gray-700">Item Name *</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="e.g., WBC Lyse"
              list="name-suggestions"
            />
            {suggestions.length > 0 && (
              <datalist id="name-suggestions">
                {suggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            )}
        </div>
        <div className="grid grid-cols-2 gap-4">
            <label className="block">
                <span className="text-sm font-medium text-gray-700">Quantity *</span>
                <input type="number" required min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-700">Min Stock</span>
                <input type="number" min="0" value={minStock} onChange={(e) => setMinStock(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <label className="block">
                <span className="text-sm font-medium text-gray-700">Lot #</span>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val.startsWith('barcode:')) {
                        val = val.replace(/^barcode:/i, '');
                      }
                      setLotNumber(val);
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    placeholder="e.g., L1002A"
                    list="lot-suggestions"
                  />
                  {isMobile && (
                    <button
                      type="button"
                      className="mt-1 px-3 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 text-xs font-semibold border border-indigo-200"
                      onClick={() => setShowLotScanner((v) => !v)}
                    >
                      {showLotScanner ? 'Hide Scanner' : 'Scan Barcode'}
                    </button>
                  )}
                </div>
                {lotSuggestions.length > 0 && (
                  <datalist id="lot-suggestions">
                    {lotSuggestions.map(lot => (
                      <option key={lot} value={lot} />
                    ))}
                  </datalist>
                )}
                {showLotScanner && (
                  <div className="mt-2">
                    <BarcodeScannerInline
                      onScan={(scanned) => {
                        setLotNumber(scanned);
                        setShowLotScanner(false);
                      }}
                      /*onError={(err) => {
                        // Log only significant errors to the console
                        if (shouldShowError(err)) {
                          console.warn("Scanner reported an issue:", err);
                        }
                      }}*/
                      onClose={() => setShowLotScanner(false)}
                    />
                  </div>
                )}
            </label>
            <label className="block">
                <span className="text-sm font-medium text-gray-700">Expiry Date</span>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"/>
            </label>
        </div>
        <label className="block">
            <span className="text-sm font-medium text-gray-700">Code #</span>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" placeholder="e.g., SKU12345"/>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Lab Section *</span>
              <select required value={section} onChange={(e) => setSection(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                {LAB_SECTIONS.slice(1).map((option) => (<option key={option.name} value={option.name}>{option.name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Storage Temperature</span>
              <select value={temperature} onChange={(e) => setTemperature(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white">
                {TEMP_OPTIONS.slice(1).map((option) => (<option key={option} value={option}>{option}</option>))}
              </select>
            </label>
        </div>
        <label className="block">
            <span className="text-sm font-medium text-gray-700">Packaging Type</span>
            <input
              type="text"
              value={packagingType}
              onChange={(e) => setPackagingType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              placeholder="e.g., Box, Vial, Pouch"
              list="packaging-type-suggestions"
            />
            <datalist id="packaging-type-suggestions">
              <option value="BOTTLE" />
              <option value="KIT" />
              <option value="BOX" />
              <option value="CARTRIDGE" />
              <option value="STRIPS" />
              <option value="set" />
              <option value="VIAL" />
              <option value="TRAY" />
              <option value="PC/S" />
              <option value="BAG" />
              <option value="TUBES" />
              <option value="CONTAINER" />
              <option value="BACKET" />
              <option value="PACKET" />
              <option value="BOOK" />
            </datalist>
        </label>
        <button type="submit"
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
          Add Item
        </button>
      </form> 
    </div>
  );
};

export default ItemForm;
