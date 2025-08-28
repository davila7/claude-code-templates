// Code Copy Functionality for Blog Articles
class CodeCopy {
    constructor() {
        this.initCodeBlocks();
        this.setupCopyFunctionality();
    }

    initCodeBlocks() {
        // Convert existing pre elements to new code-block structure
        const preElements = document.querySelectorAll('.article-content-full pre:not(.converted)');
        
        preElements.forEach(pre => {
            const code = pre.querySelector('code');
            if (!code) return;
            
            // Detect language from class or content
            const language = this.detectLanguage(code);
            const isTerminal = language === 'bash' || language === 'terminal';
            
            // Create new code block structure
            const codeBlock = document.createElement('div');
            codeBlock.className = isTerminal ? 'code-block terminal-block' : 'code-block';
            
            // Create header
            const header = document.createElement('div');
            header.className = 'code-header';
            
            const languageSpan = document.createElement('span');
            languageSpan.className = 'code-language';
            languageSpan.textContent = language;
            
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                Copy
            `;
            
            header.appendChild(languageSpan);
            header.appendChild(copyButton);
            
            // Clone and prepare the pre element
            const newPre = pre.cloneNode(true);
            newPre.classList.add('converted');
            
            // Assemble new structure
            codeBlock.appendChild(header);
            codeBlock.appendChild(newPre);
            
            // Replace original pre
            pre.parentNode.replaceChild(codeBlock, pre);
        });
    }

    detectLanguage(codeElement) {
        // Check for class-based language detection
        const className = codeElement.className;
        if (className.includes('language-')) {
            return className.match(/language-(\w+)/)[1];
        }
        
        // Check content patterns
        const content = codeElement.textContent;
        
        if (content.includes('npm ') || content.includes('$ ') || content.includes('claude-code ')) {
            return 'bash';
        }
        if (content.includes('import ') && content.includes('from ')) {
            return 'javascript';
        }
        if (content.includes('CREATE TABLE') || content.includes('SELECT ')) {
            return 'sql';
        }
        if (content.includes('{') && content.includes('"')) {
            return 'json';
        }
        if (content.includes('def ') || content.includes('import ')) {
            return 'python';
        }
        
        return 'text';
    }

    setupCopyFunctionality() {
        document.addEventListener('click', async (e) => {
            if (!e.target.closest('.copy-button')) return;
            
            const button = e.target.closest('.copy-button');
            const codeBlock = button.closest('.code-block');
            const pre = codeBlock.querySelector('pre');
            const code = pre.querySelector('code');
            
            if (!code) return;
            
            try {
                // Get clean text content
                let textToCopy = code.textContent;
                
                // Clean up terminal prompts if it's a terminal block
                if (codeBlock.classList.contains('terminal-block')) {
                    textToCopy = this.cleanTerminalOutput(textToCopy);
                }
                
                await navigator.clipboard.writeText(textToCopy);
                
                // Update button state
                const originalContent = button.innerHTML;
                button.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Copied!
                `;
                button.classList.add('copied');
                
                // Reset after 2 seconds
                setTimeout(() => {
                    button.innerHTML = originalContent;
                    button.classList.remove('copied');
                }, 2000);
                
            } catch (err) {
                console.error('Failed to copy code:', err);
                
                // Fallback: select text
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(code);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    }

    cleanTerminalOutput(text) {
        // Remove common terminal prompts and clean output
        return text
            .split('\n')
            .map(line => {
                // Remove prompts like "$ ", "❯ ", "claude-code> "
                line = line.replace(/^[\$❯]\s*/, '').replace(/^claude-code>\s*/, '');
                
                // Remove output/result comments (lines starting with # ✓)
                if (line.trim().startsWith('# ✓') || 
                    line.trim().startsWith('# Start using') ||
                    line.trim().startsWith('# Your .claude') ||
                    line.trim().startsWith('# This will') ||
                    line.includes('Components will be installed') ||
                    line.includes('directory now contains')) {
                    return '';
                }
                
                return line;
            })
            .filter(line => line.trim() !== '') // Remove empty lines
            .join('\n')
            .trim();
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new CodeCopy());
} else {
    new CodeCopy();
}