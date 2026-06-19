import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'xl',
}: ModalProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 sm:px-8 md:px-10">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div
        className={cn(
          'relative z-50 w-full rounded-2xl border border-continental-gray-3/60 bg-white shadow-2xl shadow-continental-gray-3/30',
          sizeClasses[size],
          'max-h-[90vh] overflow-hidden flex flex-col'
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {(title || description) && (
          <div className="border-b bg-gradient-to-r from-white to-continental-gray-4/30">
            <div
              className="relative flex w-full items-start justify-between gap-4 px-5 py-6 sm:px-12 md:px-14"
            >
              <div className="space-y-1">
                {title && <h2 className="text-xl font-semibold text-continental-black">{title}</h2>}
                {description && <p className="text-sm text-continental-gray-1 leading-relaxed">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="absolute right-3 top-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-continental-gray-3 bg-white text-continental-black shadow-xl transition hover:bg-continental-gray-4 hover:text-continental-black sm:right-5 sm:top-5"
                aria-label="Cerrar modal"
              >
                <X className="h-8 w-8 text-continental-black" strokeWidth={3.2} />
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto bg-white flex justify-center">
          <div className="w-full max-w-2xl px-4 py-6 sm:px-12 sm:py-10 md:px-14 space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'border-t bg-continental-gray-4/60',
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-start justify-between gap-4 px-8 py-6 sm:flex-row sm:items-center sm:justify-end sm:px-10 sm:py-6">
        {children}
      </div>
    </div>
  );
}
