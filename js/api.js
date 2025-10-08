// api.js - API Service Layer
// Base configuration
const API_CONFIG = {
    baseURL: 'http://localhost:8000/api/v1', // Change this to your actual API URL
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
};

// API Service Class
class APIService {
    constructor(config = API_CONFIG) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout;
        this.headers = config.headers;
    }

    // Generic request handler
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Project APIs
    async createProject(data) {
        return this.request('/project/create', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getProject(projectId) {
        // This API returns project with documents array included
        // Response structure: { id, name, description, created_at, documents: [...] }
        return this.request(`/project/projects/${projectId}`, {
            method: 'GET'
        });
    }

    async listProjects() {
        return this.request('/project/projects', {
            method: 'GET'
        });
    }

    async getProjectHierarchy(projectId) {
        return this.request(`/project/projects/${projectId}/hierarchy`, {
            method: 'GET'
        });
    }

    async getProjectStats(projectId) {
        return this.request(`/project/projects/${projectId}/stats`, {
            method: 'GET'
        });
    }

    // Document APIs
    async uploadDocument(projectId, formData) {
        // Don't set Content-Type for FormData - browser will set it with boundary
        const headers = { ...this.headers };
        delete headers['Content-Type'];

        return this.request(`/project/${projectId}/upload`, {
            method: 'POST',
            headers,
            body: formData
        });
    }

    async getDocument(projectId, documentId) {
        return this.request(`/project/${projectId}/documents/${documentId}`, {
            method: 'GET'
        });
    }

    async listDocuments(projectId) {
        // Documents are now fetched as part of getProject API
        // This method is kept for compatibility but now calls getProject
        const project = await this.getProject(projectId);
        return { documents: project.documents || [] };
    }

    async extractDocumentText(projectId, documentId) {
        console.log(`Extracting text for project ${projectId}, document ${documentId}`);
        return this.request(`/project/${projectId}/documents/${documentId}/extract`, {
            method: 'GET'
        });
    }

    // Testcase APIs
    async getDocumentTestcases(documentId, version = null, includeMetadata = false) {
        let endpoint = `/documents/${documentId}/testcases?include_metadata=${includeMetadata}`;
        if (version !== null) {
            endpoint += `&version=${version}`;
        }
        return this.request(endpoint, {
            method: 'GET'
        });
    }
}

// Create and export singleton instance
const apiService = new APIService();

// Make it available globally
window.apiService = apiService;