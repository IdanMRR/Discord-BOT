import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import { useTheme } from '../../contexts/ThemeContext';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  className?: string;
}

function Table<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  onSort,
  sortKey,
  sortDirection,
  className = ''
}: TableProps<T>) {
  const { darkMode } = useTheme();
  const handleSort = (key: string) => {
    if (!onSort) return;
    
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>↕️</span>;
    return sortDirection === 'asc' ? <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>↑</span> : <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>↓</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden shadow ring-1 ${darkMode ? 'ring-gray-700' : 'ring-black ring-opacity-5'} md:rounded-lg ${className}`}>
      <table className={`min-w-full divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-300'}`}>
        <thead className={`${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key as string}
                scope="col"
                className={`px-6 py-3 text-left text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider ${
                  column.sortable ? `cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}` : ''
                } ${column.className || ''}`}
                onClick={() => column.sortable && handleSort(column.key as string)}
              >
                <div className="flex items-center space-x-1">
                  <span>{column.header}</span>
                  {column.sortable && (
                    <span className="text-gray-400">{getSortIcon(column.key as string)}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={`${darkMode ? 'bg-gray-800 divide-y divide-gray-700' : 'bg-white divide-y divide-gray-200'}`}>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`px-6 py-12 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr key={index} className={`${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                {columns.map((column) => (
                  <td
                    key={column.key as string}
                    className={`px-6 py-4 whitespace-nowrap text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'} ${column.className || ''}`}
                  >
                    {column.render ? column.render(item) : item[column.key as keyof T]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
