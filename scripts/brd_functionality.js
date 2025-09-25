// Enhanced BRD Functionality - Fixed with correct endpoint routing
class BRDFunctionality {
    constructor() {
        this.isProcessing = false;
        this.currentVersionId = 0;
        this.testVersions = new Map();
        this.currentTestVersion = 1;
        this.chatVersions = new Map();
        this.currentChatVersion = 1;
        this.selectedIssues = new Set();
        this.analysisData = null;
        this.detectedIssues = [];
    }

    static init() {
        const instance = new BRDFunctionality();
        instance.bindEvents();
        return instance;
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const { id, classList } = e.target;
            const handlers = {
                'convertBrdBtn': () => this.handleBrdToFrdConversion(),
                'generateBrdTestsBtn': () => this.handleGenerateTestCases(),
                'chatSubmit': () => this.handleChatSubmit(),
                'resetFlowBtn': () => this.resetFlow()
            };

            if (handlers[id]) {
                e.preventDefault();
                handlers[id]();
            } else if (classList.contains('version-nav')) {
                this.handleVersionNavigation(e.target);
            } else if (id.startsWith('downloadTestVersion')) {
                e.preventDefault();
                this.handleDownloadTestVersion(e.target);
            }
        });

        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleChatSubmit();
            }
        });
    }

    // Step 1: Convert BRD to FRD with streaming
    async handleBrdToFrdConversion() {
        if (this.isProcessing) return;
        await this.executeStep('converting', 'convertBrdBtn', 'Converting...', async () => {
            const { projectId, documentId } = this.getDocInfo();
            this.showFlowSection(1, 'BRD to FRD Conversion', 'brdConversionContent');
            
            await this.streamWithFallback(
                async () => {
                    if (!window.BRDStreamingService) {
                        throw new Error('BRDStreamingService not available');
                    }
                    return await BRDStreamingService.streamBrdToFrd(
                        projectId, 
                        documentId, 
                        (chunk) => this.updateStreamContent('brdConversionContent', chunk),
                        (content) => console.log('BRD conversion completed:', content)
                    );
                },
                async () => {
                    console.log('Using BRDAPI fallback for conversion');
                    return await BRDAPI.convertBrdToFrd(projectId, documentId);
                },
                'brdConversionContent'
            );
            
            this.showActionButton(1, 'generateBrdTestsBtn', 'Generate Test Cases', 'Test', 'btn-success');
        });
    }

    // Step 2: Generate test cases with streaming and versioning (FRD-style)
    async handleGenerateTestCases() {
        if (this.isProcessing) return;
        await this.executeStep('generating', 'generateBrdTestsBtn', 'Generating Tests...', async () => {
            const { projectId, documentId } = this.getDocInfo();
            this.showFlowSection(2, 'Test Cases', 'testContent');
            
            let testContent = '';
            try {
                if (window.BRDStreamingService) {
                    console.log('Using BRD streaming for test generation');
                    testContent = await this.streamTestGeneration(projectId, documentId);
                } else {
                    throw new Error('BRDStreamingService not available');
                }
            } catch (streamError) {
                console.warn('Test streaming failed, using fallback:', streamError);
                const result = await BRDAPI.generateTestCases(projectId, documentId);
                testContent = this.extractContent(result);
            }
            
            this.displayTestResults(testContent, 1);
            this.showChatInterface();
        });
    }

    // Step 3: Chat update with versioning (FRD-style) - FIXED
    async handleChatSubmit() {
        const input = document.getElementById('chatInput');
        if (!input || this.isProcessing) return;

        const message = input.value.trim();
        if (!message) return;

        try {
            this.isProcessing = true;
            input.disabled = true;
            this.updateButton('chatSubmit', 'Processing...', true);
            input.value = '';

            this.currentChatVersion++;
            const versionId = this.currentChatVersion;
            this.addChatMessage(message, versionId);

            const { projectId, documentId } = this.getDocInfo();
            
            let responseContent = '';
            try {
                if (window.BRDStreamingService) {
                    console.log('Using BRD streaming for test update');
                    await BRDStreamingService.streamTestUpdate(projectId, documentId, message, (chunk) => {
                        if (chunk.text) {
                            responseContent += chunk.text;
                            this.updateChatResponse(versionId, responseContent, true);
                        }
                    });
                } else {
                    throw new Error('BRDStreamingService not available');
                }
            } catch (streamError) {
                console.warn('Chat streaming failed, using fallback:', streamError);
                const result = await BRDAPI.updateTestCases(projectId, documentId, message);
                responseContent = this.extractContent(result);
                this.updateChatResponse(versionId, responseContent, false);
            }

            // Generate new test version based on chat interaction
            await this.generateUpdatedTestCases(responseContent, versionId);

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

    // Core execution wrapper
    async executeStep(flow, buttonId, loadingText, stepFunction) {
        try {
            this.isProcessing = true;
            this.updateButton(buttonId, loadingText, true);
            await stepFunction();
        } catch (error) {
            console.error(`${flow} error:`, error);
            window.app?.showError(`${flow} failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton(buttonId, buttonId.replace('Btn', '').replace(/([A-Z])/g, ' $1'), false);
        }
    }

    // Unified streaming with fallback - ENHANCED
    async streamWithFallback(streamFunc, fallbackFunc, elementId) {
        try {
            console.log('Attempting streaming operation...');
            return await streamFunc();
        } catch (streamError) {
            console.warn('Streaming failed, using fallback:', streamError);
            
            try {
                const result = await fallbackFunc();
                this.displayResult(elementId, result);
                return result;
            } catch (fallbackError) {
                console.error('Both streaming and fallback failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    // Test streaming with versioning - FIXED
    async streamTestGeneration(projectId, documentId) {
        const element = document.getElementById('testContent');
        let accumulatedContent = '';
        const versionId = this.currentTestVersion;

        element.innerHTML = this.createTestVersionHTML(versionId, 'Generating test cases...');

        try {
            await BRDStreamingService.streamTestGeneration(projectId, documentId, (chunk) => {
                if (chunk.text) {
                    accumulatedContent += chunk.text;
                    this.updateTestStreamContent(accumulatedContent);
                }
            });
        } catch (error) {
            console.error('Stream test generation error:', error);
            throw error;
        }

        this.testVersions.set(versionId, {
            content: accumulatedContent,
            timestamp: new Date().toISOString(),
            downloaded: false
        });

        return accumulatedContent;
    }

    // Generate updated test cases from chat
    async generateUpdatedTestCases(chatResponse, chatVersion) {
        const newTestVersion = Math.max(...Array.from(this.testVersions.keys())) + 1;
        this.currentTestVersion = newTestVersion;

        this.testVersions.set(newTestVersion, {
            content: chatResponse,
            timestamp: new Date().toISOString(),
            downloaded: false,
            basedOnChat: chatVersion
        });

        this.displayTestVersion(newTestVersion);
    }

    // Version navigation
    handleVersionNavigation(button) {
        const { id, classList } = button;
        
        if (id === 'prevTestVersion' || id === 'nextTestVersion') {
            this.navigateTestVersion(id === 'nextTestVersion');
        } else if (classList.contains('chat-prev') || classList.contains('chat-next')) {
            const versionId = parseInt(button.dataset.version);
            this.navigateChatVersion(versionId, classList.contains('chat-next'));
        }
    }

    navigateTestVersion(isNext) {
        const totalVersions = this.testVersions.size;
        if (totalVersions <= 1) return;

        if (isNext && this.currentTestVersion < totalVersions) {
            this.currentTestVersion++;
        } else if (!isNext && this.currentTestVersion > 1) {
            this.currentTestVersion--;
        }

        this.displayTestVersion(this.currentTestVersion);
    }

    // Download functionality
    handleDownloadTestVersion(button) {
        const versionId = parseInt(button.id.replace('downloadTestVersion', ''));
        const versionData = this.testVersions.get(versionId);
        
        if (versionData) {
            this.downloadTestCasesAsTxt(versionData.content, versionId);
            versionData.downloaded = true;
            button.innerHTML = '<span class="btn-icon">✓</span>Downloaded';
            button.disabled = true;
            button.className = button.className.replace('btn-success', 'btn-secondary');
        }
    }

    downloadTestCasesAsTxt(content, version) {
        const { projectName, documentName } = this.getDocInfo();
        const filename = `${projectName}_${documentName}_BRD_testcase${version}.txt`;
        const timestamp = new Date().toLocaleString();
        
        const txtContent = `BRD TEST CASES
==============

Project: ${projectName}
Document: ${documentName}  
Version: ${version}
Generated: ${timestamp}

${'='.repeat(50)}

${content}

${'='.repeat(50)}
End of BRD Test Cases Document`;

        const blob = new Blob([txtContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // UI Display Methods
    showFlowSection(stepNum, title, contentId) {
        if (stepNum === 1) this.initFlowContainer();
        
        const container = document.getElementById('brdFlowContainer');
        container.insertAdjacentHTML('beforeend', `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">${stepNum}</div>
                    <h3>${title}</h3>
                    ${stepNum === 1 ? '<button id="resetFlowBtn" class="btn btn-secondary btn-sm">Reset</button>' : ''}
                </div>
                <div id="${contentId}" class="step-content">
                    <div class="loading">Processing...</div>
                </div>
            </div>
        `);
    }

    showActionButton(stepNum, buttonId, text, icon, className, disabled = false) {
        const step = document.querySelector(`#brdFlowContainer .flow-step:nth-child(${stepNum})`);
        if (!step) return;
        
        step.insertAdjacentHTML('beforeend', `
            <div class="step-actions">
                <button id="${buttonId}" class="btn ${className}" ${disabled ? 'disabled' : ''}>
                    <span class="btn-icon">${icon}</span>
                    ${text}
                </button>
            </div>
        `);
    }

    showChatInterface() {
        const testStep = document.querySelector('#brdFlowContainer .flow-step:last-child');
        testStep.querySelector('.step-content').insertAdjacentHTML('beforeend', `
            <div class="chat-interface">
                <div class="chat-header">
                    <h4>Refine Test Cases</h4>
                    <p>Request modifications or improvements</p>
                </div>
                <div id="chatResponses" class="chat-responses-container"></div>
                <div class="chat-input-container">
                    <div class="chat-input">
                        <textarea id="chatInput" placeholder="e.g., 'Add edge cases for payment validation'" rows="2"></textarea>
                        <button id="chatSubmit" class="btn btn-primary">Send</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('chatInput')?.focus();
    }

    // Chat message handling
    addChatMessage(userMessage, versionId) {
        const container = document.getElementById('chatResponses');
        if (!container) return;

        container.insertAdjacentHTML('beforeend', `
            <div id="chatMessage-${versionId}" class="chat-exchange">
                <div class="user-message">
                    <div class="message-header">You:</div>
                    <div class="message-content">${this.escapeHtml(userMessage)}</div>
                </div>
                <div class="ai-message">
                    <div class="message-header">
                        AI:
                        <div class="version-controls">
                            <button class="version-nav chat-prev" data-version="${versionId}" disabled>&lt;</button>
                            <span class="version-info">V${versionId}</span>
                            <button class="version-nav chat-next" data-version="${versionId}" disabled>&gt;</button>
                        </div>
                    </div>
                    <div class="message-content" id="aiResponse-${versionId}">
                        <div class="streaming-indicator">Generating response...</div>
                    </div>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
    }

    updateChatResponse(versionId, content, isStreaming = false) {
        const responseDiv = document.getElementById(`aiResponse-${versionId}`);
        if (!responseDiv) return;

        responseDiv.innerHTML = `<pre class="${isStreaming ? 'streaming-response' : ''}">${this.escapeHtml(content)}</pre>`;
        document.getElementById('chatResponses')?.scrollBy(0, 1000);
    }

    // Test version display
    displayTestResults(testContent, versionId) {
        this.testVersions.set(versionId, {
            content: testContent,
            timestamp: new Date().toISOString(),
            downloaded: false
        });
        
        const element = document.getElementById('testContent');
        element.innerHTML = this.createTestVersionHTML(versionId, null, testContent);
    }

    displayTestVersion(versionId) {
        const versionData = this.testVersions.get(versionId);
        if (!versionData) return;
        
        const element = document.getElementById('testContent');
        element.innerHTML = this.createTestVersionHTML(versionId, null, versionData.content, versionData.downloaded);
    }

    createTestVersionHTML(versionId, loadingText, content, downloaded = false) {
        const totalVersions = this.testVersions.size;
        return `
            <div class="test-generation-stream">
                <div class="stream-header">
                    <h4>Generated Test Cases</h4>
                    <div class="version-controls">
                        <button class="version-nav" id="prevTestVersion" ${this.currentTestVersion <= 1 ? 'disabled' : ''}>&lt;</button>
                        <span class="version-info">Version ${versionId}</span>
                        <button class="version-nav" id="nextTestVersion" ${this.currentTestVersion >= totalVersions ? 'disabled' : ''}>&gt;</button>
                    </div>
                </div>
                <div class="stream-content">
                    <div class="streaming-text">
                        ${loadingText ? `<div class="loading">${loadingText}</div>` : `<pre>${this.escapeHtml(content)}</pre>`}
                    </div>
                </div>
                <div class="stream-actions" ${loadingText ? 'style="display: none;"' : ''}>
                    <button id="downloadTestVersion${versionId}" class="btn ${downloaded ? 'btn-secondary' : 'btn-success'} btn-sm" ${downloaded ? 'disabled' : ''}>
                        <span class="btn-icon">${downloaded ? '✓' : 'Download'}</span>
                        ${downloaded ? 'Downloaded' : `Download Test Cases V${versionId}`}
                    </button>
                </div>
            </div>
        `;
    }

    updateTestStreamContent(content) {
        const streamingText = document.querySelector('.streaming-text');
        if (streamingText) {
            streamingText.innerHTML = `<pre>${this.escapeHtml(content)}</pre>`;
            streamingText.scrollTop = streamingText.scrollHeight;
        }
    }

    // Content update methods
    updateStreamContent(elementId, chunk) {
        if (!chunk?.text?.trim()) return;
        
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentContent = element.innerHTML;
        if (currentContent.includes('loading') || currentContent.includes('Processing')) {
            element.innerHTML = `<pre>${this.escapeHtml(chunk.text)}</pre>`;
        } else {
            const pre = element.querySelector('pre');
            if (pre) pre.textContent += chunk.text;
        }
        
        element.scrollTop = element.scrollHeight;
    }

    displayResult(elementId, result, title = '') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const content = this.extractContent(result);
        element.innerHTML = `<pre>${this.escapeHtml(content)}</pre>`;
    }

    extractContent(result) {
        if (typeof result === 'string') return result;
        if (typeof result === 'object') {
            return result?.frd_content || result?.analysis || result?.test_cases || 
                   result?.content || result?.text || result?.message || result?.response ||
                   JSON.stringify(result, null, 2);
        }
        return 'No content available';
    }

    showChatError(message) {
        const container = document.getElementById('chatResponses');
        if (container) {
            container.insertAdjacentHTML('beforeend', `
                <div class="chat-exchange error">
                    <div class="error-message">${this.escapeHtml(message)}</div>
                </div>
            `);
            container.scrollTop = container.scrollHeight;
        }
    }

    // Utility methods
    initFlowContainer() {
        const container = document.getElementById('brdFlowContainer');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'block';
        }
    }

    resetFlow() {
        this.currentVersionId = 0;
        this.testVersions.clear();
        this.currentTestVersion = 1;
        this.chatVersions.clear();
        this.currentChatVersion = 1;
        this.selectedIssues.clear();
        this.analysisData = null;
        this.detectedIssues = [];
        
        const container = document.getElementById('brdFlowContainer');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    }

    updateButton(buttonId, text, disabled) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.textContent = text;
            btn.disabled = disabled;
        }
    }

    getDocInfo() {
        const { currentProject, currentDocument } = window.app || {};
        if (!currentProject || !currentDocument) {
            throw new Error('No project or document selected');
        }
        return { 
            projectId: currentProject.id, 
            documentId: currentDocument.id,
            projectName: currentProject.name || 'Project',
            documentName: currentDocument.name || 'Document'
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
    if (!window.brdFunctionality) {
        window.brdFunctionality = BRDFunctionality.init();
    }
});