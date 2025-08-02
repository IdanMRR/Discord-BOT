import React from 'react';
import { createPortal } from 'react-dom';

interface ToastPortalProps {
  children: React.ReactNode;
}

const ToastPortal: React.FC<ToastPortalProps> = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.top = '0';
      toastContainer.style.left = '0';
      toastContainer.style.right = '0';
      toastContainer.style.zIndex = '2147483647'; // Maximum z-index
      toastContainer.style.pointerEvents = 'none';
      document.body.appendChild(toastContainer);
    }

    return () => {
      // Clean up if no other portals are using it
      const container = document.getElementById('toast-container');
      if (container && container.childNodes.length === 0) {
        container.remove();
      }
    };
  }, []);

  if (!mounted) return null;

  const container = document.getElementById('toast-container');
  if (!container) return null;

  return createPortal(children, container);
};

export default ToastPortal;