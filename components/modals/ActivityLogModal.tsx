
import React, { useState, useEffect } from 'react';
import { query, getDocs, orderBy, limit } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getActivityLogCollectionRef } from '../../services/firebase';
import { formatDisplayDate, displayUserName } from '../../utils/formatters';
import type { InventoryItem, ActivityLogEntry } from '../../types';

interface ActivityLogModalProps {
    db: Firestore;
    item: InventoryItem;
    onClose: () => void;
    onMessage: (msg: string, isError?: boolean) => void;
}

const ActivityLogModal: React.FC<ActivityLogModalProps> = ({ db, item, onClose, onMessage }) => {
    const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
    const [logLoading, setLogLoading] = useState(true);

    // Helper to make field names more readable
    const formatFieldName = (fieldName: string) => fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());

    const renderLogDetails = (log: ActivityLogEntry) => {
        switch (log.type) {
            case 'CONSUME':
                return <><span className="font-semibold text-red-700">Consumed: {log.details.consumedQuantity} unit(s). New stock: {log.details.newQuantity}.</span><p className="text-gray-700 mt-1 text-sm"><span className="font-medium">Reason:</span> {log.details.reason || 'No reason provided.'}</p></>;
            case 'EDIT': {
                const changes = log.details.changes;
                if (!changes || Object.keys(changes).length === 0) {
                    return <span className="font-semibold text-blue-600">Item details edited.</span>;
                }
                return (
                    <div>
                        <span className="font-semibold text-blue-600">Item details edited:</span>
                        <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                            {Object.entries(changes).map(([key, value]: [string, any]) => (
                                <li key={key}><span className="font-medium">{formatFieldName(key)}:</span> "{value.old}" <span className="font-sans-serif">→</span> "{value.new}"</li>
                            ))}
                        </ul>
                    </div>);
            }
            case 'QUANTITY_ADJUST': return <span className="font-semibold text-green-700">Recieved {log.details.change} unit(s). New stock: {log.details.newQuantity}.</span>;
            case 'DELETE': return <span className="font-semibold text-red-600">Item moved to Deleted Items.</span>;
            case 'RESTORE': return <span className="font-semibold text-green-600">Item restored from Deleted Items.</span>;
            default: return <span className="font-semibold text-gray-600">Action: {log.type}</span>;
        }
    };

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const logRef = getActivityLogCollectionRef(db, item.id);
                const q = query(logRef, orderBy('timestamp', 'desc'), limit(10));
                const snapshot = await getDocs(q);
                const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLogEntry));
                setLogEntries(logs);
            } catch (error) {
                console.error("Error fetching consumption log:", error);
                onMessage('Failed to fetch consumption logs.', true);
            } finally {
                setLogLoading(false);
            }
        };

        fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, item.id]);

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="log-title">
                <h3 id="log-title" className="text-xl font-bold text-indigo-700 mb-4 border-b pb-2">Activity Log for: {item.name}</h3>
                <p className='text-sm text-gray-600 mb-4'>Lot: {item.lotNumber || 'N/A'} | Current Stock: {item.quantity}</p>

                {logLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading log history...</div>
                ) : logEntries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No activity records found for this item.</div>
                ) : (
                    <div className="space-y-3">
                        {logEntries.map((log) => (
                            <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-start text-sm">{renderLogDetails(log)}<span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatDisplayDate(log.timestamp)}</span></div>
                                <p className="text-xs text-gray-400 mt-1">
                                    Logged by: <span className="font-medium text-indigo-500 ml-1">{displayUserName(log.user)}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                )}
                
                {logEntries.length > 0 && (
                    <p className='text-xs text-gray-400 mt-4 italic'>Showing the latest 10 log entries.</p>
                )}

                <div className="flex justify-end mt-6">
                    <button type="button" onClick={onClose}
                        className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActivityLogModal;
