// chat-service.js - Handles chat updates for testcases

class ChatService {
    constructor() {
        this.lastChatMessage = null;
        this.commitMode = true; // Default to commit mode
    }

    /**
     * Handle chat update based on document type
     */
    async sendChatUpdate(app, projectId, documentId, docType, message, commit = true) {
        try {
            this.lastChatMessage = message;

            if (docType === 'FRD') {
                return await this.sendFRDChatUpdate(app, projectId, documentId, message, commit);
            } else if (docType === 'BRD') {
                return await this.sendBRDChatUpdate(app, projectId, documentId, message, commit);
            } else {
                throw new Error('Unsupported document type: ' + docType);
            }
        } catch (error) {
            console.error('Chat update failed:', error);
            throw error;
        }
    }

    /**
     * Send chat update for FRD
     */
    async sendFRDChatUpdate(app, projectId, documentId, message, commit) {
        const integrationNotice = document.getElementById('integrationNotice');
        const refineInput = document.getElementById('refineInput');

        try {
            this.showLoading(integrationNotice, refineInput);

            const response = await apiService.chatUpdateFRDTestcases(
                projectId,
                documentId,
                message,
                commit
            );

            this.showSuccess(integrationNotice, refineInput, commit);
            
            // Reload testcases to reflect changes
            setTimeout(() => {
                app.loadTestcases(documentId);
            }, 2000);

            return response;
        } catch (error) {
            this.showError(integrationNotice, refineInput, error);
            throw error;
        }
    }

    /**
     * Send chat update for BRD (uses FRD ID)
     */
    async sendBRDChatUpdate(app, projectId, documentId, message, commit) {
        const integrationNotice = document.getElementById('integrationNotice');
        const refineInput = document.getElementById('refineInput');

        try {
            this.showLoading(integrationNotice, refineInput);

            // Get the FRD document ID (should be stored after conversion)
            const frdDocumentId = testcaseService.frdDocumentId || documentId;

            const response = await apiService.chatUpdateBRDTestcases(
                frdDocumentId,
                message,
                commit
            );

            this.showSuccess(integrationNotice, refineInput, commit);
            
            // Reload testcases to reflect changes
            setTimeout(() => {
                app.loadTestcases(documentId);
            }, 2000);

            return response;
        } catch (error) {
            this.showError(integrationNotice, refineInput, error);
            throw error;
        }
    }

    showLoading(noticeElement, inputElement) {
        if (noticeElement) {
            noticeElement.style.display = 'flex';
            noticeElement.className = 'integration-notice processing';
            noticeElement.innerHTML = '<span class="notice-icon">⏳</span><span>Processing your request...</span>';
        }

        if (inputElement) {
            inputElement.disabled = true;
        }

        const sendBtn = document.getElementById('sendRefine');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<span class="loading-spinner">⏳</span> Processing...';
        }
    }

    showSuccess(noticeElement, inputElement, commit) {
        if (noticeElement) {
            noticeElement.className = 'integration-notice success';
            const mode = commit ? 'saved' : 'previewed';
            noticeElement.innerHTML = `<span class="notice-icon">✅</span><span>Changes ${mode} successfully!</span>`;
        }

        setTimeout(() => {
            if (inputElement) {
                inputElement.value = '';
                inputElement.disabled = false;
            }

            const sendBtn = document.getElementById('sendRefine');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<span class="send-icon">✨</span> Send';
            }

            if (noticeElement) {
                noticeElement.style.display = 'none';
            }
        }, 2000);
    }

    showError(noticeElement, inputElement, error) {
        if (noticeElement) {
            noticeElement.className = 'integration-notice error';
            noticeElement.innerHTML = `<span class="notice-icon">❌</span><span>Error: ${error.message}</span>`;
        }

        setTimeout(() => {
            if (inputElement) {
                inputElement.disabled = false;
            }

            const sendBtn = document.getElementById('sendRefine');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<span class="send-icon">✨</span> Send';
            }

            if (noticeElement) {
                noticeElement.style.display = 'none';
            }
        }, 3000);
    }
}

// Create global instance
const chatService = new ChatService();