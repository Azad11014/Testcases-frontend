// Main Application with Test Case Management
class ProjectManager {
    constructor() {
        this.currentProject = null;
        this.currentDocument = null;
        this.currentTestCase = null;
        this.projects = [];
        this.testCases = [];
        this.currentStep = 1;
        this.currentView = 'document'; // 'document' | 'testcase'
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadProjects();
    }

    bindEvents() {
        // Navigation
        document.getElementById('backToProjects').addEventListener('click', () => this.showStep(1));
        document.getElementById('backToProject').addEventListener('click', () => this.backToProject());
        
        // Create project
        document.getElementById('createProjectBtn').addEventListener('click', () => this.showModal('createProjectModal'));
        document.getElementById('cancelCreate').addEventListener('click', () => this.hideModal('createProjectModal'));
        document.getElementById('createProjectForm').addEventListener('submit', (e) => this.handleCreateProject(e));

        // Upload document
        document.getElementById('uploadDocBtn').addEventListener('click', () => this.showModal('uploadDocModal'));
        document.getElementById('cancelUpload').addEventListener('click', () => this.hideModal('uploadDocModal'));
        document.getElementById('uploadDocForm').addEventListener('submit', (e) => this.handleUploadDocument(e));

        // Modal close
        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal.id);
            });
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal(modal.id);
            });
        });
    }

    async loadProjects() {
        const projectsList = document.getElementById('projectsList');
        
        try {
            projectsList.innerHTML = '<div class="loading">Loading projects...</div>';
            this.projects = await ProjectAPI.getAllProjects();
            this.renderProjectsList();
        } catch (error) {
            projectsList.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
    }

    renderProjectsList() {
        const projectsList = document.getElementById('projectsList');
        
        if (!this.projects.length) {
            projectsList.innerHTML = '<div class="loading">No projects found. Create your first project!</div>';
            return;
        }

        projectsList.innerHTML = this.projects.map(project => `
            <div class="project-card" onclick="app.selectProject(${project.id})">
                <h3>${this.escapeHtml(project.name)}</h3>
                <p>${this.escapeHtml(project.description || 'No description')}</p>
                <div class="project-meta">
                    <span>ID: ${project.id}</span>
                    <span>${project.documents?.length || 0} docs</span>
                </div>
            </div>
        `).join('');
    }

    async selectProject(projectId) {
        try {
            this.currentProject = await ProjectAPI.getProject(projectId);
            this.renderProjectDetails();
            this.showStep(2);
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    renderProjectDetails() {
        document.getElementById('selectedProjectTitle').textContent = this.currentProject.name;
        document.getElementById('projectDescription').textContent = this.currentProject.description || 'No description';

        const documentsList = document.getElementById('documentsList');
        
        if (!this.currentProject.documents?.length) {
            documentsList.innerHTML = '<div class="loading">No documents uploaded yet.</div>';
            return;
        }

        documentsList.innerHTML = this.currentProject.documents.map(doc => {
            const fileName = this.getFileName(doc.file_path);
            const uploadDate = doc.created_at ? new Date(doc.created_at).toLocaleString() : 'Unknown';
            
            return `
                <div class="document-item" onclick="app.openDocument(${doc.id}, '${doc.doctype}', '${this.escapeHtml(fileName).replace(/'/g, "\\'")}')">
                    <div class="document-info">
                        <h4>${this.escapeHtml(fileName)}</h4>
                        <p>Uploaded: ${uploadDate}</p>
                    </div>
                    <span class="document-type ${doc.doctype}">${doc.doctype}</span>
                </div>
            `;
        }).join('');
    }

    async openDocument(documentId, docType, fileName) {
        try {
            this.currentDocument = {
                id: documentId,
                doctype: docType,
                filename: fileName,
                projectId: this.currentProject.id
            };
            this.currentTestCase = null;
            this.currentView = 'document';

            this.showStep(3);
            this.renderDocumentViewer();

            // Load document content
            const textData = await ProjectAPI.extractText(this.currentProject.id, documentId);
            this.renderDocumentContent(textData);
            
            // Load existing test cases for this document
            await this.loadTestCases();

        } catch (error) {
            this.showError(`Error loading document: ${error.message}`);
            this.showStep(2);
        }
    }

    async loadTestCases() {
        try {
            this.testCases = await TestCaseAPI.listTestCases(this.currentProject.id, this.currentDocument.id);
            this.renderTestCasesList();
        } catch (error) {
            console.log('No existing test cases found or error loading:', error.message);
            this.testCases = [];
            this.renderTestCasesList();
        }
    }

    renderTestCasesList() {
        // Create test cases section if it doesn't exist
        let testCasesSection = document.getElementById('testCasesSection');
        if (!testCasesSection) {
            const documentActions = document.getElementById('documentActions');
            const testCasesHTML = `
                <div id="testCasesSection" class="section" style="display: block;">
                    <div class="section-header">
                        <h3>Existing Test Cases</h3>
                        <span class="test-cases-count">0 test cases</span>
                    </div>
                    <div id="testCasesList" class="test-cases-list">
                        <!-- Test cases will be loaded here -->
                    </div>
                </div>
            `;
            
            // Insert before document actions
            documentActions.insertAdjacentHTML('beforebegin', testCasesHTML);
            testCasesSection = document.getElementById('testCasesSection');
        }

        const testCasesList = document.getElementById('testCasesList');
        const testCasesCount = document.querySelector('.test-cases-count');
        
        if (!this.testCases.length) {
            testCasesList.innerHTML = '<div class="loading">No test cases found. Generate test cases using the actions below.</div>';
            testCasesCount.textContent = '0 test cases';
            return;
        }

        testCasesCount.textContent = `${this.testCases.length} test case${this.testCases.length !== 1 ? 's' : ''}`;

        testCasesList.innerHTML = this.testCases.map(testCase => {
            const createdDate = testCase.created_at ? new Date(testCase.created_at).toLocaleString() : 'Unknown';
            const status = testCase.status || 'Generated';
            
            return `
                <div class="test-case-item" onclick="app.openTestCase(${testCase.id})">
                    <div class="test-case-info">
                        <h4>Test Case #${testCase.id}</h4>
                        <p>Created: ${createdDate}</p>
                        <p class="test-case-description">${this.escapeHtml(testCase.description || 'Test case for document analysis')}</p>
                    </div>
                    <div class="test-case-meta">
                        <span class="test-case-status ${status.toLowerCase()}">${status}</span>
                        <span class="test-case-count">${testCase.total_tests || 0} tests</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    async openTestCase(testCaseId) {
        try {
            this.currentTestCase = { id: testCaseId };
            this.currentView = 'testcase';
            
            // Update the header to show we're viewing a test case
            document.getElementById('documentTitle').textContent = `Test Case #${testCaseId}`;
            document.getElementById('documentMeta').textContent = `Document: ${this.currentDocument.filename} • Project: ${this.currentProject.name}`;
            
            const typeHeader = document.getElementById('documentTypeHeader');
            typeHeader.textContent = 'TEST CASE';
            typeHeader.className = 'document-type TESTCASE';

            // Hide document actions and test cases list
            document.getElementById('documentActions').style.display = 'none';
            document.getElementById('testCasesSection').style.display = 'none';
            
            // Hide flow containers
            const brdFlow = document.getElementById('brdFlowContainer');
            const frdFlow = document.getElementById('frdFlowContainer');
            if (brdFlow) brdFlow.style.display = 'none';
            if (frdFlow) frdFlow.style.display = 'none';

            // Load test case content
            const testCaseData = await TestCaseAPI.previewTestCase(testCaseId);
            this.renderTestCaseContent(testCaseData);
            
            // Show test case specific actions
            this.showTestCaseActions();

        } catch (error) {
            this.showError(`Error loading test case: ${error.message}`);
        }
    }

    renderTestCaseContent(testCaseData) {
        const content = document.getElementById('documentContent');
        
        if (testCaseData && (testCaseData.content || testCaseData.test_cases || testCaseData.preview)) {
            const testContent = testCaseData.content || testCaseData.test_cases || testCaseData.preview;
            
            // Format test case content
            let formattedContent = '';
            if (typeof testContent === 'object') {
                formattedContent = this.formatTestCaseObject(testContent);
            } else {
                formattedContent = this.escapeHtml(testContent);
            }
            
            content.innerHTML = `
                <div class="test-case-content">
                    <div class="test-case-header">
                        <h3>Test Case Details</h3>
                        <div class="test-case-meta-info">
                            <span>ID: ${testCaseData.id || this.currentTestCase.id}</span>
                            <span>Total Tests: ${testCaseData.total_tests || 'Unknown'}</span>
                            <span>Status: ${testCaseData.status || 'Generated'}</span>
                        </div>
                    </div>
                    <pre class="test-case-body">${formattedContent}</pre>
                </div>
            `;
        } else {
            content.innerHTML = '<div class="error">No test case content available</div>';
        }
    }

    formatTestCaseObject(testCaseObj) {
        if (typeof testCaseObj === 'string') return testCaseObj;
        
        let formatted = '';
        
        if (testCaseObj.title) {
            formatted += `Title: ${testCaseObj.title}\n\n`;
        }
        
        if (testCaseObj.description) {
            formatted += `Description: ${testCaseObj.description}\n\n`;
        }
        
        if (testCaseObj.test_cases && Array.isArray(testCaseObj.test_cases)) {
            formatted += 'Test Cases:\n';
            testCaseObj.test_cases.forEach((testCase, index) => {
                formatted += `\n${index + 1}. ${testCase.name || `Test Case ${index + 1}`}\n`;
                if (testCase.description) formatted += `   Description: ${testCase.description}\n`;
                if (testCase.steps) formatted += `   Steps: ${testCase.steps}\n`;
                if (testCase.expected) formatted += `   Expected Result: ${testCase.expected}\n`;
            });
        } else {
            // If it's just a plain object, stringify it nicely
            formatted += JSON.stringify(testCaseObj, null, 2);
        }
        
        return formatted;
    }

    showTestCaseActions() {
        // Create test case actions section
        const testCaseActionsHTML = `
            <div id="testCaseActions" class="section">
                <div class="section-header">
                    <h3>Test Case Actions</h3>
                    <button id="backToDocument" class="btn btn-secondary">Back to Document</button>
                </div>
                <div class="action-buttons">
                    <button id="refineTestCaseBtn" class="btn btn-primary">
                        <span class="btn-icon"></span>
                        Refine Test Cases
                    </button>
                </div>
                
                <!-- Test Case Chat Interface -->
                <div id="testCaseChat" class="test-case-chat" style="display: none;">
                    <div class="section-header">
                        <h4>Refine Test Cases</h4>
                    </div>
                    <div class="inline-chat">
                        <div id="testCaseChatResponses" class="inline-responses"></div>
                        <div class="chat-input">
                            <textarea id="testCaseChatInput" placeholder="e.g., 'Add more edge cases for payment validation'" rows="2"></textarea>
                            <button id="testCaseChatSubmit" class="btn btn-primary">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing test case actions if any
        const existingActions = document.getElementById('testCaseActions');
        if (existingActions) existingActions.remove();

        // Insert test case actions
        document.getElementById('step3').insertAdjacentHTML('beforeend', testCaseActionsHTML);

        // Bind events
        this.bindTestCaseEvents();
    }

    bindTestCaseEvents() {
        document.getElementById('backToDocument').addEventListener('click', () => {
            this.backToDocument();
        });

        document.getElementById('refineTestCaseBtn').addEventListener('click', () => {
            this.showTestCaseChat();
        });

        document.getElementById('testCaseChatSubmit').addEventListener('click', () => {
            this.handleTestCaseChatSubmit();
        });

        document.getElementById('testCaseChatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleTestCaseChatSubmit();
            }
        });
    }

    showTestCaseChat() {
        const chatSection = document.getElementById('testCaseChat');
        chatSection.style.display = 'block';
        document.getElementById('testCaseChatInput').focus();
    }

    async handleTestCaseChatSubmit() {
        const input = document.getElementById('testCaseChatInput');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        try {
            input.disabled = true;
            this.updateButton('testCaseChatSubmit', 'Processing...', true);

            // Add user message to chat
            this.addTestCaseChatMessage(message, 'user');

            // Send update request to API
            const result = await TestCaseAPI.updateTestCaseChat(this.currentTestCase.id, message);
            
            // Add AI response to chat
            const responseText = result.response || result.content || result.message || 'Test case updated successfully';
            this.addTestCaseChatMessage(responseText, 'ai');

            // Clear input
            input.value = '';

            // Reload test case content to show updates
            const updatedTestCase = await TestCaseAPI.previewTestCase(this.currentTestCase.id);
            this.renderTestCaseContent(updatedTestCase);

        } catch (error) {
            console.error('Test case chat error:', error);
            this.addTestCaseChatMessage(`Error: ${error.message}`, 'error');
        } finally {
            input.disabled = false;
            input.focus();
            this.updateButton('testCaseChatSubmit', 'Send', false);
        }
    }

    addTestCaseChatMessage(message, type) {
        const container = document.getElementById('testCaseChatResponses');
        if (!container) return;

        const messageClass = type === 'user' ? 'user-query' : 
                           type === 'error' ? 'error-message' : 'ai-response';
        
        const icon = type === 'user' ? 'User:' : 
                    type === 'error' ? 'Error:' : 'AI:';

        const messageHTML = `
            <div class="inline-response">
                <div class="${messageClass}">
                    <div class="query-icon">${icon}</div>
                    <div class="message-content">${this.escapeHtml(message)}</div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', messageHTML);
        container.scrollTop = container.scrollHeight;
    }

    backToDocument() {
        this.currentTestCase = null;
        this.currentView = 'document';
        
        // Restore document view
        document.getElementById('documentTitle').textContent = this.currentDocument.filename;
        document.getElementById('documentMeta').textContent = `Project: ${this.currentProject.name} • ID: ${this.currentDocument.id}`;
        
        const typeHeader = document.getElementById('documentTypeHeader');
        typeHeader.textContent = this.currentDocument.doctype;
        typeHeader.className = `document-type ${this.currentDocument.doctype}`;

        // Show document sections
        document.getElementById('documentActions').style.display = 'block';
        document.getElementById('testCasesSection').style.display = 'block';
        
        // Show appropriate flow container
        const brdFlow = document.getElementById('brdFlowContainer');
        const frdFlow = document.getElementById('frdFlowContainer');
        
        if (this.currentDocument.doctype === 'BRD' && brdFlow) {
            brdFlow.style.display = 'block';
        } else if (this.currentDocument.doctype === 'FRD' && frdFlow) {
            frdFlow.style.display = 'block';
        }

        // Remove test case actions
        const testCaseActions = document.getElementById('testCaseActions');
        if (testCaseActions) testCaseActions.remove();

        // Reload document content
        this.loadDocumentContent();
    }

    async loadDocumentContent() {
        try {
            const textData = await ProjectAPI.extractText(this.currentProject.id, this.currentDocument.id);
            this.renderDocumentContent(textData);
        } catch (error) {
            console.error('Error reloading document content:', error);
        }
    }

    backToProject() {
        if (this.currentView === 'testcase') {
            this.backToDocument();
        } else {
            this.showStep(2);
        }
    }

    renderDocumentViewer() {
        document.getElementById('documentTitle').textContent = this.currentDocument.filename;
        document.getElementById('documentMeta').textContent = `Project: ${this.currentProject.name} • ID: ${this.currentDocument.id}`;
        
        const typeHeader = document.getElementById('documentTypeHeader');
        typeHeader.textContent = this.currentDocument.doctype;
        typeHeader.className = `document-type ${this.currentDocument.doctype}`;
    }

    renderDocumentContent(textData) {
        const content = document.getElementById('documentContent');
        const actions = document.getElementById('documentActions');

        const text = textData?.preview || textData?.content || textData?.text;
        
        if (text) {
            content.innerHTML = `<pre>${this.escapeHtml(text)}</pre>`;
            actions.style.display = 'block';
        } else {
            content.innerHTML = '<div class="error">No content available</div>';
            actions.style.display = 'none';
        }
    }

    async handleCreateProject(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            description: formData.get('description')
        };

        try {
            await ProjectAPI.createProject(data);
            this.hideModal('createProjectModal');
            this.showSuccess('Project created successfully!');
            e.target.reset();
            this.loadProjects();
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    async handleUploadDocument(e) {
        e.preventDefault();
        
        if (!this.currentProject) {
            this.showError('No project selected');
            return;
        }

        const formData = new FormData(e.target);
        const file = formData.get('file');
        const docType = formData.get('doctype');

        if (!file || !docType) {
            this.showError('Please select a file and document type');
            return;
        }

        try {
            await ProjectAPI.uploadDocument(this.currentProject.id, file, docType);
            this.hideModal('uploadDocModal');
            this.showSuccess('Document uploaded successfully!');
            e.target.reset();
            await this.selectProject(this.currentProject.id);
        } catch (error) {
            this.showError(`Error: ${error.message}`);
        }
    }

    showStep(stepNumber) {
        this.currentStep = stepNumber;
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step${stepNumber}`).classList.add('active');
    }

    showModal(modalId) { document.getElementById(modalId).classList.add('show'); }
    hideModal(modalId) { document.getElementById(modalId).classList.remove('show'); }

    showError(message) { alert('Error: ' + message); }
    showSuccess(message) { alert('Success: ' + message); }
    
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

    getFileName(filePath) {
        if (!filePath) return 'Unknown Document';
        return filePath.split(/[\\\/]/).pop() || 'Unknown Document';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProjectManager();
});