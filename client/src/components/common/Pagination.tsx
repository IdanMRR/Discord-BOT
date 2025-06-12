import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = ''
}) => {
  const { darkMode } = useTheme();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className={classNames(
      "flex items-center justify-between border-t px-4 py-3 sm:px-6",
      darkMode ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white",
      className
    )}>
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={classNames(
            "relative inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
            darkMode 
              ? "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600" 
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          )}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={classNames(
            "relative ml-3 inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
            darkMode 
              ? "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600" 
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          )}
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className={classNames(
            "text-sm",
            darkMode ? "text-gray-300" : "text-gray-700"
          )}>
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-lg shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={classNames(
                "relative inline-flex items-center rounded-l-lg border px-3 py-2 text-sm font-medium transition-all duration-200 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed",
                darkMode 
                  ? "border-gray-600 bg-gray-700 text-gray-400 hover:bg-gray-600" 
                  : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
              )}
            >
              <span className="sr-only">Previous</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            
            {getVisiblePages().map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className={classNames(
                    "relative inline-flex items-center border px-4 py-2 text-sm font-medium",
                    darkMode 
                      ? "border-gray-600 bg-gray-700 text-gray-400" 
                      : "border-gray-300 bg-white text-gray-700"
                  )}>
                    ...
                  </span>
                ) : (
                  <button
                    onClick={() => onPageChange(page as number)}
                    className={classNames(
                      "relative inline-flex items-center border px-4 py-2 text-sm font-medium transition-all duration-200 focus:z-20 hover:scale-105",
                      currentPage === page
                        ? darkMode
                          ? "z-10 bg-blue-600 border-blue-600 text-white shadow-lg"
                          : "z-10 bg-blue-600 border-blue-600 text-white shadow-lg"
                        : darkMode
                          ? "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={classNames(
                "relative inline-flex items-center rounded-r-lg border px-3 py-2 text-sm font-medium transition-all duration-200 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed",
                darkMode 
                  ? "border-gray-600 bg-gray-700 text-gray-400 hover:bg-gray-600" 
                  : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
              )}
            >
              <span className="sr-only">Next</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
