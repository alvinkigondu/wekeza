/**
 * Wekeza Authentication System
 * Now integrated with backend API
 */

const Auth = {
    // Check if user is logged in (has valid token)
    isLoggedIn() {
        return API.getToken() !== null;
    },

    // Get current logged-in user from localStorage cache
    getCurrentUser() {
        const user = localStorage.getItem('wekeza_current_user');
        return user ? JSON.parse(user) : null;
    },

    // Register a new user via API
    async register(fullName, email, password) {
        try {
            const result = await API.auth.register(fullName, email, password);
            return { success: true, message: 'Account created successfully!' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Login user via API
    async login(email, password) {
        try {
            const result = await API.auth.login(email, password);
            return { success: true, user: result.user };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    // Logout - clear tokens and user data
    logout() {
        API.auth.logout();
    },

    // Refresh user profile from API
    async refreshProfile() {
        try {
            const user = await API.auth.getProfile();
            localStorage.setItem('wekeza_current_user', JSON.stringify(user));
            return user;
        } catch (error) {
            console.error('Failed to refresh profile:', error);
            return null;
        }
    }
};

// Toast notification system
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add styles
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        font-size: 14px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    `;

    if (type === 'success') {
        toast.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    } else if (type === 'error') {
        toast.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    } else {
        toast.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    }

    document.body.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    // Handle Login Form
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            const result = await Auth.login(email, password);

            if (result.success) {
                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showToast(result.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        });
    }

    // Handle Signup Form
    if (signupForm) {
        signupForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const fullName = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;
            const submitBtn = signupForm.querySelector('button[type="submit"]');

            // Validate passwords match
            if (password !== confirmPassword) {
                showToast('Passwords do not match.', 'error');
                return;
            }

            // Validate password strength
            if (password.length < 6) {
                showToast('Password must be at least 6 characters.', 'error');
                return;
            }

            // Disable button and show loading
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating account...';

            const result = await Auth.register(fullName, email, password);

            if (result.success) {
                showToast(result.message + ' Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                showToast(result.message, 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
    }
});
