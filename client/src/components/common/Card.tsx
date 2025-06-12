import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', padding = true }) => {
  const { darkMode } = useTheme();
  
  return (
    <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-900'} rounded-lg shadow-sm border ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
