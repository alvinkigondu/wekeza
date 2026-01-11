/**
 * Wekeza API Service Layer
 * Centralized module for all backend API interactions
 */

const API = {
    BASE_URL: 'http://localhost:8000/api',

    // ==================== Token Management ====================

    getToken() {
        return localStorage.getItem('wekeza_token');
    },

    setToken(token) {
        localStorage.setItem('wekeza_token', token);
    },

    clearToken() {
        localStorage.removeItem('wekeza_token');
    },

    // ==================== Generic Request Handler ====================

    async request(endpoint, options = {}) {
        const url = `${this.BASE_URL}${endpoint}`;
        const token = this.getToken();

        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);

            // Handle 401 Unauthorized - token expired or invalid
            if (response.status === 401) {
                this.clearToken();
                localStorage.removeItem('wekeza_current_user');
                window.location.href = 'login.html';
                throw new Error('Session expired. Please log in again.');
            }

            // Handle 204 No Content
            if (response.status === 204) {
                return { success: true };
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An error occurred');
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    },

    // ==================== Authentication ====================

    auth: {
        async register(fullName, email, password) {
            const data = await API.request('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    password: password
                }),
            });
            return { success: true, user: data };
        },

        async login(email, password) {
            // OAuth2 form requires form-data format
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API.BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Invalid email or password');
            }

            // Store the token
            API.setToken(data.access_token);

            // Fetch and store user profile
            const user = await API.auth.getProfile();
            localStorage.setItem('wekeza_current_user', JSON.stringify(user));

            return { success: true, user };
        },

        async getProfile() {
            return await API.request('/auth/me');
        },

        async updateProfile(updates) {
            return await API.request('/auth/me', {
                method: 'PUT',
                body: JSON.stringify(updates),
            });
        },

        async getRiskSettings() {
            return await API.request('/auth/settings/risk');
        },

        async updateRiskSettings(settings) {
            return await API.request('/auth/settings/risk', {
                method: 'PUT',
                body: JSON.stringify(settings),
            });
        },

        async getNotificationPrefs() {
            return await API.request('/auth/settings/notifications');
        },

        async updateNotificationPrefs(prefs) {
            return await API.request('/auth/settings/notifications', {
                method: 'PUT',
                body: JSON.stringify(prefs),
            });
        },

        logout() {
            API.clearToken();
            localStorage.removeItem('wekeza_current_user');
        }
    },

    // ==================== Agents ====================

    agents: {
        async list() {
            return await API.request('/agents');
        },

        async create(agentData) {
            return await API.request('/agents', {
                method: 'POST',
                body: JSON.stringify(agentData),
            });
        },

        async get(agentId) {
            return await API.request(`/agents/${agentId}`);
        },

        async update(agentId, agentData) {
            return await API.request(`/agents/${agentId}`, {
                method: 'PUT',
                body: JSON.stringify(agentData),
            });
        },

        async delete(agentId) {
            return await API.request(`/agents/${agentId}`, {
                method: 'DELETE',
            });
        },

        async start(agentId) {
            return await API.request(`/agents/${agentId}/start`, {
                method: 'POST',
            });
        },

        async pause(agentId) {
            return await API.request(`/agents/${agentId}/pause`, {
                method: 'POST',
            });
        },

        async getSignal(agentId) {
            return await API.request(`/agents/${agentId}/signal`);
        }
    },

    // ==================== Portfolio ====================

    portfolio: {
        async get() {
            return await API.request('/portfolio');
        },

        async addHolding(holdingData) {
            return await API.request('/portfolio/holdings', {
                method: 'POST',
                body: JSON.stringify(holdingData),
            });
        },

        async removeHolding(holdingId) {
            return await API.request(`/portfolio/holdings/${holdingId}`, {
                method: 'DELETE',
            });
        },

        async getPerformance(period = '6m') {
            return await API.request(`/portfolio/performance?period=${period}`);
        },

        async getAllocation() {
            return await API.request('/portfolio/allocation');
        }
    },

    // ==================== Risk Management ====================

    risk: {
        async getSettings() {
            return await API.request('/risk/settings');
        },

        async updateSettings(settings) {
            return await API.request('/risk/settings', {
                method: 'PUT',
                body: JSON.stringify(settings),
            });
        },

        async getExposure() {
            return await API.request('/risk/exposure');
        },

        async getMetrics() {
            return await API.request('/risk/metrics');
        }
    },

    // ==================== System Logs ====================

    logs: {
        async list(page = 1, perPage = 20, level = null, category = null) {
            let url = `/logs?page=${page}&per_page=${perPage}`;
            if (level) url += `&level=${level}`;
            if (category) url += `&category=${category}`;
            return await API.request(url);
        },

        async getRecent(limit = 10) {
            return await API.request(`/logs/recent?limit=${limit}`);
        },

        async getStats() {
            return await API.request('/logs/stats');
        }
    },

    // ==================== Health Check ====================

    async healthCheck() {
        try {
            const response = await fetch(`${this.BASE_URL}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
};

// Make API available globally
window.API = API;
