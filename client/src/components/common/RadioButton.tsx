import React from 'react';

interface RadioButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const RadioButton: React.FC<RadioButtonProps> = ({ 
  label, 
  id, 
  className = '',
  ...props 
}) => {
  const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={`radio-wrapper ${className}`}>
      <input 
        type="radio" 
        className="radio" 
        id={radioId} 
        {...props} 
      />
      <label htmlFor={radioId} className="radio-label">
        {label}
      </label>
    </div>
  );
};