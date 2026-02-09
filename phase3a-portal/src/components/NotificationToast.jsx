import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import './NotificationToast.css';

const NotificationToast = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 300); // Wait for fade-out animation
  };

  if (!notification) return null;

  return (
    <div className={`notification-toast ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="toast-icon-container">
        <AlertCircle className="toast-icon" />
      </div>
      <div className="toast-content">
        <h4 className="toast-title">{notification.title}</h4>
        <p className="toast-message">{notification.message}</p>
      </div>
      <button
        className="toast-close-button"
        onClick={handleClose}
        aria-label="Close notification"
      >
        <X size={18} />
      </button>
    </div>
  );
};

// Toast Container component to manage multiple toasts
export const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <NotificationToast
          key={toast.id}
          notification={toast}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};

export default NotificationToast;
