// BRD Streaming Service - Fixed version with correct endpoint routing
class BRDStreamingService {
    static API_BASE = 'http://localhost:8000';
    static activeStreams = new Map();
    
    // Stream BRD to FRD conversion
    static async streamBrdToFrd(projectId, brdId, onChunk, onComplete, onError) {
        const streamId = `brd_convert_${projectId}_${brdId}`;
        const url = `${this.API_BASE}/api/v1/project/${projectId}/brd/${brdId}/frd/stream`;
        
        return this.createStream(streamId, url, { method: 'POST' }, onChunk, onComplete, onError);
    }
    
    // Stream BRD FRD analysis
    static async streamAnalyzeBrdFrd(projectId, brdId, onChunk, onComplete, onError) {
        const streamId = `brd_analyze_${projectId}_${brdId}`;
        const url = `${this.API_BASE}/api/v1/project/${projectId}/brd/${brdId}/analyze/stream`;
        
        return this.createStream(streamId, url, { method: 'POST' }, onChunk, onComplete, onError);
    }
    
    // Stream propose fix
    static async streamProposeFix(projectId, brdId, message, onChunk) {
        const streamId = `brd_propose_${projectId}_${brdId}`;
        const url = `${this.API_BASE}/api/v1/project/${projectId}/brd/${brdId}/propose-fix/stream`;
        const body = JSON.stringify({ message });
        
        return this.createStream(streamId, url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        }, onChunk);
    }
    
    // Stream test case generation - FIXED ENDPOINT
    static async streamTestGeneration(projectId, brdId, onChunk) {
        const streamId = `brd_test_gen_${projectId}_${brdId}`;
        // Use the working BRD endpoint pattern
        const url = `${this.API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/generate/stream`;
        
        return this.createStream(streamId, url, { method: 'POST' }, onChunk);
    }
    
    // Stream test case update - FIXED ENDPOINT
    static async streamTestUpdate(projectId, brdId, message, onChunk) {
        const streamId = `brd_test_update_${projectId}_${brdId}`;
        // Use the working BRD endpoint pattern
        const url = `${this.API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/update/stream`;
        const body = JSON.stringify({ message });
        
        return this.createStream(streamId, url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        }, onChunk);
    }
    
    // Core streaming method
    static async createStream(streamId, url, options, onChunk, onComplete, onError) {
        try {
            console.log(`Starting stream ${streamId} to ${url}`);
            
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            if (!response.body) {
                throw new Error('Response body is null');
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            this.activeStreams.set(streamId, { reader, response });
            
            let buffer = '';
            let fullContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log(`Stream ${streamId} completed`);
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    if (line.startsWith('data: ')) {
                        try {
                            const data = line.slice(6);
                            
                            if (data === '[DONE]') {
                                console.log(`Stream ${streamId} finished`);
                                if (onComplete) onComplete(fullContent);
                                return fullContent;
                            }
                            
                            // Try to parse as JSON first
                            let parsedData;
                            try {
                                parsedData = JSON.parse(data);
                                
                                if (parsedData.text) {
                                    fullContent += parsedData.text;
                                    if (onChunk) onChunk({ text: parsedData.text, data: parsedData });
                                } else if (parsedData.content) {
                                    fullContent += parsedData.content;
                                    if (onChunk) onChunk({ text: parsedData.content, data: parsedData });
                                }
                            } catch (jsonError) {
                                // If not JSON, treat as plain text
                                fullContent += data;
                                if (onChunk) onChunk({ text: data, data: { text: data } });
                            }
                            
                        } catch (parseError) {
                            console.warn(`Failed to parse stream data for ${streamId}:`, parseError);
                            continue;
                        }
                    }
                }
            }
            
            if (onComplete) onComplete(fullContent);
            return fullContent;
            
        } catch (error) {
            console.error(`Stream ${streamId} error:`, error);
            this.activeStreams.delete(streamId);
            
            if (onError) {
                onError(error);
            } else {
                throw error;
            }
        } finally {
            this.activeStreams.delete(streamId);
        }
    }
    
    // Test streaming availability
    static async testStreamingAvailability(projectId, brdId) {
        try {
            const testUrl = `${this.API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/generate/stream`;
            const response = await fetch(testUrl, { 
                method: 'HEAD',
                headers: { 'Accept': 'text/event-stream' }
            });
            return response.ok;
        } catch (error) {
            console.warn('Streaming availability test failed:', error);
            return false;
        }
    }
    
    // Utility methods
    static isStreamingSupported() {
        return typeof ReadableStream !== 'undefined' && 
               typeof TextDecoder !== 'undefined' &&
               typeof fetch !== 'undefined';
    }
    
    static getActiveStreamCount() {
        return this.activeStreams.size;
    }
    
    static getActiveStreamIds() {
        return Array.from(this.activeStreams.keys());
    }
    
    static closeAllStreams() {
        for (const [streamId, { reader, response }] of this.activeStreams.entries()) {
            try {
                reader.cancel();
                console.log(`Closed stream: ${streamId}`);
            } catch (error) {
                console.warn(`Error closing stream ${streamId}:`, error);
            }
        }
        this.activeStreams.clear();
    }
    
    static closeStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (stream) {
            try {
                stream.reader.cancel();
                this.activeStreams.delete(streamId);
                console.log(`Closed stream: ${streamId}`);
            } catch (error) {
                console.warn(`Error closing stream ${streamId}:`, error);
            }
        }
    }
}

// Make globally available
window.BRDStreamingService = BRDStreamingService;

// Initialize cleanup on page unload
window.addEventListener('beforeunload', () => {
    BRDStreamingService.closeAllStreams();
});