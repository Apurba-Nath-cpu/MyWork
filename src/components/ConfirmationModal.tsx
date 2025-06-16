
"use client";
import React from 'react';
import Modal from './Modal'; 
import { ExclamationTriangleIcon } from './custom-icons';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-700 mb-4">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        <h3 className="text-lg leading-6 font-medium text-neutral-900 dark:text-neutral-100" id="modal-title-confirm">
          {title}
        </h3>
        <div className="mt-2 px-2 py-3">
          <p className="text-sm text-neutral-500 dark:text-neutral-300">
            {message}
          </p>
        </div>
      </div>
      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
        <button
          type="button"
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-offset-neutral-800"
          onClick={onConfirm}
        >
          {confirmText}
        </button>        
        <button
          type="button"
          className="mt-3 w-full inline-flex justify-center rounded-md border border-neutral-300 dark:border-neutral-500 shadow-sm px-4 py-2 bg-white dark:bg-neutral-700 text-base font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm dark:focus:ring-offset-neutral-800"
          onClick={onCancel}
        >
          {cancelText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
