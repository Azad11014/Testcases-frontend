// app.js - Application State and Core Logic (COMPLETE WITH BRD CHILDREN)
class App {
    constructor() {
        this.currentProject = null;
        this.currentDocument = null;
        this.projects = [];
        this.documents = [];
        this.currentStep = 1;
        
        this.documentCache = new Map();
        this.testcaseVersions = [];
        this.currentTestcaseVersion = null;
        this.testcaseCache = new Map();
        
        // BRD children FRD tracking
        this.brdChildrenFRDs = [];
    }

    // Navigation methods
    showStep(stepNumber) {
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });

        const step = document.getElementById(`step${stepNumber}`);
        if (step) {
            step.classList.add('active');
            this.currentStep = stepNumber;
        }
    }

    goToStep(stepNumber) {
        this.showStep(stepNumber);
    }

    // Project methods
    async loadProjects() {
        try {
            const projectsList = document.getElementById('projectsList');
            projectsList.innerHTML = '<div class="loading">Loading projects...</div>';

            const response = await apiService.listProjects();
            this.projects = response.projects || response || [];

            this.renderProjects();
        } catch (error) {
            console.error('Failed to load projects:', error);
            this.showError('Failed to load projects. Please try again.');
        }
    }

    renderProjects() {
        const projectsList = document.getElementById('projectsList');

        if (this.projects.length === 0) {
            projectsList.innerHTML = `
                <div class="empty-state">
                    <p>No projects found. Create your first project to get started.</p>
                </div>
            `;
            return;
        }

        projectsList.innerHTML = this.projects.map(project => {
            const docCount = project.documents?.length || project.document_count || 0;
            
            return `
                <div class="project-card" data-project-id="${project.id}">
                    <h3>${this.escapeHtml(project.name)}</h3>
                    <p>${this.escapeHtml(project.description || 'No description')}</p>
                    <div class="project-meta">
                        <span>Created: ${this.formatDate(project.created_at)}</span>
                        <span>Documents: ${docCount}</span>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', () => {
                const projectId = card.dataset.projectId;
                this.selectProject(projectId);
            });
        });
    }

    async createProject(formData) {
        try {
            const projectData = {
                name: formData.get('name'),
                description: formData.get('description')
            };

            const response = await apiService.createProject(projectData);
            
            this.projects.push(response);
            this.renderProjects();
            
            return response;
        } catch (error) {
            console.error('Failed to create project:', error);
            throw error;
        }
    }

    async selectProject(projectId) {
        try {
            const response = await apiService.getProject(projectId);
            this.currentProject = response;
            this.documents = response.documents || [];

            document.getElementById('selectedProjectTitle').textContent = this.currentProject.name;
            document.getElementById('projectDescription').textContent = 
                this.currentProject.description || 'No description available';

            this.renderDocuments();
            this.goToStep(2);
        } catch (error) {
            console.error('Failed to select project:', error);
            this.showError('Failed to load project details.');
        }
    }

    // Document methods
    async loadDocuments(projectId) {
        try {
            const response = await apiService.listDocuments(projectId);
            this.documents = response.documents || response || [];
            this.renderDocuments();
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.showError('Failed to load documents.');
        }
    }

    renderDocuments() {
        const documentsList = document.getElementById('documentsList');

        if (this.documents.length === 0) {
            documentsList.innerHTML = `
                <div class="empty-state">
                    <p>No documents uploaded yet. Upload a BRD or FRD to get started.</p>
                </div>
            `;
            return;
        }

        documentsList.innerHTML = this.documents.map(doc => {
            const fileName = this.getFileNameFromPath(doc.filename || doc.file_path || 'Unknown Document');
            
            return `
                <div class="document-card">
                    <div class="document-item" 
                         data-document-id="${doc.id}" 
                         data-doc-type="${doc.doctype}"
                         data-file-name="${this.escapeHtml(fileName)}">
                        <div class="document-info">
                            <h4>${this.escapeHtml(fileName)}</h4>
                            <p>Uploaded: ${this.formatDate(doc.created_at)}</p>
                        </div>
                        <span class="document-type ${doc.doctype}">${doc.doctype}</span>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.document-item').forEach(item => {
            item.addEventListener('click', () => {
                const docId = item.dataset.documentId;
                const docType = item.dataset.docType;
                const fileName = item.dataset.fileName;
                this.openDocument(docId, docType, fileName);
            });
        });
    }

    getFileNameFromPath(path) {
        if (!path) return 'Unknown Document';
        const parts = path.split(/[/\\]/);
        const fileName = parts[parts.length - 1];
        return fileName.replace(/^doc_\d+_/, '');
    }

    async uploadDocument(projectId, formData) {
        try {
            const response = await apiService.uploadDocument(projectId, formData);
            await this.selectProject(projectId);
            return response;
        } catch (error) {
            console.error('Failed to upload document:', error);
            throw error;
        }
    }

    async openDocument(documentId, docType, fileName) {
        try {
            this.currentDocument = {
                id: documentId,
                type: docType,
                name: fileName
            };

            this.testcaseVersions = [];
            this.currentTestcaseVersion = null;
            this.brdChildrenFRDs = [];

            document.getElementById('documentTitle').textContent = fileName;
            document.getElementById('documentMeta').textContent = `Document ID: ${documentId} | Type: ${docType}`;
            document.getElementById('documentTypeHeader').textContent = docType;
            document.getElementById('documentTypeHeader').className = `document-type-large ${docType}`;

            this.goToStep(3);
            await this.loadDocumentContent(documentId);

            // Load BRD children FRDs if it's a BRD document
            if (docType === 'BRD') {
                await this.loadBRDChildrenFRDs(documentId);
            }

            this.loadTestcases(documentId).catch(error => {
                console.error('Failed to load testcases:', error);
                document.getElementById('testcaseSection').innerHTML = 
                    '<div class="empty-state">No testcases available or failed to load.</div>';
            });

        } catch (error) {
            console.error('Failed to open document:', error);
            this.showError('Failed to load document.');
        }
    }

    async loadDocumentContent(documentId) {
        try {
            const contentDiv = document.getElementById('documentContent');
            contentDiv.innerHTML = '<div class="loading">Loading document content...</div>';

            if (this.documentCache.has(documentId)) {
                contentDiv.innerHTML = this.documentCache.get(documentId);
                return;
            }

            const response = await apiService.extractDocumentText(
                this.currentProject.id,
                documentId
            );

            let content = response.text || response.content || response.extracted_text || 
                         response.preview || response.data || '';

            if (typeof response === 'string') {
                content = response;
            }

            if (!content || content.trim() === '') {
                content = 'Document appears to be empty or text could not be extracted.';
            }

            const formattedContent = this.formatDocumentContent(content);
            this.documentCache.set(documentId, formattedContent);
            contentDiv.innerHTML = formattedContent;
        } catch (error) {
            console.error('Failed to load document content:', error);
            document.getElementById('documentContent').innerHTML = 
                `<div class="error-message">Failed to load document content: ${error.message}</div>`;
        }
    }

    formatDocumentContent(content) {
        const escaped = this.escapeHtml(content);
        return `<pre class="document-text">${escaped}</pre>`;
    }

    // ==================== BRD CHILDREN FRD METHODS ====================
    
    async loadBRDChildrenFRDs(brdDocumentId) {
        try {
            const response = await apiService.getFRDsByParentBRD(brdDocumentId);
            this.brdChildrenFRDs = response.frds || response || [];
            
            // Render children FRDs section if we have any
            if (this.brdChildrenFRDs.length > 0) {
                this.renderBRDChildrenSection();
            }
        } catch (error) {
            console.error('Failed to load BRD children FRDs:', error);
            // Don't show error - just means no converted FRDs yet
        }
    }

    renderBRDChildrenSection() {
        const contentDiv = document.getElementById('documentContent');
        
        // Add children section after main content
        const childrenSection = document.createElement('div');
        childrenSection.className = 'document-children';
        childrenSection.innerHTML = `
            <h4 style="color: #1e293b; font-size: 16px; font-weight: 600; margin-bottom: 12px;">
                Converted FRDs (${this.brdChildrenFRDs.length})
            </h4>
            ${this.brdChildrenFRDs.map(frd => this.renderChildFRDItem(frd)).join('')}
        `;
        
        contentDiv.appendChild(childrenSection);
    }

    renderChildFRDItem(frd) {
        const fileName = this.getFileNameFromPath(frd.filename || frd.file_path || `FRD_${frd.id}`);
        return `
            <div class="child-document-item" data-frd-id="${frd.id}" data-frd-name="${this.escapeHtml(fileName)}">
                <div class="child-doc-info">
                    <h5>${this.escapeHtml(fileName)}</h5>
                    <p>Created: ${this.formatDate(frd.created_at || frd.conversion_date)}</p>
                    <span class="converted-badge">Converted FRD</span>
                </div>
                <span class="document-type FRD">FRD</span>
            </div>
        `;
    }

    setupChildFRDClickHandlers() {
        document.querySelectorAll('.child-document-item').forEach(item => {
            item.addEventListener('click', () => {
                const frdId = item.dataset.frdId;
                const frdName = item.dataset.frdName;
                this.openChildFRD(frdId, frdName);
            });
        });
    }

    async openChildFRD(frdDocumentId, frdName) {
        // Open the child FRD document
        await this.openDocument(frdDocumentId, 'FRD', frdName);
    }

    // Testcase methods
    async loadTestcases(documentId) {
        try {
            const testcaseSection = document.getElementById('testcaseSection');
            testcaseSection.innerHTML = '<div class="loading">Loading testcases...</div>';

            const response = await apiService.getDocumentTestcases(documentId);

            if (!response || !response.testcases || response.testcases.length === 0) {
                if (this.currentDocument.type === 'BRD') {
                    this.showBRDConversionOption(documentId);
                } else {
                    this.showGenerateTestcasesButton(documentId);
                }
                return;
            }

            this.currentTestcaseVersion = response.version;
            this.testcaseVersions = [];
            for (let i = 1; i <= response.version; i++) {
                this.testcaseVersions.push(i);
            }
            this.testcaseCache.set(response.version, response);
            this.renderTestcases(response);
        } catch (error) {
            console.error('Failed to load testcases:', error);
            if (this.currentDocument.type === 'BRD') {
                this.showBRDConversionOption(documentId);
            } else {
                this.showGenerateTestcasesButton(documentId);
            }
        }
    }

    showBRDConversionOption(documentId) {
        const testcaseSection = document.getElementById('testcaseSection');
        
        // Check if we have converted FRDs
        const hasConvertedFRDs = this.brdChildrenFRDs.length > 0;
        
        testcaseSection.innerHTML = `
            <div class="generate-testcases-prompt">
                <div class="prompt-icon"></div>
                <h3>BRD Document Detected</h3>
                ${hasConvertedFRDs ? `
                    <p>This BRD has ${this.brdChildrenFRDs.length} converted FRD${this.brdChildrenFRDs.length > 1 ? 's' : ''}. Generate test cases from an existing FRD or create a new conversion.</p>
                    <div class="prompt-buttons">
                        <button class="btn btn-primary" id="selectExistingFRDBtn">
                            <span class="view-icon"></span> Select Existing FRD
                        </button>
                        <button class="btn btn-secondary" id="convertNewFRDBtn">
                            <span class="convert-icon"></span> Convert New FRD
                        </button>
                    </div>
                ` : `
                    <p>Convert this Business Requirements Document to Functional Requirements to generate test cases</p>
                    <div class="prompt-buttons">
                        <button class="btn btn-primary" id="convertBRDBtn">
                            <span class="convert-icon"></span> Convert BRD to FRD
                        </button>
                    </div>
                `}
            </div>
        `;

        if (hasConvertedFRDs) {
            // Show list of existing FRDs to select from
            const selectBtn = document.getElementById('selectExistingFRDBtn');
            if (selectBtn) {
                selectBtn.addEventListener('click', () => {
                    this.showExistingFRDsSelection(documentId);
                });
            }

            const convertBtn = document.getElementById('convertNewFRDBtn');
            if (convertBtn) {
                convertBtn.addEventListener('click', async () => {
                    await this.handleBRDConversion(documentId);
                });
            }
        } else {
            const convertBtn = document.getElementById('convertBRDBtn');
            if (convertBtn) {
                convertBtn.addEventListener('click', async () => {
                    await this.handleBRDConversion(documentId);
                });
            }
        }
    }

    showExistingFRDsSelection(brdDocumentId) {
        const testcaseSection = document.getElementById('testcaseSection');
        
        testcaseSection.innerHTML = `
            <div class="generate-testcases-prompt">
                <div class="prompt-icon"></div>
                <h3>Select Converted FRD</h3>
                <p>Choose an FRD to generate test cases from:</p>
                <div class="document-children" style="margin-left: 0; border-left: none; padding-left: 0;">
                    ${this.brdChildrenFRDs.map(frd => {
                        const fileName = this.getFileNameFromPath(frd.filename || frd.file_path || `FRD_${frd.id}`);
                        return `
                            <div class="child-document-item" data-frd-id="${frd.id}">
                                <div class="child-doc-info">
                                    <h5>${this.escapeHtml(fileName)}</h5>
                                    <p>Created: ${this.formatDate(frd.created_at || frd.conversion_date)}</p>
                                    <span class="converted-badge">Converted FRD</span>
                                </div>
                                <button class="btn btn-primary btn-small generate-from-frd-btn">
                                    Generate Test Cases
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="margin-top: 20px;">
                    <button class="btn btn-secondary" id="backToBRDOptions">Back</button>
                </div>
            </div>
        `;

        // Add click handlers
        document.querySelectorAll('.generate-from-frd-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const frdId = btn.closest('.child-document-item').dataset.frdId;
                this.generateTestcasesForFRD(frdId);
            });
        });

        document.getElementById('backToBRDOptions').addEventListener('click', () => {
            this.showBRDConversionOption(brdDocumentId);
        });
    }

    async generateTestcasesForFRD(frdDocumentId) {
        try {
            // Store FRD ID for testcase generation
            testcaseService.frdDocumentId = frdDocumentId;
            
            // Generate testcases using BRD flow
            await testcaseService.generateBRDTestcases(this, this.currentProject.id, this.currentDocument.id);
        } catch (error) {
            console.error('Failed to generate testcases for FRD:', error);
            this.showError('Failed to generate testcases: ' + error.message);
        }
    }

    // FIXED BRD CONVERSION HANDLER
    async handleBRDConversion(documentId) {
        const testcaseSection = document.getElementById('testcaseSection');
        
        testcaseSection.innerHTML = `
            <div class="conversion-progress">
                <div class="conversion-header">
                    <h3>Converting BRD to FRD</h3>
                    <div class="conversion-status">
                        <div class="status-indicator pulse"></div>
                        <span id="conversionStatusText">Processing document...</span>
                    </div>
                </div>
                <div id="conversionContent" style="margin-top: 20px;">
                    <div class="progress-details" id="progressDetails"></div>
                </div>
            </div>
        `;

        try {
            let frdContent = '';
            let frdDocumentId = null;
            let totalChunks = 0;
            let processedChunks = 0;
            let frdFilename = null;
            
            const finalResult = await apiService.convertBRDToFRDStream(documentId, (event) => {
                const statusText = document.getElementById('conversionStatusText');
                const progressDetails = document.getElementById('progressDetails');
                
                if (!statusText || !progressDetails) return;
                
                switch (event.type) {
                    case 'start':
                        frdDocumentId = event.document_id;
                        totalChunks = event.total_chunks;
                        statusText.textContent = `Processing ${totalChunks} chunk${totalChunks > 1 ? 's' : ''}...`;
                        progressDetails.innerHTML = '<div class="loading-spinner">⏳ Analyzing document...</div>';
                        break;
                        
                    case 'batch_start':
                        statusText.textContent = `Processing batch ${event.batch} of ${event.total_batches}...`;
                        break;
                        
                    case 'chunk_complete':
                        processedChunks++;
                        if (event.frd_content) {
                            frdContent += event.frd_content + '\n\n';
                            progressDetails.innerHTML = `
                                <div class="progress-info">
                                    <p>Processed ${processedChunks} of ${totalChunks} chunks</p>
                                </div>
                                <pre class="converted-text-preview">${this.escapeHtml(frdContent.substring(0, 500))}${frdContent.length > 500 ? '...' : ''}</pre>
                            `;
                        }
                        break;
                        
                    case 'batch_complete':
                        statusText.textContent = `Batch ${event.batch} complete...`;
                        break;
                        
                    case 'finalizing':
                        statusText.textContent = 'Finalizing conversion...';
                        if (event.filename) frdFilename = event.filename;
                        if (event.document_id) frdDocumentId = event.document_id;
                        break;
                }
            });
            
            if (finalResult) {
                frdContent = finalResult.frd_content || frdContent;
                frdDocumentId = finalResult.frd_document_id || frdDocumentId;
                frdFilename = finalResult.frd_filename || frdFilename;
            }
            
            const conversionContent = document.getElementById('conversionContent');
            conversionContent.innerHTML = `
                <div class="conversion-output-section">
                    <div class="success-header">
                        <span class="success-icon">✓</span>
                        <h4>Conversion Complete</h4>
                    </div>
                    <div class="conversion-stats">
                        <span>Total Chunks: ${totalChunks}</span>
                        <span>FRD Document ID: ${frdDocumentId}</span>
                    </div>
                    <h5>Converted FRD Content</h5>
                    <pre class="converted-text">${this.escapeHtml(frdContent)}</pre>
                </div>
            `;

            testcaseService.frdDocumentId = frdDocumentId;
            this.currentDocument.linkedFRDId = frdDocumentId;
            this.currentDocument.linkedFRDFilename = frdFilename;

            // Reload BRD children to show the new FRD
            await this.loadBRDChildrenFRDs(documentId);

            const actionDiv = document.createElement('div');
            actionDiv.className = 'conversion-actions';
            actionDiv.innerHTML = `
                <button class="btn btn-primary" id="proceedWithTestcasesBtn">
                    <span class="proceed-icon"></span> Generate Test Cases
                </button>
                <button class="btn btn-secondary" id="viewConvertedFRDBtn">
                    <span class="view-icon"></span> View FRD Document
                </button>
            `;
            conversionContent.appendChild(actionDiv);

            document.getElementById('proceedWithTestcasesBtn').addEventListener('click', () => {
                this.generateTestcases(this.currentProject.id, documentId);
            });

            document.getElementById('viewConvertedFRDBtn').addEventListener('click', () => {
                this.openConvertedFRD(frdDocumentId, frdFilename);
            });

            this.showSuccess('BRD converted to FRD successfully!');

        } catch (error) {
            console.error('BRD conversion failed:', error);
            const conversionContent = document.getElementById('conversionContent');
            if (conversionContent) {
                conversionContent.innerHTML = `
                    <div class="error-message">
                        <span class="error-icon"></span>
                        <p>Failed to convert BRD: ${error.message}</p>
                    </div>
                `;
            }
            this.showError('Failed to convert BRD: ' + error.message);
        }
    }

    openConvertedFRD(frdDocumentId, frdName) {
        const fileName = frdName || `Converted_FRD_${frdDocumentId}`;
        this.openDocument(frdDocumentId, 'FRD', fileName);
    }

    showGenerateTestcasesButton(documentId) {
        const testcaseSection = document.getElementById('testcaseSection');
        testcaseSection.innerHTML = `
            <div class="generate-testcases-prompt">
                <div class="prompt-icon"></div>
                <h3>No Test Cases Available</h3>
                <p>Generate comprehensive test cases for this document using AI</p>
                <button class="btn btn-primary" id="generateTestcasesBtn">
                    <span class="generate-icon"></span> Generate Test Cases
                </button>
            </div>
        `;

        const generateBtn = document.getElementById('generateTestcasesBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generateTestcases(this.currentProject.id, documentId);
            });
        }
    }

    async generateTestcases(projectId, documentId) {
        try {
            const docType = this.currentDocument.type;
            await testcaseService.generateTestcases(this, projectId, documentId, docType);
        } catch (error) {
            console.error('Failed to generate testcases:', error);
            this.showError('Failed to generate testcases: ' + error.message);
        }
    }

    async loadTestcaseVersion(documentId, version) {
        try {
            if (this.testcaseCache.has(version)) {
                const response = this.testcaseCache.get(version);
                this.currentTestcaseVersion = version;
                this.renderTestcases(response);
                return;
            }

            const testcaseSection = document.getElementById('testcaseSection');
            testcaseSection.innerHTML = '<div class="loading">Loading testcases...</div>';

            const response = await apiService.getDocumentTestcases(documentId, version);

            this.testcaseCache.set(version, response);
            this.currentTestcaseVersion = version;
            
            if (!this.testcaseVersions.includes(version)) {
                this.testcaseVersions.push(version);
                this.testcaseVersions.sort((a, b) => a - b);
            }

            this.renderTestcases(response);
        } catch (error) {
            console.error('Failed to load testcase version:', error);
            this.showError('Failed to load testcase version.');
        }
    }

    renderTestcases(data) {
        const testcaseSection = document.getElementById('testcaseSection');
        
        const testcases = data.testcases || [];
        const version = data.version || 1;
        const testcasesCount = data.testcases_count || testcases.length;
        
        const maxVersion = Math.max(...this.testcaseVersions);

        testcaseSection.innerHTML = `
            <div class="testcase-header">
                <div class="testcase-title-section">
                    <h3>Test Cases</h3>
                    <span class="testcase-count">${testcasesCount} test cases</span>
                </div>
                <div class="testcase-controls">
                    <div class="version-controls">
                        <button class="version-btn" id="prevVersion" ${version <= 1 ? 'disabled' : ''}>
                            &lt;
                        </button>
                        <span class="version-label">Version ${version} of ${maxVersion}</span>
                        <button class="version-btn" id="nextVersion" ${version >= maxVersion ? 'disabled' : ''}>
                            &gt;
                        </button>
                    </div>
                    <button class="btn btn-primary btn-small" id="downloadTestcases">
                        Download TXT
                    </button>
                </div>
            </div>
            <div class="testcases-container">
                ${testcases.map((tc, index) => this.renderTestcaseCard(tc, index)).join('')}
            </div>
            
            <div class="refine-section">
                <div class="refine-header">
                    <h4>Refine Test Cases</h4>
                    <p class="refine-subtitle">Use AI to improve or modify these test cases</p>
                </div>
                <div class="inline-chat">
                    <textarea 
                        class="chat-input" 
                        id="refineInput"
                        placeholder="Describe how you want to refine these test cases... (e.g., 'Add more edge cases', 'Make steps more detailed', 'Add security test cases')"
                        rows="3"
                    ></textarea>
                    <div class="chat-actions">
                        <button class="btn btn-secondary btn-small" id="cancelRefine">Clear</button>
                        <button class="btn btn-primary btn-small" id="sendRefine">
                            <span class="send-icon"></span> Send
                        </button>
                    </div>
                    <div class="integration-notice" id="integrationNotice" style="display: none;">
                        <span class="notice-icon"></span>
                        <span id="noticeText">Processing...</span>
                    </div>
                </div>
            </div>
        `;

        const prevBtn = document.getElementById('prevVersion');
        const nextBtn = document.getElementById('nextVersion');
        const downloadBtn = document.getElementById('downloadTestcases');

        if (prevBtn && !prevBtn.disabled) {
            prevBtn.addEventListener('click', () => {
                this.loadTestcaseVersion(this.currentDocument.id, version - 1);
            });
        }

        if (nextBtn && !nextBtn.disabled) {
            nextBtn.addEventListener('click', () => {
                this.loadTestcaseVersion(this.currentDocument.id, version + 1);
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadTestcases(data, version);
            });
        }

        const refineInput = document.getElementById('refineInput');
        const sendRefineBtn = document.getElementById('sendRefine');
        const cancelRefineBtn = document.getElementById('cancelRefine');

        if (sendRefineBtn) {
            sendRefineBtn.addEventListener('click', async () => {
                const inputValue = refineInput.value.trim();
                if (inputValue) {
                    const docType = this.currentDocument.type;
                    await chatService.sendChatUpdate(
                        this,
                        this.currentProject.id,
                        this.currentDocument.id,
                        docType,
                        inputValue,
                        true
                    );
                }
            });
        }

        if (cancelRefineBtn) {
            cancelRefineBtn.addEventListener('click', () => {
                refineInput.value = '';
                document.getElementById('integrationNotice').style.display = 'none';
            });
        }
    }

    renderTestcaseCard(testcase, index) {
        return `
            <div class="testcase-card-flat">
                <div class="testcase-card-header-flat">
                    <span class="testcase-id">${testcase.id}</span>
                    <h4>${this.escapeHtml(testcase.title)}</h4>
                    <span class="priority ${testcase.priority}">${testcase.priority}</span>
                </div>
                <div class="testcase-card-content">
                    <div class="testcase-section">
                        <h5>Preconditions</h5>
                        <ul>
                            ${testcase.preconditions.map(pc => `<li>${this.escapeHtml(pc)}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="testcase-section">
                        <h5>Steps</h5>
                        <ol>
                            ${testcase.steps.map(step => `<li>${this.escapeHtml(step)}</li>`).join('')}
                        </ol>
                    </div>
                    <div class="testcase-section">
                        <h5>Expected Result</h5>
                        <p>${this.escapeHtml(testcase.expected)}</p>
                    </div>
                    ${testcase.addresses_issue ? `
                        <div class="testcase-section">
                            <h5>Addresses Issue</h5>
                            <p>${this.escapeHtml(testcase.addresses_issue)}</p>
                        </div>
                    ` : ''}
                    <div class="testcase-footer">
                        <span>Chunk ID: ${testcase.chunk_id}</span>
                        <span>Context: ${testcase.generated_with_context ? 'Yes' : 'No'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    downloadTestcases(data, version) {
        const testcases = data.testcases || [];
        const projectName = this.currentProject.name.replace(/[^a-z0-9]/gi, '_');
        const fileName = `${projectName}_testcases_v${version}.txt`;

        let content = `Test Cases - Version ${version}\n`;
        content += `Project: ${this.currentProject.name}\n`;
        content += `Document: ${this.currentDocument.name}\n`;
        content += `Total Test Cases: ${data.testcases_count || testcases.length}\n`;
        content += `Generated: ${new Date(data.created_at).toLocaleString()}\n`;
        content += `${'='.repeat(80)}\n\n`;

        testcases.forEach((tc, index) => {
            content += `Test Case ${index + 1}: ${tc.id}\n`;
            content += `Title: ${tc.title}\n`;
            content += `Priority: ${tc.priority}\n`;
            content += `Chunk ID: ${tc.chunk_id}\n`;
            content += `\nPreconditions:\n`;
            tc.preconditions.forEach((pc, i) => {
                content += `  ${i + 1}. ${pc}\n`;
            });
            content += `\nSteps:\n`;
            tc.steps.forEach((step, i) => {
                content += `  ${i + 1}. ${step}\n`;
            });
            content += `\nExpected Result:\n  ${tc.expected}\n`;
            if (tc.addresses_issue) {
                content += `\nAddresses Issue: ${tc.addresses_issue}\n`;
            }
            content += `\nGenerated with Context: ${tc.generated_with_context ? 'Yes' : 'No'}\n`;
            content += `${'-'.repeat(80)}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showSuccess(`Downloaded ${fileName}`);
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }

    clearCache() {
        this.documentCache.clear();
        this.testcaseCache.clear();
    }
}

// Create and export singleton instance
const app = new App();

// Make it available globally
window.app = app;
 