import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string; // For modal content styling
  overlayClassName?: string; // For overlay styling
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  overlayClassName = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden'; // Prevent scrolling background
      document.addEventListener('keydown', handleEscape);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 ${overlayClassName}`}
      onClick={(e) => {
        // Only close if click is on the overlay, not on the modal content itself
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={`relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-auto overflow-hidden
          transform transition-all duration-300 ease-out scale-100 opacity-100
          sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl
          ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          {title && (
            <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          )}
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 transition-colors"
            onClick={onClose}
            aria-label="بستن"
          >
            <CloseIcon className="fa-lg" />
          </button>
        </div>
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};