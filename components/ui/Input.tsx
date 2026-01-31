import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  fullWidth = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-')}` : `input-${Math.random().toString(36).substr(2, 9)}`);
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`relative ${widthClass} ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          block ${widthClass} px-3 py-2 border border-gray-300 rounded-md
          shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500
          sm:text-sm bg-white text-black
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  fullWidth = false,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? `textarea-${label.replace(/\s+/g, '-')}` : `textarea-${Math.random().toString(36).substr(2, 9)}`);
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <div className={`relative ${widthClass} ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`
          block ${widthClass} px-3 py-2 border border-gray-300 rounded-md
          shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500
          sm:text-sm bg-white text-black
          ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};