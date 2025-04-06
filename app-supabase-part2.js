// Part 2 of the SocialEmbedViewer class - Database operations

// These methods should be added to the SocialEmbedViewer class in app-supabase.js

async loadPosts() {
    if (!this.isAuthenticated()) return;
    
    try {
        this.showLoadingIndicator();
        this.isLoading = true;
        
        // Try to load posts from Supabase first
        try {
            const posts = await dbService.getPosts();
            this.posts = posts;
            
            // Update local IndexedDB with cloud data for offline use
            await this.syncToLocalDB(posts);
        } catch (error) {
            console.error('Error loading from Supabase, falling back to local storage:', error);
            
            // Fall back to local storage
            await this.loadFromLocalStorage();
        }
        
        // Update all tags set
        this.updateAllTags();
        
        // Render posts and tags
        this.renderPosts();
        this.renderAllTags();
    } catch (error) {
        console.error('Error loading posts:', error);
        this.showFeedback('Error loading posts. Please try again.', true);
    } finally {
        this.hideLoadingIndicator();
        this.isLoading = false;
    }
}

async syncToLocalDB(posts) {
    if (!this.db) return;
    
    try {
        const transaction = this.db.transaction(['posts'], 'readwrite');
        const store = transaction.objectStore('posts');
        
        // Clear existing data
        await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = resolve;
            clearRequest.onerror = reject;
        });
        
        // Add all posts to IndexedDB
        for (const post of posts) {
            await new Promise((resolve, reject) => {
                const addRequest = store.add(post);
                addRequest.onsuccess = resolve;
                addRequest.onerror = reject;
            });
        }
    } catch (error) {
        console.error('Error syncing to local DB:', error);
    }
}

async loadFromLocalStorage() {
    // Try to load from IndexedDB first
    if (this.db) {
        try {
            const transaction = this.db.transaction(['posts'], 'readonly');
            const store = transaction.objectStore('posts');
            const request = store.getAll();
            
            this.posts = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            return;
        } catch (error) {
            console.error('Error loading from IndexedDB:', error);
        }
    }
    
    // Fall back to localStorage if IndexedDB fails
    try {
        const storedPosts = localStorage.getItem('posts');
        if (storedPosts) {
            this.posts = JSON.parse(storedPosts);
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        this.posts = [];
    }
}

async savePost(post, refresh = true) {
    if (!this.isAuthenticated()) {
        throw new Error('User not authenticated');
    }
    
    try {
        // First try to save to Supabase
        await dbService.savePost(post);
        
        // Update local array if not refreshing
        if (!refresh) {
            this.posts.push(post);
        } else {
            // Reload all posts to ensure consistency
            await this.loadPosts();
        }
    } catch (error) {
        console.error('Error saving to Supabase, falling back to local storage:', error);
        
        // Fall back to local storage
        await this.saveLocalPost(post, refresh);
    }
}

async saveLocalPost(post, refresh = true) {
    try {
        if (this.db) {
            const transaction = this.db.transaction(['posts'], 'readwrite');
            const store = transaction.objectStore('posts');
            
            await new Promise((resolve, reject) => {
                const request = store.add(post);
                request.onsuccess = resolve;
                request.onerror = reject;
            });
            
            if (!refresh) {
                this.posts.push(post);
            } else {
                await this.loadFromLocalStorage();
            }
        } else {
            // Fall back to localStorage
            this.posts.push(post);
            localStorage.setItem('posts', JSON.stringify(this.posts));
            
            if (refresh) {
                await this.loadFromLocalStorage();
            }
        }
    } catch (error) {
        console.error('Error saving to local storage:', error);
        throw error;
    }
}

async deletePost(postId) {
    if (!this.isAuthenticated()) {
        throw new Error('User not authenticated');
    }
    
    try {
        // First try to delete from Supabase
        await dbService.deletePost(postId);
        
        // Update local array
        this.posts = this.posts.filter(post => post.id !== postId);
        
        // Update all tags
        this.updateAllTags();
        
        // Render posts and tags
        this.renderPosts();
        this.renderAllTags();
    } catch (error) {
        console.error('Error deleting from Supabase, falling back to local storage:', error);
        
        // Fall back to local storage
        await this.deleteLocalPost(postId);
    }
}

async deleteLocalPost(postId) {
    try {
        if (this.db) {
            const transaction = this.db.transaction(['posts'], 'readwrite');
            const store = transaction.objectStore('posts');
            
            await new Promise((resolve, reject) => {
                const request = store.delete(postId);
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }
        
        // Update local array
        this.posts = this.posts.filter(post => post.id !== postId);
        localStorage.setItem('posts', JSON.stringify(this.posts));
        
        // Update all tags
        this.updateAllTags();
        
        // Render posts and tags
        this.renderPosts();
        this.renderAllTags();
    } catch (error) {
        console.error('Error deleting from local storage:', error);
        throw error;
    }
}

async updatePostTags(postId, tags) {
    if (!this.isAuthenticated()) {
        throw new Error('User not authenticated');
    }
    
    try {
        // First try to update in Supabase
        await dbService.updatePostTags(postId, tags);
        
        // Update local array
        const postIndex = this.posts.findIndex(post => post.id === postId);
        if (postIndex !== -1) {
            this.posts[postIndex].tags = tags;
        }
        
        // Update all tags
        this.updateAllTags();
        
        // Render tags
        this.renderAllTags();
    } catch (error) {
        console.error('Error updating tags in Supabase, falling back to local storage:', error);
        
        // Fall back to local storage
        await this.updateLocalPostTags(postId, tags);
    }
}

async updateLocalPostTags(postId, tags) {
    try {
        // Update in IndexedDB if available
        if (this.db) {
            const transaction = this.db.transaction(['posts'], 'readwrite');
            const store = transaction.objectStore('posts');
            
            const getRequest = store.get(postId);
            await new Promise((resolve, reject) => {
                getRequest.onsuccess = () => {
                    const post = getRequest.result;
                    if (post) {
                        post.tags = tags;
                        const updateRequest = store.put(post);
                        updateRequest.onsuccess = resolve;
                        updateRequest.onerror = reject;
                    } else {
                        reject(new Error('Post not found'));
                    }
                };
                getRequest.onerror = reject;
            });
        }
        
        // Update local array
        const postIndex = this.posts.findIndex(post => post.id === postId);
        if (postIndex !== -1) {
            this.posts[postIndex].tags = tags;
            localStorage.setItem('posts', JSON.stringify(this.posts));
        }
        
        // Update all tags
        this.updateAllTags();
        
        // Render tags
        this.renderAllTags();
    } catch (error) {
        console.error('Error updating tags in local storage:', error);
        throw error;
    }
}

updateAllTags() {
    this.allTags = new Set();
    for (const post of this.posts) {
        if (post.tags && Array.isArray(post.tags)) {
            for (const tag of post.tags) {
                this.allTags.add(tag);
            }
        }
    }
}
