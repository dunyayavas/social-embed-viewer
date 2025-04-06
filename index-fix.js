// This script will fix the rendering issues in your application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Running fix script to prevent infinite card loading...');
    
    // Wait for the app to be initialized
    setTimeout(() => {
        if (!window.app) {
            console.log('App not initialized yet, waiting more...');
            setTimeout(applyFixes, 1000);
        } else {
            applyFixes();
        }
    }, 500);
    
    function applyFixes() {
        console.log('Applying fixes to prevent infinite card loading...');
        
        // Create a flag to track if we've already rendered posts
        window.postsAlreadyRendered = false;
        
        // Store the original renderPosts method
        const originalRenderPosts = window.app.renderPosts;
        
        // Override the renderPosts method to prevent duplicate rendering
        window.app.renderPosts = function(appendMode = false) {
            console.log('Intercepted renderPosts call');
            
            // If we're already loading or have already rendered posts, don't render again
            if (this.isLoading) {
                console.log('Already loading, skipping render');
                return;
            }
            
            // Check if posts are already rendered
            const postsContainer = document.getElementById('postsContainer');
            if (!postsContainer) {
                console.error('Posts container not found!');
                return;
            }
            
            // If we're not in append mode and posts are already rendered, don't render again
            if (!appendMode && window.postsAlreadyRendered && postsContainer.children.length > 0) {
                console.log('Posts already rendered, skipping');
                return;
            }
            
            // Call the original method
            console.log('Calling original renderPosts with appendMode:', appendMode);
            originalRenderPosts.call(this, appendMode);
            
            // Mark that we've rendered posts
            window.postsAlreadyRendered = true;
        };
        
        // Fix the debug console to prevent it from causing duplicate renders
        if (window.debugLoadEmbeds) {
            console.log('Patching debugLoadEmbeds function');
            const originalDebugLoadEmbeds = window.debugLoadEmbeds;
            window.debugLoadEmbeds = function() {
                console.log('Running patched debugLoadEmbeds');
                // Only run if we haven't already loaded embeds
                if (!window.embedsAlreadyLoaded) {
                    originalDebugLoadEmbeds();
                    window.embedsAlreadyLoaded = true;
                } else {
                    console.log('Embeds already loaded, skipping');
                }
            };
        }
        
        // Create a MutationObserver to watch for infinite loops of posts being added
        const postsContainer = document.getElementById('postsContainer');
        if (postsContainer) {
            console.log('Setting up MutationObserver to detect infinite loops');
            const observer = new MutationObserver((mutations) => {
                // If we're adding too many nodes at once, it might be an infinite loop
                if (mutations.length > 10 && postsContainer.children.length > 30) {
                    console.warn('Possible infinite loop detected, clearing container');
                    // Stop observing to prevent recursive loop
                    observer.disconnect();
                    // Clear the container
                    postsContainer.innerHTML = '';
                    // Add a message
                    const errorMessage = document.createElement('div');
                    errorMessage.className = 'error-message';
                    errorMessage.textContent = 'Rendering was stopped to prevent an infinite loop. Please reload the page.';
                    postsContainer.appendChild(errorMessage);
                }
            });
            
            // Start observing
            observer.observe(postsContainer, { childList: true });
        }
        
        // Force a single render after a delay to ensure posts are shown
        setTimeout(() => {
            if (window.app && typeof window.app.renderPosts === 'function') {
                console.log('Forcing a single render after delay');
                window.postsAlreadyRendered = false; // Reset the flag
                window.app.renderPosts(false); // Render once
            }
        }, 1500);
        
        console.log('Fixes applied successfully');
    }
});
