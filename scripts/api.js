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

// Test Case API - Enhanced for test case management with streaming support
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
    
    // Generate test cases with streaming support
    static generateTestCasesStream(projectId, documentId) {
        return StreamingService.streamTestGeneration(projectId, documentId);
    }
    
    // Update test cases with streaming support
    static updateTestCasesStream(projectId, documentId, message) {
        return StreamingService.streamChatUpdate(projectId, documentId, message);
    }
}

// FRD API - Enhanced with streaming endpoints and proper fallbacks
class FRDAPI {
    // Analysis endpoint (no streaming support)
    static analyzeDocument(projectId, documentId) {
        return API.post(`/api/v1/project/${projectId}/document/${documentId}/analyze`);
    }
    
    // Generate test cases with streaming first, fallback to regular
    static async generateTestCases(projectId, documentId) {
        try {
            // Try streaming first
            return await StreamingService.streamTestGeneration(projectId, documentId);
        } catch (streamError) {
            console.warn('Streaming failed, using regular API:', streamError);
            // Fallback to regular endpoint
            return API.post(`/api/v1/project/${projectId}/documents/${documentId}/testcases/generate`);
        }
    }
    
    // Chat update with streaming first, fallback to regular
    static async sendChatMessage(projectId, documentId, message) {
        try {
            // Try streaming first
            return await StreamingService.streamChatUpdate(projectId, documentId, message);
        } catch (streamError) {
            console.warn('Chat streaming failed, using regular API:', streamError);
            // Fallback to regular endpoint
            return API.post(`/api/v1/project/${projectId}/documents/${documentId}/testcases/chat`, { message });
        }
    }
    
    // Propose fixes endpoint
    static proposeFix(projectId, documentId, issueIds) {
        return API.post(`/api/v1/project/${projectId}/documents/${documentId}/frd/propose-fix`, {
            issue_ids: issueIds
        });
    }
    
    // Apply fixes endpoint
    static applyFix(projectId, documentId, versionId) {
        return API.post(`/api/v1/project/${projectId}/documents/${documentId}/frd/apply-fix`, {
            version_id: versionId
        });
    }
    
    // Get generated test cases - Updated to use new endpoint
    static getTestCases(projectId, documentId) {
        return TestCaseAPI.listTestCases(projectId, documentId);
    }
    
    // Fallback methods for backward compatibility
    static analyzeDocumentFallback(projectId, documentId) {
        return this.analyzeDocument(projectId, documentId);
    }
    
    static async generateTestCasesFallback(projectId, documentId) {
        // Always try regular API for fallback
        return API.post(`/api/v1/project/${projectId}/documents/${documentId}/testcases/generate`);
    }
    
    static async sendChatMessageFallback(projectId, documentId, message) {
        // Always try regular API for fallback
        return API.post(`/api/v1/project/${projectId}/documents/${documentId}/testcases/chat`, { message });
    }
    
    // Streaming methods with proper error handling
    static async generateTestCasesWithStreaming(projectId, documentId, onChunk) {
        try {
            return await StreamingService.streamTestGeneration(projectId, documentId, onChunk);
        } catch (error) {
            console.error('Streaming test generation failed:', error);
            throw error;
        }
    }
    
    static async sendChatMessageWithStreaming(projectId, documentId, message, onChunk) {
        try {
            return await StreamingService.streamChatUpdate(projectId, documentId, message, onChunk);
        } catch (error) {
            console.error('Streaming chat update failed:', error);
            throw error;
        }
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

// Enhanced error handling and retry logic
class APIWithRetry {
    static async requestWithRetry(apiCall, maxRetries = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await apiCall();
            } catch (error) {
                lastError = error;
                console.warn(`API call failed (attempt ${attempt}/${maxRetries}):`, error.message);
                
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }
        
        throw lastError;
    }
    
    static async requestWithFallback(primaryCall, fallbackCall) {
        try {
            return await primaryCall();
        } catch (primaryError) {
            console.warn('Primary API call failed, trying fallback:', primaryError.message);
            try {
                return await fallbackCall();
            } catch (fallbackError) {
                console.error('Both primary and fallback API calls failed');
                throw fallbackError;
            }
        }
    }
}

// Request interceptor for debugging
class APIDebugger {
    static enabled = false;
    
    static log(method, url, data, response) {
        if (!this.enabled) return;
        
        console.group(`API ${method.toUpperCase()} ${url}`);
        if (data) console.log('Request data:', data);
        console.log('Response:', response);
        console.groupEnd();
    }
    
    static enable() {
        this.enabled = true;
        console.log('API debugging enabled');
    }
    
    static disable() {
        this.enabled = false;
        console.log('API debugging disabled');
    }
}

// Connection status monitor
class ConnectionMonitor {
    static isOnline = navigator.onLine;
    static listeners = new Set();
    
    static {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline');
        });
    }
    
    static addListener(callback) {
        this.listeners.add(callback);
    }
    
    static removeListener(callback) {
        this.listeners.delete(callback);
    }
    
    static notifyListeners(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Connection status listener error:', error);
            }
        });
    }
}

// Make APIs globally available
window.API = API;
window.ProjectAPI = ProjectAPI;
window.TestCaseAPI = TestCaseAPI;
window.FRDAPI = FRDAPI;
window.BRDAPI = BRDAPI;
window.APIWithRetry = APIWithRetry;
window.APIDebugger = APIDebugger;
window.ConnectionMonitor = ConnectionMonitor;