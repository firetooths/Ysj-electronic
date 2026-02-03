import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  fullWidth = false,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? `select-${label.replace(/\s+/g, '-')}` : `select-${Math.random().toString(36).substr(2, 9)}`);
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`relative ${widthClass} ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          block ${widthClass} pl-3 pr-10 py-2 border border-gray-300 rounded-md
          shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500
          sm:text-sm bg-white text-black
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
        `}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};