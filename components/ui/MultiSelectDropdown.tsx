import React, { useState, useRef, useEffect } from 'react';
import { TagIcon } from './Icons';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);

  const handleSelect = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectedLabels = options
    .filter((opt) => selectedValues.includes(opt.value))
    .map((opt) => opt.label)
    .join(', ');

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
      >
        <span className="block truncate">
          {selectedValues.length > 0 ? selectedLabels : <span className="text-gray-500">انتخاب تگ...</span>}
        </span>
        <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {options.length > 0 ? (
            options.map((option) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    readOnly
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 ml-3"
                  />
                  <span className="font-normal block truncate">{option.label}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-2">هیچ تگی یافت نشد.</div>
          )}
        </div>
      )}
    </div>
  );
};
