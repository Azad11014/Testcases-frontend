// API Configuration
const API_BASE = 'http://localhost:8000';

// Main API Service
class API {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const config = { 
            headers: { 'Content-Type': 'application/json' }, 
            ...options 
        };
        
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        
        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.detail || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    static get(endpoint) { 
        return this.request(endpoint, { method: 'GET' }); 
    }
    
    static post(endpoint, data) { 
        const body = data instanceof FormData ? data : JSON.stringify(data);
        return this.request(endpoint, { method: 'POST', body }); 
    }
}

// Project API
class ProjectAPI {
    static getAllProjects() {
        return API.get('/api/v1/project/projects');
    }
    
    static getProject(projectId) {
        return API.get(`/api/v1/project/projects/${projectId}`);
    }
    
    static createProject(data) {
        return API.post('/api/v1/project/create', data);
    }
    
    static uploadDocument(projectId, file, docType) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('doctype', docType);
        return API.post(`/api/v1/project/${projectId}/upload`, formData);
    }
    
    static extractText(projectId, documentId) {
        return API.get(`/api/v1/project/${projectId}/documents/${documentId}/extract`);
    }
}

// Test Case API - New API for test case management
class TestCaseAPI {
    // List all test cases for a document
    static listTestCases(projectId, documentId) {
        return API.get(`/api/v1/project/${projectId}/document/${documentId}/testcases`);
    }
    
    // Preview a specific test case
    static previewTestCase(testcaseId) {
        return API.get(`/api/v1/testcases/${testcaseId}/preview`);
    }
    
    // Update test case via chat
    static updateTestCaseChat(testcaseId, message) {
        return API.post(`/api/v1/testcases/${testcaseId}/chat`, { message });
    }
}

// FRD API - Original endpoints for FRD documents
class FRDAPI {
    static analyzeDocument(projectId, documentId) {
        return API.post(`/api/v1/project/${projectId}/document/${documentId}/analyze`);
    }
    
    static generateTestCases(projectId, documentId) {
        return API.post(`/api/v1/project/${projectId}/documents/${documentId}/testcases/generate`);
    }
    
    static sendChatMessage(projectId, documentId, message) {
        return API.post(`/api/v1/project/${projectId}/documents/${documentId}/testcases/chat`, { message });
    }
    
    // Get generated test cases - Updated to use new endpoint
    static getTestCases(projectId, documentId) {
        return TestCaseAPI.listTestCases(projectId, documentId);
    }
    
    // Fallback methods for backward compatibility
    static analyzeDocumentFallback(projectId, documentId) {
        return this.analyzeDocument(projectId, documentId);
    }
    
    static generateTestCasesFallback(projectId, documentId) {
        return this.generateTestCases(projectId, documentId);
    }
    
    static sendChatMessageFallback(projectId, documentId, message) {
        return this.sendChatMessage(projectId, documentId, message);
    }
}

// BRD API - Updated with correct endpoints
class BRDAPI {
    // BRD Non-Streaming APIs
    
    // Convert BRD to FRD
    static async convertBrdToFrd(projectId, documentId) {
        return API.post(`/api/v1/project/${projectId}/document/${documentId}/convert`);
    }

    // Analyze BRD FRD
    static async analyzeBrdFrd(projectId, documentId) {
        return API.post(`/api/v1/project/${projectId}/document/${documentId}/bfrd/analyze`);
    }

    // Generate Test Cases
    static async generateTestCases(projectId, documentId) {
        return API.post(`/api/v1/project/${projectId}/document/${documentId}/testcases/generate`);
    }
    
    // Update Test Cases
    static async updateTestCases(projectId, documentId, message) {
        return API.post(`/api/v1/project/${projectId}/document/${documentId}/testcases/update`, { message });
    }

    // Legacy method names for backward compatibility
    static async converBrdToFrd(projectId, documentId) {
        return this.convertBrdToFrd(projectId, documentId);
    }

    static async analyzeBFRD(projectId, documentId) {
        return this.analyzeBrdFrd(projectId, documentId);
    }

    static async generateBFRDTestCases(projectId, documentId) {
        return this.generateTestCases(projectId, documentId);
    }
    
    static async chatUpdateBFRDTestCases(projectId, documentId, message) {
        return this.updateTestCases(projectId, documentId, message);
    }
}

// Make APIs globally available
window.API = API;
window.ProjectAPI = ProjectAPI;
window.TestCaseAPI = TestCaseAPI;
window.FRDAPI = FRDAPI;
window.BRDAPI = BRDAPI;