import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';

interface ReassignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newId: string) => void;
  title: string;
  message: string;
  options: { value: string; label: string }[];
  isConfirming?: boolean;
}

export const ReassignDialog: React.FC<ReassignDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  options,
  isConfirming = false,
}) => {
  const [selectedId, setSelectedId] = useState('');

  const handleConfirm = () => {
    if (selectedId) {
      onConfirm(selectedId);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="p-4 text-gray-700">
        <p className="mb-6 text-center">{message}</p>
        <Select
          label="انتخاب مورد جایگزین"
          options={[{ value: '', label: 'لطفا انتخاب کنید...', disabled: true }, ...options]}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          fullWidth
        />
        <div className="flex justify-center space-x-4 space-x-reverse mt-6">
          <Button 
            variant="secondary" 
            onClick={onClose} 
            disabled={isConfirming}
          >
            لغو
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            loading={isConfirming}
            disabled={!selectedId || isConfirming}
          >
            حذف و انتقال
          </Button>
        </div>
      </div>
    </Modal>
  );
};