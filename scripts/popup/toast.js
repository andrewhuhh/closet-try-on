(function(global){
  class ToastManager {
    constructor() {
      this.container = null;
      this.toasts = new Map();
      this.toastCounter = 0;
      this.init();
    }

    init() {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        console.error('Toast container not found in DOM');
        return;
      }
    }

    show(options) {
      const { title, message = '', type = 'info', duration = 3000, clickAction = null, icon = null, persistent = false } = options;
      if (!this.container) {
        console.error('Toast container not available');
        return null;
      }
      const toastId = `toast-${++this.toastCounter}`;
      const toast = this.createToastElement(toastId, title, message, type, icon, clickAction);
      this.container.insertBefore(toast, this.container.firstChild);
      this.toasts.set(toastId, { element: toast, clickAction, timer: null });
      if (!persistent && duration > 0) {
        this.setupAutoDismiss(toastId, duration);
      }
      this.limitToasts();
      return toastId;
    }

    createToastElement(toastId, title, message, type, icon, clickAction) {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.setAttribute('data-toast-id', toastId);
      const defaultIcons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      const toastIcon = icon || defaultIcons[type] || defaultIcons.info;
      toast.innerHTML = `
        <div class="toast-icon">${toastIcon}</div>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          ${message ? `<div class=\"toast-message\">${message}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Close notification">×</button>
        <div class="toast-progress"></div>
      `;
      if (clickAction && typeof clickAction === 'function') {
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', (e) => {
          if (e.target.classList.contains('toast-close')) return;
          try {
            clickAction();
            this.dismiss(toastId);
          } catch (error) {
            console.error('Error executing toast click action:', error);
          }
        });
      }
      const closeBtn = toast.querySelector('.toast-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dismiss(toastId);
      });
      return toast;
    }

    setupAutoDismiss(toastId, duration) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;
      const progressBar = toastData.element.querySelector('.toast-progress');
      if (progressBar) {
        progressBar.style.width = '100%';
        setTimeout(() => {
          progressBar.style.transition = `width ${duration}ms linear`;
          progressBar.style.width = '0%';
        }, 50);
      }
      toastData.timer = setTimeout(() => {
        this.dismiss(toastId);
      }, duration);
    }

    dismiss(toastId) {
      const toastData = this.toasts.get(toastId);
      if (!toastData) return;
      if (toastData.timer) {
        clearTimeout(toastData.timer);
      }
      toastData.element.classList.add('toast-removing');
      setTimeout(() => {
        if (toastData.element.parentNode) {
          toastData.element.parentNode.removeChild(toastData.element);
        }
        this.toasts.delete(toastId);
      }, 300);
    }

    dismissAll() {
      const toastIds = Array.from(this.toasts.keys());
      toastIds.forEach(id => this.dismiss(id));
    }

    limitToasts() {
      const maxToasts = 5;
      if (this.toasts.size > maxToasts) {
        const oldestToasts = Array.from(this.toasts.keys()).slice(0, this.toasts.size - maxToasts);
        oldestToasts.forEach(id => this.dismiss(id));
      }
    }

    success(title, message, options = {}) { return this.show({ ...options, title, message, type: 'success' }); }
    error(title, message, options = {}) { return this.show({ ...options, title, message, type: 'error', duration: 5000 }); }
    warning(title, message, options = {}) { return this.show({ ...options, title, message, type: 'warning', duration: 4000 }); }
    info(title, message, options = {}) { return this.show({ ...options, title, message, type: 'info' }); }

    generationStarted(message, clickAction) { return this.info('Generation Started', message, { icon: '🎨', clickAction, duration: 2000 }); }
    generationComplete(message, clickAction) { return this.success('Generation Complete!', message, { icon: '🎉', clickAction, duration: 4000 }); }
    avatarGenerated(clickAction) { return this.success('Avatar Created!', 'Your avatar has been generated successfully', { icon: '👤', clickAction, duration: 4000 }); }
    outfitGenerated(clickAction) { return this.success('Outfit Ready!', 'Your try-on result is ready to view', { icon: '👕', clickAction, duration: 4000 }); }
  }

  global.ToastManager = ToastManager;
})(window); 