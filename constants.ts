
export const DEFAULT_MIN_STOCK = 1;

export const TEMP_OPTIONS = [
  'All Temperatures',
  'RT (Room Temp)',
  '2-8 °C (Refrigerated)',
  '-18 to -40 °C (Frozen)',
];

export const LAB_SECTIONS: { name: string, color: string }[] = [
  { name: 'All Sections', color: 'bg-gray-200 text-gray-800' },
  { name: 'Blood Bank', color: 'bg-red-100 text-red-800' },
  { name: 'Chemistry', color: 'bg-blue-100 text-blue-800' },
  { name: 'Hematology', color: 'bg-pink-100 text-pink-800' },
  { name: 'Histology', color: 'bg-purple-100 text-purple-800' },
  { name: 'Microbiology', color: 'bg-yellow-100 text-yellow-800' },
  { name: 'Molecular Diagnostics', color: 'bg-indigo-100 text-indigo-800' },
  { name: 'Office Items', color: 'bg-gray-100 text-gray-800' },
  { name: 'Phlebotomy', color: 'bg-green-100 text-green-800' },
];

/**
 * Retrieves the Tailwind CSS color classes for a given lab section name.
 * @param sectionName The name of the lab section.
 * @returns A string of Tailwind classes for background and text color.
 */
export const getSectionColor = (sectionName?: string): string => {
    const section = LAB_SECTIONS.find(s => s.name === sectionName);
    return section ? section.color : 'bg-gray-100 text-gray-800'; // Default color
};

export const LAST_SECTION_KEY = 'lab_inventory_last_section';

export const STATUS_OPTIONS = [
  'All Statuses',
  'Low Stock',
  'Expiring/Expired',
];
