// Add this to your app.js file temporarily to help debug
console.log('App initialization started');

// Log authentication state
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('DOM loaded, checking auth state');
    
    // Check if Supabase is initialized correctly
    if (typeof initSupabase === 'function') {
      console.log('Supabase import found');
      const supabase = await initSupabase();
      console.log('Supabase initialized:', !!supabase);
      
      // Check authentication
      const { data, error } = await supabase.auth.getSession();
      console.log('Auth session:', data);
      if (error) console.error('Auth error:', error);
    } else {
      console.error('Supabase import not found');
    }
    
    // Check DOM elements
    console.log('Posts container exists:', !!document.getElementById('postsContainer'));
    
    // Check if we're using the right element IDs
    const allElements = document.querySelectorAll('*[id]');
    console.log('All element IDs:', Array.from(allElements).map(el => el.id));
  } catch (error) {
    console.error('Debug error:', error);
  }
});
