// main.js - Application Initialization and Event Handlers (UPDATED)

document.addEventListener('DOMContentLoaded', function() {
    console.log('Application initializing...');

    // Load projects on startup
    app.loadProjects();

    // ==================== STEP 1: PROJECT MANAGEMENT ====================
    
    // Create Project Button
    const createProjectBtn = document.getElementById('createProjectBtn');
    const createProjectModal = document.getElementById('createProjectModal');
    const createProjectForm = document.getElementById('createProjectForm');
    const cancelCreate = document.getElementById('cancelCreate');
    const closeButtons = document.querySelectorAll('.close');

    if (createProjectBtn) {
        createProjectBtn.addEventListener('click', () => {
            createProjectModal.style.display = 'block';
        });
    }

    if (cancelCreate) {
        cancelCreate.addEventListener('click', () => {
            createProjectModal.style.display = 'none';
            createProjectForm.reset();
        });
    }

    // Create Project Form Submission
    if (createProjectForm) {
        createProjectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createProjectForm);

            try {
                await app.createProject(formData);
                createProjectModal.style.display = 'none';
                createProjectForm.reset();
                app.showSuccess('Project created successfully!');
            } catch (error) {
                app.showError('Failed to create project: ' + error.message);
            }
        });
    }

    // ==================== STEP 2: DOCUMENT MANAGEMENT ====================
    
    // Back to Projects Button
    const backToProjects = document.getElementById('backToProjects');
    if (backToProjects) {
        backToProjects.addEventListener('click', () => {
            app.goToStep(1);
        });
    }

    // Upload Document Button
    const uploadDocBtn = document.getElementById('uploadDocBtn');
    const uploadDocModal = document.getElementById('uploadDocModal');
    const uploadDocForm = document.getElementById('uploadDocForm');
    const cancelUpload = document.getElementById('cancelUpload');

    if (uploadDocBtn) {
        uploadDocBtn.addEventListener('click', () => {
            uploadDocModal.style.display = 'block';
        });
    }

    if (cancelUpload) {
        cancelUpload.addEventListener('click', () => {
            uploadDocModal.style.display = 'none';
            uploadDocForm.reset();
        });
    }

    // Upload Document Form Submission
    if (uploadDocForm) {
        uploadDocForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!app.currentProject) {
                app.showError('No project selected');
                return;
            }

            const formData = new FormData(uploadDocForm);

            try {
                await app.uploadDocument(app.currentProject.id, formData);
                uploadDocModal.style.display = 'none';
                uploadDocForm.reset();
                app.showSuccess('Document uploaded successfully!');
            } catch (error) {
                app.showError('Failed to upload document: ' + error.message);
            }
        });
    }

    // ==================== STEP 3: DOCUMENT VIEWER ====================
    
    // Back to Project Button
    const backToProject = document.getElementById('backToProject');
    if (backToProject) {
        backToProject.addEventListener('click', () => {
            app.goToStep(2);
        });
    }

    // ==================== MODAL CLOSE HANDLERS ====================
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                const form = modal.querySelector('form');
                if (form) form.reset();
            }
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            const form = event.target.querySelector('form');
            if (form) form.reset();
        }
    });

    // ==================== OBSERVER FOR DYNAMIC CONTENT ====================
    
    // Observer to handle dynamically added child FRD items
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check if the added node or its children contain child-document-item
                        const childItems = node.classList?.contains('document-children') 
                            ? node.querySelectorAll('.child-document-item')
                            : (node.querySelectorAll?.('.child-document-item') || []);

                        if (childItems.length > 0) {
                            setupChildFRDClickHandlers();
                        }
                    }
                });
            }
        });
    });

    // Start observing the document content area
    const documentContent = document.getElementById('documentContent');
    if (documentContent) {
        observer.observe(documentContent, {
            childList: true,
            subtree: true
        });
    }

    // Setup child FRD click handlers
    function setupChildFRDClickHandlers() {
        document.querySelectorAll('.child-document-item').forEach(item => {
            // Remove existing listeners by cloning
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', (e) => {
                // Don't trigger if clicking on a button inside
                if (e.target.classList.contains('generate-from-frd-btn') || 
                    e.target.closest('.generate-from-frd-btn')) {
                    return;
                }
                
                const frdId = newItem.dataset.frdId;
                const frdName = newItem.dataset.frdName;
                
                if (frdId) {
                    app.openChildFRD(frdId, frdName);
                }
            });
        });
    }

    // ==================== KEYBOARD SHORTCUTS ====================
    
    document.addEventListener('keydown', (e) => {
        // Escape to close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
                const form = modal.querySelector('form');
                if (form) form.reset();
            });
        }

        // Ctrl/Cmd + K to focus search (if implemented)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            // Focus search if available
        }
    });

    // ==================== ERROR HANDLING ====================
    
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
    });

    console.log('Application initialized successfully');
});