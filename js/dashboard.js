/**
 * Wekeza Dashboard Controller
 * Handles view navigation, user data display, and dashboard interactions
 */

document.addEventListener('DOMContentLoaded', function () {
    // Check if user is logged in
    if (!API.getToken()) {
        window.location.href = 'login.html';
        return;
    }

    // Load user data
    loadUserProfile();

    // Set up navigation
    setupNavigation();

    // Set up logout
    setupLogout();

    // Initialize charts
    initializeCharts();

    // Set up slider controls
    setupSliders();
});

// ==================== User Profile ====================

async function loadUserProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('wekeza_current_user'));
        if (user) {
            document.getElementById('userName').textContent = user.full_name || 'User';
            if (document.getElementById('profileName')) {
                document.getElementById('profileName').value = user.full_name || '';
            }
            if (document.getElementById('profileEmail')) {
                document.getElementById('profileEmail').value = user.email || '';
            }
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

// ==================== Navigation ====================

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-target]');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    const pageTitles = {
        'overview': { title: 'System Overview', subtitle: 'Real-time market insights and agent performance' },
        'agents': { title: 'Active Agents', subtitle: 'Monitor and control your AI trading agents' },
        'risk': { title: 'Risk Management', subtitle: 'Configure risk parameters and exposure limits' },
        'portfolio': { title: 'Portfolio', subtitle: 'View your holdings and performance metrics' },
        'logs': { title: 'System Logs', subtitle: 'Review system activity and agent operations' },
        'settings': { title: 'Settings', subtitle: 'Manage your account and preferences' }
    };

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            const target = this.getAttribute('data-target');

            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Show target view, hide others
            viewSections.forEach(section => {
                if (section.id === `view-${target}`) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            });

            // Update page title
            if (pageTitles[target]) {
                pageTitle.textContent = pageTitles[target].title;
                pageSubtitle.textContent = pageTitles[target].subtitle;
            }
        });
    });

    // View All button - switch to agents view
    const viewAllBtn = document.getElementById('viewAllBtn');
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', function () {
            const agentsLink = document.querySelector('.nav-link[data-target="agents"]');
            if (agentsLink) agentsLink.click();
        });
    }
}

// ==================== Logout ====================

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            API.auth.logout();
            window.location.href = 'login.html';
        });
    }
}

// ==================== Charts ====================

function initializeCharts() {
    // Portfolio mini chart (Overview page)
    const portfolioChartCanvas = document.getElementById('portfolioChart');
    if (portfolioChartCanvas) {
        new Chart(portfolioChartCanvas, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    data: [120000, 121500, 119800, 122000, 123200, 122800, 124580],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    }

    // Exposure chart (Risk page)
    const exposureChartCanvas = document.getElementById('exposureChart');
    if (exposureChartCanvas) {
        new Chart(exposureChartCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Crypto', 'Forex', 'Stocks', 'Options', 'Cash'],
                datasets: [{
                    data: [35, 25, 20, 15, 5],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', padding: 15 }
                    }
                }
            }
        });
    }

    // Portfolio performance chart
    const perfChartCanvas = document.getElementById('portfolioPerformanceChart');
    if (perfChartCanvas) {
        new Chart(perfChartCanvas, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [100000, 105000, 102000, 112000, 118000, 115000, 124580],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // Allocation chart
    const allocChartCanvas = document.getElementById('allocationChart');
    if (allocChartCanvas) {
        new Chart(allocChartCanvas, {
            type: 'pie',
            data: {
                labels: ['Crypto', 'Stocks', 'Forex', 'Commodities', 'Cash'],
                datasets: [{
                    data: [45, 30, 15, 5, 5],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', padding: 10 }
                    }
                }
            }
        });
    }
}

// ==================== Sliders (Risk Management) ====================

function setupSliders() {
    const sliders = [
        { id: 'maxPositionSize', valueId: 'maxPositionValue', suffix: '%' },
        { id: 'stopLossDefault', valueId: 'stopLossValue', suffix: '%' },
        { id: 'dailyLossLimit', valueId: 'dailyLossValue', suffix: '%' },
        { id: 'leverageLimit', valueId: 'leverageValue', suffix: 'x' }
    ];

    sliders.forEach(slider => {
        const sliderEl = document.getElementById(slider.id);
        const valueEl = document.getElementById(slider.valueId);
        if (sliderEl && valueEl) {
            sliderEl.addEventListener('input', function () {
                valueEl.textContent = this.value + slider.suffix;
            });
        }
    });

    // Save risk settings button
    const saveRiskBtn = document.getElementById('saveRiskSettings');
    if (saveRiskBtn) {
        saveRiskBtn.addEventListener('click', async function () {
            try {
                const settings = {
                    max_position_size: parseInt(document.getElementById('maxPositionSize').value),
                    stop_loss_default: parseInt(document.getElementById('stopLossDefault').value),
                    daily_loss_limit: parseInt(document.getElementById('dailyLossLimit').value),
                    leverage_limit: parseInt(document.getElementById('leverageLimit').value)
                };
                await API.auth.updateRiskSettings(settings);
                showToast('Risk settings saved!', 'success');
            } catch (error) {
                showToast('Failed to save settings: ' + error.message, 'error');
            }
        });
    }

    // Save profile button
    const saveProfileBtn = document.getElementById('saveProfile');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function () {
            try {
                const updates = {
                    full_name: document.getElementById('profileName').value
                };
                await API.auth.updateProfile(updates);
                // Update local storage
                const user = JSON.parse(localStorage.getItem('wekeza_current_user'));
                user.full_name = updates.full_name;
                localStorage.setItem('wekeza_current_user', JSON.stringify(user));
                document.getElementById('userName').textContent = updates.full_name;
                showToast('Profile saved!', 'success');
            } catch (error) {
                showToast('Failed to save profile: ' + error.message, 'error');
            }
        });
    }
}

// ==================== Toast Notifications ====================

function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

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

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
