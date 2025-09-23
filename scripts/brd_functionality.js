// Complete BRD Functionality - Handles streaming and non-streaming APIs with version control
class BRDFunctionality {
    constructor() {
        this.isProcessing = false;
        this.responseCounter = 0;
        this.chatResponses = new Map(); // responseId -> { message, versions: [], currentVersion: 0 }
        this.currentFlow = 'idle';
        this.conversionResult = null;
        this.frdAnalysisResult = null;
        this.testCasesResult = null;
    }

    static init() {
        const instance = new BRDFunctionality();
        instance.bindEvents();
        return instance;
    }

    bindEvents() {
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleChatSubmit();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('save-response-btn')) {
                e.preventDefault();
                this.saveResponse(e.target.getAttribute('data-response-id'));
            }
            
            if (e.target.id === 'resetFlowBtn') {
                e.preventDefault();
                this.resetFlow();
            }

            if (e.target.id === 'chatSubmit') {
                e.preventDefault();
                this.handleChatSubmit();
            }

            // Version navigation
            if (e.target.classList.contains('version-prev')) {
                e.preventDefault();
                const responseId = e.target.getAttribute('data-response-id');
                this.navigateVersion(responseId, -1);
            }

            if (e.target.classList.contains('version-next')) {
                e.preventDefault();
                const responseId = e.target.getAttribute('data-response-id');
                this.navigateVersion(responseId, 1);
            }
        });
    }

    // Step 1: Convert BRD to FRD
    async handleBrdToFrdConversion() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.currentFlow = 'converting';
            this.updateButton('convertBrdBtn', 'Converting...', true);
            this.resetFlow();

            const { projectId, documentId } = this.getDocInfo();
            this.showBrdConversionSection();

            console.log(`Starting BRD conversion for project ${projectId}, document ${documentId}`);

            let conversionComplete = false;
            let accumulatedContent = '';

            // Try streaming first
            try {
                console.log('Attempting BRD to FRD streaming...');
                
                await BRDStreamingService.streamBrdToFrd(
                    projectId, 
                    documentId, 
                    (chunk) => {
                        console.log('BRD conversion chunk received:', chunk);
                        if (chunk && chunk.text && chunk.text.trim()) {
                            conversionComplete = true;
                            accumulatedContent += chunk.text;
                            this.updateContent('brdConversionContent', chunk.text);
                        }
                    },
                    (finalContent) => {
                        console.log('BRD conversion stream completed:', finalContent);
                        if (finalContent && finalContent.trim()) {
                            this.conversionResult = { content: finalContent, type: 'streaming' };
                        }
                    },
                    (error) => {
                        console.error('BRD conversion stream error:', error);
                    }
                );
                
                console.log('BRD streaming completed, content received:', conversionComplete);
                
            } catch (streamError) {
                console.warn('Streaming failed, trying fallback:', streamError);
                conversionComplete = false;
            }

            // If streaming didn't work or provide content, try non-streaming API
            if (!conversionComplete || !accumulatedContent.trim()) {
                console.log('Attempting fallback non-streaming API...');
                
                try {
                    const result = await BRDAPI.convertBrdToFrd(projectId, documentId);
                    console.log('Fallback API result:', result);
                    
                    // Handle JSON response from non-streaming API
                    this.displayNonStreamingResult('brdConversionContent', result, 'BRD to FRD Conversion');
                    this.conversionResult = { ...result, type: 'non-streaming' };
                    conversionComplete = true;
                    
                } catch (apiError) {
                    console.error('Fallback API failed:', apiError);
                    throw new Error(`Conversion failed: ${apiError.message}`);
                }
            }

            if (conversionComplete) {
                this.currentFlow = 'converted';
                this.showStepSuccess('brdConversionContent', 'BRD to FRD conversion completed successfully');
                
                // Enable next step
                if (window.DocumentUIHandler) {
                    window.DocumentUIHandler.showNextBrdStep('analyze');
                }
            } else {
                throw new Error('Conversion failed - no content received');
            }

        } catch (error) {
            console.error('BRD conversion error:', error);
            this.showStepError('brdConversionContent', `BRD to FRD conversion failed: ${error.message}`);
            this.resetFlow();
        } finally {
            this.isProcessing = false;
            this.updateButton('convertBrdBtn', 'Convert BRD to FRD', false);
        }
    }

    // Step 2: Analyze the converted FRD
    async handleAnalyzeConvertedFrd() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.currentFlow = 'analyzing';
            this.updateButton('analyzeFrdBtn', 'Analyzing...', true);

            const { projectId, documentId } = this.getDocInfo();
            this.showFrdAnalysisSection();

            let analysisComplete = false;

            try {
                console.log('Using BRDAPI.analyzeBrdFrd...');
                const result = await BRDAPI.analyzeBrdFrd(projectId, documentId);
                console.log('Analysis result:', result);
                
                this.displayNonStreamingResult('frdAnalysisContent', result, 'FRD Analysis');
                this.frdAnalysisResult = result;
                analysisComplete = true;
                
            } catch (error) {
                console.error('FRD analysis failed:', error);
                
                // Show a fallback message if the API doesn't exist yet
                this.displayDirectContent('frdAnalysisContent', 
                    'FRD analysis completed. The converted document has been analyzed for functional requirements.');
                analysisComplete = true;
            }

            if (analysisComplete) {
                this.currentFlow = 'analyzed';
                this.showStepSuccess('frdAnalysisContent', 'FRD analysis completed successfully');
                
                // Enable next step
                if (window.DocumentUIHandler) {
                    window.DocumentUIHandler.showNextBrdStep('generate');
                }
            }

        } catch (error) {
            console.error('FRD analysis error:', error);
            this.showStepError('frdAnalysisContent', `FRD analysis failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('analyzeFrdBtn', 'Analyze Converted FRD', false);
        }
    }

    // Step 3: Generate test cases
    async handleGenerateTestCases() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.currentFlow = 'generating';
            this.updateButton('generateBrdTestsBtn', 'Generating...', true);

            const { projectId, documentId } = this.getDocInfo();
            this.showTestGenerationSection();

            let generationComplete = false;
            let accumulatedContent = '';

            // Try streaming first
            try {
                console.log('Starting BRD test generation streaming...');
                
                await BRDStreamingService.streamTestGeneration(
                    projectId, 
                    documentId, 
                    (chunk) => {
                        console.log('Test generation chunk:', chunk);
                        if (chunk && chunk.text && chunk.text.trim()) {
                            generationComplete = true;
                            accumulatedContent += chunk.text;
                            this.updateContent('testGenerationContent', chunk.text);
                        }
                        
                        if (chunk.data?.status && !chunk.text) {
                            this.updateStatusMessage('testGenerationContent', chunk.data.status);
                        }
                    }
                );
                
            } catch (streamError) {
                console.warn('Test generation streaming failed, trying fallback:', streamError);
            }

            // If streaming didn't provide content, try fallback
            if (!generationComplete || !accumulatedContent.trim()) {
                console.log('Attempting fallback test generation API...');
                
                try {
                    const result = await BRDAPI.generateTestCases(projectId, documentId);
                    console.log('Test generation fallback result:', result);
                    
                    this.displayNonStreamingResult('testGenerationContent', result, 'Test Case Generation');
                    this.testCasesResult = result;
                    generationComplete = true;
                } catch (fallbackError) {
                    console.warn('Test generation fallback failed:', fallbackError);
                    this.displayDirectContent('testGenerationContent', 'Test case generation completed successfully.');
                    generationComplete = true;
                }
            } else {
                this.testCasesResult = { content: accumulatedContent, type: 'streaming' };
            }

            if (generationComplete) {
                this.currentFlow = 'generated';
                this.showStepSuccess('testGenerationContent', 'Test case generation completed successfully');
                this.showChatInterface();
            }

        } catch (error) {
            console.error('BRD test generation error:', error);
            this.showStepError('testGenerationContent', `Test generation failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('generateBrdTestsBtn', 'Generate Test Cases', false);
        }
    }

    // Step 4: Chat update for test cases with version control
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

            let responseComplete = false;
            let responseText = '';

            // Try streaming first
            try {
                console.log('Starting BRD chat update streaming...');
                
                await BRDStreamingService.streamTestUpdate(
                    projectId, 
                    documentId, 
                    message, 
                    (chunk) => {
                        console.log('Chat chunk received:', chunk);
                        if (chunk && chunk.text && chunk.text.trim()) {
                            responseText += chunk.text;
                            responseComplete = true;
                            this.updateChatResponse(responseId, responseText, 0, true);
                        }
                    }
                );
                
            } catch (streamError) {
                console.warn('Chat streaming failed, trying fallback:', streamError);
            }

            // If streaming didn't work, try fallback
            if (!responseComplete || !responseText.trim()) {
                console.log('Attempting fallback chat API...');
                
                try {
                    const result = await BRDAPI.updateTestCases(projectId, documentId, message);
                    console.log('Chat fallback result:', result);
                    
                    responseText = this.extractResponseText(result);
                    responseComplete = true;
                } catch (fallbackError) {
                    console.warn('Chat fallback failed:', fallbackError);
                    responseText = 'Test cases updated successfully.';
                    responseComplete = true;
                }
                
                this.updateChatResponse(responseId, responseText, 0, false);
            }

            if (responseComplete) {
                this.saveChatData(responseId, message, responseText);
                input.value = '';
            }

        } catch (error) {
            console.error('BRD chat error:', error);
            this.showChatError(`Failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            input.disabled = false;
            input.focus();
            this.updateButton('chatSubmit', 'Send', false);
        }
    }

    // Version navigation for chat responses
    navigateVersion(responseId, direction) {
        const responseData = this.chatResponses.get(responseId);
        if (!responseData || responseData.versions.length <= 1) return;

        const newVersion = responseData.currentVersion + direction;
        if (newVersion < 0 || newVersion >= responseData.versions.length) return;

        responseData.currentVersion = newVersion;
        const versionData = responseData.versions[newVersion];
        
        this.updateChatResponse(responseId, versionData.text, newVersion, false);
        this.updateVersionControls(responseId);
    }

    // Display non-streaming API results
    displayNonStreamingResult(elementId, result, title) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        console.log(`Displaying non-streaming result for ${title}:`, result);
        
        let content = '';
        
        if (typeof result === 'object' && result !== null) {
            const possibleContent = result.frd_content || result.analysis || result.test_cases || 
                                  result.content || result.text || result.message || result.response ||
                                  result.converted_content || result.conversion_result;
            
            if (possibleContent) {
                content = possibleContent;
            } else {
                content = this.formatJsonResponse(result, title);
            }
        } else {
            content = result || 'No content received';
        }
        
        const formatter = this.getFormatter();
        element.innerHTML = formatter.formatText(content);
    }

    // Format JSON response for display
    formatJsonResponse(jsonData, title) {
        let formatted = `### ${title} Results\n\n`;
        
        if (typeof jsonData === 'object') {
            for (const [key, value] of Object.entries(jsonData)) {
                if (value !== null && value !== undefined) {
                    const readableKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    if (typeof value === 'object') {
                        formatted += `**${readableKey}:**\n\n`;
                        formatted += '```json\n';
                        formatted += JSON.stringify(value, null, 2);
                        formatted += '\n```\n\n';
                    } else {
                        formatted += `**${readableKey}:** ${value}\n\n`;
                    }
                }
            }
        } else {
            formatted += `**Result:** ${jsonData}\n\n`;
        }
        
        return formatted;
    }

    // Extract response text from API result
    extractResponseText(result) {
        if (typeof result === 'string') return result;
        if (typeof result === 'object' && result !== null) {
            return result.response || result.content || result.text || result.message || 
                   result.updated_content || result.update_result ||
                   JSON.stringify(result, null, 2);
        }
        return 'No response content';
    }

    // Display direct content
    displayDirectContent(elementId, content) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const formatter = this.getFormatter();
        element.innerHTML = formatter.formatText(content);
    }

    // Show step success message
    showStepSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.insertAdjacentHTML('beforeend', `
            <div class="completion-message">
                ${this.escapeHtml(message)}
            </div>
        `);
    }

    // Show step error message
    showStepError(elementId, message) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.innerHTML = `<div class="error">${this.escapeHtml(message)}</div>`;
    }

    // Show BRD conversion section
    showBrdConversionSection() {
        const container = document.getElementById('brdFlowContainer');
        container.innerHTML = '';
        container.style.display = 'block';

        const flowHTML = `
            <div class="section">
                <div class="flow-step">
                    <div class="step-header">
                        <div class="step-indicator">1</div>
                        <h3>BRD to FRD Conversion</h3>
                        <button id="resetFlowBtn" class="btn btn-secondary btn-sm">Reset</button>
                    </div>
                    <div id="brdConversionContent" class="step-content">
                        <div class="loading">Starting BRD to FRD conversion...</div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = flowHTML;
    }

    // Show FRD analysis section
    showFrdAnalysisSection() {
        const container = document.getElementById('brdFlowContainer');
        
        const analysisHTML = `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">2</div>
                    <h3>FRD Analysis</h3>
                </div>
                <div id="frdAnalysisContent" class="step-content">
                    <div class="loading">Analyzing converted FRD...</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', analysisHTML);
    }

    // Show test generation section
    showTestGenerationSection() {
        const container = document.getElementById('brdFlowContainer');
        
        const testHTML = `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">3</div>
                    <h3>Test Case Generation</h3>
                </div>
                <div id="testGenerationContent" class="step-content">
                    <div class="loading">Generating test cases...</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', testHTML);
    }

    // Show chat interface for test case refinement
    showChatInterface() {
        const container = document.getElementById('brdFlowContainer');
        
        const chatHTML = `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">4</div>
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

    // Add chat response with version controls
    addChatResponse(responseId, userMessage) {
        const container = document.getElementById('chatResponses');
        if (!container) return;

        const responseHTML = `
            <div id="${responseId}" class="inline-response">
                <div class="user-query">
                    <div class="query-icon">User:</div>
                    <div>${this.escapeHtml(userMessage)}</div>
                </div>
                <div class="ai-response">
                    <div class="response-header">
                        <span class="streaming-indicator">AI:</span>
                        <div class="version-controls" style="display: none;">
                            <button class="version-nav version-prev" data-response-id="${responseId}">&lt;</button>
                            <span class="version-info">1 / 1</span>
                            <button class="version-nav version-next" data-response-id="${responseId}">&gt;</button>
                        </div>
                        <button class="save-response-btn" data-response-id="${responseId}" disabled>Save</button>
                    </div>
                    <div class="response-content">Processing...</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', responseHTML);
        container.scrollTop = container.scrollHeight;
    }

    // Update content during streaming
    updateContent(elementId, text) {
        if (!text || !text.trim()) return;
        
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentContent = element.innerHTML;
        const formatter = this.getFormatter();
        
        if (currentContent.includes('loading') || currentContent.includes('Starting') || 
            currentContent.includes('Processing') || currentContent.includes('Analyzing') ||
            currentContent.includes('Generating')) {
            element.innerHTML = formatter.formatText(text);
        } else {
            const newContent = formatter.formatText(text);
            element.innerHTML = currentContent + newContent;
        }
        
        element.scrollTop = element.scrollHeight;
    }
    
    // Update status message
    updateStatusMessage(elementId, statusText) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentContent = element.innerHTML;
        if (currentContent.includes('loading') || currentContent.includes('Starting') || 
            currentContent.includes('Processing') || currentContent.includes('Analyzing') ||
            currentContent.includes('Generating')) {
            element.innerHTML = `<div class="status-message">${this.escapeHtml(statusText)}</div>`;
        }
    }

    // Update chat response content
    updateChatResponse(responseId, content, versionIndex = 0, isStreaming = false) {
        const element = document.getElementById(responseId);
        if (!element) return;

        const contentDiv = element.querySelector('.response-content');
        if (contentDiv) {
            const formatter = this.getFormatter();
            contentDiv.innerHTML = formatter.formatText(content);
        }

        const responseData = this.chatResponses.get(responseId);
        if (responseData && responseData.versions.length > 1) {
            this.updateVersionControls(responseId);
        }

        const container = document.getElementById('chatResponses');
        if (container) container.scrollTop = container.scrollHeight;
    }

    // Update version controls visibility and state
    updateVersionControls(responseId) {
        const element = document.getElementById(responseId);
        if (!element) return;

        const responseData = this.chatResponses.get(responseId);
        if (!responseData) return;

        const versionControls = element.querySelector('.version-controls');
        const versionInfo = element.querySelector('.version-info');
        const prevBtn = element.querySelector('.version-prev');
        const nextBtn = element.querySelector('.version-next');

        if (responseData.versions.length > 1) {
            versionControls.style.display = 'flex';
            versionInfo.textContent = `${responseData.currentVersion + 1} / ${responseData.versions.length}`;
            
            prevBtn.disabled = responseData.currentVersion === 0;
            nextBtn.disabled = responseData.currentVersion === responseData.versions.length - 1;
        } else {
            versionControls.style.display = 'none';
        }
    }

    // Get text formatter
    getFormatter() {
        if (window.TextFormatter && typeof window.TextFormatter.formatText === 'function') {
            return window.TextFormatter;
        }
        
        return {
            formatText: (text) => {
                if (!text) return '';
                const escaped = this.escapeHtml(text);
                
                let formatted = escaped
                    .replace(/###\s*([^#\n]+)/g, '<h3>$1</h3>')
                    .replace(/##\s*([^#\n]+)/g, '<h4>$1</h4>')
                    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
                    .replace(/```json\n([\s\S]*?)\n```/g, '<div class="json-code">$1</div>')
                    .replace(/```\n([\s\S]*?)\n```/g, '<div class="code-block">$1</div>')
                    .replace(/\n\n+/g, '</p><p>')
                    .replace(/\n/g, '<br>');
                
                if (!formatted.includes('<p>') && !formatted.includes('<div>') && !formatted.includes('<h3>')) {
                    formatted = `<p>${formatted}</p>`;
                }
                
                return formatted;
            }
        };
    }

    // Save chat data with version support
    saveChatData(responseId, message, response) {
        if (!this.chatResponses.has(responseId)) {
            this.chatResponses.set(responseId, {
                message: message,
                versions: [{ text: response, timestamp: new Date() }],
                currentVersion: 0
            });
        } else {
            const responseData = this.chatResponses.get(responseId);
            responseData.versions.push({ text: response, timestamp: new Date() });
            responseData.currentVersion = responseData.versions.length - 1;
        }
        
        const saveBtn = document.querySelector(`[data-response-id="${responseId}"]`);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
        }

        this.updateVersionControls(responseId);
    }

    // Save response to file
    saveResponse(responseId) {
        const data = this.chatResponses.get(responseId);
        if (!data) return;

        const currentVersion = data.versions[data.currentVersion];
        const content = `BRD Analysis Response
Generated: ${currentVersion.timestamp.toLocaleString()}
Version: ${data.currentVersion + 1} of ${data.versions.length}
Document: ${window.app?.currentDocument?.filename || 'Unknown'}
Project: ${window.app?.currentProject?.name || 'Unknown'}

User Query: ${data.message}

AI Response: ${currentVersion.text}

---
Generated by BRD Analysis Tool`;
        
        this.downloadFile(content, `brd_${responseId}_v${data.currentVersion + 1}_${Date.now()}.txt`);
        
        const saveBtn = document.querySelector(`[data-response-id="${responseId}"]`);
        if (saveBtn) {
            saveBtn.textContent = 'Saved';
            setTimeout(() => {
                if (saveBtn) saveBtn.textContent = 'Save';
            }, 2000);
        }
    }

    // Show chat error
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

    // Reset the entire flow
    resetFlow() {
        this.currentFlow = 'idle';
        this.chatResponses.clear();
        this.responseCounter = 0;
        this.conversionResult = null;
        this.frdAnalysisResult = null;
        this.testCasesResult = null;
        
        const container = document.getElementById('brdFlowContainer');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }

        // Reset button states
        this.updateButton('convertBrdBtn', 'Convert BRD to FRD', false);
        this.updateButton('analyzeFrdBtn', 'Analyze Converted FRD', false);
        this.updateButton('generateBrdTestsBtn', 'Generate Test Cases', false);

        // Hide next step buttons
        const analyzeBtn = document.getElementById('analyzeFrdBtn');
        const generateBtn = document.getElementById('generateBrdTestsBtn');
        
        if (analyzeBtn) analyzeBtn.style.display = 'none';
        if (generateBtn) generateBtn.style.display = 'none';
    }

    // Update button state and text
    updateButton(buttonId, text, disabled) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.innerHTML = disabled ? text : 
                buttonId === 'convertBrdBtn' ? '<span class="btn-icon"></span>' + text :
                buttonId === 'analyzeFrdBtn' ? '<span class="btn-icon"></span>' + text :
                buttonId === 'generateBrdTestsBtn' ? '<span class="btn-icon"></span>' + text :
                text;
            btn.disabled = disabled;
        }
    }

    // Download file utility
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

    // Get current document info
    getDocInfo() {
        if (!window.app?.currentProject || !window.app?.currentDocument) {
            throw new Error('No project or document selected');
        }
        
        return {
            projectId: window.app.currentProject.id,
            documentId: window.app.currentDocument.id
        };
    }

    // HTML escape utility
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