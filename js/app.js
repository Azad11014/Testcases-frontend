// app.js - Application State and Core Logic
class App {
    constructor() {
        this.currentProject = null;
        this.currentDocument = null;
        this.projects = [];
        this.documents = [];
        this.currentStep = 1;
        
        // Cache for document content
        this.documentCache = new Map();
        
        // Testcase state management
        this.testcaseVersions = [];
        this.currentTestcaseVersion = null;
        this.testcaseCache = new Map();
    }

    // Navigation methods
    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });

        // Show requested step
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
            // Count documents - handle different response structures
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

        // Add click handlers
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
            
            // Add to local array
            this.projects.push(response);
            
            // Re-render
            this.renderProjects();
            
            return response;
        } catch (error) {
            console.error('Failed to create project:', error);
            throw error;
        }
    }

    async selectProject(projectId) {
        try {
            // Fetch project with documents in a single API call
            const response = await apiService.getProject(projectId);
            this.currentProject = response;

            // Extract documents from the response
            this.documents = response.documents || [];

            // Update UI
            document.getElementById('selectedProjectTitle').textContent = this.currentProject.name;
            document.getElementById('projectDescription').textContent = 
                this.currentProject.description || 'No description available';

            // Render documents (already loaded from project API)
            this.renderDocuments();

            // Navigate to project details
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
            // Extract filename from file_path (handle both filename and file_path)
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

        // Add click handlers for documents
        document.querySelectorAll('.document-item').forEach(item => {
            item.addEventListener('click', () => {
                const docId = item.dataset.documentId;
                const docType = item.dataset.docType;
                const fileName = item.dataset.fileName;
                this.openDocument(docId, docType, fileName);
            });
        });
    }

    // Helper method to extract filename from path
    getFileNameFromPath(path) {
        if (!path) return 'Unknown Document';
        
        // Handle both forward and backward slashes
        const parts = path.split(/[/\\]/);
        const fileName = parts[parts.length - 1];
        
        // Remove doc_X_ prefix if exists (e.g., "doc_1_FRD_Payment_System.pdf")
        return fileName.replace(/^doc_\d+_/, '');
    }

    async uploadDocument(projectId, formData) {
        try {
            const response = await apiService.uploadDocument(projectId, formData);
            
            // Reload project with documents to get updated list
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

            // Reset testcase state
            this.testcaseVersions = [];
            this.currentTestcaseVersion = null;

            // Update UI
            document.getElementById('documentTitle').textContent = fileName;
            document.getElementById('documentMeta').textContent = `Document ID: ${documentId} | Type: ${docType}`;
            document.getElementById('documentTypeHeader').textContent = docType;
            document.getElementById('documentTypeHeader').className = `document-type-large ${docType}`;

            // Navigate to document view first
            this.goToStep(3);

            // Load document content
            await this.loadDocumentContent(documentId);

            // Load testcases (non-blocking)
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

            // Check cache first
            if (this.documentCache.has(documentId)) {
                contentDiv.innerHTML = this.documentCache.get(documentId);
                return;
            }

            console.log('Fetching document content for:', documentId);
            const response = await apiService.extractDocumentText(
                this.currentProject.id,
                documentId
            );

            console.log('Document extraction response:', response);

            // Handle different response structures
            let content = '';
            if (response.text) {
                content = response.text;
            } else if (response.content) {
                content = response.content;
            } else if (response.extracted_text) {
                content = response.extracted_text;
            } else if (response.preview) {
                // Handle preview field from API
                content = response.preview;
            } else if (response.data) {
                content = response.data;
            } else if (typeof response === 'string') {
                content = response;
            } else {
                // Show the full response structure for debugging
                console.error('Unexpected response structure:', response);
                content = `Unable to extract text. Response structure: ${JSON.stringify(Object.keys(response))}`;
            }

            if (!content || content.trim() === '') {
                content = 'Document appears to be empty or text could not be extracted.';
            }

            const formattedContent = this.formatDocumentContent(content);
            
            // Cache the content
            this.documentCache.set(documentId, formattedContent);
            
            contentDiv.innerHTML = formattedContent;
        } catch (error) {
            console.error('Failed to load document content:', error);
            document.getElementById('documentContent').innerHTML = 
                `<div class="error-message">Failed to load document content: ${error.message}</div>`;
        }
    }

    formatDocumentContent(content) {
        // Basic formatting for document content
        const escaped = this.escapeHtml(content);
        // Preserve line breaks and format as preformatted text
        return `<pre class="document-text">${escaped}</pre>`;
    }

    // Testcase methods
    async loadTestcases(documentId) {
        try {
            const testcaseSection = document.getElementById('testcaseSection');
            testcaseSection.innerHTML = '<div class="loading">Loading testcases...</div>';

            const response = await apiService.getDocumentTestcases(documentId);

            if (!response || !response.testcases || response.testcases.length === 0) {
                testcaseSection.innerHTML = '<div class="empty-state">No testcases available for this document.</div>';
                return;
            }

            // Store version info and discover all available versions
            this.currentTestcaseVersion = response.version;
            
            // Build list of all versions from 1 to current version
            this.testcaseVersions = [];
            for (let i = 1; i <= response.version; i++) {
                this.testcaseVersions.push(i);
            }
            
            // Cache this version
            this.testcaseCache.set(response.version, response);

            this.renderTestcases(response);
        } catch (error) {
            console.error('Failed to load testcases:', error);
            document.getElementById('testcaseSection').innerHTML = 
                '<div class="error-message">Failed to load testcases.</div>';
        }
    }

    async loadTestcaseVersion(documentId, version) {
        try {
            // Check cache first
            if (this.testcaseCache.has(version)) {
                console.log('Loading version from cache:', version);
                const response = this.testcaseCache.get(version);
                this.currentTestcaseVersion = version;
                this.renderTestcases(response);
                return;
            }

            const testcaseSection = document.getElementById('testcaseSection');
            testcaseSection.innerHTML = '<div class="loading">Loading testcases...</div>';

            console.log('Fetching version from API:', version);
            const response = await apiService.getDocumentTestcases(documentId, version);

            // Cache this version
            this.testcaseCache.set(version, response);
            this.currentTestcaseVersion = version;
            
            // Update available versions if this is a new max
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
                        <span class="version-label">Version ${version}</span>
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
                <button class="btn btn-secondary" id="refineTestcasesBtn" disabled>
                    <span class="refine-icon">✨</span> Refine Test Cases
                </button>
                <div class="inline-chat" id="inlineChat" style="display: none;">
                    <textarea 
                        class="chat-input" 
                        placeholder="Describe how you want to refine these test cases..."
                        rows="3"
                    ></textarea>
                    <div class="chat-actions">
                        <button class="btn btn-secondary btn-small" id="cancelRefine">Cancel</button>
                        <button class="btn btn-primary btn-small" id="sendRefine" disabled>Send</button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
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

        // Create and download file
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

    // Clear cache method
    clearCache() {
        this.documentCache.clear();
        this.testcaseCache.clear();
    }
}

// Create and export singleton instance
const app = new App();

// Make it available globally
window.app = app;