// Database service for Supabase
import { initSupabase } from './supabase.js';

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.user = null;
    this.isInitialized = false;
    this.listeners = [];
  }
  
  async init() {
    if (this.isInitialized) return;
    
    try {
      this.supabase = await initSupabase();
      
      // Get current session
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        this.user = session.user;
      }
      
      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        this.user = session?.user || null;
        this.notifyListeners({ type: 'auth', user: this.user });
      });
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database service:', error);
      throw error;
    }
  }
  
  // Add a state change listener
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }
  
  // Notify all listeners
  notifyListeners(event) {
    this.listeners.forEach(listener => listener(event));
  }
  
  // Check if user is authenticated
  isAuthenticated() {
    return !!this.user;
  }
  
  // Get current user
  getCurrentUser() {
    return this.user;
  }
  
  // Sign out
  async signOut() {
    if (!this.supabase) await this.init();
    return this.supabase.auth.signOut();
  }
  
  // Posts CRUD operations
  
  // Get all posts for current user
  async getPosts(page = 0, pageSize = 10) {
    if (!this.supabase) await this.init();
    if (!this.user) throw new Error('User not authenticated');
    
    // Calculate range for pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error } = await this.supabase
      .from('posts')
      .select(`
        *,
        tags(*)
      `)
      .eq('user_id', this.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);
      
    if (error) throw error;
    
    // Transform data to match app's expected format
    return data.map(post => ({
      id: post.id,
      url: post.url,
      type: post.type,
      title: post.title || '',
      thumbnail: post.thumbnail || '',
      date: post.created_at,
      tags: post.tags.map(tag => tag.name)
    }));
  }
  
  // Save a new post
  async savePost(post) {
    if (!this.supabase) await this.init();
    if (!this.user) throw new Error('User not authenticated');
    
    // Insert post
    const { data, error } = await this.supabase
      .from('posts')
      .insert({
        user_id: this.user.id,
        url: post.url,
        type: post.type,
        title: post.title || null,
        thumbnail: post.thumbnail || null
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Insert tags if any
    if (post.tags && post.tags.length > 0) {
      const tagData = post.tags.map(tag => ({
        post_id: data.id,
        name: tag
      }));
      
      const { error: tagError } = await this.supabase
        .from('tags')
        .insert(tagData);
        
      if (tagError) throw tagError;
    }
    
    // Notify listeners
    this.notifyListeners({ type: 'post_added', post: data });
    
    return data;
  }
  
  // Delete a post
  async deletePost(postId) {
    if (!this.supabase) await this.init();
    if (!this.user) throw new Error('User not authenticated');
    
    // Delete post (tags will be cascade deleted due to foreign key)
    const { error } = await this.supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', this.user.id);
      
    if (error) throw error;
    
    // Notify listeners
    this.notifyListeners({ type: 'post_deleted', postId });
    
    return true;
  }
  
  // Update post tags
  async updatePostTags(postId, tags) {
    if (!this.supabase) await this.init();
    if (!this.user) throw new Error('User not authenticated');
    
    // First delete existing tags
    const { error: deleteError } = await this.supabase
      .from('tags')
      .delete()
      .eq('post_id', postId);
      
    if (deleteError) throw deleteError;
    
    // Then insert new tags
    if (tags && tags.length > 0) {
      const tagData = tags.map(tag => ({
        post_id: postId,
        name: tag
      }));
      
      const { error: insertError } = await this.supabase
        .from('tags')
        .insert(tagData);
        
      if (insertError) throw insertError;
    }
    
    // Notify listeners
    this.notifyListeners({ type: 'tags_updated', postId, tags });
    
    return true;
  }
  
  // Subscribe to real-time updates
  subscribeToUpdates(callback) {
    if (!this.supabase) throw new Error('Database not initialized');
    
    // Subscribe to posts table
    const postsSubscription = this.supabase
      .channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
        callback({ type: 'post_change', payload });
      })
      .subscribe();
      
    // Subscribe to tags table
    const tagsSubscription = this.supabase
      .channel('public:tags')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, payload => {
        callback({ type: 'tag_change', payload });
      })
      .subscribe();
      
    // Return unsubscribe function
    return () => {
      postsSubscription.unsubscribe();
      tagsSubscription.unsubscribe();
    };
  }
}

// Create singleton instance
const dbService = new DatabaseService();

export default dbService;
