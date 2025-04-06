// Authentication module
import { initSupabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    });
    
    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    });
    
    // Login form submission
    const loginButton = document.getElementById('loginButton');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    
    loginButton.addEventListener('click', async () => {
        // Validate inputs
        if (!loginEmail.value || !loginPassword.value) {
            loginError.textContent = 'Please fill in all fields';
            return;
        }
        
        // Set loading state
        loginButton.classList.add('loading');
        loginButton.disabled = true;
        loginError.textContent = '';
        
        try {
            const supabase = await initSupabase();
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail.value,
                password: loginPassword.value
            });
            
            if (error) throw error;
            
            // Check if there's a pending share
            const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
            if (redirectUrl === 'share' && sessionStorage.getItem('pendingShareUrl')) {
                window.location.href = './index.html?share=pending';
            } else {
                window.location.href = './index.html';
            }
        } catch (error) {
            loginError.textContent = error.message || 'Failed to login. Please try again.';
            loginButton.classList.remove('loading');
            loginButton.disabled = false;
        }
    });
    
    // Signup form submission
    const signupButton = document.getElementById('signupButton');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    const signupError = document.getElementById('signupError');
    
    signupButton.addEventListener('click', async () => {
        // Validate inputs
        if (!signupEmail.value || !signupPassword.value || !signupConfirmPassword.value) {
            signupError.textContent = 'Please fill in all fields';
            return;
        }
        
        if (signupPassword.value !== signupConfirmPassword.value) {
            signupError.textContent = 'Passwords do not match';
            return;
        }
        
        if (signupPassword.value.length < 6) {
            signupError.textContent = 'Password must be at least 6 characters';
            return;
        }
        
        // Set loading state
        signupButton.classList.add('loading');
        signupButton.disabled = true;
        signupError.textContent = '';
        
        try {
            const supabase = await initSupabase();
            const { data, error } = await supabase.auth.signUp({
                email: signupEmail.value,
                password: signupPassword.value
            });
            
            if (error) throw error;
            
            // Show success message
            signupForm.innerHTML = `
                <div class="auth-success">
                    <h3>Registration Successful!</h3>
                    <p>Please check your email to confirm your account.</p>
                    <p>You'll be redirected to the login page shortly...</p>
                </div>
            `;
            
            // Redirect to login after a delay
            setTimeout(() => {
                loginTab.click();
            }, 3000);
        } catch (error) {
            signupError.textContent = error.message || 'Failed to sign up. Please try again.';
            signupButton.classList.remove('loading');
            signupButton.disabled = false;
        }
    });
    
    // Check if user is already logged in
    checkAuthState();
    
    async function checkAuthState() {
        try {
            const supabase = await initSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                // User is already logged in, redirect to main page
                window.location.href = './index.html';
            }
        } catch (error) {
            console.error('Auth state check failed:', error);
        }
    }
});
