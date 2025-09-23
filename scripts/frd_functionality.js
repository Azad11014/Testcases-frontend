// FRD Functionality - Fixed with proper error handling and formatting
class FRDFunctionality {
    constructor() {
        this.isProcessing = false;
        this.responseCounter = 0;
        this.chatResponses = new Map();
        this.currentFlow = 'idle';
    }

    static init() {
        const instance = new FRDFunctionality();
        instance.bindEvents();
        return instance;
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'analyzeDocBtn' && window.app?.currentDocument?.doctype === 'FRD') {
                e.preventDefault();
                this.handleAnalyze();
            }
            
            if (e.target.id === 'generateTestsBtn') {
                e.preventDefault();
                this.handleGenerateTests();
            }
            
            if (e.target.id === 'chatSubmit') {
                e.preventDefault();
                this.handleChatSubmit();
            }
            
            if (e.target.classList.contains('save-response-btn')) {
                e.preventDefault();
                this.saveResponse(e.target.getAttribute('data-response-id'));
            }
            
            if (e.target.id === 'resetFlowBtn') {
                e.preventDefault();
                this.resetFlow();
            }
        });

        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleChatSubmit();
            }
        });
    }

    async handleAnalyze() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.currentFlow = 'analyzing';
            this.updateButton('analyzeDocBtn', 'Analyzing...', true);
            this.resetFlow();

            const { projectId, documentId } = this.getDocInfo();
            this.showAnalysisSection();

            // Try streaming first, fallback to normal API
            try {
                console.log('Starting FRD analysis stream...');
                let hasReceivedContent = false;
                
                await StreamingService.streamAnalysis(projectId, documentId, (chunk) => {
                    console.log('Analysis chunk received:', chunk);
                    if (chunk.text && chunk.text.trim()) {
                        hasReceivedContent = true;
                        this.updateContent('analysisContent', chunk.text);
                    }
                });
                
                console.log('Analysis streaming completed');
                
                // If no content was received via streaming, try fallback
                if (!hasReceivedContent) {
                    console.log('No content received via streaming, trying fallback API...');
                    const result = await FRDAPI.analyzeDocumentFallback(projectId, documentId);
                    this.displayResult('analysisContent', result);
                }
                
            } catch (streamError) {
                console.warn('Streaming failed, using fallback:', streamError);
                try {
                    const result = await FRDAPI.analyzeDocumentFallback(projectId, documentId);
                    this.displayResult('analysisContent', result);
                } catch (fallbackError) {
                    console.error('Both streaming and fallback failed:', fallbackError);
                    throw fallbackError;
                }
            }

            this.currentFlow = 'analyzed';
            this.showGenerateButton();

        } catch (error) {
            console.error('Analysis error:', error);
            window.app.showError(`Analysis failed: ${error.message}`);
            this.resetFlow();
        } finally {
            this.isProcessing = false;
            this.updateButton('analyzeDocBtn', 'Analyze Document', false);
        }
    }

    async handleGenerateTests() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.currentFlow = 'generating';
            this.updateButton('generateTestsBtn', 'Generating...', true);

            const { projectId, documentId } = this.getDocInfo();
            this.showTestSection();

            // Try streaming first, fallback to normal API
            try {
                console.log('Starting test generation stream...');
                let hasReceivedContent = false;
                
                await StreamingService.streamTestGeneration(projectId, documentId, (chunk) => {
                    console.log('Test gen chunk received:', chunk);
                    
                    if (chunk.text && chunk.text.trim()) {
                        hasReceivedContent = true;
                        this.updateContent('testContent', chunk.text);
                    }
                    
                    // Handle status messages
                    if (chunk.data?.status && !chunk.text) {
                        this.updateStatusMessage('testContent', chunk.data.status);
                    }
                });
                
                if (!hasReceivedContent) {
                    // Try to fetch the generated content directly
                    console.log('No content received via stream, fetching directly...');
                    try {
                        const result = await API.get(`/api/v1/project/${projectId}/documents/${documentId}/testcases`);
                        this.displayResult('testContent', result);
                        hasReceivedContent = true;
                    } catch (fetchError) {
                        console.warn('Direct fetch also failed:', fetchError);
                    }
                }
                
                if (!hasReceivedContent) {
                    throw new Error('No content received from streaming or direct fetch');
                }
                
                console.log('Test generation streaming completed');
            } catch (streamError) {
                console.warn('Streaming failed, using fallback:', streamError);
                const result = await FRDAPI.generateTestCasesFallback(projectId, documentId);
                this.displayResult('testContent', result);
            }

            this.currentFlow = 'generated';
            this.showChatInterface();

        } catch (error) {
            console.error('Test generation error:', error);
            window.app.showError(`Test generation failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('generateTestsBtn', 'Generate Test Cases', false);
        }
    }

    async handleChatSubmit() {
        const input = document.getElementById('chatInput');
        if (!input || this.isProcessing) return;

        const message = input.value.trim();
        if (!message) return;

        try {
            this.isProcessing = true;
            input.disabled = true;
            this.updateButton('chatSubmit', 'Processing...', true);

            this.responseCounter++;
            const responseId = `response-${this.responseCounter}`;
            this.addChatResponse(responseId, message);

            const { projectId, documentId } = this.getDocInfo();

            // Try streaming first, fallback to normal API
            try {
                console.log('Starting chat stream...');
                let responseText = '';
                let hasReceivedContent = false;
                
                await StreamingService.streamChatUpdate(projectId, documentId, message, (chunk) => {
                    console.log('Chat chunk received:', chunk);
                    if (chunk.text && chunk.text.trim()) {
                        responseText += chunk.text;
                        hasReceivedContent = true;
                        this.updateChatResponse(responseId, responseText);
                    }
                });
                
                if (!hasReceivedContent) {
                    throw new Error('No response content received from chat stream');
                }
                
                console.log('Chat streaming completed');
                this.saveChatData(responseId, message, responseText);
            } catch (streamError) {
                console.warn('Chat streaming failed, using fallback:', streamError);
                const result = await FRDAPI.sendChatMessageFallback(projectId, documentId, message);
                const responseText = result.response || result.content || result.text || result.message || 'No response';
                this.updateChatResponse(responseId, responseText);
                this.saveChatData(responseId, message, responseText);
            }

            input.value = '';

        } catch (error) {
            console.error('Chat error:', error);
            this.showChatError(`Failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            input.disabled = false;
            input.focus();
            this.updateButton('chatSubmit', 'Send', false);
        }
    }

    showAnalysisSection() {
        const container = document.getElementById('frdFlowContainer');
        if (container) container.remove();

        const flowHTML = `
            <div id="frdFlowContainer" class="section">
                <div class="flow-step">
                    <div class="step-header">
                        <div class="step-indicator">1</div>
                        <h3>FRD Analysis</h3>
                        <button id="resetFlowBtn" class="btn btn-secondary btn-sm">Reset</button>
                    </div>
                    <div id="analysisContent" class="step-content">
                        <div class="loading">Starting analysis...</div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('step3').insertAdjacentHTML('beforeend', flowHTML);
    }

    showTestSection() {
        const container = document.getElementById('frdFlowContainer');
        if (!container) return;

        const testHTML = `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">2</div>
                    <h3>Test Cases</h3>
                </div>
                <div id="testContent" class="step-content">
                    <div class="loading">Generating test cases...</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', testHTML);
    }

    showChatInterface() {
        const container = document.getElementById('frdFlowContainer');
        if (!container) return;

        const chatHTML = `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">3</div>
                    <h3>Refine Test Cases</h3>
                </div>
                <div class="step-content inline-chat">
                    <div id="chatResponses" class="inline-responses"></div>
                    <div class="chat-input">
                        <textarea id="chatInput" placeholder="e.g., 'Add edge cases for payment validation'" rows="2"></textarea>
                        <button id="chatSubmit" class="btn btn-primary">Send</button>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', chatHTML);
        document.getElementById('chatInput')?.focus();
    }

    showGenerateButton() {
        const analysisStep = document.querySelector('#frdFlowContainer .flow-step');
        if (!analysisStep) return;

        const buttonHTML = `
            <div class="step-actions">
                <button id="generateTestsBtn" class="btn btn-success">Generate Test Cases</button>
            </div>
        `;
        
        analysisStep.insertAdjacentHTML('beforeend', buttonHTML);
    }

    addChatResponse(responseId, userMessage) {
        const container = document.getElementById('chatResponses');
        if (!container) return;

        const responseHTML = `
            <div id="${responseId}" class="inline-response">
                <div class="user-query">
                    <div class="query-icon">👤</div>
                    <div>${this.escapeHtml(userMessage)}</div>
                </div>
                <div class="ai-response">
                    <div class="response-header">
                        <span class="streaming-indicator">🤖</span>
                        <button class="save-response-btn" data-response-id="${responseId}" disabled>Save</button>
                    </div>
                    <div class="response-content">Processing...</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', responseHTML);
        container.scrollTop = container.scrollHeight;
    }

    updateContent(elementId, text) {
        if (!text || !text.trim()) return;
        
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentContent = element.innerHTML;
        
        // Use TextFormatter if available, otherwise fallback to basic formatting
        const formatter = this.getFormatter();
        
        // If it's a loading message, replace it
        if (currentContent.includes('loading') || currentContent.includes('Starting') || currentContent.includes('Processing')) {
            element.innerHTML = formatter.formatText(text);
        } else {
            // Append new text to existing content
            const newContent = formatter.formatText(text);
            element.innerHTML = currentContent + newContent;
        }
        
        element.scrollTop = element.scrollHeight;
    }
    
    updateStatusMessage(elementId, statusText) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Update status messages without replacing content
        const currentContent = element.innerHTML;
        if (currentContent.includes('loading') || currentContent.includes('Starting') || currentContent.includes('Processing')) {
            element.innerHTML = `<div class="status-message">${this.escapeHtml(statusText)}</div>`;
        }
    }

    updateChatResponse(responseId, content) {
        const element = document.getElementById(responseId);
        if (!element) return;

        const contentDiv = element.querySelector('.response-content');
        if (contentDiv) {
            const formatter = this.getFormatter();
            contentDiv.innerHTML = formatter.formatText(content);
        }

        const container = document.getElementById('chatResponses');
        if (container) container.scrollTop = container.scrollHeight;
    }

    displayResult(elementId, result) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const content = result?.analysis || result?.test_cases || result?.content || result?.text || result?.message || 'No content received';
        const formatter = this.getFormatter();
        element.innerHTML = formatter.formatText(content);
    }

    // Get formatter with fallback
    getFormatter() {
        if (window.TextFormatter && typeof window.TextFormatter.formatText === 'function') {
            return window.TextFormatter;
        }
        
        // Fallback formatter
        return {
            formatText: (text) => {
                if (!text) return '';
                const escaped = this.escapeHtml(text);
                
                // Basic markdown formatting
                let formatted = escaped
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
                    .replace(/\n\n+/g, '</p><p>')
                    .replace(/\n/g, '<br>');
                
                if (!formatted.includes('<p>') && !formatted.includes('<div>')) {
                    formatted = `<p>${formatted}</p>`;
                }
                
                return formatted;
            }
        };
    }

    saveChatData(responseId, message, response) {
        this.chatResponses.set(responseId, { message, response, timestamp: new Date() });
        
        const saveBtn = document.querySelector(`[data-response-id="${responseId}"]`);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
        }
    }

    saveResponse(responseId) {
        const data = this.chatResponses.get(responseId);
        if (!data) return;

        const content = `Test Case Chat Response
Generated: ${data.timestamp.toLocaleString()}
Document: ${window.app?.currentDocument?.filename || 'Unknown'}
Project: ${window.app?.currentProject?.name || 'Unknown'}

User Query: ${data.message}

AI Response: ${data.response}

---
Generated by FRD Analysis Tool`;
        
        this.downloadFile(content, `chat_${responseId}_${Date.now()}.txt`);
        
        const saveBtn = document.querySelector(`[data-response-id="${responseId}"]`);
        if (saveBtn) {
            saveBtn.textContent = 'Saved';
            setTimeout(() => {
                if (saveBtn) saveBtn.textContent = 'Save';
            }, 2000);
        }
    }

    showChatError(message) {
        const container = document.getElementById('chatResponses');
        if (!container) return;

        container.insertAdjacentHTML('beforeend', `
            <div class="inline-response">
                <div class="ai-response">
                    <div class="response-content error">${this.escapeHtml(message)}</div>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
    }

    resetFlow() {
        this.currentFlow = 'idle';
        this.chatResponses.clear();
        this.responseCounter = 0;
        
        const container = document.getElementById('frdFlowContainer');
        if (container) container.remove();
    }

    updateButton(buttonId, text, disabled) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.textContent = text;
            btn.disabled = disabled;
        }
    }

    downloadFile(content, fileName) {
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    }

    getDocInfo() {
        if (!window.app?.currentProject || !window.app?.currentDocument) {
            throw new Error('No project or document selected');
        }
        
        return {
            projectId: window.app.currentProject.id,
            documentId: window.app.currentDocument.id
        };
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    if (!window.frdFunctionality) {
        window.frdFunctionality = FRDFunctionality.init();
    }
});