import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  className = '',
  id,
  ...props 
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input 
        id={inputId}
        className={`input-field ${error ? 'border-destructive' : ''} ${className}`} 
        {...props} 
      />
      {error && (
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          {error}
        </p>
      )}
    </div>
  );
};