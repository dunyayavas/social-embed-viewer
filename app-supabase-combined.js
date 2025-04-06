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
            // Initialize Supabase and check authentication
            await this.initAuth();
            
            // Initialize IndexedDB for offline fallback
            await this.initIndexedDB();
            
            // Initialize event listeners
            this.initializeEventListeners();
            
            // Load posts from database
            if (this.isAuthenticated()) {
                this.loadPosts();
            }
            
            // Check for pending shared URL
            this.checkPendingSharedUrl();
            
            this.isInitialized = true;
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
        
        if (this.isAuthenticated()) {
            // User is logged in
            appElement.style.display = 'block';
            authRequiredElement.style.display = 'none';
            
            // Display user email
            userEmailElement.textContent = this.user.email;
        } else {
            // User is not logged in
            appElement.style.display = 'none';
            authRequiredElement.style.display = 'flex';
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
    
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.isAuthenticated()) {
            this.showFeedback('Please log in to add links.', true);
            return;
        }
        
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
renderPosts(append = false) {
    const postsContainer = document.getElementById('postsContainer');
    
    if (!append) {
        postsContainer.innerHTML = '';
    }
    
    // Filter posts by active tags
    let filteredPosts = this.posts;
    if (this.activeTags.size > 0) {
        filteredPosts = this.posts.filter(post => {
            if (!post.tags || !Array.isArray(post.tags)) return false;
            return Array.from(this.activeTags).every(tag => post.tags.includes(tag));
        });
    }
    
    // Sort posts by date (newest first)
    filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Apply pagination
    const start = append ? this.currentPage * this.postsPerPage : 0;
    const end = start + this.postsPerPage;
    const paginatedPosts = filteredPosts.slice(start, end);
    
    // Create post elements
    for (const post of paginatedPosts) {
        const postElement = this.createPostElement(post);
        postsContainer.appendChild(postElement);
    }
    
    // Show message if no posts
    if (filteredPosts.length === 0 && !append) {
        const noPostsMessage = document.createElement('div');
        noPostsMessage.className = 'no-posts-message';
        noPostsMessage.textContent = this.activeTags.size > 0 
            ? 'No posts found with the selected tags. Try removing some filters.'
            : 'No posts yet. Add your first link above!';
        postsContainer.appendChild(noPostsMessage);
    }
    
    // Hide loading indicator if all posts have been loaded
    if (end >= filteredPosts.length) {
        this.hideLoadingIndicator();
    }
}

createPostElement(post) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = post.id;
    
    // Add delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = '&times;';
    deleteButton.addEventListener('click', () => this.handleDeletePost(post.id));
    card.appendChild(deleteButton);
    
    // Create embed based on post type
    this.createEmbed(post, card);
    
    // Add tags
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'card-tags';
    
    const tagsWrapper = document.createElement('div');
    tagsWrapper.className = 'tags-container';
    
    if (post.tags && Array.isArray(post.tags)) {
        for (const tag of post.tags) {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.innerHTML = `
                ${tag}
                <button class="tag-delete" data-tag="${tag}">&times;</button>
            `;
            
            // Add event listener to delete tag
            tagSpan.querySelector('.tag-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleRemoveTag(post.id, tag);
            });
            
            tagsWrapper.appendChild(tagSpan);
        }
    }
    
    // Add tag input button
    const addTagButton = document.createElement('button');
    addTagButton.className = 'add-tag-button';
    addTagButton.textContent = '+';
    addTagButton.addEventListener('click', () => this.showTagInput(post.id, tagsContainer));
    
    tagsContainer.appendChild(tagsWrapper);
    tagsContainer.appendChild(addTagButton);
    card.appendChild(tagsContainer);
    
    return card;
}

renderAllTags() {
    const tagFilters = document.getElementById('tagFilters');
    tagFilters.innerHTML = '';
    
    if (this.allTags.size === 0) {
        tagFilters.style.display = 'none';
        return;
    }
    
    tagFilters.style.display = 'flex';
    
    // Add "All" filter
    const allFilter = document.createElement('button');
    allFilter.className = `tag-filter ${this.activeTags.size === 0 ? 'active' : ''}`;
    allFilter.textContent = 'All';
    allFilter.addEventListener('click', () => {
        this.activeTags.clear();
        this.currentPage = 0;
        this.renderAllTags();
        this.renderPosts();
    });
    tagFilters.appendChild(allFilter);
    
    // Add tag filters
    for (const tag of Array.from(this.allTags).sort()) {
        const tagFilter = document.createElement('button');
        tagFilter.className = `tag-filter ${this.activeTags.has(tag) ? 'active' : ''}`;
        tagFilter.textContent = tag;
        tagFilter.addEventListener('click', () => {
            if (this.activeTags.has(tag)) {
                this.activeTags.delete(tag);
            } else {
                this.activeTags.add(tag);
            }
            this.currentPage = 0;
            this.renderAllTags();
            this.renderPosts();
        });
        tagFilters.appendChild(tagFilter);
    }
}

getLinkType(url) {
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        
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

async createEmbed(post, container) {
    const embedContainer = document.createElement('div');
    embedContainer.className = 'embed-container';
    
    switch (post.type) {
        case 'twitter':
            this.createTwitterEmbed(post, embedContainer);
            break;
        case 'instagram':
            this.createInstagramEmbed(post, embedContainer);
            break;
        case 'youtube':
            this.createYouTubeEmbed(post, embedContainer);
            break;
        case 'linkedin':
            this.createLinkedInEmbed(post, embedContainer);
            break;
        case 'website':
        default:
            await this.createWebsiteEmbed(post, embedContainer);
            break;
    }
    
    container.appendChild(embedContainer);
}

createTwitterEmbed(post, container) {
    // Create a placeholder while the tweet loads
    container.innerHTML = `
        <div class="placeholder-text">
            <div class="spinner"></div>
            <p>Loading tweet...</p>
        </div>
    `;
    
    // Create Twitter embed
    twttr.widgets.createTweet(
        this.getTwitterId(post.url),
        container,
        {
            theme: 'light',
            dnt: true,
            cards: 'hidden'
        }
    ).then(() => {
        // Remove placeholder once loaded
        const placeholder = container.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.remove();
        }
    }).catch(error => {
        console.error('Error creating Twitter embed:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load tweet. The tweet may have been deleted or is private.</p>
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">View on Twitter</a>
            </div>
        `;
    });
}

getTwitterId(url) {
    try {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/');
        // The last part of the path for a tweet URL is the tweet ID
        return pathParts[pathParts.length - 1];
    } catch (error) {
        console.error('Error parsing Twitter URL:', error);
        return '';
    }
}

createInstagramEmbed(post, container) {
    // Create a placeholder while the post loads
    container.innerHTML = `
        <div class="placeholder-text">
            <div class="spinner"></div>
            <p>Loading Instagram post...</p>
        </div>
    `;
    
    // Create Instagram embed
    // First, create the blockquote element that Instagram's embed script expects
    const blockquote = document.createElement('blockquote');
    blockquote.className = 'instagram-media';
    blockquote.setAttribute('data-instgrm-captioned', '');
    blockquote.setAttribute('data-instgrm-permalink', post.url);
    container.appendChild(blockquote);
    
    // Process the embed
    if (window.instgrm) {
        window.instgrm.Embeds.process();
    } else {
        // If the Instagram embed script hasn't loaded yet, show an error
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load Instagram post. Please try refreshing the page.</p>
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">View on Instagram</a>
            </div>
        `;
    }
}

createYouTubeEmbed(post, container) {
    const videoId = this.getYouTubeId(post.url);
    
    if (!videoId) {
        container.innerHTML = `
            <div class="error-message">
                <p>Invalid YouTube URL.</p>
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">View on YouTube</a>
            </div>
        `;
        return;
    }
    
    // Create YouTube embed iframe
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.width = '100%';
    iframe.height = '315';
    iframe.frameBorder = '0';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    
    container.appendChild(iframe);
}

getYouTubeId(url) {
    try {
        const parsedUrl = new URL(url);
        
        // Handle youtu.be URLs
        if (parsedUrl.hostname === 'youtu.be') {
            return parsedUrl.pathname.substring(1);
        }
        
        // Handle youtube.com URLs
        if (parsedUrl.hostname.includes('youtube.com')) {
            const params = new URLSearchParams(parsedUrl.search);
            return params.get('v');
        }
        
        return null;
    } catch (error) {
        console.error('Error parsing YouTube URL:', error);
        return null;
    }
}

async createLinkedInEmbed(post, container) {
    // LinkedIn doesn't provide a simple embed API like Twitter or Instagram
    // We'll use a proxy to fetch the Open Graph metadata
    container.innerHTML = `
        <div class="website-preview loading">
            <div class="meta-image-container">
                <div class="placeholder-text">Loading LinkedIn post...</div>
            </div>
            <div class="meta-content">
                <h3 class="meta-title">Loading...</h3>
                <p class="meta-description">Fetching LinkedIn content...</p>
            </div>
        </div>
    `;
    
    try {
        // Use a CORS proxy to fetch the LinkedIn page
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(post.url)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch LinkedIn post');
        
        const html = await response.text();
        
        // Extract Open Graph metadata
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const title = doc.querySelector('meta[property="og:title"]')?.content || 'LinkedIn Post';
        const description = doc.querySelector('meta[property="og:description"]')?.content || '';
        const imageUrl = doc.querySelector('meta[property="og:image"]')?.content || '';
        
        // Update post object with metadata for future reference
        post.title = title;
        post.description = description;
        post.thumbnail = imageUrl;
        
        // Create the preview
        container.innerHTML = `
            <div class="website-preview">
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                    <div class="meta-image-container">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="website-thumbnail">` : 
                        `<img src="https://www.linkedin.com/favicon.ico" alt="LinkedIn" class="website-thumbnail favicon-fallback">`}
                        <div class="placeholder-text">LinkedIn Post</div>
                    </div>
                    <div class="meta-content">
                        <h3 class="meta-title">${title}</h3>
                        <p class="meta-description">${description}</p>
                    </div>
                </a>
            </div>
        `;
    } catch (error) {
        console.error('Error creating LinkedIn embed:', error);
        container.innerHTML = `
            <div class="website-preview">
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                    <div class="meta-image-container">
                        <img src="https://www.linkedin.com/favicon.ico" alt="LinkedIn" class="website-thumbnail favicon-fallback">
                        <div class="placeholder-text">LinkedIn Post</div>
                    </div>
                    <div class="meta-content">
                        <h3 class="meta-title">LinkedIn Post</h3>
                        <p class="meta-description">Click to view on LinkedIn</p>
                    </div>
                </a>
            </div>
        `;
    }
}

async createWebsiteEmbed(post, container) {
    // Create a placeholder while loading
    container.innerHTML = `
        <div class="website-preview loading">
            <div class="meta-image-container">
                <div class="placeholder-text">Loading website preview...</div>
            </div>
            <div class="meta-content">
                <h3 class="meta-title">Loading...</h3>
                <p class="meta-description">Fetching website content...</p>
            </div>
        </div>
    `;
    
    try {
        // Check if we already have metadata for this post
        if (post.title && post.thumbnail) {
            renderSavedMetadata();
            return;
        }
        
        // Use a CORS proxy to fetch the website
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(post.url)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Failed to fetch website');
        
        const html = await response.text();
        
        // Extract Open Graph metadata
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const title = doc.querySelector('meta[property="og:title"]')?.content || 
                     doc.querySelector('title')?.textContent || 
                     new URL(post.url).hostname;
                     
        const description = doc.querySelector('meta[property="og:description"]')?.content || 
                           doc.querySelector('meta[name="description"]')?.content || 
                           '';
                           
        const imageUrl = doc.querySelector('meta[property="og:image"]')?.content || '';
        
        // Get favicon
        const faviconUrl = doc.querySelector('link[rel="icon"]')?.href || 
                          doc.querySelector('link[rel="shortcut icon"]')?.href || 
                          `${new URL(post.url).origin}/favicon.ico`;
        
        // Update post object with metadata for future reference
        post.title = title;
        post.description = description;
        post.thumbnail = imageUrl;
        post.favicon = faviconUrl;
        
        // Save the updated post to database
        await this.updatePostMetadata(post);
        
        renderSavedMetadata();
    } catch (error) {
        console.error('Error creating website embed:', error);
        renderFallbackPreview();
    }
    
    function renderSavedMetadata() {
        container.innerHTML = `
            <div class="website-preview">
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                    <div class="meta-image-container">
                        ${post.thumbnail ? `<img src="${post.thumbnail}" alt="${post.title}" class="website-thumbnail">` : 
                        `<img src="${post.favicon || getFaviconFromUrl(post.url)}" alt="${post.title}" class="website-thumbnail favicon-fallback">`}
                        <div class="placeholder-text">${new URL(post.url).hostname}</div>
                    </div>
                    <div class="meta-content">
                        <h3 class="meta-title">${post.title || new URL(post.url).hostname}</h3>
                        <p class="meta-description">${post.description || 'No description available'}</p>
                    </div>
                </a>
            </div>
        `;
    }
    
    function renderFallbackPreview() {
        const hostname = new URL(post.url).hostname;
        container.innerHTML = `
            <div class="website-preview">
                <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                    <div class="meta-image-container">
                        <img src="${getFaviconFromUrl(post.url)}" alt="${hostname}" class="website-thumbnail favicon-fallback">
                        <div class="placeholder-text">${hostname}</div>
                    </div>
                    <div class="meta-content">
                        <h3 class="meta-title">${hostname}</h3>
                        <p class="meta-description">${post.url}</p>
                    </div>
                </a>
            </div>
        `;
    }
    
    function getFaviconFromUrl(url) {
        try {
            const { origin } = new URL(url);
            return `${origin}/favicon.ico`;
        } catch (error) {
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23f0f0f0"/><text x="50%" y="50%" font-family="Arial" font-size="50" text-anchor="middle" dominant-baseline="middle" fill="%23999">?</text></svg>';
        }
    }
}

async updatePostMetadata(post) {
    // This is a simplified version - in the full implementation, we would update the post in Supabase
    try {
        if (this.db) {
            const transaction = this.db.transaction(['posts'], 'readwrite');
            const store = transaction.objectStore('posts');
            
            await new Promise((resolve, reject) => {
                const request = store.put(post);
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        }
        
        // Update localStorage as well
        localStorage.setItem('posts', JSON.stringify(this.posts));
    } catch (error) {
        console.error('Error updating post metadata:', error);
    }
}
async handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        const card = document.querySelector(`.card[data-id="${postId}"]`);
        if (card) {
            // Add removing animation
            card.classList.add('removing');
            
            // Wait for animation to complete
            setTimeout(async () => {
                await this.deletePost(postId);
            }, 300);
        } else {
            await this.deletePost(postId);
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        this.showFeedback('Error deleting post. Please try again.', true);
    }
}

async handleRemoveTag(postId, tagToRemove) {
    try {
        // Find the post
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        
        // Remove the tag
        const updatedTags = post.tags.filter(tag => tag !== tagToRemove);
        
        // Update the post
        await this.updatePostTags(postId, updatedTags);
        
        // Update UI
        const tagElement = document.querySelector(`.card[data-id="${postId}"] .tag:has(button[data-tag="${tagToRemove}"])`);
        if (tagElement) {
            tagElement.remove();
        }
    } catch (error) {
        console.error('Error removing tag:', error);
        this.showFeedback('Error removing tag. Please try again.', true);
    }
}

showTagInput(postId, tagsContainer) {
    // Check if there's already an active tag input
    const existingInput = document.querySelector('.inline-tag-input.active');
    if (existingInput) {
        existingInput.classList.remove('active');
    }
    
    // Create tag input container if it doesn't exist
    let tagManageContainer = tagsContainer.querySelector('.tag-input-container');
    if (!tagManageContainer) {
        tagManageContainer = document.createElement('div');
        tagManageContainer.className = 'tag-input-container';
        tagsContainer.querySelector('.tags-container').appendChild(tagManageContainer);
    }
    
    // Create or show tag input
    let tagInput = tagManageContainer.querySelector('.inline-tag-input');
    if (!tagInput) {
        tagInput = document.createElement('input');
        tagInput.className = 'inline-tag-input';
        tagInput.placeholder = 'Add tag';
        tagInput.maxLength = 20;
        
        // Handle tag input events
        tagInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const newTag = tagInput.value.trim();
                if (newTag) {
                    // Create new tag element
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'tag';
                    tagSpan.innerHTML = `
                        ${newTag}
                        <button class="tag-delete" data-tag="${newTag}">&times;</button>
                    `;
                    
                    // Add event listener to delete tag
                    tagSpan.querySelector('.tag-delete').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handleRemoveTag(postId, newTag);
                    });
                    
                    // Find the post
                    const post = this.posts.find(p => p.id === postId);
                    if (!post) return;
                    
                    // Add to UI immediately
                    const tagsContainer = tagManageContainer.parentElement;
                    tagsContainer.insertBefore(tagSpan, tagManageContainer);
                    
                    // Update post
                    post.tags.push(newTag);
                    
                    // Update storage
                    await this.updatePostTags(postId, post.tags);
                    
                    // Clear input
                    tagInput.value = '';
                    
                    // Update all tags and filters
                    this.updateAllTags();
                    this.renderAllTags();
                }
            } else if (e.key === 'Escape') {
                tagInput.classList.remove('active');
                tagInput.value = '';
            }
        });
        
        // Handle click outside to close
        const clickHandler = (e) => {
            if (!tagInput.contains(e.target) && !tagsContainer.querySelector('.add-tag-button').contains(e.target)) {
                tagInput.classList.remove('active');
                tagInput.value = '';
            }
        };
        document.addEventListener('click', clickHandler);
        
        tagManageContainer.appendChild(tagInput);
    }
    
    // Show and focus the input
    tagInput.classList.add('active');
    tagInput.focus();
}

showLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
}

hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    this.isLoading = false;
}

async exportData() {
    try {
        // Prepare data for export
        const exportData = {
            posts: this.posts,
            version: '1.0',
            exported_at: new Date().toISOString()
        };
        
        // Convert to JSON string
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // Create blob and download link
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link and trigger click
        const a = document.createElement('a');
        a.href = url;
        a.download = `social-embed-viewer-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        
        // Show feedback
        this.showFeedback('Data exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        this.showFeedback('Error exporting data. Please try again.', true);
    }
}

async importData(e) {
    if (!this.isAuthenticated()) {
        this.showFeedback('Please log in to import data.', true);
        return;
    }
    
    try {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                // Parse the JSON data
                const importData = JSON.parse(event.target.result);
                
                // Validate data
                if (!importData.posts || !Array.isArray(importData.posts)) {
                    throw new Error('Invalid import data format');
                }
                
                // Confirm import
                if (confirm(`Import ${importData.posts.length} posts? This will merge with your existing collection.`)) {
                    // Show loading indicator
                    this.showLoadingIndicator();
                    
                    // Process each post
                    const newPosts = [];
                    let duplicates = 0;
                    
                    // Check for duplicates based on URL
                    for (const post of importData.posts) {
                        const exists = this.posts.some(p => p.url === post.url);
                        if (!exists) {
                            // Ensure post has a valid ID and date
                            if (!post.id) post.id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
                            if (!post.date) post.date = new Date().toISOString();
                            
                            newPosts.push(post);
                        } else {
                            duplicates++;
                        }
                    }
                    
                    // Add new posts to database
                    for (const post of newPosts) {
                        await this.savePost(post, false); // Don't refresh after each save
                    }
                    
                    // Now refresh the view
                    await this.loadPosts();
                    
                    // Show feedback
                    this.showFeedback(`Imported ${newPosts.length} posts. Skipped ${duplicates} duplicates.`);
                }
            } catch (err) {
                console.error('Import parsing error:', err);
                this.showFeedback('Error parsing import file. Please check the file format.', true);
            } finally {
                // Reset file input
                e.target.value = '';
                this.hideLoadingIndicator();
            }
        };
        
        reader.readAsText(file);
    } catch (error) {
        console.error('Import error:', error);
        this.showFeedback('Error importing data. Please try again.', true);
        // Reset file input
        e.target.value = '';
        this.hideLoadingIndicator();
    }
}

showFeedback(message, isError = false) {
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `feedback-message ${isError ? 'error' : 'success'}`;
    feedback.textContent = message;
    
    // Add to DOM
    document.body.appendChild(feedback);
    
    // Auto-remove after delay
    setTimeout(() => {
        feedback.classList.add('fade-out');
        setTimeout(() => {
            if (feedback.parentNode) {
                document.body.removeChild(feedback);
            }
        }, 500);
    }, 3000);
}
