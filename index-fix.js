// This script will fix the element ID issues in your application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Running fix script...');
    
    // Check which script is being used
    const usingSupabase = document.querySelector('script[src*="app-supabase"]') !== null;
    console.log('Using Supabase integration:', usingSupabase);
    
    if (usingSupabase) {
        // Fix is already applied in app-supabase.js
        console.log('Using app-supabase.js - no fixes needed');
    } else {
        // Fix for the original app.js
        console.log('Using app.js - applying fixes');
        
        // Override the renderPosts method to use the correct element ID
        SocialEmbedViewer.prototype._renderPostsInternal = function() {
            const postsEl = document.getElementById('postsContainer');
            if (!postsEl) {
                console.error('Posts container not found!');
                return;
            }
            
            console.log('Rendering posts to postsContainer');
            
            // Clear existing posts
            postsEl.innerHTML = '';
            
            // Filter posts if filters are active
            let filteredPosts = this.posts;
            if (this.activeFilters.size > 0) {
                filteredPosts = this.posts.filter(post => {
                    // Only show posts that have ALL selected tags
                    return Array.from(this.activeFilters).every(tag => post.tags.includes(tag));
                });
            }
            
            // Sort posts from latest to oldest
            filteredPosts.sort((a, b) => {
                return new Date(b.date) - new Date(a.date);
            });
            
            // Store filtered posts for pagination
            this.filteredPosts = filteredPosts;
            
            // Load initial batch
            this.loadMorePosts(true);
        };
        
        // Override loadMorePosts to use the correct element ID
        const originalLoadMorePosts = SocialEmbedViewer.prototype.loadMorePosts;
        SocialEmbedViewer.prototype.loadMorePosts = function(isInitialLoad = false) {
            if (this.isLoading || (this.allPostsLoaded && !isInitialLoad)) return;
            
            this.isLoading = true;
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) loadingIndicator.style.display = 'flex';
            
            const postsContainer = document.getElementById('postsContainer');
            if (!postsContainer) {
                console.error('Posts container not found in loadMorePosts!');
                return;
            }
            
            console.log('Loading more posts to postsContainer');
            
            // Call the original method but with fixed element references
            try {
                // Get the current batch of posts
                const startIndex = this.currentPage * this.pageSize;
                const endIndex = startIndex + this.pageSize;
                const currentBatch = this.filteredPosts.slice(startIndex, endIndex);
                
                // Process each post in the batch
                currentBatch.forEach(post => {
                    const postElement = this.renderPost(post);
                    if (postElement) {
                        postsContainer.appendChild(postElement);
                    }
                });
                
                // Update pagination state
                this.allPostsLoaded = endIndex >= this.filteredPosts.length;
                this.isLoading = false;
                
                // Hide loading indicator
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                // If no posts were loaded, show a message
                if (postsContainer.children.length === 0) {
                    const noPostsMessage = document.createElement('div');
                    noPostsMessage.className = 'no-posts-message';
                    noPostsMessage.textContent = this.activeFilters.size > 0 ? 
                        'No posts match the selected filters.' : 
                        'No posts yet. Add your first link above!';
                    postsContainer.appendChild(noPostsMessage);
                }
            } catch (error) {
                console.error('Error in loadMorePosts:', error);
                this.isLoading = false;
                if (loadingIndicator) loadingIndicator.style.display = 'none';
            }
        };
        
        console.log('Fixes applied successfully');
    }
});
