// Debug script to help identify why cards aren't loading
console.log('Debug script loaded');

// Check if we're using the right script
console.log('Scripts loaded:', {
  appSupabase: !!document.querySelector('script[src*="app-supabase.js"]'),
  appOriginal: !!document.querySelector('script[src*="app.js"]'),
  dbService: !!document.querySelector('script[src*="db-service.js"]'),
  supabase: !!document.querySelector('script[src*="supabase.js"]')
});

// Add a global error handler
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
});

// Monitor DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded');
  
  // Check important elements
  console.log('Elements found:', {
    postsContainer: !!document.getElementById('postsContainer'),
    tagFilters: !!document.getElementById('tagFilters'),
    loadingIndicator: !!document.getElementById('loadingIndicator'),
    authRequired: !!document.getElementById('authRequired')
  });
  
  // Check if app instance is created
  setTimeout(() => {
    console.log('App instance:', !!window.app);
    
    if (window.app) {
      // Log app state
      console.log('App initialized:', window.app.isInitialized);
      console.log('App authenticated:', window.app.isAuthenticated());
      console.log('App posts count:', window.app.posts?.length || 0);
      
      // Try to manually render posts
      try {
        console.log('Attempting to manually render posts...');
        window.app.renderPosts();
      } catch (error) {
        console.error('Error manually rendering posts:', error);
      }
    }
  }, 1000);
});
