// Enhanced Streaming Service with FRD-specific endpoints and proper fallbacks
class StreamingService {
    static activeStreams = new Map();

    static async stream(url, streamId, onChunk, onComplete, onError) {
        return new Promise((resolve, reject) => {
            this.closeStream(streamId);

            const eventSource = new EventSource(url);
            
            this.activeStreams.set(streamId, eventSource);

            let accumulatedText = '';
            let isComplete = false;

            eventSource.onmessage = (event) => {
                try {
                    if (event.data === '[DONE]' || event.data === 'data: [DONE]') {
                        isComplete = true;
                        this.closeStream(streamId);
                        if (onComplete) onComplete(accumulatedText);
                        resolve(accumulatedText);
                        return;
                    }

                    // Handle different data formats
                    let data;
                    const eventData = event.data.startsWith('data: ') ? event.data.slice(6) : event.data;
                    
                    try {
                        data = JSON.parse(eventData);
                    } catch {
                        // If not JSON, treat as plain text
                        data = { text: eventData };
                    }

                    if (data?.text || data?.content || data?.message) {
                        const chunk = data.text || data.content || data.message;
                        accumulatedText += chunk;
                        if (onChunk) onChunk({ text: chunk, data });
                    }
                } catch (error) {
                    console.error('Stream parse error:', error);
                }
            };

            eventSource.onerror = (error) => {
                console.error('Stream error:', error);
                this.closeStream(streamId);
                
                if (!isComplete) {
                    const errorMsg = new Error('Streaming connection failed');
                    if (onError) onError(errorMsg);
                    reject(errorMsg);
                }
            };

            eventSource.onopen = () => {
                console.log(`Stream ${streamId} connected`);
            };

            // Timeout after 5 minutes
            setTimeout(() => {
                if (!isComplete) {
                    this.closeStream(streamId);
                    const timeoutError = new Error('Stream timeout');
                    if (onError) onError(timeoutError);
                    reject(timeoutError);
                }
            }, 300000);
        });
    }

    static closeStream(streamId) {
        const eventSource = this.activeStreams.get(streamId);
        if (eventSource) {
            eventSource.close();
            this.activeStreams.delete(streamId);
        }
    }

    static closeAllStreams() {
        this.activeStreams.forEach((eventSource, streamId) => {
            eventSource.close();
        });
        this.activeStreams.clear();
    }

    // FRD Test Case Generation Stream
    static async streamTestGeneration(projectId, documentId, onChunk) {
        const streamId = `testgen-${projectId}-${documentId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/frd/${documentId}/testcases/generate/stream`;
        
        try {
            return await this.stream(url, streamId, onChunk);
        } catch (error) {
            console.warn('Test generation streaming failed:', error);
            throw error;
        }
    }

    // FRD Chat Update Stream - Uses POST with streaming response
    static async streamChatUpdate(projectId, documentId, message, onChunk) {
        const streamId = `chat-${projectId}-${documentId}`;
        
        try {
            const postUrl = `${API_BASE}/api/v1/project/${projectId}/frd/${documentId}/testcases/update/stream`;
            
            // Use fetch for POST request that returns a stream
            const response = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await this.handleStreamResponse(response, streamId, onChunk);
            
        } catch (error) {
            console.warn('Chat streaming failed:', error);
            throw error;
        }
    }

    // Handle streaming response from fetch
    static async handleStreamResponse(response, streamId, onChunk) {
        return new Promise(async (resolve, reject) => {
            let accumulatedText = '';
            let isComplete = false;

            try {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        isComplete = true;
                        resolve(accumulatedText);
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            
                            if (data === '[DONE]') {
                                isComplete = true;
                                resolve(accumulatedText);
                                return;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                if (parsed?.text || parsed?.content || parsed?.message) {
                                    const text = parsed.text || parsed.content || parsed.message;
                                    accumulatedText += text;
                                    if (onChunk) onChunk({ text, data: parsed });
                                }
                            } catch (error) {
                                // Handle plain text
                                if (data.trim()) {
                                    accumulatedText += data;
                                    if (onChunk) onChunk({ text: data });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Stream read error:', error);
                if (!isComplete) {
                    reject(error);
                }
            }
        });
    }

    // Legacy methods for backward compatibility
    static async streamAnalysis(projectId, documentId, onChunk) {
        console.warn('streamAnalysis is deprecated, analysis does not support streaming');
        throw new Error('Analysis streaming not supported');
    }
}

// BRD Streaming Service - Enhanced for BRD-specific operations
class BRDStreamingService {
    static activeStreams = new Map();
    static streamingSupported = true;

    // Check if streaming is supported
    static isStreamingSupported() {
        return this.streamingSupported && typeof EventSource !== 'undefined';
    }

    // Get active stream count
    static getActiveStreamCount() {
        return this.activeStreams.size;
    }

    // Get active stream IDs
    static getActiveStreamIds() {
        return Array.from(this.activeStreams.keys());
    }

    // Test streaming availability
    static async testStreamingAvailability(projectId, brdId) {
        try {
            const testUrl = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/stream/test`;
            const response = await fetch(testUrl, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn('Streaming availability test failed:', error);
            return false;
        }
    }

    // Generic streaming method for BRD operations
    static async streamRequest(url, streamId, onChunk, onComplete, onError) {
        return new Promise(async (resolve, reject) => {
            let accumulatedText = '';
            let isComplete = false;
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                this.activeStreams.set(streamId, { reader, response });

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        isComplete = true;
                        this.closeStream(streamId);
                        if (onComplete) onComplete(accumulatedText);
                        resolve(accumulatedText);
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6).trim();
                            
                            if (dataStr === '[DONE]') {
                                isComplete = true;
                                this.closeStream(streamId);
                                if (onComplete) onComplete(accumulatedText);
                                resolve(accumulatedText);
                                return;
                            }

                            try {
                                const data = JSON.parse(dataStr);
                                
                                if (data.type === 'token' && data.text) {
                                    accumulatedText += data.text;
                                    if (onChunk) onChunk({ text: data.text, data, accumulated: accumulatedText });
                                } else if (data.text || data.content || data.message) {
                                    const text = data.text || data.content || data.message;
                                    accumulatedText += text;
                                    if (onChunk) onChunk({ text, data, accumulated: accumulatedText });
                                }
                            } catch (parseError) {
                                // Handle non-JSON data
                                if (dataStr.trim()) {
                                    accumulatedText += dataStr;
                                    if (onChunk) onChunk({ text: dataStr, accumulated: accumulatedText });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`BRD Stream ${streamId} error:`, error);
                this.closeStream(streamId);
                
                if (!isComplete) {
                    if (onError) onError(error);
                    reject(error);
                }
            }
        });
    }

    // Stream BRD to FRD conversion
    static async streamBrdToFrd(projectId, brdId, onChunk, onComplete, onError) {
        const streamId = `brd-frd-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/frd/stream`;
        
        return this.streamRequest(url, streamId, onChunk, onComplete, onError);
    }

    // Stream BRD FRD analysis
    static async streamAnalyzeBrdFrd(projectId, brdId, onChunk, onComplete, onError) {
        const streamId = `brd-analyze-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/analyze/stream`;
        
        return this.streamRequest(url, streamId, onChunk, onComplete, onError);
    }

    // Stream propose fix
    static async streamProposeFix(projectId, brdId, message, onChunk) {
        const streamId = `brd-propose-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/propose-fix/stream`;
        
        return new Promise(async (resolve, reject) => {
            let accumulatedText = '';
            let isComplete = false;
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify({ message })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                this.activeStreams.set(streamId, { reader, response });

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        isComplete = true;
                        this.closeStream(streamId);
                        resolve(accumulatedText);
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6).trim();
                            
                            if (dataStr === '[DONE]') {
                                isComplete = true;
                                this.closeStream(streamId);
                                resolve(accumulatedText);
                                return;
                            }

                            try {
                                const data = JSON.parse(dataStr);
                                
                                if (data.type === 'token' && data.text) {
                                    accumulatedText += data.text;
                                    if (onChunk) onChunk({ text: data.text, data, accumulated: accumulatedText });
                                }
                            } catch (parseError) {
                                if (dataStr.trim()) {
                                    accumulatedText += dataStr;
                                    if (onChunk) onChunk({ text: dataStr, accumulated: accumulatedText });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`BRD Propose Fix Stream error:`, error);
                this.closeStream(streamId);
                
                if (!isComplete) {
                    reject(error);
                }
            }
        });
    }

    // Stream test case generation
    static async streamTestGeneration(projectId, brdId, onChunk) {
        const streamId = `brd-testgen-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/generate/stream`;
        
        return this.streamRequest(url, streamId, onChunk);
    }

    // Stream test case update
    static async streamTestUpdate(projectId, brdId, message, onChunk) {
        const streamId = `brd-testupdate-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/update/stream`;
        
        return new Promise(async (resolve, reject) => {
            let accumulatedText = '';
            let isComplete = false;
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'text/event-stream',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify({ message })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                this.activeStreams.set(streamId, { reader, response });

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        isComplete = true;
                        this.closeStream(streamId);
                        resolve(accumulatedText);
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6).trim();
                            
                            if (dataStr === '[DONE]') {
                                isComplete = true;
                                this.closeStream(streamId);
                                resolve(accumulatedText);
                                return;
                            }

                            try {
                                const data = JSON.parse(dataStr);
                                
                                if (data.type === 'token' && data.text) {
                                    accumulatedText += data.text;
                                    if (onChunk) onChunk({ text: data.text, data, accumulated: accumulatedText });
                                }
                            } catch (parseError) {
                                if (dataStr.trim()) {
                                    accumulatedText += dataStr;
                                    if (onChunk) onChunk({ text: dataStr, accumulated: accumulatedText });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`BRD Test Update Stream error:`, error);
                this.closeStream(streamId);
                
                if (!isComplete) {
                    reject(error);
                }
            }
        });
    }

    // Close a specific stream
    static closeStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (stream) {
            if (stream.reader) {
                stream.reader.cancel();
            }
            if (stream.response && stream.response.body) {
                stream.response.body.cancel();
            }
            this.activeStreams.delete(streamId);
        }
    }

    // Close all active streams
    static closeAllStreams() {
        this.activeStreams.forEach((stream, streamId) => {
            this.closeStream(streamId);
        });
        this.activeStreams.clear();
    }
}

// Text Formatter for proper content display
class TextFormatter {
    static formatText(text) {
        if (!text) return '';
        
        // Handle completion messages
        if (text.includes('[Analysis complete') || text.includes('[Generation complete')) {
            return `<div class="completion-message">${this.escapeHtml(text)}</div>`;
        }

        let formatted = this.escapeHtml(text);
        
        // Format markdown-like text
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/\n\n+/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        if (formatted && !formatted.includes('<p>') && !formatted.includes('<div>')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        return formatted;
    }

    static escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', 
            '"': '&quot;', "'": '&#039;'
        })[m]);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    StreamingService.closeAllStreams();
    BRDStreamingService.closeAllStreams();
});

// Make services globally available
window.StreamingService = StreamingService;
window.BRDStreamingService = BRDStreamingService;
window.TextFormatter = TextFormatter;