import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface BaseFieldProps {
  label?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface InputFieldProps extends BaseFieldProps {
  type: 'input';
  inputType?: 'text' | 'email' | 'password' | 'number' | 'color';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface TextareaFieldProps extends BaseFieldProps {
  type: 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

interface SelectFieldProps extends BaseFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

interface CheckboxFieldProps extends BaseFieldProps {
  type: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface ColorFieldProps extends BaseFieldProps {
  type: 'color';
  value: string;
  onChange: (value: string) => void;
}

type FormFieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps | CheckboxFieldProps | ColorFieldProps;

const FormField: React.FC<FormFieldProps> = (props) => {
  const { label, description, error, required, disabled, className = '' } = props;

  const baseInputClasses = classNames(
    "w-full px-3 py-2 rounded-lg border transition-all duration-200",
    "bg-background border-border text-foreground",
    "focus:border-primary focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
    error && "border-destructive bg-destructive/10",
    disabled && "opacity-60 cursor-not-allowed",
    "placeholder-muted-foreground"
  );

  const labelClasses = classNames(
    "block text-sm font-medium mb-2",
    "text-foreground",
    error && "text-destructive"
  );

  const renderField = () => {
    switch (props.type) {
      case 'input':
        return (
          <input
            type={props.inputType || 'text'}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            min={props.min}
            max={props.max}
            disabled={disabled}
            className={baseInputClasses}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder}
            rows={props.rows || 3}
            disabled={disabled}
            className={classNames(baseInputClasses, "resize-y min-h-[80px]")}
          />
        );

      case 'select':
        return (
          <select
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClasses}
          >
            {props.placeholder && (
              <option value="">{props.placeholder}</option>
            )}
            {props.options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={props.checked}
              onChange={(e) => props.onChange(e.target.checked)}
              disabled={disabled}
              className={classNames(
                "h-4 w-4 rounded border transition-colors",
                "border-border bg-background text-primary focus:ring-primary focus:ring-offset-background",
                "focus:ring-2 focus:ring-offset-2"
              )}
            />
            {label && (
              <span className={classNames(
                "ml-2 text-sm",
                "text-foreground",
                disabled && "opacity-60"
              )}>
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </span>
            )}
          </label>
        );

      case 'color':
        return (
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              disabled={disabled}
              className="w-12 h-10 rounded-lg border border-border cursor-pointer disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              disabled={disabled}
              className={classNames(baseInputClasses, "flex-1")}
              placeholder="#000000"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={classNames("space-y-1", className)}>
      {label && props.type !== 'checkbox' && (
        <label className={labelClasses}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      
      {renderField()}
      
      {description && (
        <p className={classNames(
          "text-xs",
          "text-muted-foreground"
        )}>
          {description}
        </p>
      )}
      
      {error && (
        <p className="text-xs text-destructive flex items-center">
          <span className="mr-1">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;