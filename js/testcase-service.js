// testcase-service.js - Handles testcase generation for both BRD and FRD (FIXED)

class TestcaseService {
    constructor() {
        this.totalChunks = 0;
        this.processedChunks = 0;
        this.frdDocumentId = null;
    }

    /**
     * Generate testcases based on document type
     * @param {Object} app - App instance
     * @param {number} projectId - Project ID
     * @param {number} documentId - Document ID
     * @param {string} docType - Document type (FRD or BRD)
     */
    async generateTestcases(app, projectId, documentId, docType) {
        try {
            if (docType === 'FRD') {
                await this.generateFRDTestcases(app, projectId, documentId);
            } else if (docType === 'BRD') {
                await this.generateBRDTestcases(app, projectId, documentId);
            } else {
                throw new Error('Unsupported document type: ' + docType);
            }
        } catch (error) {
            console.error('Testcase generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate testcases for FRD document
     */
    async generateFRDTestcases(app, projectId, documentId) {
        const testcaseSection = document.getElementById('testcaseSection');
        
        testcaseSection.innerHTML = `
            <div class="testcase-generation">
                <div class="generation-header">
                    <h3>Generating FRD Test Cases</h3>
                    <div class="generation-status">
                        <div class="status-indicator pulse"></div>
                        <span>Processing document...</span>
                    </div>
                </div>
                
                <div class="generation-progress">
                    <div class="progress-section">
                        <h4>📊 Analysis Progress</h4>
                        <div id="vectorStatus" class="status-item pending">
                            <span class="status-icon">⏳</span>
                            <span>Indexing document chunks...</span>
                        </div>
                        <div id="analysisStatus" class="status-item pending">
                            <span class="status-icon">⏳</span>
                            <span>Analyzing requirements...</span>
                        </div>
                    </div>

                    <div class="progress-section">
                        <h4>🔍 Issues Found</h4>
                        <div id="issuesContainer" class="issues-container">
                            <div class="empty-placeholder">Scanning for issues...</div>
                        </div>
                    </div>

                    <div class="progress-section" id="testcaseProgressSection" style="display: none;">
                        <h4>✅ Generating Test Cases</h4>
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <div class="progress-text" id="progressText">0 / 0 chunks processed</div>
                    </div>
                </div>

                <div class="generation-footer" id="generationFooter" style="display: none;">
                    <button class="btn btn-primary" id="viewGeneratedTestcases">
                        View Generated Test Cases
                    </button>
                </div>
            </div>
        `;

        // Start streaming
        await apiService.generateFRDTestcasesStream(
            projectId, 
            documentId,
            (event) => this.handleFRDStreamEvent(app, event)
        );
    }

    /**
     * Generate testcases for BRD document (requires conversion first)
     */
    async generateBRDTestcases(app, projectId, documentId) {
        const testcaseSection = document.getElementById('testcaseSection');
        
        testcaseSection.innerHTML = `
            <div class="testcase-generation">
                <div class="generation-header">
                    <h3>Generating Test Cases from BRD</h3>
                    <div class="generation-status">
                        <div class="status-indicator pulse"></div>
                        <span>Processing document...</span>
                    </div>
                </div>
                
                <div class="generation-progress">
                    <div class="progress-section">
                        <h4>📊 Analysis Progress</h4>
                        <div id="vectorStatus" class="status-item pending">
                            <span class="status-icon">⏳</span>
                            <span>Analyzing FRD content...</span>
                        </div>
                        <div id="analysisStatus" class="status-item pending">
                            <span class="status-icon">⏳</span>
                            <span>Preparing test generation...</span>
                        </div>
                    </div>

                    <div class="progress-section">
                        <h4>🔍 Issues Found</h4>
                        <div id="issuesContainer" class="issues-container">
                            <div class="empty-placeholder">Scanning for issues...</div>
                        </div>
                    </div>

                    <div class="progress-section" id="testcaseProgressSection" style="display: none;">
                        <h4>✅ Generating Test Cases</h4>
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <div class="progress-text" id="progressText">Processing...</div>
                    </div>
                </div>

                <div class="generation-footer" id="generationFooter" style="display: none;">
                    <button class="btn btn-primary" id="viewGeneratedTestcases">
                        View Generated Test Cases
                    </button>
                </div>
            </div>
        `;

        try {
            // Use the FRD document ID that was stored after conversion
            if (!this.frdDocumentId) {
                throw new Error('FRD document ID not found. Please convert BRD to FRD first.');
            }

            this.updateStatus('vectorStatus', 'processing', 'Using converted FRD document...');
            this.updateStatus('analysisStatus', 'processing', 'Starting test generation...');
            
            // Generate testcases for the converted FRD
            document.getElementById('testcaseProgressSection').style.display = 'block';
            
            await apiService.generateBRDTestcases(
                this.frdDocumentId,
                (event) => this.handleBRDTestcaseEvent(app, event)
            );
            
        } catch (error) {
            console.error('BRD testcase generation failed:', error);
            this.updateStatus('analysisStatus', 'error', '✗ Generation failed: ' + error.message);
            app.showError('Failed to generate testcases: ' + error.message);
        }
    }

    handleFRDStreamEvent(app, event) {
        const { type, data } = event;

        switch (type) {
            case 'vector_ingest_start':
                this.updateStatus('vectorStatus', 'processing', 'Indexing document chunks...');
                break;

            case 'vector_ingest_complete':
                this.updateStatus('vectorStatus', 'complete', `✓ Indexed ${data.chunks_indexed} chunks`);
                this.updateStatus('analysisStatus', 'processing', 'Analyzing requirements...');
                break;

            case 'start':
                this.updateStatus('analysisStatus', 'complete', `✓ Found ${data.total_chunks} chunks to analyze`);
                document.getElementById('testcaseProgressSection').style.display = 'block';
                this.totalChunks = data.total_chunks;
                this.processedChunks = 0;
                break;

            case 'batch_start':
                this.updateProgressText(`Processing batch ${data.batch} of ${data.total_batches}...`);
                break;

            case 'issues_found':
                this.addIssues(data.issues);
                break;

            case 'chunk_complete':
                this.processedChunks++;
                this.updateProgress(this.processedChunks, this.totalChunks);
                break;

            case 'complete':
                this.onGenerationComplete(app);
                break;

            case 'error':
                app.showError('Generation error: ' + data.message);
                break;
        }
    }

    handleBRDTestcaseEvent(app, event) {
        const { type, data } = event;

        switch (type) {
            case 'start':
                this.updateStatus('vectorStatus', 'complete', '✓ FRD document ready');
                this.updateStatus('analysisStatus', 'complete', `✓ Found ${data.total_chunks || 1} chunks to process`);
                document.getElementById('testcaseProgressSection').style.display = 'block';
                this.totalChunks = data.total_chunks || 1;
                this.processedChunks = 0;
                break;

            case 'batch_start':
                this.updateProgressText(`Processing batch ${data.batch} of ${data.total_batches}...`);
                break;

            case 'issues_found':
                this.addIssues(data.issues);
                break;

            case 'chunk_complete':
                this.processedChunks++;
                this.updateProgress(this.processedChunks, this.totalChunks);
                break;

            case 'processing':
                this.updateProgressText('Generating test cases...');
                break;

            case 'progress':
                if (data.total) {
                    this.totalChunks = data.total;
                    this.processedChunks = data.current || 0;
                    this.updateProgress(this.processedChunks, this.totalChunks);
                }
                break;

            case 'complete':
                this.onGenerationComplete(app);
                break;

            case 'error':
                app.showError('Generation error: ' + data.message);
                break;
        }
    }

    updateStatus(elementId, status, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = `status-item ${status}`;
            const textSpan = element.querySelector('span:last-child');
            if (textSpan) {
                textSpan.textContent = text;
            }
            
            const iconSpan = element.querySelector('.status-icon');
            if (iconSpan) {
                if (status === 'complete') {
                    iconSpan.textContent = '✓';
                } else if (status === 'processing') {
                    iconSpan.textContent = '⏳';
                } else if (status === 'error') {
                    iconSpan.textContent = '✗';
                }
            }
        }
    }

    addIssues(issues) {
        const issuesContainer = document.getElementById('issuesContainer');
        if (!issuesContainer) return;

        const placeholder = issuesContainer.querySelector('.empty-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        issues.forEach(issue => {
            const issueElement = document.createElement('div');
            issueElement.className = `issue-item severity-${issue.severity}`;
            issueElement.innerHTML = `
                <div class="issue-header">
                    <span class="issue-id">${issue.id}</span>
                    <span class="issue-type">${issue.type}</span>
                    <span class="issue-severity ${issue.severity}">${issue.severity}</span>
                </div>
                <p class="issue-description">${this.escapeHtml(issue.description)}</p>
                <p class="issue-location">Location: ${this.escapeHtml(issue.location)}</p>
            `;
            issuesContainer.appendChild(issueElement);
        });
    }

    updateProgress(current, total) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill && progressText) {
            const percentage = (current / total) * 100;
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${current} / ${total} chunks processed`;
        }
    }

    updateProgressText(text) {
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = text;
        }
    }

    onGenerationComplete(app) {
        const generationFooter = document.getElementById('generationFooter');
        if (generationFooter) {
            generationFooter.style.display = 'block';
            
            const viewBtn = document.getElementById('viewGeneratedTestcases');
            if (viewBtn) {
                viewBtn.addEventListener('click', () => {
                    app.loadTestcases(app.currentDocument.id);
                });
            }
        }

        app.showSuccess('Test cases generated successfully!');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const testcaseService = new TestcaseService();