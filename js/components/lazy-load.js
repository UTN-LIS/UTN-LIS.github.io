// lazy-load.js - Lazy loading functionality for images

// Lazy-load for images to improve performance
function initLazyLoad() {
  const images = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy');
        observer.unobserve(img);
      }
    });
  });

  images.forEach(img => imageObserver.observe(img));
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initLazyLoad };
}