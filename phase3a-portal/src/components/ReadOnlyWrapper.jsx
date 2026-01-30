import React from 'react';

/**
 * ReadOnlyWrapper - Prevents write operations in demo mode
 * 
 * Wraps buttons, forms, and actions to show toast notifications
 * when users try to perform write operations in demo/read-only mode.
 */

// Toast notification component for read-only alerts
export const showReadOnlyToast = (message = 'This is a demo - changes are not saved') => {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up';
  toast.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <span class="font-medium">${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.add('animate-fade-out');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
};

// Add CSS for animations if not already present
const addToastStyles = () => {
  if (document.getElementById('read-only-toast-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'read-only-toast-styles';
  style.textContent = `
    @keyframes slide-up {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes fade-out {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
    
    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
    
    .animate-fade-out {
      animation: fade-out 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
};

// Initialize styles on load
if (typeof window !== 'undefined') {
  addToastStyles();
}

/**
 * ReadOnlyButton - Wrapper for buttons in read-only mode
 */
export const ReadOnlyButton = ({ 
  children, 
  onClick, 
  disabled = false, 
  readOnly = false,
  toastMessage,
  className = '',
  ...props 
}) => {
  const isReadOnly = readOnly || import.meta.env.VITE_READ_ONLY_MODE === 'true';
  
  const handleClick = (e) => {
    if (isReadOnly) {
      e.preventDefault();
      e.stopPropagation();
      showReadOnlyToast(toastMessage);
      return;
    }
    
    if (onClick && !disabled) {
      onClick(e);
    }
  };
  
  return (
    <button
      {...props}
      className={`${className} ${isReadOnly ? 'cursor-not-allowed opacity-75' : ''}`}
      onClick={handleClick}
      disabled={disabled && !isReadOnly}
    >
      {children}
    </button>
  );
};

/**
 * ReadOnlyForm - Wrapper for forms in read-only mode
 */
export const ReadOnlyForm = ({ 
  children, 
  onSubmit, 
  readOnly = false,
  toastMessage = 'This is a demo - form submission is disabled',
  ...props 
}) => {
  const isReadOnly = readOnly || import.meta.env.VITE_READ_ONLY_MODE === 'true';
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isReadOnly) {
      showReadOnlyToast(toastMessage);
      return;
    }
    
    if (onSubmit) {
      onSubmit(e);
    }
  };
  
  return (
    <form {...props} onSubmit={handleSubmit}>
      {children}
    </form>
  );
};

/**
 * ReadOnlyInput - Wrapper for inputs in read-only mode
 */
export const ReadOnlyInput = ({ 
  readOnly = false,
  onFocus,
  ...props 
}) => {
  const isReadOnly = readOnly || import.meta.env.VITE_READ_ONLY_MODE === 'true';
  
  const handleFocus = (e) => {
    if (isReadOnly && props.type !== 'text' && props.type !== 'search') {
      showReadOnlyToast('This is a demo - editing is disabled');
    }
    
    if (onFocus) {
      onFocus(e);
    }
  };
  
  return (
    <input 
      {...props} 
      readOnly={isReadOnly}
      onFocus={handleFocus}
    />
  );
};

/**
 * useReadOnly - Hook to check read-only mode
 */
export const useReadOnly = () => {
  const isReadOnly = import.meta.env.VITE_READ_ONLY_MODE === 'true';
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  
  return {
    isReadOnly,
    isDemoMode,
    showToast: showReadOnlyToast
  };
};

export default {
  ReadOnlyButton,
  ReadOnlyForm,
  ReadOnlyInput,
  useReadOnly,
  showReadOnlyToast
};
