// Wekeza Authentication System
// Uses localStorage to store user accounts

const Auth = {
    // Get all users from localStorage
    getUsers() {
        const users = localStorage.getItem('wekeza_users');
        return users ? JSON.parse(users) : [];
    },

    // Save users to localStorage
    saveUsers(users) {
        localStorage.setItem('wekeza_users', JSON.stringify(users));
    },

    // Register a new user
    register(fullName, email, password) {
        const users = this.getUsers();

        // Check if user already exists
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, message: 'An account with this email already exists.' };
        }

        // Add new user
        const newUser = {
            id: Date.now(),
            fullName,
            email: email.toLowerCase(),
            password, // In production, this should be hashed
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        this.saveUsers(users);

        return { success: true, message: 'Account created successfully!' };
    },

    // Login user
    login(email, password) {
        const users = this.getUsers();
        const user = users.find(u =>
            u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (user) {
            // Store current session
            localStorage.setItem('wekeza_current_user', JSON.stringify({
                id: user.id,
                fullName: user.fullName,
                email: user.email
            }));
            return { success: true, user };
        }

        return { success: false, message: 'Invalid email or password.' };
    },

    // Get current logged-in user
    getCurrentUser() {
        const user = localStorage.getItem('wekeza_current_user');
        return user ? JSON.parse(user) : null;
    },

    // Logout
    logout() {
        localStorage.removeItem('wekeza_current_user');
    },

    // Check if user is logged in
    isLoggedIn() {
        return this.getCurrentUser() !== null;
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
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            const result = Auth.login(email, password);

            if (result.success) {
                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                showToast(result.message, 'error');
            }
        });
    }

    // Handle Signup Form
    if (signupForm) {
        signupForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const fullName = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('signupConfirmPassword').value;

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

            const result = Auth.register(fullName, email, password);

            if (result.success) {
                showToast(result.message + ' Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            } else {
                showToast(result.message, 'error');
            }
        });
    }
});
