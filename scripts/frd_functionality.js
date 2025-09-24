// Complete FRD Functionality with Streaming APIs and Version Management
class FRDFunctionality {
    constructor() {
        this.isProcessing = false;
        this.responseCounter = 0;
        this.chatResponses = new Map();
        this.analysisData = null;
        this.selectedAnomalies = new Set();
        this.currentVersionId = 0;
        this.testVersions = new Map();
        this.currentTestVersion = 1;
        this.chatVersions = new Map();
        this.currentChatVersion = 1;
    }

    static init() {
        const instance = new FRDFunctionality();
        instance.bindEvents();
        return instance;
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const { id, classList } = e.target;
            
            if (id === 'analyzeDocBtn' && window.app?.currentDocument?.doctype === 'FRD') {
                e.preventDefault();
                this.handleAnalyze();
            } else if (id === 'proposeFxBtn') {
                e.preventDefault();
                this.handleProposeFix();
            } else if (id === 'applyFixBtn') {
                e.preventDefault();
                this.handleApplyFix();
            } else if (id === 'generateTestsBtn') {
                e.preventDefault();
                this.handleGenerateTests();
            } else if (id === 'chatSubmit') {
                e.preventDefault();
                this.handleChatSubmit();
            } else if (classList.contains('anomaly-checkbox')) {
                this.handleAnomalySelection(e.target);
            } else if (id === 'selectAllAnomalies') {
                this.handleSelectAllAnomalies(e.target);
            } else if (id === 'resetFlowBtn') {
                e.preventDefault();
                this.resetFlow();
            } else if (id.startsWith('downloadTestVersion')) {
                e.preventDefault();
                this.handleDownloadTestVersion(e.target);
            } else if (classList.contains('version-nav')) {
                this.handleVersionNavigation(e.target);
            }
        });

        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleChatSubmit();
            }
        });
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

    resetFlow() {
        this.analysisData = null;
        this.selectedAnomalies.clear();
        this.currentVersionId = 0;
        this.testVersions.clear();
        this.currentTestVersion = 1;
        this.chatVersions.clear();
        this.currentChatVersion = 1;
        this.chatResponses.clear();
        
        const container = document.getElementById('frdFlowContainer');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
    }

    async handleAnalyze() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.updateButton('analyzeDocBtn', 'Analyzing...', true);
            
            const { projectId, documentId } = this.getDocInfo();
            this.showFlowContainer();
            this.showSection(1, 'FRD Analysis', 'analysisContent', 'Analyzing FRD document...');

            const result = await FRDAPI.analyzeDocumentFallback(projectId, documentId);
            this.processAnalysisResult(result);
            
            this.showAnomalySelection();
            this.showFixButtons();

        } catch (error) {
            console.error('Analysis error:', error);
            window.app.showError(`Analysis failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('analyzeDocBtn', 'Analyze FRD', false);
        }
    }

    processAnalysisResult(result) {
        if (result && typeof result === 'object') {
            if (result.anomalies) {
                this.analysisData = result;
                this.currentVersionId = result.version_id || 0;
            } else {
                this.parseRawAnalysisData(result);
            }
        }
        this.displayAnalysisResults();
    }

    parseRawAnalysisData(data) {
        let anomalies = [];
        
        if (data.data && Array.isArray(data.data)) {
            anomalies = data.data.filter(item => item.section && item.issue);
        } else if (typeof data === 'string' && data.includes('anomalies')) {
            try {
                const parsed = JSON.parse(data);
                if (parsed.anomalies) {
                    anomalies = parsed.anomalies;
                }
            } catch (e) {
                console.log('Failed to parse as JSON, extracting manually');
            }
        }

        if (anomalies.length === 0 && typeof data === 'string') {
            anomalies = this.extractAnomaliesFromString(data);
        }

        this.analysisData = {
            anomalies: anomalies,
            version_id: data.version_id || 25,
            summary: `Found ${anomalies.length} potential issues in the FRD document.`
        };
        this.currentVersionId = this.analysisData.version_id;
    }

    extractAnomaliesFromString(dataString) {
        const anomalies = [];
        const anomalyPattern = /"section":\s*"([^"]+)"[^}]*"issue":\s*"([^"]+)"[^}]*"severity":\s*"([^"]+)"[^}]*"suggestion":\s*"([^"]+)"[^}]*"id":\s*(\d+)/g;
        
        let match;
        while ((match = anomalyPattern.exec(dataString)) !== null) {
            anomalies.push({
                id: parseInt(match[5]),
                section: match[1],
                issue: match[2],
                severity: match[3],
                suggestion: match[4]
            });
        }
        return anomalies;
    }

    displayAnalysisResults() {
        const element = document.getElementById('analysisContent');
        if (!element || !this.analysisData) return;

        const anomalyCount = this.analysisData.anomalies ? this.analysisData.anomalies.length : 0;
        
        let content = '<div class="analysis-results">';
        content += `
            <div class="anomalies-found">
                <h4>Issues Detected</h4>
                <p>Found ${anomalyCount} potential issues in the FRD document.</p>
            </div>
        `;
        content += '</div>';
        
        element.innerHTML = content;
    }

    showAnomalySelection() {
        if (!this.analysisData?.anomalies?.length) return;

        const anomalies = this.analysisData.anomalies;
        const anomalyHTML = `
            <div class="anomaly-selection">
                <div class="anomaly-selection-header">
                    <h4>Select Issues to Fix</h4>
                    <label class="select-all-label">
                        <input type="checkbox" id="selectAllAnomalies" class="select-all-checkbox">
                        <span>Select All (${anomalies.length} issues)</span>
                    </label>
                </div>
                
                <div class="anomaly-cards">
                    ${anomalies.map(anomaly => `
                        <div class="anomaly-card" data-anomaly-id="${anomaly.id}">
                            <div class="anomaly-card-header">
                                <div class="anomaly-card-title">
                                    <label class="anomaly-label">
                                        <input type="checkbox" class="anomaly-checkbox" data-anomaly-id="${anomaly.id}">
                                        <span class="anomaly-title">Anomaly #${anomaly.id}</span>
                                    </label>
                                </div>
                                <span class="anomaly-severity severity-${anomaly.severity.toLowerCase()}">${anomaly.severity.toUpperCase()}</span>
                            </div>
                            
                            <div class="anomaly-card-body">
                                <div class="anomaly-detail">
                                    <span class="detail-label">Section:</span>
                                    <span class="detail-value">${this.escapeHtml(anomaly.section)}</span>
                                </div>
                                
                                <div class="anomaly-detail">
                                    <span class="detail-label">Issue:</span>
                                    <span class="detail-value">${this.escapeHtml(anomaly.issue)}</span>
                                </div>
                                
                                <div class="anomaly-detail suggestion">
                                    <span class="detail-label">Suggestion:</span>
                                    <span class="detail-value">${this.escapeHtml(anomaly.suggestion)}</span>
                                </div>
                                
                                <div class="anomaly-detail">
                                    <span class="detail-label">ID:</span>
                                    <span class="detail-value">${anomaly.id}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="selection-summary">
                    <span class="selection-count">
                        <span id="selectedCount">0</span> of ${anomalies.length} issues selected
                    </span>
                </div>
            </div>
        `;

        const analysisStep = document.querySelector('#frdFlowContainer .flow-step');
        if (analysisStep) {
            const stepContent = analysisStep.querySelector('.step-content');
            stepContent?.insertAdjacentHTML('beforeend', anomalyHTML);
        }
    }

    handleSelectAllAnomalies(checkbox) {
        const isChecked = checkbox.checked;
        const anomalyCheckboxes = document.querySelectorAll('.anomaly-checkbox');
        
        anomalyCheckboxes.forEach(cb => {
            cb.checked = isChecked;
            const anomalyId = parseInt(cb.getAttribute('data-anomaly-id'));
            
            if (isChecked) {
                this.selectedAnomalies.add(anomalyId);
            } else {
                this.selectedAnomalies.delete(anomalyId);
            }
        });

        this.updateSelectionUI();
    }

    handleAnomalySelection(checkbox) {
        const anomalyId = parseInt(checkbox.getAttribute('data-anomaly-id'));
        
        if (checkbox.checked) {
            this.selectedAnomalies.add(anomalyId);
        } else {
            this.selectedAnomalies.delete(anomalyId);
        }

        this.updateSelectionUI();
        this.updateSelectAllCheckbox();
    }

    updateSelectionUI() {
        const countElement = document.getElementById('selectedCount');
        if (countElement) countElement.textContent = this.selectedAnomalies.size;

        const proposeBtn = document.getElementById('proposeFxBtn');
        const applyBtn = document.getElementById('applyFixBtn');
        
        const hasSelection = this.selectedAnomalies.size > 0;
        if (proposeBtn) proposeBtn.disabled = !hasSelection;
        if (applyBtn) applyBtn.disabled = !hasSelection;
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllAnomalies');
        if (!selectAllCheckbox) return;

        const totalAnomalies = this.analysisData?.anomalies?.length || 0;
        const selectedCount = this.selectedAnomalies.size;

        if (selectedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedCount === totalAnomalies) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    showFixButtons() {
        const analysisStep = document.querySelector('#frdFlowContainer .flow-step');
        if (!analysisStep) return;

        const buttonHTML = `
            <div class="step-actions">
                <button id="proposeFxBtn" class="btn btn-info" disabled>
                    <span class="btn-icon">Fix</span>
                    Propose Fixes
                </button>
                <button id="applyFixBtn" class="btn btn-warning" disabled>
                    <span class="btn-icon">Apply</span>
                    Apply Fixes Directly
                </button>
            </div>
        `;
        
        analysisStep.insertAdjacentHTML('beforeend', buttonHTML);
    }

    async handleProposeFix() {
        if (this.isProcessing || this.selectedAnomalies.size === 0) return;

        try {
            this.isProcessing = true;
            this.updateButton('proposeFxBtn', 'Proposing Fixes...', true);

            const { projectId, documentId } = this.getDocInfo();
            this.showSection(2, 'Proposed Fixes', 'proposeFixContent', 'Generating proposed fixes...');

            const selectedAnomalyIds = Array.from(this.selectedAnomalies);
            const requestData = { issue_ids: selectedAnomalyIds };

            const result = await this.callProposeFixAPI(projectId, documentId, requestData);
            this.displayProposedFixes(result);
            this.showApplyButton();

        } catch (error) {
            console.error('Propose fix error:', error);
            window.app.showError(`Propose fix failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('proposeFxBtn', 'Propose Fixes', false);
        }
    }

    async handleApplyFix() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.updateButton('applyFixBtn', 'Applying Fixes...', true);

            const { projectId, documentId } = this.getDocInfo();
            
            const sectionNumber = document.querySelectorAll('#frdFlowContainer .flow-step').length + 1;
            this.showSection(sectionNumber, 'Applied Fixes', 'applyFixContent', 'Applying fixes...');

            const versionId = this.hasProposedFixes() ? this.currentVersionId : 0;
            const result = await this.callApplyFixAPI(projectId, documentId, versionId);
            
            this.displayApplyResults(result);
            
            if (result.version_id) {
                this.currentVersionId = result.version_id;
            }
            
            this.showGenerateTestsButton();

        } catch (error) {
            console.error('Apply fix error:', error);
            window.app.showError(`Apply fix failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('applyFixBtn', 'Apply Fixes', false);
        }
    }

    async handleGenerateTests() {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;
            this.updateButton('generateTestsBtn', 'Generating Tests...', true);

            const { projectId, documentId } = this.getDocInfo();
            
            const sectionNumber = document.querySelectorAll('#frdFlowContainer .flow-step').length + 1;
            this.showSection(sectionNumber, 'Test Cases', 'testContent', 'Generating test cases...');

            // Try streaming first, fallback to normal API
            try {
                await this.streamTestGeneration(projectId, documentId);
            } catch (streamError) {
                console.warn('Streaming failed, using fallback:', streamError);
                const result = await FRDAPI.generateTestCasesFallback(projectId, documentId);
                this.displayTestResults(result, 1);
            }
            
            this.showChatInterface();

        } catch (error) {
            console.error('Test generation error:', error);
            window.app.showError(`Test generation failed: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.updateButton('generateTestsBtn', 'Generate Test Cases', false);
        }
    }

    async streamTestGeneration(projectId, documentId) {
        const element = document.getElementById('testContent');
        if (!element) return;

        let accumulatedContent = '';
        const versionId = this.currentTestVersion;

        // Initialize streaming display
        element.innerHTML = `
            <div class="test-generation-stream">
                <div class="stream-header">
                    <h4>Generated Test Cases (Streaming)</h4>
                    <div class="version-controls">
                        <button class="version-nav" id="prevTestVersion" disabled>&lt;</button>
                        <span class="version-info">Version ${versionId}</span>
                        <button class="version-nav" id="nextTestVersion" disabled>&gt;</button>
                    </div>
                </div>
                <div class="stream-content">
                    <div class="streaming-text" id="streamingTestContent"></div>
                </div>
                <div class="stream-actions" style="display: none;">
                    <button id="downloadTestVersion${versionId}" class="btn btn-success btn-sm">
                        <span class="btn-icon">Download</span>
                        Download Test Cases V${versionId}
                    </button>
                </div>
            </div>
        `;

        const streamingElement = document.getElementById('streamingTestContent');

        try {
            await StreamingService.streamTestGeneration(projectId, documentId, (chunk) => {
                if (chunk.text) {
                    accumulatedContent += chunk.text;
                    streamingElement.innerHTML = `<pre>${this.escapeHtml(accumulatedContent)}</pre>`;
                    streamingElement.scrollTop = streamingElement.scrollHeight;
                }
            });

            // Store version data
            this.testVersions.set(versionId, {
                content: accumulatedContent,
                timestamp: new Date().toISOString(),
                downloaded: false
            });

            // Show download button when streaming completes
            const downloadActions = element.querySelector('.stream-actions');
            if (downloadActions) {
                downloadActions.style.display = 'block';
            }

            this.updateTestVersionControls();

        } catch (error) {
            throw error; // Let the caller handle fallback
        }
    }

    displayTestResults(result, versionId) {
        const element = document.getElementById('testContent');
        if (!element) return;

        const testContent = result?.test_cases || result?.content || result?.text || 'No test cases generated';
        
        // Store version data
        this.testVersions.set(versionId, {
            content: testContent,
            timestamp: new Date().toISOString(),
            downloaded: false
        });

        const content = `
            <div class="test-generation-stream">
                <div class="stream-header">
                    <h4>Generated Test Cases</h4>
                    <div class="version-controls">
                        <button class="version-nav" id="prevTestVersion" disabled>&lt;</button>
                        <span class="version-info">Version ${versionId}</span>
                        <button class="version-nav" id="nextTestVersion" disabled>&gt;</button>
                    </div>
                </div>
                <div class="stream-content">
                    <div class="streaming-text">
                        <pre>${this.escapeHtml(testContent)}</pre>
                    </div>
                </div>
                <div class="stream-actions">
                    <button id="downloadTestVersion${versionId}" class="btn btn-success btn-sm">
                        <span class="btn-icon">Download</span>
                        Download Test Cases V${versionId}
                    </button>
                </div>
            </div>
        `;
        
        element.innerHTML = content;
        this.updateTestVersionControls();
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

            // Clear input immediately to prevent repeating
            input.value = '';

            this.currentChatVersion++;
            const versionId = this.currentChatVersion;
            
            this.addChatMessage(message, versionId);

            const { projectId, documentId } = this.getDocInfo();
            
            // Try streaming first, fallback to normal API
            try {
                await this.streamChatUpdate(projectId, documentId, message, versionId);
            } catch (streamError) {
                console.warn('Chat streaming failed, using fallback:', streamError);
                const result = await FRDAPI.sendChatMessageFallback(projectId, documentId, message);
                const responseText = result.response || result.content || result.text || result.message || 'Updated successfully';
                this.updateChatResponse(versionId, responseText, false);
                
                // For fallback, still create new test version with the response
                const newTestVersion = Math.max(...Array.from(this.testVersions.keys())) + 1;
                this.currentTestVersion = newTestVersion;
                this.testVersions.set(newTestVersion, {
                    content: responseText,
                    timestamp: new Date().toISOString(),
                    downloaded: false,
                    basedOnChat: versionId
                });
                this.displayTestVersion(newTestVersion);
            }

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

    addChatMessage(userMessage, versionId) {
        const container = document.getElementById('chatResponses');
        if (!container) return;

        const messageHTML = `
            <div id="chatMessage-${versionId}" class="chat-exchange">
                <div class="user-message">
                    <div class="message-header">
                        <span class="message-sender">You:</span>
                    </div>
                    <div class="message-content">${this.escapeHtml(userMessage)}</div>
                </div>
                <div class="ai-message">
                    <div class="message-header">
                        <span class="message-sender">AI:</span>
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
        `;
        
        container.insertAdjacentHTML('beforeend', messageHTML);
        container.scrollTop = container.scrollHeight;
    }

    async streamChatUpdate(projectId, documentId, message, versionId) {
        let accumulatedContent = '';

        try {
            await this.streamTestCaseUpdate(projectId, documentId, message, (chunk) => {
                if (chunk.text) {
                    accumulatedContent += chunk.text;
                    this.updateChatResponse(versionId, accumulatedContent, true);
                }
            });

            // Store final version and generate new test cases
            await this.generateUpdatedTestCases(projectId, documentId, accumulatedContent, versionId);

        } catch (error) {
            throw error; // Let the caller handle fallback
        }
    }

    async streamTestCaseUpdate(projectId, documentId, message, onChunk) {
        const url = `${API_BASE}/api/v1/project/${projectId}/frd/${documentId}/testcases/update/stream`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({ message: message })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data && onChunk) {
                                onChunk(data);
                            }
                        } catch (e) {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    async generateUpdatedTestCases(projectId, documentId, chatResponse, chatVersion) {
        try {
            // The chatResponse already contains the updated test cases from the streaming API
            // Generate new test cases version based on chat interaction
            const newTestVersion = Math.max(...Array.from(this.testVersions.keys())) + 1;
            this.currentTestVersion = newTestVersion;

            // Use the streamed content as the new test cases
            const testContent = chatResponse || 'Updated test cases';

            // Store new test version
            this.testVersions.set(newTestVersion, {
                content: testContent,
                timestamp: new Date().toISOString(),
                downloaded: false,
                basedOnChat: chatVersion
            });

            // Update the test display to show new version
            this.displayTestVersion(newTestVersion);

        } catch (error) {
            console.warn('Failed to generate updated test cases:', error);
            // Continue with just the chat response
        }
    }

    updateChatResponse(versionId, content, isStreaming = false) {
        const responseDiv = document.getElementById(`aiResponse-${versionId}`);
        if (!responseDiv) return;

        if (isStreaming) {
            responseDiv.innerHTML = `<pre class="streaming-response">${this.escapeHtml(content)}</pre>`;
        } else {
            responseDiv.innerHTML = `<pre>${this.escapeHtml(content)}</pre>`;
            
            // Store the chat version
            this.chatVersions.set(versionId, {
                content: content,
                timestamp: new Date().toISOString()
            });
        }

        const container = document.getElementById('chatResponses');
        if (container) container.scrollTop = container.scrollHeight;
    }

    handleDownloadTestVersion(button) {
        const versionId = parseInt(button.id.replace('downloadTestVersion', ''));
        const versionData = this.testVersions.get(versionId);
        
        if (versionData) {
            this.downloadTestCasesAsTxt(versionData.content, versionId);
            
            // Update button state
            versionData.downloaded = true;
            button.innerHTML = '<span class="btn-icon">✓</span>Downloaded';
            button.disabled = true;
            button.classList.remove('btn-success');
            button.classList.add('btn-secondary');
            
            window.app?.showSuccess(`Test cases version ${versionId} downloaded successfully`);
        }
    }

    downloadTestCasesAsTxt(content, version) {
        try {
            const { projectName, documentName } = this.getDocInfo();
            const filename = `${projectName}_${documentName}_testcase${version}.txt`;
            
            // Create text content with header
            const txtContent = this.createTxtContent(content, projectName, documentName, version);
            
            // Create blob and download
            const blob = new Blob([txtContent], { type: 'text/plain' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Download failed:', error);
            window.app?.showError('Failed to download test cases');
        }
    }

    createTxtContent(testContent, projectName, documentName, version) {
        const timestamp = new Date().toLocaleString();
        
        const txtContent = `TEST CASES
===========

Project: ${projectName}
Document: ${documentName}
Version: ${version}
Generated: ${timestamp}

${'='.repeat(50)}

${testContent}

${'='.repeat(50)}
End of Test Cases Document`;

        return txtContent;
    }

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
        this.updateTestVersionControls();
    }

    navigateChatVersion(currentVersion, isNext) {
        const versions = Array.from(this.chatVersions.keys()).sort((a, b) => a - b);
        const currentIndex = versions.indexOf(currentVersion);
        
        if (currentIndex === -1) return;

        let newIndex;
        if (isNext && currentIndex < versions.length - 1) {
            newIndex = currentIndex + 1;
        } else if (!isNext && currentIndex > 0) {
            newIndex = currentIndex - 1;
        } else {
            return;
        }

        const newVersion = versions[newIndex];
        this.displayChatVersion(currentVersion, newVersion);
    }

    displayTestVersion(versionId) {
        const versionData = this.testVersions.get(versionId);
        if (!versionData) return;

        const element = document.getElementById('testContent');
        if (!element) return;

        element.innerHTML = `
            <div class="test-generation-stream">
                <div class="stream-header">
                    <h4>Generated Test Cases</h4>
                    <div class="version-controls">
                        <button class="version-nav" id="prevTestVersion">&lt;</button>
                        <span class="version-info">Version ${versionId}</span>
                        <button class="version-nav" id="nextTestVersion">&gt;</button>
                    </div>
                </div>
                <div class="stream-content">
                    <div class="streaming-text">
                        <pre>${this.escapeHtml(versionData.content)}</pre>
                    </div>
                </div>
                <div class="stream-actions">
                    <button id="downloadTestVersion${versionId}" class="btn ${versionData.downloaded ? 'btn-secondary' : 'btn-success'} btn-sm" ${versionData.downloaded ? 'disabled' : ''}>
                        <span class="btn-icon">${versionData.downloaded ? '✓' : 'Download'}</span>
                        ${versionData.downloaded ? 'Downloaded' : `Download Test Cases V${versionId}`}
                    </button>
                </div>
            </div>
        `;

        this.updateTestVersionControls();
    }

    displayChatVersion(currentVersion, newVersion) {
        const versionData = this.chatVersions.get(newVersion);
        if (!versionData) return;

        const responseDiv = document.getElementById(`aiResponse-${currentVersion}`);
        const versionInfo = document.querySelector(`#chatMessage-${currentVersion} .version-info`);

        if (responseDiv) {
            responseDiv.innerHTML = `<pre>${this.escapeHtml(versionData.content)}</pre>`;
        }

        if (versionInfo) {
            versionInfo.textContent = `V${newVersion}`;
        }

        // Update navigation buttons
        this.updateChatVersionControls(currentVersion, newVersion);
    }

    updateChatVersionControls(messageId, currentVersion) {
        const versions = Array.from(this.chatVersions.keys()).sort((a, b) => a - b);
        const currentIndex = versions.indexOf(currentVersion);
        
        const prevBtn = document.querySelector(`#chatMessage-${messageId} .chat-prev`);
        const nextBtn = document.querySelector(`#chatMessage-${messageId} .chat-next`);

        if (prevBtn) {
            prevBtn.disabled = currentIndex <= 0;
            prevBtn.dataset.version = messageId;
        }
        if (nextBtn) {
            nextBtn.disabled = currentIndex >= versions.length - 1;
            nextBtn.dataset.version = messageId;
        }
    }

    updateTestVersionControls() {
        const prevBtn = document.getElementById('prevTestVersion');
        const nextBtn = document.getElementById('nextTestVersion');
        const totalVersions = this.testVersions.size;

        if (prevBtn) {
            prevBtn.disabled = this.currentTestVersion <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentTestVersion >= totalVersions;
        }
    }

    showChatError(message) {
        const container = document.getElementById('chatResponses');
        if (container) {
            container.insertAdjacentHTML('beforeend', `
                <div class="chat-exchange error">
                    <div class="error-message">
                        <span class="error-icon">⚠️</span>
                        Error: ${this.escapeHtml(message)}
                    </div>
                </div>
            `);
            container.scrollTop = container.scrollHeight;
        }
    }

    hasProposedFixes() {
        return document.getElementById('proposeFixContent') !== null;
    }

    async callProposeFixAPI(projectId, documentId, requestData) {
        const url = `${API_BASE}/api/v1/project/${projectId}/documents/${documentId}/frd/propose-fix`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }

    async callApplyFixAPI(projectId, documentId, versionId) {
        const url = `${API_BASE}/api/v1/project/${projectId}/documents/${documentId}/frd/apply-fix`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version_id: versionId })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
    }

    displayProposedFixes(result) {
        const element = document.getElementById('proposeFixContent');
        if (!element) return;

        let content = '<div class="proposed-fixes-results">';

        if (result.version_id) {
            this.currentVersionId = result.version_id;
            content += `
                <div class="version-info-card">
                    <h4>New Version Created</h4>
                    <p>Version ID: <strong>${result.version_id}</strong></p>
                </div>
            `;
        }

        if (result.updated_sections && result.updated_sections.length > 0) {
            content += `
                <div class="updated-sections-card">
                    <h4>Updated Sections (${result.updated_sections.length})</h4>
                    <div class="updated-sections-list">
                        ${result.updated_sections.map(section => `
                            <div class="updated-section-item">
                                <div class="section-header">
                                    <h5>${this.escapeHtml(section.section)}</h5>
                                </div>
                                <div class="section-content">
                                    <div class="updated-text">
                                        <pre>${this.escapeHtml(section.updated_text)}</pre>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (result.message || result.summary) {
            content += `
                <div class="result-message">
                    <p>${this.escapeHtml(result.message || result.summary)}</p>
                </div>
            `;
        }

        content += '</div>';
        element.innerHTML = content;
    }

    displayApplyResults(result) {
        const element = document.getElementById('applyFixContent');
        if (!element) return;

        let content = '<div class="apply-fix-results">';

        content += `
            <div class="success-card">
                <h4>Fixes Applied Successfully</h4>
                <p>The FRD document has been updated with the selected fixes.</p>
            </div>
        `;

        if (result.version_id) {
            content += `
                <div class="version-info-card">
                    <h4>Document Updated</h4>
                    <p>New Version ID: <strong>${result.version_id}</strong></p>
                </div>
            `;
        }

        if (result.message) {
            content += `
                <div class="result-message">
                    <p>${this.escapeHtml(result.message)}</p>
                </div>
            `;
        }

        content += '</div>';
        element.innerHTML = content;
    }

    showApplyButton() {
        const proposeStep = document.querySelector('#frdFlowContainer .flow-step:last-child');
        if (!proposeStep) return;

        const buttonHTML = `
            <div class="step-actions">
                <button id="applyFixBtn" class="btn btn-success">
                    <span class="btn-icon">Apply</span>
                    Apply These Fixes
                </button>
            </div>
        `;
        
        proposeStep.insertAdjacentHTML('beforeend', buttonHTML);
    }

    showGenerateTestsButton() {
        const lastStep = document.querySelector('#frdFlowContainer .flow-step:last-child');
        if (!lastStep) return;

        const buttonHTML = `
            <div class="step-actions">
                <button id="generateTestsBtn" class="btn btn-success">
                    <span class="btn-icon">Test</span>
                    Generate Test Cases
                </button>
            </div>
        `;
        
        lastStep.insertAdjacentHTML('beforeend', buttonHTML);
    }

    showChatInterface() {
        const testStep = document.querySelector('#frdFlowContainer .flow-step:last-child');
        if (!testStep) return;

        const chatHTML = `
            <div class="chat-interface">
                <div class="chat-header">
                    <h4>Refine Test Cases</h4>
                    <p>Ask for modifications, additional test cases, or improvements</p>
                </div>
                <div id="chatResponses" class="chat-responses-container"></div>
                <div class="chat-input-container">
                    <div class="chat-input">
                        <textarea id="chatInput" placeholder="e.g., 'Add edge cases for payment validation'" rows="2"></textarea>
                        <button id="chatSubmit" class="btn btn-primary">
                            <span class="btn-icon">Send</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        testStep.querySelector('.step-content').insertAdjacentHTML('beforeend', chatHTML);
        document.getElementById('chatInput')?.focus();
    }

    // Helper methods
    showFlowContainer() {
        const container = document.getElementById('frdFlowContainer');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'block';
        }
    }

    showSection(stepNumber, title, contentId, loadingText) {
        const container = document.getElementById('frdFlowContainer');
        if (!container) return;

        const sectionHTML = `
            <div class="flow-step">
                <div class="step-header">
                    <div class="step-indicator">${stepNumber}</div>
                    <h3>${title}</h3>
                </div>
                <div id="${contentId}" class="step-content">
                    ${loadingText ? `<div class="loading">${loadingText}</div>` : ''}
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', sectionHTML);
    }

    updateButton(buttonId, text, disabled) {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.textContent = text;
            btn.disabled = disabled;
        }
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

    escapeXml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

// Initialize FRD functionality
document.addEventListener('DOMContentLoaded', () => {
    window.frdFunctionality = FRDFunctionality.init();
});