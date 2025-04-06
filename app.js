class SocialEmbedViewer {
    constructor() {
        this.db = null;
        this.posts = [];
        this.activeFilters = new Set();
        this.pageSize = 20; // Number of posts to load at once
        this.currentPage = 0;
        this.allPostsLoaded = false;
        this.isLoading = false;
        this.initializeDB();
        this.initializeEventListeners();
    }

    async initializeDB() {
        try {
            // Initialize IndexedDB
            const request = indexedDB.open('socialEmbedDB', 1);

            request.onerror = (event) => {
                // Fallback to localStorage if IndexedDB fails
                this.db = null;
                this.loadFromLocalStorage();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('posts')) {
                    db.createObjectStore('posts', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.loadPosts();
            };
        } catch (error) {
            this.db = null;
            this.loadFromLocalStorage();
        }
    }

    initializeEventListeners() {
        document.getElementById('linkForm').addEventListener('submit', (e) => this.handleSubmit(e));
        this.renderAllTags();
        
        // Add scroll event listener for infinite scrolling
        window.addEventListener('scroll', this.handleScroll.bind(this));
        
        // Add visibility change event to optimize for background tabs
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.renderPosts(); // Refresh when tab becomes visible
            }
        });
        
        // Add import/export event listeners
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('importData').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
    }
    
    handleScroll() {
        // Don't trigger if already loading or all posts are loaded
        if (this.isLoading || this.allPostsLoaded) return;
        
        const scrollY = window.scrollY;
        const visibleHeight = window.innerHeight;
        const pageHeight = document.documentElement.scrollHeight;
        const bottomOfPage = scrollY + visibleHeight >= pageHeight - 300;
        
        if (bottomOfPage) {
            this.loadMorePosts();
        }
    }

    async loadPosts() {

        try {
            if (this.db) {
                const transaction = this.db.transaction(['posts'], 'readonly');
                const store = transaction.objectStore('posts');
                const request = store.getAll();

                request.onsuccess = () => {
                    this.posts = request.result || [];
                    this.renderPosts();
                    this.renderAllTags();
                };

                request.onerror = () => {
                    this.loadFromLocalStorage();
                };
            } else {
                this.loadFromLocalStorage();
            }
        } catch (error) {
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        this.posts = JSON.parse(localStorage.getItem('posts') || '[]');
        this.renderPosts();
        this.renderAllTags();
    }

    async savePost(post) {
        try {
            if (this.db) {
                const transaction = this.db.transaction(['posts'], 'readwrite');
                const store = transaction.objectStore('posts');
                const request = store.add(post);
                
                request.onsuccess = () => {
                    this.loadPosts();
                };
                
                request.onerror = () => {
                    // Fallback to localStorage
                    this.posts.push(post);
                    localStorage.setItem('posts', JSON.stringify(this.posts));
                    this.loadPosts();
                };
            } else {
                this.posts.push(post);
                localStorage.setItem('posts', JSON.stringify(this.posts));
                this.loadPosts();
            }
        } catch (error) {
            throw error;
        }
    }

    async deletePost(id) {
        try {
            // Remove card from UI immediately
            const card = document.querySelector(`[data-post-id="${id}"]`);
            if (card) {
                card.classList.add('removing');
                // Use animation to fade out
                setTimeout(() => {
                    card.remove();
                }, 300); // Match this with CSS animation duration
            }
            
            // Update local array
            this.posts = this.posts.filter(p => p.id !== id);
            
            // Update tags UI
            this.renderAllTags();
            
            // Update storage in background
            if (this.db) {
                const transaction = this.db.transaction(['posts'], 'readwrite');
                const store = transaction.objectStore('posts');
                const request = store.delete(id);
                
                request.onsuccess = () => {
                    // Database updated successfully
                };
            } else {
                localStorage.setItem('posts', JSON.stringify(this.posts));
            }
        } catch (error) {
            // Continue even if there's an error with database operation
            // UI is already updated
        }
    }

    async updatePost(post) {
        try {

            // Update local array
            const index = this.posts.findIndex(p => p.id === post.id);

            if (index !== -1) {
                // Update local data
                this.posts[index] = post;
                
                // Update filter tags 
                this.renderAllTags();
                
                // Update storage in background
                if (this.db) {
                    const transaction = this.db.transaction(['posts'], 'readwrite');
                    const store = transaction.objectStore('posts');
                    const request = store.put(post);
                    request.onsuccess = () => {
    
                    };
                } else {
                    localStorage.setItem('posts', JSON.stringify(this.posts));
                }
            }
        } catch (error) {
            // Continue even if there's an error with database operation
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const linkInput = document.getElementById('linkInput');
        const tagInput = document.getElementById('tagInput');
        const url = linkInput.value.trim();
        const tagsText = tagInput.value.trim();

        if (!url) return;

        // Process tags - split by comma and trim whitespace
        const tags = tagsText ? tagsText.split(',').map(tag => tag.trim()).filter(tag => tag !== '') : [];
        
        const post = {
            id: Date.now().toString(),
            url,
            type: this.getLinkType(url),
            tags: tags,
            date: new Date().toISOString()
        };

        try {
            await this.savePost(post);
            linkInput.value = '';
            tagInput.value = '';
            
            // Show feedback
            const feedback = document.createElement('div');
            feedback.className = 'submit-feedback';
            feedback.textContent = `Link added${tags.length > 0 ? ' with ' + tags.length + ' tag(s)' : ''}`;
            
            const form = document.getElementById('linkForm');
            form.appendChild(feedback);
            
            // Remove feedback after 3 seconds
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.remove();
                }
            }, 3000);
        } catch (error) {
            console.error('Error adding link:', error);
        }
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
            }
            
            return 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }

    getAllTags() {
        const tags = new Set();
        this.posts.forEach(post => {
            post.tags.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }

    renderAllTags() {
        const filterContainer = document.getElementById('tagFilters');
        if (!filterContainer) return;
        
        // Clear container more efficiently
        while (filterContainer.firstChild) {
            filterContainer.removeChild(filterContainer.firstChild);
        }
        
        this.getAllTags().forEach(tag => {
            const tagButton = document.createElement('button');
            tagButton.className = this.activeFilters.has(tag) ? 'tag-filter active' : 'tag-filter';
            tagButton.textContent = tag;
            
            tagButton.addEventListener('click', () => {
                if (this.activeFilters.has(tag)) {
                    this.activeFilters.delete(tag);
                } else {
                    this.activeFilters.add(tag);
                }
                this.renderPosts();
                this.renderAllTags();
            });
            
            filterContainer.appendChild(tagButton);
        });
    }

    async renderPost(post) {
        const postsContainer = document.getElementById('posts');
        const newCard = this.createPostCard(post);
        
        postsContainer.appendChild(newCard);
        
        // Process embeds after being added to DOM
        if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load(newCard);
        }
        if (window.instgrm) {
            window.instgrm.Embeds.process(newCard);
        }
    }

    createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-post-id', post.id);
        
        // Create embed container
        const embedContainer = this.createEmbed(post);
        card.appendChild(embedContainer);
        
        // Create tags section
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'card-tags';
        
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';

        // Create and append tags
        post.tags.forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag';
            tagSpan.innerHTML = `
                ${tag}
                <button class="tag-delete" aria-label="Remove tag">&times;</button>
            `;
            tagSpan.querySelector('.tag-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                
                // Remove from data model
                post.tags = post.tags.filter(t => t !== tag);
                
                // Remove from UI
                tagSpan.remove();
                
                // Update storage
                await this.updatePost(post);
            });
            tagsContainer.appendChild(tagSpan);
        });
        
        // Create tag management container
        const tagManageContainer = document.createElement('div');
        tagManageContainer.className = 'tag-input-container';
        
        // Create tag input
        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.className = 'inline-tag-input';
        tagInput.placeholder = 'Add tag...';
        tagInput.style.display = 'none';
        
        // Create add button
        const addTagButton = document.createElement('button');
        addTagButton.className = 'add-tag-button';
        addTagButton.innerHTML = '<span>+</span>';
        
        // Add button click handler
        addTagButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add tag button clicked');
            
            if (tagInput.style.display === 'none') {
                tagInput.style.display = 'block';
                tagInput.focus();
            } else {
                tagInput.style.display = 'none';
            }
        });
        
        // Tag input handler
        tagInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const newTag = tagInput.value.trim();
                if (newTag) {
                    // Create new tag element
                    const tagSpan = document.createElement('span');
                    tagSpan.className = 'tag';
                    tagSpan.innerHTML = `
                        ${newTag}
                        <button class="tag-delete" aria-label="Remove tag">&times;</button>
                    `;
                    
                    // Add delete handler
                    tagSpan.querySelector('.tag-delete').addEventListener('click', async (evt) => {
                        evt.stopPropagation();
                        // Update data
                        post.tags = post.tags.filter(t => t !== newTag);
                        // Update UI
                        tagSpan.remove();
                        // Update storage
                        await this.updatePost(post);
                    });
                    
                    // Add to UI immediately
                    tagsContainer.appendChild(tagSpan);
                    
                    // Update post
                    post.tags.push(newTag);
                    
                    // Update storage
                    await this.updatePost(post);
                }
                tagInput.value = '';
                tagInput.style.display = 'none';
            } else if (e.key === 'Escape') {
                tagInput.value = '';
                tagInput.style.display = 'none';
            }
        });
        
        // Handle clicks outside the tag input
        const clickOutsideHandler = (e) => {
            if (!tagManageContainer.contains(e.target)) {
                tagInput.style.display = 'none';
            }
        };
        document.addEventListener('click', clickOutsideHandler);
        
        // Assemble components
        tagManageContainer.appendChild(tagInput);
        tagManageContainer.appendChild(addTagButton);
        
        tagsDiv.appendChild(tagsContainer);
        tagsDiv.appendChild(tagManageContainer);
        card.appendChild(tagsDiv);

        // Add delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '&times;';
        deleteButton.setAttribute('aria-label', 'Delete post');
        deleteButton.addEventListener('click', () => this.deletePost(post.id));
        card.appendChild(deleteButton);
        
        return card;
    }

    async createEmbed(post) {
        const wrapper = document.createElement('div');
        wrapper.className = 'embed-container';
        
        switch (post.type) {
            case 'twitter':
                const tweetUrl = new URL(post.url);
                // Convert x.com URLs to twitter.com
                const finalUrl = tweetUrl.hostname === 'x.com' 
                    ? `https://twitter.com${tweetUrl.pathname}${tweetUrl.search}` 
                    : post.url;
                
                wrapper.innerHTML = `
                    <blockquote class="twitter-tweet" data-dnt="true" data-theme="light">
                        <a href="${finalUrl}"></a>
                    </blockquote>`;

                // Wait for Twitter widget to be ready
                if (window.twttr) {
                    if (window.twttr.widgets) {
                        window.twttr.widgets.load(wrapper);
                    } else {
                        window.twttr.ready((twttr) => {
                            twttr.widgets.load(wrapper);
                        });
                    }
                }
                break;
                
            case 'instagram':
                wrapper.innerHTML = `
                    <blockquote class="instagram-media" data-instgrm-captioned 
                        data-instgrm-permalink="${post.url}">
                        <a href="${post.url}"></a>
                    </blockquote>`;
                
                if (window.instgrm) {
                    window.instgrm.Embeds.process(wrapper);
                }
                break;
                
            case 'youtube':
                const videoId = this.getYoutubeId(post.url);
                if (videoId) {
                    wrapper.innerHTML = `
                        <iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" 
                            frameborder="0" allow="accelerometer; autoplay; clipboard-write; 
                            encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
                        </iframe>`;
                } else {
                    wrapper.innerHTML = `<div class="error-embed">Invalid YouTube URL</div>`;
                }
                break;
                
            default:
                try {
                    const urlObj = new URL(post.url);
                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=128`;
                    
                    // Create the basic embed first with loading state
                    wrapper.innerHTML = `
                        <div class="website-embed">
                            <div class="website-header">
                                <img src="${faviconUrl}" alt="Favicon" class="favicon" />
                                <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="website-link">
                                    <span class="website-hostname">${urlObj.hostname}</span>
                                </a>
                            </div>
                            <div class="website-preview loading">
                                <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                                    <div class="meta-image-container">
                                        <div class="placeholder-text">
                                            <span>Loading preview...</span>
                                        </div>
                                    </div>
                                    <div class="meta-content">
                                        <h3 class="meta-title">Loading title...</h3>
                                        <p class="meta-description">Loading description...</p>
                                    </div>
                                </a>
                            </div>
                        </div>
                    `;
                    
                    // Use a proxy service that can handle CORS and fetch Open Graph metadata
                    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(post.url)}`;
                    
                    // Fetch the webpage content
                    fetch(proxyUrl)
                        .then(response => response.text())
                        .then(html => {
                            // Parse the HTML
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            
                            // Extract Open Graph metadata or fallback to regular meta tags
                            let title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                                       doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || 
                                       doc.querySelector('title')?.textContent || 
                                       urlObj.hostname;
                            
                            let description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                                             doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || 
                                             doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
                                             '';
                            
                            let imageUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
                                           doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || 
                                           '';
                            
                            // If image URL is relative, convert to absolute
                            if (imageUrl && !imageUrl.startsWith('http')) {
                                const base = doc.querySelector('base')?.getAttribute('href') || post.url;
                                imageUrl = new URL(imageUrl, base).href;
                            }
                            
                            // Update the preview with the metadata
                            const previewContainer = wrapper.querySelector('.website-preview');
                            if (previewContainer) {
                                previewContainer.classList.remove('loading');
                                
                                // Update title and description
                                const titleEl = previewContainer.querySelector('.meta-title');
                                const descEl = previewContainer.querySelector('.meta-description');
                                
                                if (titleEl) titleEl.textContent = title;
                                if (descEl) descEl.textContent = description;
                                
                                // Update image if available
                                if (imageUrl) {
                                    const imgContainer = previewContainer.querySelector('.meta-image-container');
                                    if (imgContainer) {
                                        imgContainer.innerHTML = `<img src="${imageUrl}" alt="${title}" class="website-thumbnail" />`;
                                    }
                                } else {
                                    // No image available, use a larger favicon as fallback
                                    const imgContainer = previewContainer.querySelector('.meta-image-container');
                                    if (imgContainer) {
                                        imgContainer.innerHTML = `<img src="${faviconUrl}" alt="${title}" class="website-thumbnail favicon-fallback" />`;
                                    }
                                }
                            }
                        })
                        .catch(() => {
                            // On error, show a simplified preview
                            const previewContainer = wrapper.querySelector('.website-preview');
                            if (previewContainer) {
                                previewContainer.classList.remove('loading');
                                previewContainer.innerHTML = `
                                    <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                                        <div class="meta-content">
                                            <h3 class="meta-title">${urlObj.hostname}</h3>
                                            <p class="meta-description">Visit this website</p>
                                        </div>
                                    </a>
                                `;
                            }
                        });
                } catch (e) {
                    wrapper.innerHTML = `
                        <div class="unknown-embed">
                            <a href="${post.url}" target="_blank" rel="noopener noreferrer">
                                ${post.url}
                            </a>
                        </div>
                    `;
                }
        }
        
        return wrapper;
    }

    getYoutubeId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    async renderPosts() {
        // Debounce rendering to avoid multiple renders in quick succession
        if (this._renderTimeout) {
            clearTimeout(this._renderTimeout);
        }
        
        this._renderTimeout = setTimeout(async () => {
            await this._renderPostsInternal();
            this._renderTimeout = null;
        }, 50);
    }
    
    async _renderPostsInternal() {
        const postsContainer = document.getElementById('posts');
        if (!postsContainer) return;
        
        // Reset pagination when filters change or on initial load
        this.currentPage = 0;
        this.allPostsLoaded = false;
        
        // Clear container more efficiently
        while (postsContainer.firstChild) {
            postsContainer.removeChild(postsContainer.firstChild);
        }
        
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
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.textContent = 'Loading...';
        postsContainer.insertAdjacentElement('afterend', loadingIndicator);
        
        // Load initial batch
        await this.loadMorePosts(true);
    }
    
    async loadMorePosts(isInitialLoad = false) {
        if (this.isLoading || (this.allPostsLoaded && !isInitialLoad)) return;
        
        this.isLoading = true;
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        
        const postsContainer = document.getElementById('posts');
        if (!postsContainer) return;
        
        // Get the current batch of posts
        const startIndex = this.currentPage * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const currentBatch = this.filteredPosts.slice(startIndex, endIndex);
        
        // Check if we've loaded all posts
        if (currentBatch.length === 0) {
            this.allPostsLoaded = true;
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            this.isLoading = false;
            return;
        }
        
        // Render current batch
        for (const post of currentBatch) {
            const card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-post-id', post.id);
            
            const embed = await this.createEmbed(post);
            card.appendChild(embed);

            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'card-tags';
            
            // Create tags container
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'tags-container';
            post.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.innerHTML = `
                    ${tag}
                    <button class="tag-delete" aria-label="Remove tag">&times;</button>
                `;
                tagSpan.querySelector('.tag-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const updatedTags = post.tags.filter(t => t !== tag);
                    this.updatePost({ ...post, tags: updatedTags });
                });
                tagsContainer.appendChild(tagSpan);
            });
            
            // Add new tag button
            const tagManageContainer = document.createElement('div');
            tagManageContainer.className = 'tag-input-container';
            
            const tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.className = 'inline-tag-input';
            tagInput.placeholder = 'Add tag...';
            tagInput.style.display = 'none';
            
            const addTagButton = document.createElement('button');
            addTagButton.className = 'add-tag-button';
            addTagButton.innerHTML = '<span>+</span>';
            
            addTagButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tagInput.style.display === 'none') {
                    tagInput.style.display = 'block';
                    tagInput.focus();
                } else {
                    tagInput.style.display = 'none';
                }
            });
            
            tagInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter') {
                    const newTag = tagInput.value.trim();
                    if (newTag) {
                        // Create new tag element
                        const tagSpan = document.createElement('span');
                        tagSpan.className = 'tag';
                        tagSpan.innerHTML = `
                            ${newTag}
                            <button class="tag-delete" aria-label="Remove tag">&times;</button>
                        `;
                        
                        // Add delete handler
                        tagSpan.querySelector('.tag-delete').addEventListener('click', (evt) => {
                            evt.stopPropagation();
                            const updatedTags = post.tags.filter(t => t !== newTag);
                            tagSpan.remove(); // Remove immediately
                            this.updatePost({ ...post, tags: updatedTags });
                        });
                        
                        tagsContainer.appendChild(tagSpan);
                        
                        // Update post
                        const updatedTags = [...post.tags, newTag];
                        await this.updatePost({ ...post, tags: updatedTags });
                    }
                    tagInput.value = '';
                    tagInput.style.display = 'none';
                } else if (e.key === 'Escape') {
                    tagInput.value = '';
                    tagInput.style.display = 'none';
                }
            });
            
            // Use one-time listener to avoid memory leaks
            const clickHandler = (e) => {
                if (!tagManageContainer.contains(e.target)) {
                    tagInput.style.display = 'none';
                }
            };
            document.addEventListener('click', clickHandler);
            
            tagManageContainer.appendChild(tagInput);
            tagManageContainer.appendChild(addTagButton);
            
            tagsDiv.appendChild(tagsContainer);
            tagsDiv.appendChild(tagManageContainer);
            card.appendChild(tagsDiv);

            // Minimal delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '&times;';
            deleteButton.setAttribute('aria-label', 'Delete post');
            deleteButton.addEventListener('click', () => this.deletePost(post.id));
            card.appendChild(deleteButton);

            const grid = document.getElementById('posts');
            if (grid) {
                grid.appendChild(card);
            }
        }
        
        // Increment page counter
        this.currentPage++;
        
        // Reload social media widgets
        if (window.twttr) {
            window.twttr.widgets.load();
        }
        if (window.instgrm) {
            window.instgrm.Embeds.process();
        }
        
        // Hide loading indicator when done
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
            this.showFeedback('Error exporting data. Please try again.', true);
        }
    }
    
    async importData(e) {
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
                        this.loadPosts();
                        
                        // Show feedback
                        this.showFeedback(`Imported ${newPosts.length} posts. Skipped ${duplicates} duplicates.`);
                    }
                } catch (err) {
                    this.showFeedback('Error parsing import file. Please check the file format.', true);
                }
                
                // Reset file input
                e.target.value = '';
            };
            
            reader.readAsText(file);
        } catch (error) {
            this.showFeedback('Error importing data. Please try again.', true);
            // Reset file input
            e.target.value = '';
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
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new SocialEmbedViewer();
});
