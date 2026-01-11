// Dashboard Logic

document.addEventListener('DOMContentLoaded', function () {
    // 1. Authentication Check
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Load User Data
    if (typeof Auth !== 'undefined') {
        const currentUser = Auth.getCurrentUser();
        if (currentUser) {
            document.getElementById('userName').textContent = currentUser.fullName;

            // Also populate settings profile if on that page
            const profileNameInput = document.getElementById('profileName');
            const profileEmailInput = document.getElementById('profileEmail');
            if (profileNameInput) profileNameInput.value = currentUser.fullName;
            if (profileEmailInput) profileEmailInput.value = currentUser.email;
        }
    }

    // 3. Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof Auth !== 'undefined') {
                Auth.logout();
                if (typeof showToast === 'function') showToast('Logged out successfully!', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1000);
            }
        });
    }

    // 4. Initialize Navigation (Do this FIRST to ensure UI works)
    initNavigation();

    // 5. Initialize Charts (Safely)
    try {
        if (typeof Chart !== 'undefined') {
            initPortfolioChart(); // Overview Chart
            initPortfolioView();  // Detailed Portfolio View
            initRiskView();       // Risk Management View
        } else {
            console.warn('Chart.js not loaded. Visualizations will be disabled.');
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }

    // 6. Initialize Settings
    initSettingsView();
});

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const viewAllBtn = document.getElementById('viewAllBtn');

    // Helper to switch views
    function switchView(targetId) {
        // Update Sidebar Active State
        navLinks.forEach(link => {
            if (link.dataset.target === targetId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Toggle Views
        views.forEach(view => {
            if (view.id === `view-${targetId}`) {
                view.classList.remove('hidden');
                // Re-trigger animation
                view.style.animation = 'none';
                view.offsetHeight; /* trigger reflow */
                view.style.animation = null;
            } else {
                view.classList.add('hidden');
            }
        });

        // Update Header Titles based on view
        updateHeader(targetId);
    }

    // Helper to update header text
    function updateHeader(viewId) {
        switch (viewId) {
            case 'overview':
                pageTitle.textContent = 'System Overview';
                pageSubtitle.textContent = 'Real-time market insights and agent performance';
                break;
            case 'agents':
                pageTitle.textContent = 'Active Agents';
                pageSubtitle.textContent = 'Manage and configure your trading bots';
                break;
            case 'risk':
                pageTitle.textContent = 'Risk Management';
                pageSubtitle.textContent = 'Global risk settings and exposure limits';
                break;
            case 'portfolio':
                pageTitle.textContent = 'Portfolio Performance';
                pageSubtitle.textContent = 'Historical data and asset allocation';
                break;
            case 'logs':
                pageTitle.textContent = 'System Logs';
                pageSubtitle.textContent = 'Audit trails and error reporting';
                break;
            case 'settings':
                pageTitle.textContent = 'Settings';
                pageSubtitle.textContent = 'Platform configuration and preferences';
                break;
        }
    }

    // Add click listeners to sidebar links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            if (target) {
                switchView(target);
            }
        });
    });

    // Handle "View All" button
    if (viewAllBtn) {
        viewAllBtn.addEventListener('click', () => {
            switchView('agents');
        });
    }
}

function initPortfolioChart() {
    const ctx = document.getElementById('portfolioChart');
    if (!ctx) return;

    // Fake data for the portfolio chart simulation
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 100);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)'); // Blue with opacity
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Portfolio Value',
                data: [120000, 121500, 121000, 122800, 123500, 124000, 124580],
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false // Hide X axis for cleaner look in the card
                },
                y: {
                    display: false // Hide Y axis
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// --- PORTFOLIO VIEW LOGIC ---
function initPortfolioView() {
    // 1. Mock Data for Holdings
    const holdings = [
        { asset: 'Bitcoin (BTC)', type: 'Crypto', quantity: 0.45, avgPrice: 40000, currentPrice: 42500 },
        { asset: 'Ethereum (ETH)', type: 'Crypto', quantity: 4.2, avgPrice: 2100, currentPrice: 2350 },
        { asset: 'Tesla (TSLA)', type: 'Stock', quantity: 25, avgPrice: 180, currentPrice: 210 },
        { asset: 'Apple (AAPL)', type: 'Stock', quantity: 50, avgPrice: 150, currentPrice: 185 },
        { asset: 'EUR/USD', type: 'Forex', quantity: 10000, avgPrice: 1.08, currentPrice: 1.09 },
        { asset: 'Gold (XAU)', type: 'Commodity', quantity: 5, avgPrice: 1950, currentPrice: 2020 }
    ];

    // 2. Render Allocation Chart (Donut)
    const allocCtx = document.getElementById('allocationChart');
    if (allocCtx) {
        new Chart(allocCtx, {
            type: 'doughnut',
            data: {
                labels: ['Crypto', 'Stocks', 'Forex', 'Commodities'],
                datasets: [{
                    data: [35, 40, 15, 10],
                    backgroundColor: [
                        '#f59e0b', // Amber (Crypto)
                        '#3b82f6', // Blue (Stocks)
                        '#10b981', // Green (Forex)
                        '#eab308'  // Yellow (Gold)
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // 3. Render Performance Chart (Line)
    const perfCtx = document.getElementById('portfolioPerformanceChart');
    if (perfCtx) {
        const gradient = perfCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        new Chart(perfCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Net Worth',
                    data: [98000, 105000, 102000, 115000, 118000, 124580],
                    borderColor: '#10b981', // Green
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#0f172a',
                    pointBorderColor: '#10b981',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        callbacks: {
                            label: function (context) {
                                return 'Value: ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8', callback: (val) => '$' + val / 1000 + 'k' }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // 4. Render Holdings Table
    const tableBody = document.getElementById('holdingsTableBody');
    if (tableBody) {
        tableBody.innerHTML = ''; // Clear existing
        holdings.forEach(item => {
            const totalValue = item.quantity * item.currentPrice;
            const investValue = item.quantity * item.avgPrice;
            const profitLoss = totalValue - investValue;
            const profitPercent = (profitLoss / investValue) * 100;
            const isProfit = profitLoss >= 0;

            const row = `
                <tr>
                    <td style="font-weight: 500; color: white;">${item.asset}</td>
                    <td><span class="status-badge" style="background: rgba(255,255,255,0.1); color: #cbd5e1;">${item.type}</span></td>
                    <td>${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td>$${item.avgPrice.toLocaleString()}</td>
                    <td>$${item.currentPrice.toLocaleString()}</td>
                    <td style="font-weight: 600;">$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="color: ${isProfit ? 'var(--accent-green)' : 'var(--accent-red)'}">
                        ${isProfit ? '+' : ''}$${Math.abs(profitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${isProfit ? '+' : ''}${profitPercent.toFixed(2)}%)
                    </td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', row);
        });
    }
}

// --- RISK VIEW LOGIC ---
function initRiskView() {
    // 1. Exposure Chart (Bar)
    const exposureCtx = document.getElementById('exposureChart');
    if (exposureCtx) {
        new Chart(exposureCtx, {
            type: 'bar',
            data: {
                labels: ['Crypto', 'Stocks', 'Forex', 'Commodities', 'Cash'],
                datasets: [{
                    label: 'Exposure %',
                    data: [35, 40, 15, 8, 2],
                    backgroundColor: [
                        'rgba(245, 158, 11, 0.7)',
                        'rgba(59, 130, 246, 0.7)',
                        'rgba(16, 185, 129, 0.7)',
                        'rgba(234, 179, 8, 0.7)',
                        'rgba(148, 163, 184, 0.7)'
                    ],
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#94a3b8', callback: val => val + '%' },
                        max: 50
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#f8fafc', font: { size: 12 } }
                    }
                }
            }
        });
    }

    // 2. Risk Slider Handlers
    const sliders = [
        { id: 'maxPositionSize', valueId: 'maxPositionValue', suffix: '%' },
        { id: 'stopLossDefault', valueId: 'stopLossValue', suffix: '%' },
        { id: 'dailyLossLimit', valueId: 'dailyLossValue', suffix: '%' },
        { id: 'leverageLimit', valueId: 'leverageValue', suffix: 'x' }
    ];

    sliders.forEach(({ id, valueId, suffix }) => {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(valueId);
        if (slider && valueDisplay) {
            slider.addEventListener('input', () => {
                valueDisplay.textContent = slider.value + suffix;
            });
        }
    });

    // 3. Save Risk Settings Button
    const saveRiskBtn = document.getElementById('saveRiskSettings');
    if (saveRiskBtn) {
        saveRiskBtn.addEventListener('click', () => {
            showToast('Risk settings saved successfully!', 'success');
        });
    }
}

// --- SETTINGS VIEW LOGIC ---
function initSettingsView() {
    // 1. Save Profile Button
    const saveProfileBtn = document.getElementById('saveProfile');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('profileName');
            if (nameInput && nameInput.value.trim()) {
                // Update localStorage user
                const currentUser = Auth.getCurrentUser();
                if (currentUser) {
                    currentUser.fullName = nameInput.value.trim();
                    localStorage.setItem('wekeza_current_user', JSON.stringify(currentUser));

                    // Update header display
                    const headerName = document.getElementById('userName');
                    if (headerName) headerName.textContent = currentUser.fullName;

                    showToast('Profile updated successfully!', 'success');
                }
            }
        });
    }

    // 2. Notification Toggle Handlers (just visual feedback for now)
    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            // In a real app, this would save to backend
            const label = toggle.closest('.toggle-item')?.querySelector('.toggle-title')?.textContent;
            const state = toggle.checked ? 'enabled' : 'disabled';
            showToast(`${label} notifications ${state}`, 'info');
        });
    });

    // 3. Export Data Button
    const exportBtn = document.querySelector('.btn-danger-secondary');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            showToast('Preparing data export...', 'info');
            setTimeout(() => {
                showToast('Export complete! Check your downloads.', 'success');
            }, 1500);
        });
    }

    // 4. Delete Account Button (with confirmation)
    const deleteBtn = document.querySelector('.btn-danger');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                Auth.logout();
                showToast('Account deletion requested. Redirecting...', 'info');
                setTimeout(() => {
                    window.location.href = 'landingpage.html';
                }, 2000);
            }
        });
    }
}
