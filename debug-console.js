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

// Patch Twitter embed loading
window.twttr = window.twttr || {};
window.twttr.ready = function(callback) {
  console.log('Twitter embed API ready callback called');
  if (callback) callback();
};

// Patch Instagram embed loading
window.instgrm = window.instgrm || {};
window.instgrm.Embeds = window.instgrm.Embeds || {};
window.instgrm.Embeds.process = function() {
  console.log('Instagram embed process called');
};

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
      
      // Log post details
      if (window.app.posts && window.app.posts.length > 0) {
        console.log('Posts details:', window.app.posts.map(post => ({
          id: post.id,
          type: post.type,
          url: post.url
        })));
      }
      
      // Monkey patch the createPostElement method to add more logging
      const originalCreatePostElement = window.app.createPostElement;
      if (originalCreatePostElement) {
        window.app.createPostElement = function(post) {
          console.log('Creating post element for:', post);
          const element = originalCreatePostElement.call(window.app, post);
          console.log('Post element created:', element);
          return element;
        };
      }
      
      // Monkey patch the loadEmbed methods
      const embedTypes = ['loadTwitterEmbed', 'loadInstagramEmbed', 'loadYouTubeEmbed', 'loadLinkedInEmbed'];
      embedTypes.forEach(methodName => {
        if (window.app[methodName]) {
          const originalMethod = window.app[methodName];
          window.app[methodName] = function(element, url) {
            console.log(`Calling ${methodName} for url:`, url);
            try {
              return originalMethod.call(window.app, element, url);
            } catch (error) {
              console.error(`Error in ${methodName}:`, error);
              return null;
            }
          };
        }
      });
      
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

// Add a helper function to manually load embeds
window.debugLoadEmbeds = function() {
  console.log('Manually loading embeds...');
  
  // Try to load Twitter embeds
  if (window.twttr && window.twttr.widgets) {
    console.log('Loading Twitter widgets...');
    window.twttr.widgets.load();
  } else {
    console.log('Twitter widgets not available');
  }
  
  // Try to load Instagram embeds
  if (window.instgrm && window.instgrm.Embeds) {
    console.log('Processing Instagram embeds...');
    window.instgrm.Embeds.process();
  } else {
    console.log('Instagram Embeds not available');
  }
  
  // Check for YouTube iframes
  const youtubeIframes = document.querySelectorAll('iframe[src*="youtube.com"]');
  console.log('YouTube iframes found:', youtubeIframes.length);
  
  // Check for LinkedIn embeds
  const linkedinEmbeds = document.querySelectorAll('.linkedin-embed');
  console.log('LinkedIn embeds found:', linkedinEmbeds.length);
};
