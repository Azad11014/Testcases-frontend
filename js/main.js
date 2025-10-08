// main.js - Application Initialization and Event Handlers

// Modal Handler Class
class ModalHandler {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.closeBtn = this.modal.querySelector('.close');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close button
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.close();
            }
        });
    }

    open() {
        this.modal.style.display = 'block';
    }

    close() {
        this.modal.style.display = 'none';
        
        // Reset form if exists
        const form = this.modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
}

// Form Handler Class
class FormHandler {
    constructor(formId, onSubmit) {
        this.form = document.getElementById(formId);
        this.onSubmit = onSubmit;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = this.form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            
            try {
                // Disable submit button
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';

                // Get form data
                const formData = new FormData(this.form);
                
                // Call the submit handler
                await this.onSubmit(formData);
                
                // Reset form
                this.form.reset();
            } catch (error) {
                console.error('Form submission failed:', error);
                app.showError(error.message || 'An error occurred');
            } finally {
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Application initializing...');

    // Initialize modals
    const createProjectModal = new ModalHandler('createProjectModal');
    const uploadDocModal = new ModalHandler('uploadDocModal');

    // Setup navigation buttons
    setupNavigationButtons();

    // Setup modal open buttons
    setupModalButtons(createProjectModal, uploadDocModal);

    // Setup forms
    setupForms(createProjectModal, uploadDocModal);

    // Load initial data
    loadInitialData();

    console.log('Application initialized successfully');
});

// Navigation Button Setup
function setupNavigationButtons() {
    // Back to Projects button
    const backToProjectsBtn = document.getElementById('backToProjects');
    if (backToProjectsBtn) {
        backToProjectsBtn.addEventListener('click', () => {
            app.goToStep(1);
            app.currentProject = null;
        });
    }

    // Back to Project button
    const backToProjectBtn = document.getElementById('backToProject');
    if (backToProjectBtn) {
        backToProjectBtn.addEventListener('click', () => {
            app.goToStep(2);
            app.currentDocument = null;
        });
    }
}

// Modal Button Setup
function setupModalButtons(createProjectModal, uploadDocModal) {
    // Create Project button
    const createProjectBtn = document.getElementById('createProjectBtn');
    if (createProjectBtn) {
        createProjectBtn.addEventListener('click', () => {
            createProjectModal.open();
        });
    }

    // Cancel buttons
    const cancelCreateBtn = document.getElementById('cancelCreate');
    if (cancelCreateBtn) {
        cancelCreateBtn.addEventListener('click', () => {
            createProjectModal.close();
        });
    }

    // Upload Document button
    const uploadDocBtn = document.getElementById('uploadDocBtn');
    if (uploadDocBtn) {
        uploadDocBtn.addEventListener('click', () => {
            if (!app.currentProject) {
                app.showError('Please select a project first');
                return;
            }
            uploadDocModal.open();
        });
    }

    // Cancel upload button
    const cancelUploadBtn = document.getElementById('cancelUpload');
    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', () => {
            uploadDocModal.close();
        });
    }
}

// Form Setup
function setupForms(createProjectModal, uploadDocModal) {
    // Create Project Form
    new FormHandler('createProjectForm', async (formData) => {
        const project = await app.createProject(formData);
        createProjectModal.close();
        app.showSuccess(`Project "${project.name}" created successfully!`);
    });

    // Upload Document Form
    new FormHandler('uploadDocForm', async (formData) => {
        if (!app.currentProject) {
            throw new Error('No project selected');
        }

        const file = formData.get('file');
        const doctype = formData.get('doctype');

        if (!file || !doctype) {
            throw new Error('Please select a file and document type');
        }

        // Create FormData for upload
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('doctype', doctype);

        const response = await app.uploadDocument(app.currentProject.id, uploadData);
        uploadDocModal.close();
        app.showSuccess(`Document "${file.name}" uploaded successfully!`);
    });
}

// Load Initial Data
async function loadInitialData() {
    try {
        await app.loadProjects();
    } catch (error) {
        console.error('Failed to load initial data:', error);
        app.showError('Failed to load application data. Please refresh the page.');
    }
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Debug tools
window.debug = {
    app: () => app,
    api: () => apiService,
    clearCache: () => app.clearCache(),
    getCurrentProject: () => app.currentProject,
    getCurrentDocument: () => app.currentDocument,
    getProjects: () => app.projects,
    getDocuments: () => app.documents
};

console.log('Debug tools available via window.debug');