// Part 4 of the SocialEmbedViewer class - Event Handlers and Utilities

// These methods should be added to the SocialEmbedViewer class in app-supabase.js

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
