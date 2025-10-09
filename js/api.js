// api.js - API Service Layer (COMPLETE FIXED VERSION)
// Base configuration
const API_CONFIG = {
    baseURL: 'http://localhost:8000/api/v1',
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
        const project = await this.getProject(projectId);
        return { documents: project.documents || [] };
    }

    async extractDocumentText(projectId, documentId) {
        console.log(`Extracting text for project ${projectId}, document ${documentId}`);
        return this.request(`/project/${projectId}/documents/${documentId}/extract`, {
            method: 'GET'
        });
    }

    // ==================== BRD CHILDREN FRD APIs ====================
    
    /**
     * Get all converted FRDs for a BRD document
     * GET /api/v1/brd/{brd_document_id}/frds
     */
    async getFRDsByParentBRD(brdDocumentId) {
        return this.request(`/brd/${brdDocumentId}/frds`, {
            method: 'GET'
        });
    }

    // ==================== BRD CONVERSION AND TESTCASE GENERATION ====================
    
    /**
     * Convert BRD to FRD with SSE streaming
     * POST /api/v1/brd/convert/{brd_document_id}
     */
    async convertBRDToFRDStream(brdDocumentId, onEvent) {
        const url = `${this.baseURL}/brd/convert/${brdDocumentId}`;
        return this.handleStreamingResponse(url, 'POST', null, onEvent);
    }

    /**
     * Convert BRD to FRD - Non-streaming version (waits for complete response)
     * POST /api/v1/brd/convert/{brd_document_id}
     */
    async convertBRDToFRD(brdDocumentId) {
        const url = `${this.baseURL}/brd/convert/${brdDocumentId}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream',
                    ...this.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            const events = this.parseSSEResponse(responseText);
            return this.aggregateConversionData(events);
        } catch (error) {
            console.error('BRD conversion failed:', error);
            throw error;
        }
    }

    /**
     * Generate testcases for converted FRD (from BRD)
     * POST /api/v1/brd/frd/{frd_document_id}/testcases/generate
     */
    async generateBRDTestcases(frdDocumentId, onEvent) {
        const url = `${this.baseURL}/brd/frd/${frdDocumentId}/testcases/generate`;
        return this.handleStreamingResponse(url, 'POST', null, onEvent);
    }

    /**
     * Chat update for BRD testcases (uses converted FRD ID)
     * POST /api/v1/brd/frd/{frd_document_id}/testcases/chat-update
     */
    async chatUpdateBRDTestcases(frdDocumentId, message, commit = true) {
        return this.request(
            `/brd/frd/${frdDocumentId}/testcases/chat-update?commit=${commit}`,
            {
                method: 'POST',
                body: JSON.stringify({ message })
            }
        );
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

    // FRD Streaming testcase generation
    async generateFRDTestcasesStream(projectId, documentId, onEvent) {
        const url = `${this.baseURL}/frd/project/${projectId}/documents/${documentId}/generate-testcases-stream`;
        return this.handleStreamingResponse(url, 'GET', null, onEvent);
    }

    // Chat update for FRD testcases
    async chatUpdateFRDTestcases(projectId, documentId, message, commit = true) {
        return this.request(
            `/frd/testcases/chat-update?project_id=${projectId}&document_id=${documentId}&commit=${commit}`,
            {
                method: 'POST',
                body: JSON.stringify({ message })
            }
        );
    }

    // ==================== SSE PARSING UTILITIES ====================
    
    /**
     * Parse SSE response text into events
     */
    parseSSEResponse(text) {
        const events = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            if (line.startsWith('data: ')) {
                try {
                    const jsonStr = line.substring(6);
                    const data = JSON.parse(jsonStr);
                    events.push(data);
                } catch (error) {
                    console.error('Failed to parse SSE line:', line, error);
                }
            }
        }
        
        return events;
    }

    /**
     * Aggregate conversion data from all SSE events
     */
    aggregateConversionData(events) {
        let frdContent = '';
        let documentId = null;
        let totalChunks = 0;
        let filename = null;
        
        for (const event of events) {
            if (event.type === 'start') {
                documentId = event.document_id;
                totalChunks = event.total_chunks;
            } else if (event.type === 'chunk_complete' && event.frd_content) {
                frdContent += event.frd_content + '\n\n';
            } else if (event.type === 'finalizing') {
                if (event.filename) filename = event.filename;
                if (event.document_id) documentId = event.document_id;
            }
        }
        
        return {
            frd_document_id: documentId,
            frd_content: frdContent.trim(),
            content: frdContent.trim(),
            text: frdContent.trim(),
            total_chunks: totalChunks,
            frd_filename: filename || `FRD_${documentId}`
        };
    }

    // ==================== GENERIC STREAMING HANDLER ====================
    
    /**
     * Generic streaming response handler for SSE endpoints
     */
    async handleStreamingResponse(url, method = 'GET', body = null, onEvent) {
        try {
            const requestOptions = {
                method: method,
                headers: {
                    'Accept': 'text/event-stream',
                    ...this.headers
                }
            };

            if (body && method === 'POST') {
                requestOptions.body = JSON.stringify(body);
            }

            const response = await fetch(url, requestOptions);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let allEvents = [];

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6);
                            const eventData = JSON.parse(jsonStr);
                            allEvents.push(eventData);
                            
                            if (onEvent) {
                                onEvent({ type: eventData.type, data: eventData });
                            }
                        } catch (error) {
                            console.error('Failed to parse SSE line:', line, error);
                        }
                    }
                }
            }

            if (url.includes('/brd/convert/')) {
                return this.aggregateConversionData(allEvents);
            }

            return { success: true, events: allEvents };

        } catch (error) {
            console.error('Stream error:', error);
            throw error;
        }
    }
}

// Create and export singleton instance
const apiService = new APIService();

// Make it available globally
window.apiService = apiService;