// Supabase client configuration
const supabaseUrl = 'https://fvbafecdoqslcvmyxqjf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2YmFmZWNkb3FzbGN2bXl4cWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM5NDg3MjYsImV4cCI6MjA1OTUyNDcyNn0.TfhLP9BBhokuAPVaxFQy4dg-MvZlsJDquVFPF-OWjOM';

// Initialize Supabase client
let supabase = null;

// Dynamically import Supabase client
async function initSupabase() {
  if (supabase) return supabase;
  
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm');
    supabase = createClient(supabaseUrl, supabaseKey);
    return supabase;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    throw error;
  }
}

export { initSupabase };
