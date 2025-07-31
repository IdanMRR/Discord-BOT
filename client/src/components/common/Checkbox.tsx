import React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  label, 
  id, 
  className = '',
  ...props 
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`checkbox-wrapper ${className}`}>
      <input 
        type="checkbox" 
        className="checkbox" 
        id={checkboxId} 
        {...props} 
      />
      <label htmlFor={checkboxId} className="checkbox-label">
        {label}
      </label>
    </div>
  );
};