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
    static API_BASE = API_BASE || '';

    // BRD Non-Streaming APIs (Fallback)
    
    // Convert BRD to FRD - Keep existing endpoint
    static async convertBrdToFrd(projectId, documentId) {
        try {
            return await API.post(`/api/v1/project/${projectId}/document/${documentId}/convert`);
        } catch (error) {
            console.error('BRD to FRD conversion failed:', error);
            throw error;
        }
    }

    // Analyze BRD FRD - Updated endpoint
    static async analyzeBrdFrd(projectId, documentId) {
        try {
            return await API.post(`/api/v1/project/${projectId}/document/${documentId}/bfrd/analyze`);
        } catch (error) {
            console.error('BRD FRD analysis failed:', error);
            throw error;
        }
    }

    // Propose Fix BRD - New endpoint
    static async proposeBrdFix(projectId, documentId, issueIds) {
        try {
            const payload = {
                issues: Array.isArray(issueIds) ? issueIds : [issueIds],
                message: `Please propose fixes for the following issues: ${issueIds.join(', ')}`
            };
            return await API.post(`/api/v1/project/${projectId}/document/${documentId}/brd/propose-fix`, payload);
        } catch (error) {
            console.error('BRD propose fix failed:', error);
            throw error;
        }
    }

    // Apply Fix BRD - New endpoint with version
    static async applyBrdFix(projectId, documentId, versionId = 0) {
        try {
            return await API.post(`/api/v1/project/${projectId}/document/${documentId}/brd/apply-fix/${versionId}`);
        } catch (error) {
            console.error('BRD apply fix failed:', error);
            throw error;
        }
    }

    // Generate Test Cases - New endpoint
    static async generateTestCases(projectId, documentId) {
        try {
            return await API.post(`/api/v1/project/${projectId}/document/${documentId}/testcases/generate`);
        } catch (error) {
            console.error('BRD generate test cases failed:', error);
            throw error;
        }
    }

    // Update Test Cases - New endpoint
    static async updateTestCases(projectId, documentId, message) {
        try {
            const payload = {
                message: message,
                instruction: message
            };
            return await API.post(`/api/v1/project/${projectId}/document/${documentId}/testcases/update`, payload);
        } catch (error) {
            console.error('BRD update test cases failed:', error);
            throw error;
        }
    }

    // Streaming APIs with fallback logic
    
    // Stream BRD to FRD conversion
    static async streamBrdToFrd(projectId, brdId, onChunk, onComplete, onError) {
        console.log(`Starting BRD to FRD streaming for project ${projectId}, brd ${brdId}`);
        
        try {
            // Try streaming first
            return await BRDStreamingService.streamBrdToFrd(projectId, brdId, onChunk, onComplete, onError);
        } catch (streamError) {
            console.warn('BRD to FRD streaming failed, trying fallback API:', streamError);
            
            try {
                // Fallback to regular API
                const result = await this.convertBrdToFrd(projectId, brdId);
                
                // Simulate streaming behavior for consistency
                if (onChunk && result) {
                    const content = this.extractContent(result);
                    onChunk({ text: content, data: result });
                }
                
                if (onComplete && result) {
                    const content = this.extractContent(result);
                    onComplete(content);
                }
                
                return result;
            } catch (fallbackError) {
                console.error('Both streaming and fallback failed for BRD to FRD:', fallbackError);
                if (onError) onError(fallbackError);
                throw fallbackError;
            }
        }
    }

    // Stream BRD FRD analysis
    static async streamAnalyzeBrdFrd(projectId, brdId, onChunk, onComplete, onError) {
        console.log(`Starting BRD FRD analysis streaming for project ${projectId}, brd ${brdId}`);
        
        try {
            // Try streaming first
            return await BRDStreamingService.streamAnalyzeBrdFrd(projectId, brdId, onChunk, onComplete, onError);
        } catch (streamError) {
            console.warn('BRD FRD analysis streaming failed, trying fallback API:', streamError);
            
            try {
                // Fallback to regular API
                const result = await this.analyzeBrdFrd(projectId, brdId);
                
                // Simulate streaming behavior
                if (onChunk && result) {
                    const content = this.extractContent(result);
                    onChunk({ text: content, data: result });
                }
                
                if (onComplete && result) {
                    const content = this.extractContent(result);
                    onComplete(content);
                }
                
                return result;
            } catch (fallbackError) {
                console.error('Both streaming and fallback failed for BRD FRD analysis:', fallbackError);
                if (onError) onError(fallbackError);
                throw fallbackError;
            }
        }
    }

    // Stream propose fix
    static async streamProposeFix(projectId, brdId, message, onChunk) {
        console.log(`Starting BRD propose fix streaming for project ${projectId}, brd ${brdId}`);
        
        try {
            // Try streaming first
            return await BRDStreamingService.streamProposeFix(projectId, brdId, message, onChunk);
        } catch (streamError) {
            console.warn('BRD propose fix streaming failed, trying fallback API:', streamError);
            
            try {
                // Extract issue IDs from message or use default
                const issueIds = this.extractIssueIds(message) || [1];
                
                // Fallback to regular API
                const result = await this.proposeBrdFix(projectId, brdId, issueIds);
                
                // Simulate streaming behavior
                if (onChunk && result) {
                    const content = this.extractContent(result);
                    onChunk({ text: content, data: result });
                }
                
                return result;
            } catch (fallbackError) {
                console.error('Both streaming and fallback failed for BRD propose fix:', fallbackError);
                throw fallbackError;
            }
        }
    }

    // Stream test case generation
    static async streamTestGeneration(projectId, brdId, onChunk) {
        console.log(`Starting BRD test generation streaming for project ${projectId}, brd ${brdId}`);
        
        try {
            // Try streaming first
            return await BRDStreamingService.streamTestGeneration(projectId, brdId, onChunk);
        } catch (streamError) {
            console.warn('BRD test generation streaming failed, trying fallback API:', streamError);
            
            try {
                // Fallback to regular API
                const result = await this.generateTestCases(projectId, brdId);
                
                // Simulate streaming behavior
                if (onChunk && result) {
                    const content = this.extractContent(result);
                    onChunk({ text: content, data: result });
                }
                
                return result;
            } catch (fallbackError) {
                console.error('Both streaming and fallback failed for BRD test generation:', fallbackError);
                throw fallbackError;
            }
        }
    }

    // Stream test case update
    static async streamTestUpdate(projectId, brdId, message, onChunk) {
        console.log(`Starting BRD test update streaming for project ${projectId}, brd ${brdId}`);
        
        try {
            // Try streaming first
            return await BRDStreamingService.streamTestUpdate(projectId, brdId, message, onChunk);
        } catch (streamError) {
            console.warn('BRD test update streaming failed, trying fallback API:', streamError);
            
            try {
                // Fallback to regular API
                const result = await this.updateTestCases(projectId, brdId, message);
                
                // Simulate streaming behavior
                if (onChunk && result) {
                    const content = this.extractContent(result);
                    onChunk({ text: content, data: result });
                }
                
                return result;
            } catch (fallbackError) {
                console.error('Both streaming and fallback failed for BRD test update:', fallbackError);
                throw fallbackError;
            }
        }
    }

    // Utility Methods

    // Extract content from API response
    static extractContent(result) {
        if (typeof result === 'string') return result;
        
        if (typeof result === 'object' && result !== null) {
            // Try various common content fields
            return result.frd_content || 
                   result.analysis || 
                   result.test_cases || 
                   result.content || 
                   result.text || 
                   result.message || 
                   result.response ||
                   result.converted_content || 
                   result.conversion_result ||
                   result.proposed_fixes ||
                   result.fix_suggestions ||
                   result.applied_fixes ||
                   result.updated_content ||
                   result.generated_tests ||
                   result.test_content ||
                   JSON.stringify(result, null, 2);
        }
        
        return 'No content available';
    }

    // Extract issue IDs from message text
    static extractIssueIds(message) {
        if (!message) return null;
        
        // Look for patterns like "issues: 1, 2, 3" or "issue #1, #2"
        const matches = message.match(/(?:issue|issues)[:\s#]*(\d+(?:,?\s*\d+)*)/i);
        
        if (matches && matches[1]) {
            return matches[1].split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }
        
        // Look for standalone numbers
        const numberMatches = message.match(/\b\d+\b/g);
        if (numberMatches) {
            return numberMatches.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
        }
        
        return null;
    }

    // Check if streaming is available
    static async isStreamingAvailable(projectId, brdId) {
        try {
            return await BRDStreamingService.testStreamingAvailability(projectId, brdId);
        } catch (error) {
            console.warn('Streaming availability check failed:', error);
            return false;
        }
    }

    // Get streaming service status
    static getStreamingStatus() {
        return {
            supported: BRDStreamingService.isStreamingSupported(),
            activeStreams: BRDStreamingService.getActiveStreamCount(),
            streamIds: BRDStreamingService.getActiveStreamIds()
        };
    }

    // Enhanced error handling with retry logic
    static async executeWithRetry(operation, maxRetries = 2, delay = 1000) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`API attempt ${attempt + 1}/${maxRetries + 1}`);
                return await operation();
            } catch (error) {
                lastError = error;
                console.warn(`API attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const waitTime = delay * Math.pow(2, attempt);
                    console.log(`Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    console.error(`All ${maxRetries + 1} API attempts failed`);
                    throw lastError;
                }
            }
        }
    }

    // Validate API parameters
    static validateParams(projectId, documentId) {
        if (!projectId || !documentId) {
            throw new Error('Project ID and Document ID are required');
        }
        
        if (typeof projectId !== 'string' && typeof projectId !== 'number') {
            throw new Error('Project ID must be a string or number');
        }
        
        if (typeof documentId !== 'string' && typeof documentId !== 'number') {
            throw new Error('Document ID must be a string or number');
        }
    }

    // Format error for user display
    static formatError(error) {
        if (error?.response?.data?.message) {
            return error.response.data.message;
        }
        
        if (error?.message) {
            return error.message;
        }
        
        if (typeof error === 'string') {
            return error;
        }
        
        return 'An unknown error occurred';
    }

    // Health check endpoint
    static async healthCheck() {
        try {
            // This would depend on your API having a health check endpoint
            const response = await fetch(`${this.API_BASE}/health`);
            return response.ok;
        } catch (error) {
            console.warn('Health check failed:', error);
            return false;
        }
    }

    // Get API configuration
    static getConfig() {
        return {
            baseUrl: this.API_BASE,
            streamingSupported: BRDStreamingService.isStreamingSupported(),
            endpoints: {
                convert: '/api/v1/project/{project_id}/document/{document_id}/convert',
                analyze: '/api/v1/project/{project_id}/document/{document_id}/bfrd/analyze',
                proposeFix: '/api/v1/project/{project_id}/document/{document_id}/brd/propose-fix',
                applyFix: '/api/v1/project/{project_id}/document/{document_id}/brd/apply-fix/{version_id}',
                generateTests: '/api/v1/project/{project_id}/document/{document_id}/testcases/generate',
                updateTests: '/api/v1/project/{project_id}/document/{document_id}/testcases/update',
                
                // Streaming endpoints
                streamConvert: '/api/v1/project/{project_id}/brd/{brd_id}/frd/stream',
                streamAnalyze: '/api/v1/project/{project_id}/brd/{brd_id}/analyze/stream',
                streamProposeFix: '/api/v1/project/{project_id}/brd/{brd_id}/propose-fix/stream',
                streamGenerateTests: '/api/v1/project/{project_id}/brd/{brd_id}/testcases/generate/stream',
                streamUpdateTests: '/api/v1/project/{project_id}/brd/{brd_id}/testcases/update/stream'
            }
        };
    }

    // Close all active streams
    static closeAllStreams() {
        if (BRDStreamingService) {
            BRDStreamingService.closeAllStreams();
        }
    }

    // Debug logging
    static enableDebugLogging(enable = true) {
        this._debugLogging = enable;
        if (enable) {
            console.log('BRD API debug logging enabled');
            console.log('Current configuration:', this.getConfig());
        }
    }

    static _log(...args) {
        if (this._debugLogging) {
            console.log('[BRD API]', ...args);
        }
    }
}

// Make globally available
window.BRDAPI = BRDAPI;

// Initialize debug logging if needed
if (window.location.hostname === 'localhost' || window.location.search.includes('debug=1')) {
    BRDAPI.enableDebugLogging(true);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    BRDAPI.closeAllStreams();
});

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