// Text Formatter - Standalone utility for formatting streaming content
class TextFormatter {
    static formatText(text) {
        if (!text) return '';
        
        // Handle completion messages
        if (text.includes('[Analysis complete') || text.includes('[Generation complete')) {
            return `<div class="completion-message">${this.escapeHtml(text)}</div>`;
        }

        let formatted = this.escapeHtml(text);
        
        // Enhanced markdown formatting
        formatted = formatted.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        formatted = formatted.replace(/^\*\*(.+):\*\*$/gm, '<h4>$1:</h4>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
        
        // Format lists
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
        
        // Wrap consecutive list items
        formatted = formatted.replace(/(<li>.*<\/li>\s*)+/g, (match) => {
            return `<ul>${match}</ul>`;
        });
        
        // Format code blocks (JSON)
        formatted = formatted.replace(/```json\n([\s\S]*?)\n```/g, '<pre class="json-code">$1</pre>');
        formatted = formatted.replace(/```\n([\s\S]*?)\n```/g, '<pre class="code-block">$1</pre>');
        
        // Format separators
        formatted = formatted.replace(/^---$/gm, '<hr>');
        
        // Handle paragraphs
        formatted = formatted.replace(/\n\n+/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        if (formatted && !formatted.includes('<p>') && !formatted.includes('<div>') && !formatted.includes('<h') && !formatted.includes('<ul>')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        return formatted;
    }

    static escapeHtml(text) {
        if (!text) return '';
        return text.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', 
            '"': '&quot;', "'": '&#039;'
        })[m]);
    }

    // Format test cases preview array into readable format
    static formatTestCasesPreview(previewArray) {
        if (!Array.isArray(previewArray)) return '';
        
        return previewArray.map(testCase => {
            let formatted = `\n## ${testCase.id}: ${testCase.title}\n`;
            
            if (testCase.preconditions && testCase.preconditions.length > 0) {
                formatted += `\n**Preconditions:**\n`;
                testCase.preconditions.forEach(condition => {
                    formatted += `- ${condition}\n`;
                });
            }
            
            if (testCase.steps && testCase.steps.length > 0) {
                formatted += `\n**Test Steps:**\n`;
                testCase.steps.forEach((step, index) => {
                    formatted += `${index + 1}. ${step}\n`;
                });
            }
            
            if (testCase.expected_result) {
                formatted += `\n**Expected Result:**\n${testCase.expected_result}\n`;
            }
            
            if (testCase.test_data) {
                formatted += `\n**Test Data:**\n${JSON.stringify(testCase.test_data, null, 2)}\n`;
            }
            
            return formatted;
        }).join('\n---\n');
    }
}

// Make TextFormatter globally available
window.TextFormatter = TextFormatter;