
import React from 'react';

interface Metrics {
    totalItems: number;
    totalQuantity: number;
    lowStockCount: number;
    expiringItemsCount: number;
}

interface MetricsPanelProps {
    metrics: Metrics;
}

interface MetricCardProps {
    title: string;
    value: number | string;
    colorClass: string;
    icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, colorClass, icon }) => (
    <div className={`p-5 rounded-xl shadow-lg flex items-center justify-between ${colorClass}`}>
        <div>
            <p className="text-sm font-medium text-white opacity-80">{title}</p>
            <p className="text-3xl font-extrabold text-white">{value}</p>
        </div>
        <div className="text-white opacity-70">{icon}</div>
    </div>
);

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard title="Unique Items" value={metrics.totalItems} colorClass="bg-indigo-600"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10l3-2 3 2 3-2 3 2 3-2V7M3 17h18" /></svg>}/>
            <MetricCard title="Total Quantity" value={metrics.totalQuantity} colorClass="bg-blue-600"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>}/>
            <MetricCard title="Low Stock Alerts" value={metrics.lowStockCount} colorClass="bg-orange-500"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.332 16c-.77 1.333.192 3 1.732 3z" /></svg>}/>
            <MetricCard title="Expiring/Expired" value={metrics.expiringItemsCount} colorClass="bg-red-600"
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-2 4h-4m-6 4v8a2 2 0 002 2h8a2 2 0 002-2v-8m-12 0h12" /></svg>}/>
        </div>
    );
};

export default MetricsPanel;
