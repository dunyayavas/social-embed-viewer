// Standalone version of the app that works without authentication
console.log('Standalone version loaded');

class StandaloneViewer {
  constructor() {
    this.posts = [];
    this.init();
  }
  
  init() {
    console.log('Initializing standalone viewer');
    // Add some sample posts for testing
    this.addSamplePosts();
    
    // Render the posts
    this.renderPosts();
    
    // Add event listener for the form
    const form = document.getElementById('linkForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
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
  }
  
  addSamplePosts() {
    // Add sample posts
    this.posts = [
      {
        id: '1',
        url: 'https://twitter.com/elonmusk/status/1507041396242407424',
        type: 'twitter',
        date: new Date().toISOString(),
        tags: ['twitter', 'news']
      },
      {
        id: '2',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        type: 'youtube',
        date: new Date().toISOString(),
        tags: ['youtube', 'music']
      },
      {
        id: '3',
        url: 'https://www.instagram.com/p/CdKI1-4OFdo/',
        type: 'instagram',
        date: new Date().toISOString(),
        tags: ['instagram', 'photo']
      }
    ];
  }
  
  renderPosts() {
    console.log('Rendering posts:', this.posts.length);
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) {
      console.error('Posts container not found!');
      return;
    }
    
    // Clear container
    postsContainer.innerHTML = '';
    
    // Render each post
    this.posts.forEach(post => {
      const postElement = this.createPostElement(post);
      postsContainer.appendChild(postElement);
    });
    
    // Show message if no posts
    if (this.posts.length === 0) {
      const noPostsMessage = document.createElement('div');
      noPostsMessage.className = 'no-posts-message';
      noPostsMessage.textContent = 'No posts yet. Add your first link above!';
      postsContainer.appendChild(noPostsMessage);
    }
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
      tagsContainer.appendChild(tagElement);
    });
    
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
  
  loadEmbed(post, container) {
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
  
  loadGenericEmbed(post, container) {
    container.innerHTML = `
      <div class="link-preview">
        <div class="link-preview-content">
          <h3>${post.url}</h3>
          <a href="${post.url}" target="_blank" rel="noopener noreferrer">Open link</a>
        </div>
      </div>
    `;
  }
  
  getYoutubeId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }
  
  handleSubmit(e) {
    e.preventDefault();
    
    const linkInput = document.getElementById('linkInput');
    const tagInput = document.getElementById('tagInput');
    const url = linkInput.value.trim();
    const tags = tagInput.value ? tagInput.value.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
    
    if (!url) return;
    
    // Create post object
    const post = {
      id: Date.now().toString(),
      url,
      type: this.getLinkType(url),
      date: new Date().toISOString(),
      tags
    };
    
    // Add post
    this.posts.push(post);
    
    // Render posts
    this.renderPosts();
    
    // Clear inputs
    linkInput.value = '';
    tagInput.value = '';
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
  
  deletePost(id) {
    this.posts = this.posts.filter(post => post.id !== id);
    this.renderPosts();
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing standalone viewer');
  window.viewer = new StandaloneViewer();
});
