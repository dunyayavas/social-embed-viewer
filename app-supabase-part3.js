// Part 3 of the SocialEmbedViewer class - UI Rendering

// These methods should be added to the SocialEmbedViewer class in app-supabase.js

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
