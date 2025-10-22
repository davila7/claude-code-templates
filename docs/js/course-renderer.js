/**
 * Custom Course Renderer for Claude Code Templates
 * Simple markdown-based course system with terminal theme
 */

class CourseRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.courseData = null;
        this.currentSection = 0;
    }

    /**
     * Load and render a course from markdown
     * @param {string} markdownContent - Raw markdown content
     */
    async render(markdownContent) {
        // Parse frontmatter and content
        const { metadata, content } = this.parseFrontmatter(markdownContent);
        this.courseData = { metadata, content };

        // Parse markdown to sections
        const sections = this.parseToSections(content);

        // Generate course HTML
        const courseHTML = this.generateCourseHTML(sections, metadata);

        // Inject into container
        this.container.innerHTML = courseHTML;

        // Setup sidebar navigation
        this.setupSidebar(sections);

        // Setup code highlighting and copy buttons
        this.setupCodeBlocks();

        // Setup quiz interactions
        this.setupQuizzes();

        // Apply syntax highlighting if available
        if (window.Prism) {
            Prism.highlightAll();
        }
    }

    /**
     * Parse frontmatter (YAML-like metadata)
     */
    parseFrontmatter(markdown) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
        const match = markdown.match(frontmatterRegex);

        if (match) {
            const metadataLines = match[1].split('\n');
            const metadata = {};
            metadataLines.forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length) {
                    metadata[key.trim()] = valueParts.join(':').trim();
                }
            });
            return { metadata, content: match[2] };
        }

        return { metadata: {}, content: markdown };
    }

    /**
     * Parse markdown into sections based on H2 headings
     */
    parseToSections(content) {
        const lines = content.split('\n');
        const sections = [];
        let currentSection = null;
        let hasContentBeforeFirstH2 = false;

        lines.forEach(line => {
            // Check if it's an H2 heading (section)
            if (line.startsWith('## ')) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line.replace('## ', '').trim(),
                    content: []
                };
            } else if (currentSection) {
                currentSection.content.push(line);
            } else if (line.trim() !== '' && !line.startsWith('#')) {
                // Content before first H2 - only if it's not empty or H1
                hasContentBeforeFirstH2 = true;
            }
        });

        if (currentSection) {
            sections.push(currentSection);
        }

        return sections;
    }

    /**
     * Generate complete course HTML
     */
    generateCourseHTML(sections, metadata) {
        return `
            <div class="course-container">
                <!-- Sidebar -->
                <aside class="course-sidebar">
                    <div class="course-header">
                        <h3>${metadata.title || 'Course'}</h3>
                        <span class="course-duration">${metadata.duration || '5 min'}</span>
                    </div>
                    <nav class="course-nav">
                        ${sections.map((section, index) => `
                            <a href="#section-${index}"
                               class="nav-item ${index === 0 ? 'active' : ''}"
                               data-section="${index}">
                                ${section.title}
                            </a>
                        `).join('')}
                    </nav>
                </aside>

                <!-- Main Content -->
                <main class="course-content">
                    ${sections.map((section, index) => `
                        <section id="section-${index}" class="course-section ${index === 0 ? 'active' : ''}">
                            <h2>${section.title}</h2>
                            ${this.renderMarkdown(section.content.join('\n'))}
                        </section>
                    `).join('')}
                </main>
            </div>
        `;
    }

    /**
     * Simple markdown to HTML converter
     */
    renderMarkdown(markdown) {
        let html = markdown;

        // Code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'bash';
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-lang">${language}</span>
                        <button class="copy-btn" onclick="courseRenderer.copyCode(this)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                        </button>
                    </div>
                    <pre><code class="language-${language}">${this.escapeHtml(code.trim())}</code></pre>
                </div>
            `;
        });

        // Quizzes
        html = html.replace(/\?>\s*(.+?)\n((?:- \[[ x]\] .+\n?)+)/g, (match, question, options) => {
            const optionList = options.trim().split('\n').map((opt, idx) => {
                const isCorrect = opt.includes('[x]');
                const text = opt.replace(/- \[[ x]\] /, '').trim();
                return `
                    <label class="quiz-option">
                        <input type="radio" name="quiz-${Date.now()}" value="${idx}" ${isCorrect ? 'data-correct="true"' : ''}>
                        <span>${text}</span>
                    </label>
                `;
            }).join('');

            return `
                <div class="quiz-container">
                    <div class="quiz-question">${question}</div>
                    <div class="quiz-options">
                        ${optionList}
                    </div>
                    <button class="quiz-check" onclick="courseRenderer.checkQuiz(this)">Check Answer</button>
                    <div class="quiz-feedback"></div>
                </div>
            `;
        });

        // Headings (H3-H6)
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Paragraphs
        html = html.split('\n\n').map(para => {
            para = para.trim();
            if (!para) return '';
            if (para.startsWith('<')) return para; // Already HTML
            return `<p>${para}</p>`;
        }).join('\n');

        return html;
    }

    /**
     * Setup sidebar navigation
     */
    setupSidebar(sections) {
        const navItems = this.container.querySelectorAll('.nav-item');
        const sectionElements = this.container.querySelectorAll('.course-section');

        navItems.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Update active states
                navItems.forEach(nav => nav.classList.remove('active'));
                sectionElements.forEach(section => section.classList.remove('active'));

                item.classList.add('active');
                sectionElements[index].classList.add('active');

                // No scroll - just switch sections
            });
        });
    }

    /**
     * Setup code blocks with copy functionality
     */
    setupCodeBlocks() {
        // Already handled in renderMarkdown
    }

    /**
     * Setup quiz interactions
     */
    setupQuizzes() {
        // Event listeners are added via onclick in HTML
    }

    /**
     * Copy code to clipboard
     */
    copyCode(button) {
        const codeBlock = button.closest('.code-block');
        const code = codeBlock.querySelector('code').textContent;

        navigator.clipboard.writeText(code).then(() => {
            const originalText = button.innerHTML;
            button.innerHTML = '✓ Copied!';
            button.style.backgroundColor = '#d57455';
            button.style.color = '#ffffff';

            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.backgroundColor = '';
                button.style.color = '';
            }, 2000);
        });
    }

    /**
     * Check quiz answer
     */
    checkQuiz(button) {
        const quizContainer = button.closest('.quiz-container');
        const selectedOption = quizContainer.querySelector('input[type="radio"]:checked');
        const feedback = quizContainer.querySelector('.quiz-feedback');
        const allOptions = quizContainer.querySelectorAll('input[type="radio"]');

        if (!selectedOption) {
            feedback.innerHTML = '<span class="feedback-warning">⚠️ Please select an answer</span>';
            return;
        }

        const isCorrect = selectedOption.hasAttribute('data-correct');

        if (isCorrect) {
            feedback.innerHTML = '<span class="feedback-correct">✓ Correct!</span>';
            selectedOption.parentElement.classList.add('correct');
        } else {
            // Find and highlight the correct answer
            let correctAnswer = null;
            allOptions.forEach(option => {
                if (option.hasAttribute('data-correct')) {
                    correctAnswer = option.parentElement.querySelector('span').textContent;
                    option.parentElement.classList.add('correct');
                }
            });

            selectedOption.parentElement.classList.add('incorrect');
            feedback.innerHTML = `<span class="feedback-incorrect">✗ Incorrect. The correct answer is: <strong>${correctAnswer}</strong></span>`;
        }

        button.disabled = true;
    }

    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global instance
let courseRenderer;

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
    window.CourseRenderer = CourseRenderer;
}
