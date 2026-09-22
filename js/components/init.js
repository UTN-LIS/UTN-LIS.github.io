// init.js - Component initialization and coordination

// Placeholder for future component enhancements (e.g., modal, carousel)
function initComponents() {
  // Add any additional component initializations here
  
}

// Initialize all component functionalities on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Import and initialize lazy loading
  if (typeof initLazyLoad === 'function') {
    initLazyLoad();
  }

  // Import and initialize form validation
  if (typeof initFormValidation === 'function') {
    initFormValidation();
  }

  initComponents();
  
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initComponents };
}