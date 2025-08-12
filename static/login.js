// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    sendPasswordResetEmail, 
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyApaox9bfZWul8SfkMltCQnps_xBHMImsE",
    authDomain: "smart-spend-83959.firebaseapp.com",
    projectId: "smart-spend-83959",
    storageBucket: "smart-spend-83959.firebasestorage.app",
    messagingSenderId: "1090756846106",
    appId: "1:1090756846106:web:5524053541e033276f67a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Track if user is intentionally logging in/signing up
let isIntentionalAuth = false;

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const signUpButton = document.getElementById('signUp');
    const signInButton = document.getElementById('signIn');
    const container = document.getElementById('container');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const modal = document.getElementById('forgotPasswordModal');
    const closeButton = document.querySelector('.close');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');

    // Toggle between sign in and sign up forms
    signUpButton.addEventListener('click', () => {
        container.classList.add("right-panel-active");
    });
    
    signInButton.addEventListener('click', () => {
        container.classList.remove("right-panel-active");
    });
    
    // Forgot password modal
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = "block";
    });
    
    closeButton.addEventListener('click', () => {
        modal.style.display = "none";
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });

    // Auth State Listener
    onAuthStateChanged(auth, (user) => {
        if (user && isIntentionalAuth) {
            console.log('User successfully logged in:', user.email);
            // Set user_id cookie for backend authentication
            document.cookie = `user_id=${user.uid}; path=/`;
            // Redirect to dashboard after short delay to allow user to see success message
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            // Reset the flag
            isIntentionalAuth = false;
        } else if (user) {
            console.log('User already authenticated, redirecting to dashboard');
            // Only redirect if not already on homepage
            if (window.location.pathname !== '/') {
                document.cookie = `user_id=${user.uid}; path=/`;
                window.location.href = '/';
            }
        } else {
            console.log('User is signed out');
        }
    });

    // Login Form Submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        // Validation
        if (!email || !password) {
            showError('Please fill in all fields');
            return;
        }
        
        try {
            // Show loading state
            const loginBtn = loginForm.querySelector('button');
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
            
            // Set intentional auth flag
            isIntentionalAuth = true;
            
            const userCredential = await signInWithEmailAndPassword(
                auth, 
                email, 
                password
            );
            
            // Success
            showSuccess('Login successful! Redirecting...');
            loginForm.reset();
            
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Login failed. Please try again.';
            
            switch(error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many attempts. Account temporarily locked.';
                    break;
            }
            
            showError(errorMessage);
        } finally {
            // Reset button state
            const loginBtn = loginForm.querySelector('button');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    });

    // Signup Form Submission
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        
        // Validation
        if (!name || !email || !password || !confirmPassword) {
            showError('Please fill in all fields', signupForm);
            return;
        }
        
        if (password !== confirmPassword) {
            showError('Passwords do not match', signupForm);
            return;
        }
        
        if (password.length < 8) {
            showError('Password must be at least 8 characters long', signupForm);
            return;
        }
        
        try {
            // Show loading state
            const signupBtn = signupForm.querySelector('button');
            signupBtn.disabled = true;
            signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            
            // Set intentional auth flag
            isIntentionalAuth = true;
            
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );
            
            // Success - store additional user data
            localStorage.setItem('userName', name);
            showSuccess('Account created successfully!', signupForm);
            
            // Switch to login form after successful signup
            container.classList.remove("right-panel-active");
            signupForm.reset();
            
        } catch (error) {
            console.error('Signup error:', error);
            let errorMessage = 'Signup failed. Please try again.';
            
            switch(error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'This email is already registered.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password should be at least 6 characters.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/password accounts are not enabled.';
                    break;
            }
            
            showError(errorMessage, signupForm);
        } finally {
            // Reset button state
            const signupBtn = signupForm.querySelector('button');
            signupBtn.disabled = false;
            signupBtn.textContent = 'Sign Up';
        }
    });

    // Password Reset Form Submission
    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value.trim();
        
        if (!email) {
            showError('Please enter your email address', forgotPasswordForm);
            return;
        }
        
        try {
            // Show loading state
            const resetBtn = forgotPasswordForm.querySelector('button');
            resetBtn.disabled = true;
            resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            await sendPasswordResetEmail(auth, email);
            showSuccess(`Password reset email sent to ${email}`, forgotPasswordForm);
            
            // Close the modal after delay
            setTimeout(() => {
                modal.style.display = "none";
                forgotPasswordForm.reset();
            }, 2000);
            
        } catch (error) {
            console.error('Password reset error:', error);
            let errorMessage = 'Failed to send reset email. Please try again.';
            
            switch(error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
            }
            
            showError(errorMessage, forgotPasswordForm);
        } finally {
            // Reset button state
            const resetBtn = forgotPasswordForm.querySelector('button');
            resetBtn.disabled = false;
            resetBtn.textContent = 'Send Reset Link';
        }
    });

    // Helper Functions
    function showError(message, form = null) {
        // Remove any existing messages
        const existingErrors = form ? 
            form.querySelectorAll('.error-message') : 
            document.querySelectorAll('.error-message');
        
        existingErrors.forEach(el => el.remove());
        
        // Create error element
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.style.color = '#ff4b2b';
        errorEl.style.margin = '10px 0';
        errorEl.style.fontSize = '14px';
        errorEl.textContent = message;
        
        // Insert error message
        if (form) {
            form.insertBefore(errorEl, form.querySelector('button'));
        } else {
            document.body.appendChild(errorEl);
            setTimeout(() => errorEl.remove(), 3000);
        }
    }
    
    function showSuccess(message, form = null) {
        // Remove any existing messages
        const existingMessages = form ? 
            form.querySelectorAll('.success-message') : 
            document.querySelectorAll('.success-message');
        
        existingMessages.forEach(el => el.remove());
        
        // Create success element
        const successEl = document.createElement('div');
        successEl.className = 'success-message';
        successEl.style.color = '#4CAF50';
        successEl.style.margin = '10px 0';
        successEl.style.fontSize = '14px';
        successEl.textContent = message;
        
        // Insert success message
        if (form) {
            form.insertBefore(successEl, form.querySelector('button'));
        } else {
            document.body.appendChild(successEl);
            setTimeout(() => successEl.remove(), 3000);
        }
    }

    console.log('SmartSpend authentication system ready');
});
