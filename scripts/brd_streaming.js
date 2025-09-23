// BRD Streaming Service - Updated with correct endpoints
class BRDStreamingService {
    static activeStreams = new Map();

    static async stream(url, streamId, onChunk, onComplete, onError) {
        return new Promise((resolve, reject) => {
            this.closeStream(streamId);

            const eventSource = new EventSource(url);
            
            this.activeStreams.set(streamId, eventSource);

            let accumulatedText = '';
            let isComplete = false;
            let hasReceivedData = false;

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
                        hasReceivedData = true;
                        if (onChunk) onChunk({ text: chunk, data });
                    }

                    // Handle status updates
                    if (data?.status) {
                        if (onChunk) onChunk({ text: '', data });
                    }
                } catch (error) {
                    console.error('BRD Stream parse error:', error);
                }
            };

            eventSource.onerror = (error) => {
                console.error('BRD Stream error:', error);
                this.closeStream(streamId);
                
                if (!isComplete) {
                    const errorMsg = new Error(`BRD streaming connection failed: ${error.message || 'Unknown error'}`);
                    if (onError) onError(errorMsg);
                    reject(errorMsg);
                }
            };

            eventSource.onopen = () => {
                console.log(`BRD Stream ${streamId} connected`);
            };

            // Timeout after 5 minutes
            setTimeout(() => {
                if (!isComplete) {
                    this.closeStream(streamId);
                    
                    // If we received some data, consider it a partial success
                    if (hasReceivedData) {
                        console.log('Stream timeout but data was received, resolving...');
                        if (onComplete) onComplete(accumulatedText);
                        resolve(accumulatedText);
                    } else {
                        const timeoutError = new Error('BRD stream timeout - no data received');
                        if (onError) onError(timeoutError);
                        reject(timeoutError);
                    }
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

    // BRD to FRD Conversion Stream - GET endpoint
    static async streamBrdToFrd(projectId, brdId, onChunk, onComplete, onError) {
        const streamId = `brd-to-frd-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/frd/stream`;
        
        try {
            console.log(`Starting BRD to FRD stream: ${url}`);
            return await this.stream(url, streamId, onChunk, onComplete, onError);
        } catch (error) {
            console.warn('BRD to FRD streaming failed:', error);
            throw error;
        }
    }

    // BRD Propose Fix Stream - POST endpoint
    static async streamProposeFix(projectId, brdId, message, onChunk) {
        const streamId = `brd-propose-fix-${projectId}-${brdId}`;
        
        try {
            const postUrl = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/propose-fix/stream`;
            
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
            console.warn('BRD propose fix streaming failed:', error);
            throw error;
        }
    }

    // BRD FRD Update Stream - POST endpoint
    static async streamUpdateFrdBrd(projectId, brdId, message, onChunk) {
        const streamId = `brd-frd-update-${projectId}-${brdId}`;
        
        try {
            const postUrl = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/frd/update/stream`;
            
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
            console.warn('BRD FRD update streaming failed:', error);
            throw error;
        }
    }

    // BRD Test Case Generation Stream - GET endpoint
    static async streamTestGeneration(projectId, brdId, onChunk) {
        const streamId = `brd-testgen-${projectId}-${brdId}`;
        const url = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/generate/stream`;
        
        try {
            console.log(`Starting BRD test generation stream: ${url}`);
            return await this.stream(url, streamId, onChunk);
        } catch (error) {
            console.warn('BRD test generation streaming failed:', error);
            throw error;
        }
    }

    // BRD Test Case Update Stream - POST endpoint
    static async streamTestUpdate(projectId, brdId, message, onChunk) {
        const streamId = `brd-test-update-${projectId}-${brdId}`;
        
        try {
            const postUrl = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/testcases/update/stream`;
            
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
            console.warn('BRD test update streaming failed:', error);
            throw error;
        }
    }

    // Handle streaming response from fetch
    static async handleStreamResponse(response, streamId, onChunk) {
        return new Promise(async (resolve, reject) => {
            let accumulatedText = '';
            let isComplete = false;
            let hasReceivedData = false;

            try {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        isComplete = true;
                        
                        // If we received data, consider it successful
                        if (hasReceivedData) {
                            resolve(accumulatedText);
                        } else {
                            reject(new Error('Stream ended without data'));
                        }
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
                                    hasReceivedData = true;
                                    if (onChunk) onChunk({ text, data: parsed });
                                }
                                
                                // Handle status updates
                                if (parsed?.status) {
                                    if (onChunk) onChunk({ text: '', data: parsed });
                                }
                            } catch (parseError) {
                                // Handle plain text
                                if (data.trim()) {
                                    accumulatedText += data;
                                    hasReceivedData = true;
                                    if (onChunk) onChunk({ text: data });
                                }
                            }
                        } else if (line.trim() && !line.startsWith('event:') && !line.startsWith('id:')) {
                            // Handle lines that don't start with 'data:'
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed?.text || parsed?.content || parsed?.message) {
                                    const text = parsed.text || parsed.content || parsed.message;
                                    accumulatedText += text;
                                    hasReceivedData = true;
                                    if (onChunk) onChunk({ text, data: parsed });
                                }
                            } catch (parseError) {
                                // Treat as plain text if it's not empty
                                if (line.trim()) {
                                    accumulatedText += line;
                                    hasReceivedData = true;
                                    if (onChunk) onChunk({ text: line });
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('BRD Stream read error:', error);
                if (!isComplete) {
                    reject(error);
                }
            }
        });
    }

    // Enhanced error handling with retry logic
    static async streamWithRetry(url, streamId, onChunk, onComplete, onError, maxRetries = 2) {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Stream attempt ${attempt + 1}/${maxRetries + 1} for ${streamId}`);
                return await this.stream(url, streamId, onChunk, onComplete, onError);
            } catch (error) {
                lastError = error;
                console.warn(`Stream attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`All ${maxRetries + 1} stream attempts failed for ${streamId}`);
                    throw lastError;
                }
            }
        }
    }

    // Test streaming availability
    static async testStreamingAvailability(projectId, brdId) {
        try {
            const testUrl = `${API_BASE}/api/v1/project/${projectId}/brd/${brdId}/frd/stream`;
            const response = await fetch(testUrl, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.log('Streaming test failed:', error.message);
            return false;
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    BRDStreamingService.closeAllStreams();
});

window.BRDStreamingService = BRDStreamingService;