// Import Supabase services
import { initSupabase } from './supabase.js';
import dbService from './db-service.js';

class SocialEmbedViewer {
    constructor() {
        this.posts = [];
        this.allTags = new Set();
        this.activeTags = new Set();
        this.db = null;
        this.postsPerPage = 10;
        this.currentPage = 0;
        this.isLoading = false;
        this.isInitialized = false;
        this.supabase = null;
        this.user = null;
        
        // Initialize the application
        this.init();
    }
    
    async init() {
        try {
            console.log('Initializing app...');
            
            // Initialize Supabase and check authentication
            await this.initAuth();
            
            // Initialize IndexedDB for offline fallback
            await this.initIndexedDB();
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Always load posts, even if not authenticated
            this.loadPosts();
            
            // Check for pending shared URL
            this.checkPendingSharedUrl();
            
            // Hide auth required message
            const authRequired = document.getElementById('authRequired');
            if (authRequired) {
                authRequired.style.display = 'none';
            }
            
            // Show app
            const app = document.getElementById('app');
            if (app) {
                app.style.display = 'block';
            }
            
            // Add sample posts if none exist
            if (this.posts.length === 0) {
                console.log('No posts found, adding samples...');
                this.addSamplePosts();
            }
            
            this.isInitialized = true;
            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
        }
    }
    
    async initAuth() {
        try {
            // Initialize database service
            await dbService.init();
            
            // Add listener for auth state changes
            dbService.addListener(event => {
                if (event.type === 'auth') {
                    this.handleAuthChange(event.user);
                }
            });
            
            // Get current user
            this.user = dbService.getCurrentUser();
            
            // Update UI based on auth state
            this.updateAuthUI();
        } catch (error) {
            console.error('Auth initialization error:', error);
        }
    }
    
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('socialEmbedViewer', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('posts')) {
                    db.createObjectStore('posts', { keyPath: 'id' });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            
            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    initializeEventListeners() {
        // Form submission
        document.getElementById('linkForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Logout button
        document.getElementById('logoutButton').addEventListener('click', () => this.handleLogout());
        
        // Add scroll event listener for infinite scrolling
        window.addEventListener('scroll', this.handleScroll.bind(this));
        
        // Add visibility change event to optimize for background tabs
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isAuthenticated()) {
                this.renderPosts(); // Refresh when tab becomes visible
            }
        });
        
        // Add import/export event listeners
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('importData').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
    }
    
    isAuthenticated() {
        return !!this.user;
    }
    
    updateAuthUI() {
        const appElement = document.getElementById('app');
        const authRequiredElement = document.getElementById('authRequired');
        const userEmailElement = document.getElementById('userEmail');
        const logoutButton = document.getElementById('logoutButton');
        
        if (this.isAuthenticated()) {
            // User is logged in
            if (appElement) appElement.style.display = 'block';
            if (authRequiredElement) authRequiredElement.style.display = 'none';
            if (userEmailElement) userEmailElement.textContent = this.user.email;
            if (logoutButton) logoutButton.style.display = 'inline-block';
        } else {
            // User is not logged in, but we'll still show the app
            if (appElement) appElement.style.display = 'block';
            if (authRequiredElement) authRequiredElement.style.display = 'none';
            if (userEmailElement) userEmailElement.textContent = 'Demo Mode';
            if (logoutButton) logoutButton.style.display = 'none';
        }
    }
    
    async handleAuthChange(user) {
        this.user = user;
        this.updateAuthUI();
        
        if (user) {
            // User logged in, load posts
            await this.loadPosts();
        } else {
            // User logged out, clear posts
            this.posts = [];
            this.renderPosts();
        }
    }
    
    async handleLogout() {
        try {
            await dbService.signOut();
            // Auth state change listener will handle UI updates
        } catch (error) {
            console.error('Logout error:', error);
            this.showFeedback('Error logging out. Please try again.', true);
        }
    }
    
    // Add sample posts for demo mode
    addSamplePosts() {
        const samplePosts = [
            {
                id: 'sample1',
                url: 'https://twitter.com/elonmusk/status/1507041396242407424',
                type: 'twitter',
                date: new Date().toISOString(),
                tags: ['twitter', 'news']
            },
            {
                id: 'sample2',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                type: 'youtube',
                date: new Date().toISOString(),
                tags: ['youtube', 'music']
            },
            {
                id: 'sample3',
                url: 'https://www.instagram.com/p/CdKI1-4OFdo/',
                type: 'instagram',
                date: new Date().toISOString(),
                tags: ['instagram', 'photo']
            },
            {
                id: 'sample4',
                url: 'https://linkedin.com/posts/williamhgates_my-annual-letter-the-age-of-ai-has-begun-activity-7046559153393680384-xDsW',
                type: 'linkedin',
                date: new Date().toISOString(),
                tags: ['linkedin', 'technology']
            }
        ];
        
        this.posts = samplePosts;
        console.log('Added sample posts:', this.posts.length);
    }
    
    checkPendingSharedUrl() {
        // Check if there's a pending shared URL from mobile
        const urlParams = new URLSearchParams(window.location.search);
        const isPendingShare = urlParams.get('share') === 'pending';
        
        if (isPendingShare && this.isAuthenticated()) {
            const pendingUrl = sessionStorage.getItem('pendingSharedUrl');
            if (pendingUrl) {
                // Pre-fill the link input
                document.getElementById('linkInput').value = pendingUrl;
                
                // Clear the pending URL
                sessionStorage.removeItem('pendingSharedUrl');
                
                // Focus on tag input to encourage tagging
                document.getElementById('tagInput').focus();
                
                // Show feedback
                this.showFeedback('Link received from sharing. Add tags if desired and submit.');
                
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }
    
    handleScroll() {
        if (this.isLoading) return;
        
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Load more posts when user scrolls near the bottom
        if (scrollY + windowHeight >= documentHeight - 300) {
            this.loadMorePosts();
        }
    }
    
    async loadMorePosts() {
        if (this.isLoading) return;
        
        this.currentPage++;
        this.renderPosts(true); // Append mode
    }
    
    async renderPosts(appendMode = false) {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            console.log('Rendering posts...');
            const postsContainer = document.getElementById('postsContainer');
            if (!postsContainer) {
                console.error('Posts container not found!');
                return;
            }
            
            // Clear container if not appending
            if (!appendMode) {
                postsContainer.innerHTML = '';
            }
            
            // Show loading indicator
            const loadingIndicator = document.getElementById('loadingIndicator');
            if (loadingIndicator) loadingIndicator.style.display = 'flex';
            
            // Get posts from database
            let posts = [];
            if (this.isAuthenticated()) {
                try {
                    // Try to get posts from Supabase
                    posts = await dbService.getPosts(this.currentPage, this.postsPerPage);
                    console.log('Loaded posts from Supabase:', posts.length);
                } catch (error) {
                    console.error('Error loading posts from Supabase:', error);
                    // Fallback to IndexedDB
                    posts = await this.getPostsFromIndexedDB();
                    console.log('Loaded posts from IndexedDB:', posts.length);
                }
            } else {
                // Not authenticated, use the posts we already have
                posts = this.posts;
                console.log('Using existing posts:', posts.length);
            }
            
            this.posts = appendMode ? [...this.posts, ...posts] : posts;
            
            // Filter posts if tags are active
            let filteredPosts = this.posts;
            if (this.activeTags.size > 0) {
                filteredPosts = this.posts.filter(post => {
                    // Only show posts that have ALL selected tags
                    return Array.from(this.activeTags).every(tag => post.tags.includes(tag));
                });
            }
            
            // Sort posts from latest to oldest
            filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Calculate pagination
            const startIndex = appendMode ? (this.currentPage - 1) * this.postsPerPage : 0;
            const endIndex = startIndex + this.postsPerPage;
            const postsToRender = filteredPosts.slice(startIndex, endIndex);
            
            // Render posts
            for (const post of postsToRender) {
                const postElement = this.createPostElement(post);
                postsContainer.appendChild(postElement);
            }
            
            // Update all tags
            this.updateAllTags();
            
            // Hide loading indicator
            document.getElementById('loadingIndicator').style.display = 'none';
            
            // Show message if no posts
            if (postsContainer.children.length === 0) {
                const noPostsMessage = document.createElement('div');
                noPostsMessage.className = 'no-posts-message';
                noPostsMessage.textContent = this.activeTags.size > 0 ? 
                    'No posts match the selected tags.' : 
                    'No posts yet. Add your first link above!';
                postsContainer.appendChild(noPostsMessage);
            }
        } catch (error) {
            console.error('Error rendering posts:', error);
        } finally {
            this.isLoading = false;
        }
    }
    
    async getPostsFromIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            
            const transaction = this.db.transaction(['posts'], 'readonly');
            const store = transaction.objectStore('posts');
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            
            request.onerror = () => {
                console.error('Error getting posts from IndexedDB');
                resolve([]);
            };
        });
    }
    
    createPostElement(post) {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        postElement.dataset.id = post.id;
        
        // Create post header
        const postHeader = document.createElement('div');
        postHeader.className = 'post-header';
        
        // Create post actions
        const postActions = document.createElement('div');
        postActions.className = 'post-actions';
        
        // Create delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '&times;';
        deleteButton.addEventListener('click', () => this.deletePost(post.id));
        
        postActions.appendChild(deleteButton);
        postHeader.appendChild(postActions);
        
        // Create post content
        const postContent = document.createElement('div');
        postContent.className = 'post-content';
        
        // Create embed container
        const embedContainer = document.createElement('div');
        embedContainer.className = 'embed-container';
        embedContainer.innerHTML = `<div class="loading-embed">Loading ${post.type} embed...</div>`;
        
        // Load embed
        this.loadEmbed(post, embedContainer);
        
        postContent.appendChild(embedContainer);
        
        // Create post tags
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'post-tags';
        
        // Add tags
        post.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.textContent = tag;
            tagElement.addEventListener('click', () => {
                // Toggle tag filter
                if (this.activeTags.has(tag)) {
                    this.activeTags.delete(tag);
                } else {
                    this.activeTags.add(tag);
                }
                this.renderPosts();
            });
            tagsContainer.appendChild(tagElement);
        });
        
        // Add tag input
        const addTagContainer = document.createElement('div');
        addTagContainer.className = 'add-tag-container';
        
        const addTagButton = document.createElement('button');
        addTagButton.className = 'add-tag-button';
        addTagButton.textContent = '+';
        addTagButton.addEventListener('click', () => {
            const tagInput = document.createElement('input');
            tagInput.className = 'tag-input';
            tagInput.placeholder = 'Add tag';
            
            addTagContainer.innerHTML = '';
            addTagContainer.appendChild(tagInput);
            
            tagInput.focus();
            
            // Handle tag input blur
            tagInput.addEventListener('blur', () => {
                const newTag = tagInput.value.trim();
                if (newTag && !post.tags.includes(newTag)) {
                    post.tags.push(newTag);
                    this.updatePost(post);
                }
                addTagContainer.innerHTML = '';
                addTagContainer.appendChild(addTagButton);
            });
            
            // Handle tag input enter
            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const newTag = tagInput.value.trim();
                    if (newTag && !post.tags.includes(newTag)) {
                        post.tags.push(newTag);
                        this.updatePost(post);
                    }
                    addTagContainer.innerHTML = '';
                    addTagContainer.appendChild(addTagButton);
                }
            });
        });
        
        addTagContainer.appendChild(addTagButton);
        tagsContainer.appendChild(addTagContainer);
        
        postContent.appendChild(tagsContainer);
        
        // Add post date
        const postDate = document.createElement('div');
        postDate.className = 'post-date';
        postDate.textContent = new Date(post.date).toLocaleDateString();
        
        postContent.appendChild(postDate);
        
        // Assemble post
        postElement.appendChild(postHeader);
        postElement.appendChild(postContent);
        
        return postElement;
    }
    
    async loadEmbed(post, container) {
        try {
            switch (post.type) {
                case 'twitter':
                    this.loadTwitterEmbed(post, container);
                    break;
                case 'instagram':
                    this.loadInstagramEmbed(post, container);
                    break;
                case 'youtube':
                    this.loadYoutubeEmbed(post, container);
                    break;
                case 'linkedin':
                    this.loadLinkedInEmbed(post, container);
                    break;
                default:
                    this.loadGenericEmbed(post, container);
            }
        } catch (error) {
            console.error('Error loading embed:', error);
            container.innerHTML = `<div class="embed-error">Error loading embed</div>`;
        }
    }
    
    loadTwitterEmbed(post, container) {
        container.innerHTML = `<blockquote class="twitter-tweet"><a href="${post.url}"></a></blockquote>`;
        if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load(container);
        }
    }
    
    loadInstagramEmbed(post, container) {
        const postId = post.url.split('/').slice(-2)[0];
        container.innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="${post.url}"></blockquote>`;
        if (window.instgrm && window.instgrm.Embeds) {
            window.instgrm.Embeds.process(container);
        }
    }
    
    loadYoutubeEmbed(post, container) {
        const videoId = this.getYoutubeId(post.url);
        if (videoId) {
            container.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else {
            container.innerHTML = `<div class="embed-error">Invalid YouTube URL</div>`;
        }
    }
    
    loadLinkedInEmbed(post, container) {
        // LinkedIn doesn't have a simple embed API, so we'll create a preview card
        container.innerHTML = `
            <div class="linkedin-preview">
                <div class="linkedin-preview-content">
                    <h3>LinkedIn Post</h3>
                    <p>LinkedIn doesn't support direct embeds. <a href="${post.url}" target="_blank" rel="noopener noreferrer">Open in LinkedIn</a></p>
                </div>
            </div>
        `;
    }
    
    loadGenericEmbed(post, container) {
        // For other URLs, create a link preview
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(post.url)}`;
        
        fetch(proxyUrl)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Extract metadata
                const title = doc.querySelector('meta[property="og:title"]')?.content || 
                              doc.querySelector('title')?.textContent || 
                              post.url;
                              
                const description = doc.querySelector('meta[property="og:description"]')?.content || 
                                   doc.querySelector('meta[name="description"]')?.content || 
                                   '';
                                   
                const image = doc.querySelector('meta[property="og:image"]')?.content || 
                             doc.querySelector('meta[property="twitter:image"]')?.content || 
                             '';
                
                // Create preview
                container.innerHTML = `
                    <div class="link-preview">
                        ${image ? `<div class="link-preview-image"><img src="${image}" alt="${title}"></div>` : ''}
                        <div class="link-preview-content">
                            <h3>${title}</h3>
                            <p>${description}</p>
                            <a href="${post.url}" target="_blank" rel="noopener noreferrer">${post.url}</a>
                        </div>
                    </div>
                `;
            })
            .catch(error => {
                console.error('Error fetching link preview:', error);
                container.innerHTML = `
                    <div class="link-preview">
                        <div class="link-preview-content">
                            <h3>${post.url}</h3>
                            <a href="${post.url}" target="_blank" rel="noopener noreferrer">Open link</a>
                        </div>
                    </div>
                `;
            });
    }
    
    getYoutubeId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    updateAllTags() {
        // Update all tags set
        this.allTags = new Set();
        this.posts.forEach(post => {
            post.tags.forEach(tag => this.allTags.add(tag));
        });
        
        // Render tag filters
        const tagFiltersContainer = document.getElementById('tagFilters');
        if (!tagFiltersContainer) return;
        
        tagFiltersContainer.innerHTML = '';
        
        // Sort tags alphabetically
        const sortedTags = Array.from(this.allTags).sort();
        
        sortedTags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = `tag-filter ${this.activeTags.has(tag) ? 'active' : ''}`;
            tagElement.textContent = tag;
            tagElement.addEventListener('click', () => {
                // Toggle tag filter
                if (this.activeTags.has(tag)) {
                    this.activeTags.delete(tag);
                } else {
                    this.activeTags.add(tag);
                }
                tagElement.classList.toggle('active');
                this.renderPosts();
            });
            tagFiltersContainer.appendChild(tagElement);
        });
    }
    
    getLinkType(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
                return 'twitter';
            } else if (hostname.includes('instagram.com')) {
                return 'instagram';
            } else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
                return 'youtube';
            } else if (hostname.includes('linkedin.com')) {
                return 'linkedin';
            } else {
                return 'website';
            }
        } catch (error) {
            console.error('Error parsing URL:', error);
            return 'website';
        }
    }
    
    async savePost(post) {
        try {
            if (this.isAuthenticated()) {
                // Save to Supabase
                await dbService.savePost(post);
            }
            
            // Also save to IndexedDB for offline access
            if (this.db) {
                const transaction = this.db.transaction(['posts'], 'readwrite');
                const store = transaction.objectStore('posts');
                await store.add(post);
            }
            
            // Update posts array
            this.posts.push(post);
            this.renderPosts();
        } catch (error) {
            console.error('Error saving post:', error);
            throw error;
        }
    }
    
    async updatePost(post) {
        try {
            if (this.isAuthenticated()) {
                // Update in Supabase
                await dbService.updatePost(post);
            }
            
            // Also update in IndexedDB
            if (this.db) {
                const transaction = this.db.transaction(['posts'], 'readwrite');
                const store = transaction.objectStore('posts');
                await store.put(post);
            }
            
            // Update posts array
            const index = this.posts.findIndex(p => p.id === post.id);
            if (index !== -1) {
                this.posts[index] = post;
            }
            
            this.renderPosts();
        } catch (error) {
            console.error('Error updating post:', error);
            throw error;
        }
    }
    
    async deletePost(id) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        try {
            if (this.isAuthenticated()) {
                // Delete from Supabase
                await dbService.deletePost(id);
            }
            
            // Also delete from IndexedDB
            if (this.db) {
                const transaction = this.db.transaction(['posts'], 'readwrite');
                const store = transaction.objectStore('posts');
                await store.delete(id);
            }
            
            // Update posts array
            this.posts = this.posts.filter(post => post.id !== id);
            this.renderPosts();
            
            this.showFeedback('Post deleted successfully');
        } catch (error) {
            console.error('Error deleting post:', error);
            this.showFeedback('Error deleting post', true);
        }
    }
    
    showLoadingIndicator() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
    }
    
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
    
    showFeedback(message, isError = false) {
        const feedback = document.createElement('div');
        feedback.className = `feedback ${isError ? 'error' : 'success'}`;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(feedback);
            }, 500);
        }, 3000);
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        // Allow adding links even if not authenticated
        // if (!this.isAuthenticated()) {
        //     this.showFeedback('Please log in to add links.', true);
        //     return;
        // }
        
        const linkInput = document.getElementById('linkInput');
        const tagInput = document.getElementById('tagInput');
        const url = linkInput.value.trim();
        const tags = tagInput.value ? tagInput.value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        if (!url) return;
        
        try {
            // Show loading indicator
            this.showLoadingIndicator();
            
            // Create post object
            const post = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                url,
                type: this.getLinkType(url),
                date: new Date().toISOString(),
                tags
            };
            
            // Save post to database
            await this.savePost(post);
            
            // Clear inputs
            linkInput.value = '';
            tagInput.value = '';
            
            // Show feedback
            this.showFeedback('Link added successfully!');
        } catch (error) {
            console.error('Error adding link:', error);
            this.showFeedback('Error adding link. Please try again.', true);
        } finally {
            this.hideLoadingIndicator();
        }
    }
    
    // More methods will be added in subsequent files
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SocialEmbedViewer();
});
