// Component Page JavaScript
class ComponentPageManager {
    constructor() {
        this.component = null;
        this.dataLoader = null;
        this.init();
    }

    async init() {
        console.log('Initializing Component Page Manager...');
        
        // Initialize data loader
        this.dataLoader = window.dataLoader || new DataLoader();
        
        // Load component from URL parameters
        await this.loadComponentFromURL();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    async loadComponentFromURL() {
        let componentType, componentName, componentPath;
        
        // Check if we're using SEO-friendly URLs: /component/type/name
        const pathParts = window.location.pathname.split('/').filter(part => part);
        if (pathParts.length >= 3 && pathParts[0] === 'component') {
            componentType = decodeURIComponent(pathParts[1]);
            componentName = decodeURIComponent(pathParts[2]);
            console.log('SEO URL Parameters:', { componentType, componentName });
        } else {
            // Fallback to query parameters
            const urlParams = new URLSearchParams(window.location.search);
            componentType = urlParams.get('type');
            componentName = urlParams.get('name');
            componentPath = urlParams.get('path');
            console.log('Query Parameters:', { componentType, componentName, componentPath });
        }

        if (!componentType || (!componentName && !componentPath)) {
            this.showError('Missing component parameters in URL');
            return;
        }

        try {
            // Load all components data
            const componentsData = await this.dataLoader.loadAllComponents();
            
            if (!componentsData) {
                throw new Error('Failed to load components data');
            }

            // Find the component
            const categoryKey = componentType + 's'; // Convert 'agent' to 'agents'
            const components = componentsData[categoryKey] || [];
            
            let component = null;
            
            // Try to find by name first, then by path
            if (componentName) {
                component = components.find(c => c.name === componentName);
                
                // If not found, try to find by path that ends with the component name
                if (!component) {
                    component = components.find(c => {
                        // Check if path ends with componentName.md or componentName.json
                        const pathEnd = `${componentName}.md`;
                        const pathEndJson = `${componentName}.json`;
                        return c.path && (c.path.endsWith(pathEnd) || c.path.endsWith(pathEndJson));
                    });
                }
            }
            
            if (!component && componentPath) {
                component = components.find(c => c.path === componentPath);
            }

            if (!component) {
                throw new Error(`Component not found: ${componentType}/${componentName || componentPath}`);
            }

            this.component = {
                ...component,
                type: componentType
            };

            await this.renderComponent();

        } catch (error) {
            console.error('Error loading component:', error);
            this.showError(error.message);
        }
    }

    async renderComponent() {
        if (!this.component) {
            this.showError('No component data available');
            return;
        }

        console.log('Rendering component:', this.component);

        // Hide loading state
        document.getElementById('loadingState').style.display = 'none';

        // Show component content
        document.getElementById('componentContent').style.display = 'block';

        // Render component header
        this.renderComponentHeader();

        // Render component description
        this.renderComponentDescription();

        // Render security validation section
        this.renderSecurityValidation();

        // Render metadata section
        await this.renderMetadataSection();

        // Render installation section
        this.renderInstallationSection();

        // Render component code
        await this.renderComponentCode();

        // Render GitHub link
        this.renderGitHubLink();

        // Update page metadata
        this.updatePageMetadata();
    }


    renderComponentHeader() {
        const typeConfig = {
            agent: { icon: '🤖', color: '#ff6b6b', badge: 'AGENT' },
            command: { icon: '⚡', color: '#4ecdc4', badge: 'COMMAND' },
            mcp: { icon: '🔌', color: '#45b7d1', badge: 'MCP' },
            setting: { icon: '⚙️', color: '#9c88ff', badge: 'SETTING' },
            hook: { icon: '🪝', color: '#ff8c42', badge: 'HOOK' },
            template: { icon: '📦', color: '#f9a825', badge: 'TEMPLATE' }
        };

        const config = typeConfig[this.component.type] || typeConfig.template;
        const formattedName = this.formatComponentName(this.component.name);

        // Update icon with null check
        const iconElement = document.getElementById('componentIcon');
        if (iconElement) {
            iconElement.textContent = config.icon;
        }
        
        // Update title with null check
        const titleElement = document.getElementById('componentTitle');
        if (titleElement) {
            titleElement.textContent = formattedName;
        }
        
        // Update type badge with null check
        const typeBadge = document.getElementById('componentTypeBadge');
        if (typeBadge) {
            typeBadge.textContent = config.badge;
            typeBadge.style.backgroundColor = config.color;
        }
        
        // Update category - restored for original design
        const category = this.component.category || 'General';
        const categoryElement = document.getElementById('componentCategory');
        if (categoryElement) {
            categoryElement.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        }

        // Update download badge
        const downloadBadge = document.getElementById('componentDownloadBadge');
        const downloadCount = document.getElementById('downloadCount');
        if (downloadBadge && downloadCount) {
            const downloads = this.component.downloads || 0;
            if (downloads > 0) {
                downloadBadge.style.display = 'inline-flex';
                downloadCount.textContent = this.formatNumber(downloads);
                downloadBadge.title = `${downloads.toLocaleString()} downloads`;
            } else {
                downloadBadge.style.display = 'none';
            }
        }

        // Add to cart button is set up in setupEventListeners()
    }

    renderComponentDescription() {
        const description = this.getComponentDescription();
        const descriptionElement = document.getElementById('componentDescription');
        if (descriptionElement) {
            descriptionElement.textContent = description;
        }
    }

    renderSecurityValidation() {
        const security = this.component.security;

        // If no security data, hide everything
        if (!security || !security.validated) {
            const validationSection = document.getElementById('validationSection');
            if (validationSection) validationSection.style.display = 'none';

            const validationBadge = document.getElementById('componentValidationBadge');
            if (validationBadge) validationBadge.style.display = 'none';
            return;
        }

        // Show validation section
        const validationSection = document.getElementById('validationSection');
        if (validationSection) validationSection.style.display = 'block';

        const score = security.score || 0;
        const isValid = security.valid;
        const errors = security.errorCount || 0;
        const warnings = security.warningCount || 0;

        // Determine color based on score
        let scoreColor = '#48bb78'; // Green
        let scoreStatus = 'Excellent';

        if (score < 70) {
            scoreColor = '#f56565'; // Red
            scoreStatus = 'Needs Attention';
        } else if (score < 85) {
            scoreColor = '#ed8936'; // Orange
            scoreStatus = 'Good';
        } else if (score < 100) {
            scoreColor = '#48bb78'; // Green
            scoreStatus = 'Very Good';
        } else if (score === 100) {
            scoreColor = '#48bb78'; // Green
            scoreStatus = 'Excellent';
        }

        // Only override to red if score is below 70 OR (invalid AND low errors)
        if (!isValid && score < 70) {
            scoreColor = '#f56565'; // Red
            scoreStatus = 'Needs Attention';
        }

        // Update header badge
        const validationBadge = document.getElementById('componentValidationBadge');
        const validationScoreSpan = document.getElementById('validationScore');
        if (validationBadge && validationScoreSpan) {
            validationBadge.style.display = 'inline-flex';
            validationBadge.style.backgroundColor = scoreColor + '20';
            validationBadge.style.borderColor = scoreColor + '50';
            validationBadge.style.color = scoreColor;
            validationScoreSpan.textContent = score;
            validationBadge.title = `Quality Score: ${score}/100 - Click to see details`;
            validationBadge.style.cursor = 'pointer';

            // Add click event to scroll to validation section
            validationBadge.onclick = function() {
                const validationSection = document.getElementById('validationSection');
                if (validationSection) {
                    validationSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Add a highlight animation
                    validationSection.style.animation = 'highlight 1s ease';
                    setTimeout(() => {
                        validationSection.style.animation = '';
                    }, 1000);
                }
            };
        }

        // Update score circle
        const scoreCircle = document.getElementById('scoreCircle');
        const scoreValue = document.getElementById('scoreValue');
        if (scoreCircle && scoreValue) {
            scoreCircle.style.borderColor = scoreColor;
            scoreValue.textContent = score;
            scoreValue.style.color = scoreColor;
        }

        // Update score status
        const scoreStatusEl = document.getElementById('scoreStatus');
        if (scoreStatusEl) {
            scoreStatusEl.textContent = scoreStatus;
            scoreStatusEl.style.color = scoreColor;
        }

        // Update inline stats
        const inlineErrors = document.getElementById('inlineErrors');
        const inlineWarnings = document.getElementById('inlineWarnings');
        if (inlineErrors) {
            inlineErrors.textContent = errors;
            inlineErrors.style.color = errors > 0 ? '#f56565' : '#48bb78';
        }
        if (inlineWarnings) {
            inlineWarnings.textContent = warnings;
            inlineWarnings.style.color = warnings > 0 ? '#ed8936' : '#48bb78';
        }

        // Render validation checks with detailed messages
        const validationChecks = document.getElementById('validationChecks');
        if (validationChecks && security.validators) {
            const checkDescriptions = {
                structural: 'Verifies file format, YAML frontmatter, required fields, and encoding',
                integrity: 'Checks for tampering using SHA256 hash and version tracking',
                semantic: 'Detects malicious patterns, prompt injection, and dangerous commands',
                references: 'Validates external URLs and prevents SSRF attacks',
                provenance: 'Confirms author metadata and repository information'
            };

            const checkLabels = {
                structural: 'Structure',
                integrity: 'Integrity',
                semantic: 'Content Safety',
                references: 'references',
                provenance: 'Source'
            };

            validationChecks.innerHTML = '';
            Object.entries(security.validators).forEach(([key, validatorData]) => {
                // Handle both old format (boolean) and new format (object with detailed data)
                const passed = typeof validatorData === 'boolean' ? validatorData : validatorData.valid;
                const hasErrors = typeof validatorData === 'object' && validatorData.errors && validatorData.errors.length > 0;
                const hasWarnings = typeof validatorData === 'object' && validatorData.warnings && validatorData.warnings.length > 0;
                const hasInfo = typeof validatorData === 'object' && validatorData.info && validatorData.info.length > 0;
                const hasDetails = hasErrors || hasWarnings || hasInfo || passed;

                // Determine status: passed, warning, or failed
                let status = 'passed';
                let icon = '✓';
                if (hasErrors) {
                    status = 'failed';
                    icon = '✗';
                } else if (hasWarnings) {
                    status = 'warning';
                    icon = '⚠';
                }

                const checkItem = document.createElement('div');
                checkItem.className = `validation-check-item ${status}`;
                checkItem.style.cursor = 'pointer';

                // Build HTML for check item
                checkItem.innerHTML = `
                    <div class="check-header">
                        <div class="check-main">
                            <span class="check-icon">${icon}</span>
                            <span class="check-label">${checkLabels[key] || key}</span>
                        </div>
                        <div class="check-stats">
                            ${typeof validatorData === 'object' ? `
                                ${validatorData.errorCount > 0 ? `<span class="check-error-count">${validatorData.errorCount} errors</span>` : ''}
                                ${validatorData.warningCount > 0 ? `<span class="check-warning-count">${validatorData.warningCount} warnings</span>` : ''}
                            ` : ''}
                        </div>
                    </div>
                `;

                // Add click event listener - all items are clickable now
                checkItem.addEventListener('click', () => {
                    window.openValidationModal(key, checkLabels[key] || key, validatorData, checkDescriptions[key]);
                });

                validationChecks.appendChild(checkItem);
            });
        }
    }

    async renderMetadataSection() {
        const metadataSection = document.getElementById('metadataSection');

        console.log('=== Metadata Section Debug ===');
        console.log('Component type:', this.component.type);
        console.log('Component name:', this.component.name);
        console.log('Component author:', this.component.author);
        console.log('Component repo:', this.component.repo);

        // Check if component has metadata fields directly from frontmatter
        const hasDirectAuthor = this.component.author && this.component.author.trim() !== '';
        const hasDirectRepo = this.component.repo && this.component.repo.trim() !== '';
        const hasDirectVersion = this.component.version && this.component.version.trim() !== '';
        const hasDirectLicense = this.component.license && this.component.license.trim() !== '';
        const hasDirectKeywords = this.component.keywords && this.component.keywords.length > 0;

        // For agents, try to load marketplace data
        let agentMetadata = null;
        if (this.component.type === 'agent') {
            try {
                const marketplace = await this.loadComponentsMarketplace();
                console.log('Components marketplace loaded:', marketplace);

                if (marketplace && marketplace.agents) {
                    const componentName = this.component.name.replace('.md', '');
                    console.log('Looking for component:', componentName);

                    agentMetadata = marketplace.agents.find(
                        agent => agent.name === componentName
                    );
                    console.log('Found agent metadata:', agentMetadata);
                }
            } catch (error) {
                console.error('Error loading marketplace metadata:', error);
            }
        }

        // Show metadata section if we have any metadata
        const hasMetadata = hasDirectAuthor || hasDirectRepo || hasDirectVersion || hasDirectLicense || hasDirectKeywords || agentMetadata;

        if (!hasMetadata) {
            console.log('No metadata available, hiding metadata section');
            if (metadataSection) metadataSection.style.display = 'none';
            return;
        }

        // Show metadata section
        if (metadataSection) metadataSection.style.display = 'block';

        // Populate version - prioritize direct version field, then marketplace
        const versionElement = document.getElementById('metadataVersion');
        if (versionElement) {
            const version = this.component.version || agentMetadata?.version || '--';
            versionElement.textContent = version;
        }

        // Populate author - prioritize direct author field, then marketplace
        const authorElement = document.getElementById('metadataAuthor');
        if (authorElement) {
            if (hasDirectAuthor) {
                authorElement.textContent = this.component.author;
            } else if (agentMetadata) {
                const authorName = agentMetadata.author?.name || agentMetadata.author || '--';
                authorElement.textContent = authorName;
            } else {
                authorElement.textContent = '--';
            }
        }

        // Populate license - prioritize direct license field, then marketplace
        const licenseElement = document.getElementById('metadataLicense');
        if (licenseElement) {
            const license = this.component.license || agentMetadata?.license || '--';
            licenseElement.textContent = license;
        }

        // Populate repository - prioritize direct repo field, then marketplace
        const repositoryLink = document.getElementById('metadataRepository');
        const repositoryNone = document.getElementById('metadataRepositoryNone');

        let repositoryUrl = null;

        // Priority 1: Direct repo field
        if (hasDirectRepo) {
            repositoryUrl = this.component.repo;
        }
        // Priority 2: Marketplace repository
        else if (agentMetadata?.repository) {
            repositoryUrl = agentMetadata.repository;
        }

        if (repositoryUrl) {
            if (repositoryLink) {
                repositoryLink.href = repositoryUrl;
                repositoryLink.style.display = 'inline-flex';
            }
            if (repositoryNone) {
                repositoryNone.style.display = 'none';
            }
        } else {
            if (repositoryLink) {
                repositoryLink.style.display = 'none';
            }
            if (repositoryNone) {
                repositoryNone.style.display = 'inline';
            }
        }

        // Populate keywords - prioritize direct keywords field, then marketplace
        const keywordsContainer = document.getElementById('metadataKeywords');
        if (keywordsContainer) {
            const keywords = this.component.keywords || agentMetadata?.keywords || [];
            if (keywords && keywords.length > 0) {
                keywordsContainer.innerHTML = '';
                keywords.forEach(keyword => {
                    const keywordChip = document.createElement('span');
                    keywordChip.className = 'metadata-keyword';
                    keywordChip.textContent = keyword;
                    keywordsContainer.appendChild(keywordChip);
                });
            } else {
                keywordsContainer.innerHTML = '<span class="metadata-value">--</span>';
            }
        }
    }

    async loadComponentsMarketplace() {
        try {
            // Check if components marketplace is already cached
            if (this.componentsMarketplace) {
                return this.componentsMarketplace;
            }

            // Use the already loaded components data from dataLoader
            const componentsData = await this.dataLoader.loadAllComponents();

            if (componentsData && componentsData.componentsMarketplace) {
                this.componentsMarketplace = componentsData.componentsMarketplace;
                console.log('Loaded components marketplace:', this.componentsMarketplace);
                return this.componentsMarketplace;
            }

            // Fallback: try to fetch marketplace.json directly from components/.claude-plugin/
            const marketplaceResponse = await fetch('https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/.claude-plugin/marketplace.json');
            if (marketplaceResponse.ok) {
                this.componentsMarketplace = await marketplaceResponse.json();
                console.log('Loaded components marketplace from GitHub:', this.componentsMarketplace);
                return this.componentsMarketplace;
            }

            console.warn('No components marketplace found');
            return null;
        } catch (error) {
            console.error('Error loading components marketplace:', error);
            return null;
        }
    }

    renderInstallationSection() {
        const componentPath = this.getCleanPath();
        const basicInstallCommand = `npx claude-code-templates@latest --${this.component.type}=${componentPath} --yes`;

        // Update basic installation command
        const basicInstallElement = document.getElementById('basicInstallCommand');
        if (basicInstallElement) {
            basicInstallElement.textContent = basicInstallCommand;
        }

        // Handle agent-specific sections
        if (this.component.type === 'agent') {
            this.renderGlobalAgentSection(componentPath);
            this.renderCloudSandboxSection(componentPath);
        } else {
            // Hide agent-specific sections for non-agents
            const globalAgentSection = document.getElementById('globalAgentSection');
            const cloudSandboxSection = document.getElementById('cloudSandboxSection');

            if (globalAgentSection) globalAgentSection.style.display = 'none';
            if (cloudSandboxSection) cloudSandboxSection.style.display = 'none';
        }
    }

    renderGlobalAgentSection(componentPath) {
        const globalAgentSection = document.getElementById('globalAgentSection');
        const globalAgentCommand = `npx claude-code-templates@latest --create-agent ${componentPath}`;
        const globalUsageCommand = `${componentPath.split('/').pop()} "your prompt here"`;

        const globalAgentCommandElement = document.getElementById('globalAgentCommand');
        const globalUsageCommandElement = document.getElementById('globalUsageCommand');
        
        if (globalAgentCommandElement) {
            globalAgentCommandElement.textContent = globalAgentCommand;
        }
        if (globalUsageCommandElement) {
            globalUsageCommandElement.textContent = globalUsageCommand;
        }
        
        if (globalAgentSection) {
            globalAgentSection.style.display = 'block';
        }
    }

    renderCloudSandboxSection(componentPath) {
        const cloudSandboxSection = document.getElementById('cloudSandboxSection');

        // Update all sandbox command examples with the component path
        const e2bSandboxCommand = `npx claude-code-templates@latest --sandbox e2b --agent=${componentPath} --prompt "your development task"`;
        const cloudflareSandboxCommand = `npx claude-code-templates@latest --sandbox cloudflare --agent=${componentPath} --prompt "your development task"`;
        const dockerSandboxCommand = `npx claude-code-templates@latest --sandbox docker --agent=${componentPath} --prompt "your development task"`;

        const e2bSandboxCommandElement = document.getElementById('e2bSandboxCommand');
        const cloudflareSandboxCommandElement = document.getElementById('cloudflareSandboxCommand');
        const dockerSandboxCommandElement = document.getElementById('dockerSandboxCommand');

        if (e2bSandboxCommandElement) {
            e2bSandboxCommandElement.textContent = e2bSandboxCommand;
        }
        if (cloudflareSandboxCommandElement) {
            cloudflareSandboxCommandElement.textContent = cloudflareSandboxCommand;
        }
        if (dockerSandboxCommandElement) {
            dockerSandboxCommandElement.textContent = dockerSandboxCommand;
        }

        if (cloudSandboxSection) {
            cloudSandboxSection.style.display = 'block';
        }
    }

    async renderComponentCode() {
        try {
            let content = this.component.content || 'No content available.';
            let language = 'plaintext';

            // Determine language based on file extension
            if (this.component.path) {
                const extension = this.component.path.split('.').pop();
                switch (extension) {
                    case 'md':
                        language = 'markdown';
                        break;
                    case 'json':
                        language = 'json';
                        // Pretty print JSON
                        try {
                            content = JSON.stringify(JSON.parse(content), null, 2);
                        } catch (e) {
                            console.warn('Could not parse JSON content:', e);
                        }
                        break;
                    case 'js':
                        language = 'javascript';
                        break;
                    case 'yml':
                    case 'yaml':
                        language = 'yaml';
                        break;
                }
            }

            // Collect line numbers with errors and warnings
            const errorLines = new Set();
            const warningLines = new Set();

            if (this.component.security && this.component.security.validators) {
                Object.values(this.component.security.validators).forEach(validator => {
                    if (validator.errors) {
                        validator.errors.forEach(error => {
                            // Check direct line property
                            if (error.line) {
                                errorLines.add(error.line);
                            }
                            // Check examples array
                            if (error.examples && error.examples.length > 0) {
                                error.examples.forEach(example => {
                                    if (example.line) {
                                        errorLines.add(example.line);
                                    }
                                });
                            }
                        });
                    }
                    if (validator.warnings) {
                        validator.warnings.forEach(warning => {
                            // Check direct line property
                            if (warning.line) {
                                warningLines.add(warning.line);
                            }
                            // Check examples array
                            if (warning.examples && warning.examples.length > 0) {
                                warning.examples.forEach(example => {
                                    if (example.line) {
                                        warningLines.add(example.line);
                                    }
                                });
                            }
                        });
                    }
                });
            }

            // Update code language indicator
            const codeLanguageElement = document.getElementById('codeLanguage');
            if (codeLanguageElement) {
                codeLanguageElement.textContent = language;
            }

            // Render code with syntax highlighting
            const codeElement = document.querySelector('#codeContent code');
            if (codeElement) {
                codeElement.innerHTML = this.highlightCode(content, language);
                codeElement.className = `language-${language}`;
            }

            // Generate line numbers with error/warning indicators
            const lines = content.split('\n');
            const lineNumbers = lines.map((_, index) => {
                const lineNum = index + 1;
                let className = '';
                let style = '';
                let title = '';

                if (errorLines.has(lineNum)) {
                    className = 'line-with-error';
                    style = 'background-color: rgba(245, 101, 101, 0.15); color: #f56565; font-weight: 600; border-left: 3px solid #f56565; padding-left: 5px; cursor: pointer;';
                    title = 'Line has validation errors - Click to see details';
                } else if (warningLines.has(lineNum)) {
                    className = 'line-with-warning';
                    style = 'background-color: rgba(237, 137, 54, 0.15); color: #ed8936; font-weight: 600; border-left: 3px solid #ed8936; padding-left: 5px; cursor: pointer;';
                    title = 'Line has validation warnings - Click to see details';
                }

                return `<span class="${className}" style="${style}" title="${title}" data-line-number="${lineNum}">${lineNum}</span>`;
            }).join('');

            const lineNumbersElement = document.getElementById('lineNumbers');
            if (lineNumbersElement) {
                lineNumbersElement.innerHTML = lineNumbers;

                // Add click event listeners to error/warning line numbers
                const clickableLines = lineNumbersElement.querySelectorAll('.line-with-error, .line-with-warning');
                clickableLines.forEach(lineSpan => {
                    lineSpan.addEventListener('click', () => {
                        // Find which validator has the error for this line
                        const lineNum = parseInt(lineSpan.getAttribute('data-line-number'));

                        if (this.component.security && this.component.security.validators) {
                            // Look for the validator with this line number
                            for (const [validatorKey, validatorData] of Object.entries(this.component.security.validators)) {
                                if (typeof validatorData === 'object') {
                                    // Check if this validator has errors/warnings for this line
                                    const hasError = validatorData.errors && validatorData.errors.some(error => {
                                        if (error.line === lineNum) return true;
                                        if (error.examples && error.examples.some(ex => ex.line === lineNum)) return true;
                                        return false;
                                    });

                                    const hasWarning = validatorData.warnings && validatorData.warnings.some(warning => {
                                        if (warning.line === lineNum) return true;
                                        if (warning.examples && warning.examples.some(ex => ex.line === lineNum)) return true;
                                        return false;
                                    });

                                    if (hasError || hasWarning) {
                                        // Found the validator with this line, open its modal
                                        const checkLabels = {
                                            structural: 'Structure',
                                            integrity: 'Integrity',
                                            semantic: 'Content Safety',
                                            references: 'references',
                                            provenance: 'Source'
                                        };

                                        const checkDescriptions = {
                                            structural: 'Verifies file format, YAML frontmatter, required fields, and encoding',
                                            integrity: 'Checks for tampering using SHA256 hash and version tracking',
                                            semantic: 'Detects malicious patterns, prompt injection, and dangerous commands',
                                            references: 'Validates external URLs and prevents SSRF attacks',
                                            provenance: 'Confirms author metadata and repository information'
                                        };

                                        window.openValidationModal(
                                            validatorKey,
                                            checkLabels[validatorKey] || validatorKey,
                                            validatorData,
                                            checkDescriptions[validatorKey]
                                        );
                                        break;
                                    }
                                }
                            }
                        }
                    });
                });
            }

            // Add corresponding highlighting to code lines
            if (errorLines.size > 0 || warningLines.size > 0) {
                const codeLines = codeElement.innerHTML.split('\n');
                const highlightedLines = codeLines.map((line, index) => {
                    const lineNum = index + 1;
                    if (errorLines.has(lineNum)) {
                        return `<span style="background-color: rgba(245, 101, 101, 0.08); display: block; margin: 0 -10px; padding: 0 10px;">${line}</span>`;
                    } else if (warningLines.has(lineNum)) {
                        return `<span style="background-color: rgba(237, 137, 54, 0.08); display: block; margin: 0 -10px; padding: 0 10px;">${line}</span>`;
                    }
                    return line;
                });
                codeElement.innerHTML = highlightedLines.join('\n');
            }

            // Sync scroll between line numbers and code content
            const codeContentDiv = document.getElementById('codeContent');
            if (lineNumbersElement && codeContentDiv) {
                codeContentDiv.addEventListener('scroll', function() {
                    lineNumbersElement.scrollTop = codeContentDiv.scrollTop;
                });
            }

        } catch (error) {
            console.error('Error rendering component code:', error);
            const codeElement = document.querySelector('#codeContent code');
            if (codeElement) {
                codeElement.textContent = 'Error loading component content.';
            }
        }
    }

    renderGitHubLink() {
        const githubUrl = this.generateGitHubURL();
        const githubLinkElement = document.getElementById('githubLink');
        if (githubLinkElement) {
            githubLinkElement.href = githubUrl;
        }
    }

    generateGitHubURL() {
        let githubUrl = 'https://github.com/davila7/claude-code-templates/';
        
        if (this.component.type === 'template') {
            githubUrl += `tree/main/cli-tool/templates/${this.component.folderPath || ''}`;
        } else {
            const componentPath = this.component.path || this.component.name;
            githubUrl += `blob/main/cli-tool/components/${this.component.type}s/${componentPath}`;
        }
        
        return githubUrl;
    }



    setupEventListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.loadComponentFromURL();
        });
        
        // Handle Add to Stack button
        const addToCartBtn = document.getElementById('addToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.component) {
                    // Debug logging for production
                    console.log('=== Add to Cart Debug ===');
                    console.log('Component object:', this.component);
                    console.log('Component type:', this.component.type);
                    console.log('Component name:', this.component.name);
                    console.log('Component path:', this.component.path);
                    
                    // Check if cartManager exists
                    if (typeof addToCart === 'function') {
                        // Convert component type to plural format
                        const componentType = this.getComponentTypePlural();
                        
                        console.log('Plural type for cart:', componentType);
                        
                        if (!componentType) {
                            console.error('Failed to get component type plural');
                            alert('Unable to determine component type. Please refresh the page.');
                            return;
                        }
                        
                        if (this.component.name && this.component.path) {
                            // Create component object that matches cart manager expectations
                            // Clean component name (remove .md extension and format properly)
                            const cleanName = this.getCleanComponentName();
                            const componentItem = {
                                name: cleanName,
                                path: this.component.path,
                                category: this.component.category
                            };
                            console.log('Sending to cart:', componentItem, componentType);
                            addToCart(componentItem, componentType);
                        } else {
                            console.error('Missing component name or path:', this.component);
                            alert('Unable to add component: missing component information');
                        }
                    } else {
                        console.error('Cart functionality not available');
                        console.log('typeof addToCart:', typeof addToCart);
                        console.log('window.addToCart:', window.addToCart);
                        // Fallback: show a message or redirect to main page
                        alert('Cart functionality not available. Please return to the main page to add components to your stack.');
                    }
                } else {
                    console.error('No component data available');
                    alert('Component data not loaded. Please refresh the page.');
                }
            });
        }
    }
    
    getComponentType() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('type');
    }
    
    getComponentTypePlural() {
        // Get type from the component object itself
        const type = this.component?.type;
        
        if (!type) {
            console.error('Component type not found in component object');
            return null;
        }
        
        // Convert singular type to plural for cart manager
        const typeMapping = {
            'agent': 'agents',
            'command': 'commands',
            'setting': 'settings',
            'hook': 'hooks',
            'mcp': 'mcps',
            'template': 'templates'
        };
        
        return typeMapping[type] || type + 's';
    }
    
    getComponentFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('name') || urlParams.get('path');
    }
    
    getCleanComponentName() {
        if (!this.component || !this.component.name) {
            return 'Unknown Component';
        }
        
        let cleanName = this.component.name;
        
        // Remove .md extension if present
        if (cleanName.endsWith('.md')) {
            cleanName = cleanName.slice(0, -3);
        }
        
        // Convert kebab-case or snake_case to Title Case
        cleanName = cleanName
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
            
        return cleanName;
    }

    updatePageMetadata() {
        const cleanName = this.getCleanComponentName(this.component.name);
        const description = this.getComponentDescription();
        const typeCapitalized = this.component.type.charAt(0).toUpperCase() + this.component.type.slice(1);
        const category = this.component.category || 'Development';
        
        // Enhanced page title with component type and category
        const pageTitle = `${cleanName} ${typeCapitalized} - Claude Code Templates`;
        const enhancedDescription = `${description} | ${typeCapitalized} for ${category} | Claude Code Templates - AI-powered development tools`;
        
        // Generate proper canonical URL for SEO
        const canonicalURL = this.generateCanonicalURL();

        // Update page title
        document.title = pageTitle;
        const pageTitleElement = document.getElementById('page-title');
        if (pageTitleElement) {
            pageTitleElement.textContent = pageTitle;
        }

        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.content = enhancedDescription;
        }

        // Update keywords
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
            metaKeywords.content = `${cleanName}, ${this.component.type}, ${category}, Claude Code, AI development, automation, ${this.component.type}s, templates`;
        }

        // Update canonical URL
        const canonicalLink = document.getElementById('canonical-url');
        if (canonicalLink) {
            canonicalLink.href = canonicalURL;
        }

        // Update Open Graph meta tags
        const ogUrl = document.getElementById('og-url');
        const ogTitle = document.getElementById('og-title');
        const ogDescription = document.getElementById('og-description');
        
        if (ogUrl) ogUrl.content = canonicalURL;
        if (ogTitle) ogTitle.content = pageTitle;
        if (ogDescription) ogDescription.content = enhancedDescription;

        // Update Twitter meta tags
        const twitterUrl = document.getElementById('twitter-url');
        const twitterTitle = document.getElementById('twitter-title');
        const twitterDescription = document.getElementById('twitter-description');
        
        if (twitterUrl) twitterUrl.content = canonicalURL;
        if (twitterTitle) twitterTitle.content = pageTitle;
        if (twitterDescription) twitterDescription.content = enhancedDescription;

        // Add structured data for better SEO
        this.addStructuredData(cleanName, description, typeCapitalized, category, canonicalURL);
    }

    generateCanonicalURL() {
        // Generate SEO-friendly canonical URL
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('5500');
        
        if (!isLocal && this.component.type && this.component.name) {
            // Use SEO-friendly URL for production
            let cleanName = this.component.name;
            if (cleanName.endsWith('.md')) {
                cleanName = cleanName.slice(0, -3);
            }
            if (cleanName.endsWith('.json')) {
                cleanName = cleanName.slice(0, -5);
            }
            
            const baseUrl = window.location.origin;
            return `${baseUrl}/component/${encodeURIComponent(this.component.type)}/${encodeURIComponent(cleanName)}`;
        }
        
        // Fallback to current URL
        return window.location.href;
    }

    addStructuredData(name, description, type, category, url) {
        // Remove existing structured data
        const existingScript = document.getElementById('component-structured-data');
        if (existingScript) {
            existingScript.remove();
        }

        // Add new structured data
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": name,
            "applicationCategory": "DeveloperApplication",
            "applicationSubCategory": `${type} Component`,
            "description": description,
            "operatingSystem": ["Windows", "macOS", "Linux"],
            "url": url,
            "author": {
                "@type": "Organization",
                "name": "Claude Code Templates Community"
            },
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
            },
            "keywords": `${name}, ${type}, ${category}, Claude Code, AI development`,
            "programmingLanguage": type === "command" ? "Shell" : "Configuration",
            "relatedLink": "https://www.anthropic.com/claude-code"
        };

        const script = document.createElement('script');
        script.id = 'component-structured-data';
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(structuredData, null, 2);
        document.head.appendChild(script);
    }


    // Utility methods
    formatComponentName(name) {
        return name.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num.toString();
    }

    getComponentDescription() {
        let description = this.component.description || '';
        
        if (!description && this.component.content) {
            const descMatch = this.component.content.match(/description:\s*(.+?)(?:\n|$)/);
            if (descMatch) {
                description = descMatch[1].trim().replace(/^["']|["']$/g, '');
            } else {
                const lines = this.component.content.split('\n');
                const firstParagraph = lines.find(line => 
                    line.trim() && !line.startsWith('---') && !line.startsWith('#')
                );
                if (firstParagraph) {
                    description = firstParagraph.trim();
                }
            }
        }
        
        if (!description) {
            description = `A ${this.component.type} component for enhanced development workflow.`;
        }
        
        return description;
    }

    getCleanPath() {
        let componentPath = this.component.path || this.component.name;
        
        // Remove file extensions
        if (componentPath.endsWith('.md') || componentPath.endsWith('.json')) {
            componentPath = componentPath.replace(/\.(md|json)$/, '');
        }
        
        return componentPath;
    }

    highlightCode(content, language) {
        // Basic syntax highlighting (same as modal)
        let highlighted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        if (language === 'markdown' || language === 'yaml') {
            // Highlight YAML/Markdown frontmatter keys (blue)
            highlighted = highlighted.replace(/^([a-zA-Z_-]+):/gm, '<span style="color: #569cd6;">$1</span>:');
            
            // Highlight strings in quotes (orange)
            highlighted = highlighted.replace(/&quot;([^&]+?)&quot;/g, '<span style="color: #ce9178;">&quot;$1&quot;</span>');
            
            // Highlight important keywords (light blue)
            highlighted = highlighted.replace(/\b(hackathon|strategy|AI|solution|ideation|evaluation|projects|feedback|concepts|feasibility|guidance|agent|specialist|brainstorming|winning|judge|feedback|Context|User|Examples)\b/gi, '<span style="color: #4fc1ff;">$1</span>');
            
            // Highlight markdown headers (blue)
            highlighted = highlighted.replace(/^(#+)\s*(.+)$/gm, '<span style="color: #569cd6;">$1</span> <span style="color: #dcdcaa;">$2</span>');
            
            // Highlight code in backticks
            highlighted = highlighted.replace(/`([^`]+)`/g, '<span style="color: #ce9178;">$1</span>');
            
            // Highlight YAML separators
            highlighted = highlighted.replace(/^---$/gm, '<span style="color: #808080;">---</span>');
        }
        
        return highlighted;
    }

    showError(message) {
        console.error('Component page error:', message);
        
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('componentContent').style.display = 'none';
        document.getElementById('errorState').style.display = 'block';
        
        // Update error message if needed
        const errorElement = document.querySelector('#errorState p');
        if (errorElement && message !== 'Missing component parameters in URL') {
            errorElement.textContent = message;
        }
    }

    // Static method to create URL for component
    static createComponentURL(type, name, path) {
        // Detect if we're in local development
        const isLocal = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.includes('5500');
        
        if (!isLocal && type && name) {
            // Use SEO-friendly URL structure for production: /component/type/name
            let cleanName = name;
            if (cleanName.endsWith('.md')) {
                cleanName = cleanName.slice(0, -3);
            }
            if (cleanName.endsWith('.json')) {
                cleanName = cleanName.slice(0, -5);
            }
            
            return `component/${encodeURIComponent(type)}/${encodeURIComponent(cleanName)}`;
        }
        
        // Use query parameters for local development or fallback
        const params = new URLSearchParams();
        params.set('type', type);
        if (name) params.set('name', name);
        if (path) params.set('path', path);
        
        return `component.html?${params.toString()}`;
    }
}

// Global function for creating component URLs (used by other scripts)
function createComponentURL(type, name, path) {
    return ComponentPageManager.createComponentURL(type, name, path);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.componentPageManager = new ComponentPageManager();
});

// Export for other scripts
window.ComponentPageManager = ComponentPageManager;

// Component Share functionality
function toggleComponentShareDropdown() {
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown) {
        shareDropdown.classList.toggle('open');
    }
}

function shareComponentOnTwitter() {
    const componentManager = window.componentPageManager;
    let message;
    
    if (componentManager && componentManager.component) {
        const cleanName = componentManager.getCleanComponentName(componentManager.component.name);
        const type = componentManager.component.type.charAt(0).toUpperCase() + componentManager.component.type.slice(1);
        const category = componentManager.component.category || 'Development';
        const canonicalURL = componentManager.generateCanonicalURL();
        
        message = `🚀 Found this amazing ${cleanName} ${type} for Claude Code!

Perfect for ${category.toLowerCase()} workflows with AI-powered automation.

${canonicalURL}

#ClaudeCode #AI #Development #${category.replace(/\s+/g, '')} #Automation`;
    } else {
        // Fallback message
        const componentTitle = document.getElementById('componentTitle')?.textContent || 'Claude Code Component';
        const currentURL = window.location.href;
        message = `🚀 Check out this ${componentTitle} for Claude Code!

Perfect for AI-powered development workflows.

${currentURL}

#ClaudeCode #AI #Development`;
    }
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(twitterUrl, '_blank');
    
    // Close dropdown after sharing
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown) {
        shareDropdown.classList.remove('open');
    }
}

function shareComponentOnThreads() {
    const componentManager = window.componentPageManager;
    let message;
    
    if (componentManager && componentManager.component) {
        const cleanName = componentManager.getCleanComponentName(componentManager.component.name);
        const type = componentManager.component.type.charAt(0).toUpperCase() + componentManager.component.type.slice(1);
        const category = componentManager.component.category || 'Development';
        const canonicalURL = componentManager.generateCanonicalURL();
        
        message = `🚀 Found this amazing ${cleanName} ${type} for Claude Code!

Perfect for ${category.toLowerCase()} workflows with AI-powered automation.

${canonicalURL}

#ClaudeCode #AI #Development #${category.replace(/\s+/g, '')} #Automation`;
    } else {
        // Fallback message
        const componentTitle = document.getElementById('componentTitle')?.textContent || 'Claude Code Component';
        const currentURL = window.location.href;
        message = `🚀 Check out this ${componentTitle} for Claude Code!

Perfect for AI-powered development workflows.

${currentURL}

#ClaudeCode #AI #Development`;
    }
    
    const threadsUrl = `https://threads.net/intent/post?text=${encodeURIComponent(message)}`;
    window.open(threadsUrl, '_blank');
    
    // Close dropdown after sharing
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown) {
        shareDropdown.classList.remove('open');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const shareDropdown = document.getElementById('componentShareDropdown');
    if (shareDropdown && !shareDropdown.contains(e.target)) {
        shareDropdown.classList.remove('open');
    }
});

// Validation Modal System
window.openValidationModal = function(validatorKey, validatorLabel, validatorData, description) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
        backdrop-filter: blur(3px);
        overflow: hidden;
    `;

    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = `
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        max-width: 700px;
        max-height: 80vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    `;

    // Handle both old format (boolean) and new format (object)
    const passed = typeof validatorData === 'boolean' ? validatorData : validatorData.valid;
    const hasErrors = typeof validatorData === 'object' && validatorData.errors && validatorData.errors.length > 0;
    const hasWarnings = typeof validatorData === 'object' && validatorData.warnings && validatorData.warnings.length > 0;
    const hasInfo = typeof validatorData === 'object' && validatorData.info && validatorData.info.length > 0;

    // Determine status
    let status = 'passed';
    let statusColor = '#48bb78';
    let statusText = 'All Checks Passed';
    let statusIcon = '✓';

    if (hasErrors) {
        status = 'failed';
        statusColor = '#f56565';
        statusText = 'Validation Failed';
        statusIcon = '✗';
    } else if (hasWarnings) {
        status = 'warning';
        statusColor = '#ed8936';
        statusText = 'Validation Passed with Warnings';
        statusIcon = '⚠';
    }

    // Build modal content - Header (fixed)
    let modalHeader = `
        <div style="padding: 30px 30px 20px 30px; flex-shrink: 0; border-bottom: 1px solid #333;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <h2 style="margin: 0 0 8px 0; color: #fff; font-size: 24px; font-weight: 600;">
                        ${validatorLabel}
                    </h2>
                    <p style="margin: 0; color: #999; font-size: 14px; line-height: 1.6;">
                        ${description || 'Validation check details'}
                    </p>
                </div>
                <button id="closeValidationModal" style="
                    background: transparent;
                    border: none;
                    color: #999;
                    font-size: 28px;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                    margin-left: 20px;
                    flex-shrink: 0;
                " onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#999'">
                    ×
                </button>
            </div>

            <!-- Status Badge -->
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: ${statusColor}20;
                border: 1px solid ${statusColor}40;
                border-radius: 6px;
                color: ${statusColor};
                font-weight: 600;
                font-size: 14px;
            ">
                <span style="font-size: 16px;">${statusIcon}</span>
                ${statusText}
            </div>
        </div>
    `;

    // Build modal body content (scrollable)
    let modalBodyContent = '';

    // Add errors section if present
    if (hasErrors) {
        modalBodyContent += `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #f56565; font-size: 16px; font-weight: 600; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                    <span>✗</span>
                    Errors (${validatorData.errorCount || validatorData.errors.length})
                </h3>
                <div style="
                    background: rgba(245, 101, 101, 0.1);
                    border-left: 3px solid #f56565;
                    border-radius: 4px;
                    padding: 16px;
                ">
        `;

        validatorData.errors.forEach((error, index) => {
            // Build location info if available
            let locationInfo = '';
            if (error.position || error.line) {
                locationInfo = `
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        margin-top: 4px;
                        padding: 4px 8px;
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 4px;
                        font-size: 12px;
                        color: #999;
                        font-family: 'Courier New', monospace;
                    ">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,7H13V13H11V7M11,15H13V17H11V15Z"/>
                        </svg>
                        ${error.position ? `Line ${error.position}` : `Line ${error.line}` + (error.column ? `:${error.column}` : '')}
                    </div>
                `;
            }

            // Build line text preview if available
            let lineTextPreview = '';
            if (error.lineText) {
                lineTextPreview = `
                    <div style="margin-top: 8px; padding: 8px 12px; background: rgba(0, 0, 0, 0.4); border-left: 2px solid #f56565; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; color: #ddd; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;">
                        ${error.lineText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                    </div>
                `;
            }

            // Handle examples array (for patterns with multiple matches)
            let examplesSection = '';
            if (error.examples && error.examples.length > 0) {
                examplesSection = `
                    <div style="margin-top: 12px;">
                        <div style="color: #999; font-size: 12px; margin-bottom: 6px; font-weight: 600;">
                            Found ${error.examples.length} occurrence${error.examples.length > 1 ? 's' : ''}:
                        </div>
                `;

                error.examples.slice(0, 5).forEach((example, exIdx) => {
                    examplesSection += `
                        <div style="margin-bottom: 8px; padding: 8px 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="color: #f56565; font-size: 11px; font-weight: 600; font-family: 'Courier New', monospace;">
                                    ${example.position || `Line ${example.line}`}
                                </span>
                                ${example.text ? `
                                    <span style="color: #ed8936; font-size: 11px; font-family: 'Courier New', monospace;">
                                        "${example.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
                                    </span>
                                ` : ''}
                            </div>
                            ${example.lineText ? `
                                <div style="color: #999; font-size: 11px; font-family: 'Courier New', monospace; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;">
                                    ${example.lineText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                });

                if (error.examples.length > 5) {
                    examplesSection += `
                        <div style="color: #666; font-size: 11px; font-style: italic; margin-top: 4px;">
                            ... and ${error.examples.length - 5} more occurrence${error.examples.length - 5 > 1 ? 's' : ''}
                        </div>
                    `;
                }

                examplesSection += `</div>`;
            }

            modalBodyContent += `
                <div style="margin-bottom: ${index < validatorData.errors.length - 1 ? '12px' : '0'}; padding-bottom: ${index < validatorData.errors.length - 1 ? '12px' : '0'}; border-bottom: ${index < validatorData.errors.length - 1 ? '1px solid rgba(245, 101, 101, 0.2)' : 'none'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <div style="color: #f56565; font-weight: 600; font-size: 13px;">
                            ${error.code || 'ERROR'}
                        </div>
                        ${locationInfo}
                    </div>
                    <div style="color: #ddd; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
                        ${error.message || error}
                    </div>
                    ${lineTextPreview}
                    ${examplesSection}
                    ${error.context && !error.examples ? `
                        <div style="margin-top: 8px; padding: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; color: #999;">
                            ${JSON.stringify(error.context, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        modalBodyContent += `
                </div>
            </div>
        `;
    }

    // Add warnings section if present
    if (hasWarnings) {
        modalBodyContent += `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #ed8936; font-size: 16px; font-weight: 600; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                    <span>⚠</span>
                    Warnings (${validatorData.warningCount || validatorData.warnings.length})
                </h3>
                <div style="
                    background: rgba(237, 137, 54, 0.1);
                    border-left: 3px solid #ed8936;
                    border-radius: 4px;
                    padding: 16px;
                ">
        `;

        validatorData.warnings.forEach((warning, index) => {
            // Build location info if available
            let locationInfo = '';
            if (warning.position || warning.line) {
                locationInfo = `
                    <div style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        margin-top: 4px;
                        padding: 4px 8px;
                        background: rgba(0, 0, 0, 0.3);
                        border-radius: 4px;
                        font-size: 12px;
                        color: #999;
                        font-family: 'Courier New', monospace;
                    ">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,7H13V13H11V7M11,15H13V17H11V15Z"/>
                        </svg>
                        ${warning.position ? `Line ${warning.position}` : `Line ${warning.line}` + (warning.column ? `:${warning.column}` : '')}
                    </div>
                `;
            }

            // Build line text preview if available
            let lineTextPreview = '';
            if (warning.lineText) {
                lineTextPreview = `
                    <div style="margin-top: 8px; padding: 8px 12px; background: rgba(0, 0, 0, 0.4); border-left: 2px solid #ed8936; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; color: #ddd; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;">
                        ${warning.lineText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                    </div>
                `;
            }

            // Handle examples array (for patterns with multiple matches)
            let examplesSection = '';
            if (warning.examples && warning.examples.length > 0) {
                examplesSection = `
                    <div style="margin-top: 12px;">
                        <div style="color: #999; font-size: 12px; margin-bottom: 6px; font-weight: 600;">
                            Found ${warning.examples.length} occurrence${warning.examples.length > 1 ? 's' : ''}:
                        </div>
                `;

                warning.examples.slice(0, 5).forEach((example, exIdx) => {
                    examplesSection += `
                        <div style="margin-bottom: 8px; padding: 8px 12px; background: rgba(0, 0, 0, 0.3); border-radius: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="color: #ed8936; font-size: 11px; font-weight: 600; font-family: 'Courier New', monospace;">
                                    ${example.position || `Line ${example.line}`}
                                </span>
                                ${example.text ? `
                                    <span style="color: #f9a825; font-size: 11px; font-family: 'Courier New', monospace;">
                                        "${example.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
                                    </span>
                                ` : ''}
                            </div>
                            ${example.lineText ? `
                                <div style="color: #999; font-size: 11px; font-family: 'Courier New', monospace; white-space: normal; word-wrap: break-word; overflow-wrap: break-word;">
                                    ${example.lineText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                                </div>
                            ` : ''}
                        </div>
                    `;
                });

                if (warning.examples.length > 5) {
                    examplesSection += `
                        <div style="color: #666; font-size: 11px; font-style: italic; margin-top: 4px;">
                            ... and ${warning.examples.length - 5} more occurrence${warning.examples.length - 5 > 1 ? 's' : ''}
                        </div>
                    `;
                }

                examplesSection += `</div>`;
            }

            modalBodyContent += `
                <div style="margin-bottom: ${index < validatorData.warnings.length - 1 ? '12px' : '0'}; padding-bottom: ${index < validatorData.warnings.length - 1 ? '12px' : '0'}; border-bottom: ${index < validatorData.warnings.length - 1 ? '1px solid rgba(237, 137, 54, 0.2)' : 'none'};">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <div style="color: #ed8936; font-weight: 600; font-size: 13px;">
                            ${warning.code || 'WARNING'}
                        </div>
                        ${locationInfo}
                    </div>
                    <div style="color: #ddd; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
                        ${warning.message || warning}
                    </div>
                    ${lineTextPreview}
                    ${examplesSection}
                    ${warning.context && !warning.examples ? `
                        <div style="margin-top: 8px; padding: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; font-family: 'Courier New', monospace; font-size: 12px; color: #999;">
                            ${JSON.stringify(warning.context, null, 2).replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        modalBodyContent += `
                </div>
            </div>
        `;
    }

    // Add success/info section if everything passed
    if (!hasErrors && !hasWarnings && (hasInfo || passed)) {
        // Generate validator-specific success summary
        let successSummary = '';

        switch(validatorKey) {
            case 'structural':
                successSummary = `
                    <div style="color: #bbb; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
                        This component has a valid structure with proper formatting:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #999; font-size: 13px; line-height: 1.8;">
                        <li>YAML frontmatter is properly formatted and contains all required fields</li>
                        <li>File size is within acceptable limits</li>
                        <li>UTF-8 encoding is valid with no binary content</li>
                        <li>Content structure follows markdown conventions</li>
                        <li>Section count is optimal for readability</li>
                    </ul>
                `;
                break;

            case 'integrity':
                successSummary = `
                    <div style="color: #bbb; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
                        This component's integrity has been verified:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #999; font-size: 13px; line-height: 1.8;">
                        <li>SHA256 hash matches expected value</li>
                        <li>No tampering or unauthorized modifications detected</li>
                        <li>Version tracking is consistent</li>
                        <li>File has not been corrupted during transmission</li>
                    </ul>
                `;
                break;

            case 'semantic':
                successSummary = `
                    <div style="color: #bbb; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
                        This component is safe and contains no malicious content:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #999; font-size: 13px; line-height: 1.8;">
                        <li>No prompt injection attempts detected</li>
                        <li>No dangerous shell commands or system calls</li>
                        <li>No obfuscated or suspicious code patterns</li>
                        <li>No attempts to access sensitive file paths</li>
                        <li>Content follows security best practices</li>
                    </ul>
                `;
                break;

            case 'references':
                successSummary = `
                    <div style="color: #bbb; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
                        All external references have been validated:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #999; font-size: 13px; line-height: 1.8;">
                        <li>All URLs are properly formatted and accessible</li>
                        <li>No SSRF (Server-Side Request Forgery) vulnerabilities</li>
                        <li>External links point to trusted domains</li>
                        <li>No private network or localhost references</li>
                        <li>HTTP links have been upgraded to HTTPS where possible</li>
                    </ul>
                `;
                break;

            case 'provenance':
                successSummary = `
                    <div style="color: #bbb; font-size: 14px; line-height: 1.6; margin-bottom: 12px;">
                        Component origin and authorship have been confirmed:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; color: #999; font-size: 13px; line-height: 1.8;">
                        <li>Author metadata is present and valid</li>
                        <li>Repository information is correct</li>
                        <li>License information is specified</li>
                        <li>Component source can be traced to original repository</li>
                        <li>No signs of unauthorized redistribution</li>
                    </ul>
                `;
                break;

            default:
                successSummary = `
                    <div style="color: #bbb; font-size: 14px; line-height: 1.6;">
                        This component has been validated and meets all ${validatorLabel.toLowerCase()} requirements.
                    </div>
                `;
        }

        modalBodyContent += `
            <div style="margin-bottom: 24px;">
                <h3 style="color: #48bb78; font-size: 16px; font-weight: 600; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                    <span>✓</span>
                    Validation Passed
                </h3>
                <div style="
                    background: rgba(72, 187, 120, 0.1);
                    border-left: 3px solid #48bb78;
                    border-radius: 4px;
                    padding: 16px;
                ">
                    <div style="color: #48bb78; font-weight: 600; font-size: 14px; margin-bottom: 12px;">
                        All ${validatorLabel} checks passed successfully
                    </div>
                    ${successSummary}
        `;

        // Add info items if present
        if (hasInfo) {
            modalBodyContent += `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(72, 187, 120, 0.2);">
                    <div style="color: #48bb78; font-weight: 600; font-size: 13px; margin-bottom: 8px;">
                        Additional Details:
                    </div>
            `;
            validatorData.info.forEach((info, index) => {
                modalBodyContent += `
                    <div style="margin-bottom: ${index < validatorData.info.length - 1 ? '8px' : '0'}; color: #999; font-size: 13px; padding-left: 12px;">
                        • ${info.message || info}
                    </div>
                `;
            });
            modalBodyContent += `
                </div>
            `;
        }

        modalBodyContent += `
                </div>
            </div>
        `;
    }

    // Build modal footer (fixed)
    let modalFooter = `
            <div style="display: flex; justify-content: flex-end; margin-top: 24px; padding-top: 24px; border-top: 1px solid #333;">
                <button id="closeValidationModalBtn" style="
                    background: #2d2d2d;
                    border: 1px solid #444;
                    color: #fff;
                    padding: 10px 24px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#3d3d3d'; this.style.borderColor='#555'" onmouseout="this.style.background='#2d2d2d'; this.style.borderColor='#444'">
                    Close
                </button>
            </div>
    `;

    // Assemble the complete modal with scrollable body
    modalContainer.innerHTML = `
        ${modalHeader}
        <div style="flex: 1; overflow-y: auto; padding: 30px;">
            ${modalBodyContent}
        </div>
        <div style="flex-shrink: 0; padding: 20px 30px; border-top: 1px solid #333;">
            ${modalFooter}
        </div>
    `;
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);

    // Close modal handlers
    function closeModal() {
        document.body.removeChild(modalOverlay);
    }

    document.getElementById('closeValidationModal').addEventListener('click', closeModal);
    document.getElementById('closeValidationModalBtn').addEventListener('click', closeModal);

    // Close on overlay click (but not on modal content click)
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Close on Escape key
    function handleEscape(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    }
    document.addEventListener('keydown', handleEscape);
};