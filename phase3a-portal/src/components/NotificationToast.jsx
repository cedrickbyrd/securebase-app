import React, { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import './NotificationToast.css';

const NotificationToast = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss: 10 seconds for critical, 5 seconds for others
    const dismissTime = notification.severity === 'critical' ? 10000 : 5000;
    const timer = setTimeout(() => {
      handleClose();
    }, dismissTime);

    return () => clearTimeout(timer);
  }, [notification.severity]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 300); // Wait for fade-out animation
  };

  if (!notification) return null;

  // Get icon based on severity
  const getIcon = () => {
    switch (notification.severity) {
      case 'critical':
        return <AlertCircle className="toast-icon" />;
      case 'warning':
        return <AlertTriangle className="toast-icon" />;
      case 'info':
        return <Info className="toast-icon" />;
      case 'success':
        return <CheckCircle className="toast-icon" />;
      default:
        return <AlertCircle className="toast-icon" />;
    }
  };

  // Get severity class for styling
  const getSeverityClass = () => {
    return `severity-${notification.severity || 'info'}`;
  };

  return (
    <div className={`notification-toast ${getSeverityClass()} ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="toast-icon-container">
        {getIcon()}
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
  // Limit to max 3 visible toasts (show most recent)
  const visibleToasts = toasts.slice(-3);
  
  return (
    <div className="toast-container">
      {visibleToasts.map((toast) => (
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
