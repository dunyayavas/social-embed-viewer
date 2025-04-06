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
