#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3444;

// Platform-aware command names. Now that spawns run without `shell: true`,
// Windows needs the `.cmd` shim to resolve npm-installed executables (bare
// 'npx'/'claude' would fail with ENOENT on win32).
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const CLAUDE_CMD = process.platform === 'win32' ? 'claude.cmd' : 'claude';

// Load .env file from current working directory (where user runs the command)
function loadEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log(chalk.blue('📄 Loading .env file from:'), chalk.gray(envPath));
        
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = envContent.split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .reduce((acc, line) => {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, ''); // Remove quotes
                    acc[key.trim()] = value;
                }
                return acc;
            }, {});
        
        // Set environment variables
        Object.assign(process.env, envVars);
        
        const hasE2B = !!process.env.E2B_API_KEY;
        const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
        
        console.log(chalk.green('✅ Environment variables loaded:'));
        console.log(chalk.gray(`   • E2B_API_KEY: ${hasE2B ? 'Found' : 'Missing'}`));
        console.log(chalk.gray(`   • ANTHROPIC_API_KEY: ${hasAnthropic ? 'Found' : 'Missing'}`));
        
        return hasE2B && hasAnthropic;
    } else {
        console.log(chalk.yellow('⚠️  No .env file found in:'), chalk.gray(envPath));
        return false;
    }
}

// Load environment variables on startup
const hasApiKeys = loadEnvFile();

// CORS middleware — restrict to the local Studio UI origin only.
// A wildcard (`*`) origin combined with the command-executing endpoints below
// lets any web page the developer visits drive requests into this server
// (drive-by RCE). Only allow the same-origin UI served from localhost:PORT.
const ALLOWED_ORIGINS = new Set([
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
]);
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    // Reject cross-origin requests outright for the state-changing endpoints.
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return res.status(403).json({ success: false, error: 'Cross-origin request rejected' });
    }
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// JSON parsing middleware
app.use(express.json());

// Store active tasks
const activeTasks = new Map();

// Serve the sandbox interface at root
app.get('/', (req, res) => {
    // Try local file first (when running from npm package)
    const localPath = path.join(__dirname, 'sandbox-interface.html');
    // Fallback to docs folder (when running from source)
    const docsPath = path.join(__dirname, '../../docs/sandbox-interface.html');
    
    if (fs.existsSync(localPath)) {
        res.sendFile(localPath);
    } else if (fs.existsSync(docsPath)) {
        res.sendFile(docsPath);
    } else {
        res.status(404).send(`
            <html>
                <body style="font-family: system-ui; padding: 40px; background: #0f0f0f; color: #e0e0e0;">
                    <h1>❌ Sandbox Interface Not Found</h1>
                    <p>The sandbox-interface.html file could not be found.</p>
                    <p>Please reinstall the package or check your installation.</p>
                    <pre style="background: #1a1a1a; padding: 10px; border-radius: 5px;">
Tried paths:
- ${localPath}
- ${docsPath}
                    </pre>
                </body>
            </html>
        `);
    }
});

// Serve static files for CSS, JS, etc. (but not index.html at root)
app.use('/css', express.static(path.join(__dirname, '../../docs/css')));
app.use('/js', express.static(path.join(__dirname, '../../docs/js')));
app.use('/assets', express.static(path.join(__dirname, '../../docs/assets')));

// Serve components.json for agent autocomplete
app.get('/components.json', (req, res) => {
    const componentsPath = path.join(__dirname, '../../docs/components.json');
    if (fs.existsSync(componentsPath)) {
        res.sendFile(componentsPath);
    } else {
        res.status(404).json({ error: 'Components file not found' });
    }
});

// API endpoint to execute task (local or cloud)
app.post('/api/execute', async (req, res) => {
    const { prompt, mode = 'local', agent = 'development-team/frontend-developer' } = req.body;
    
    if (!prompt || prompt.trim().length < 10) {
        return res.status(400).json({
            success: false,
            error: 'Please provide a detailed prompt (at least 10 characters)'
        });
    }
    
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create task object
    const task = {
        id: taskId,
        title: prompt.substring(0, 60) + (prompt.length > 60 ? '...' : ''),
        prompt: prompt.trim(),
        agent: agent,
        mode: mode,
        status: 'running',
        startTime: new Date(),
        progress: 0,
        output: [],
        sandboxId: null
    };
    
    activeTasks.set(taskId, task);
    
    // Execute based on mode
    if (mode === 'cloud') {
        executeE2BTask(task);
    } else {
        executeLocalTask(task);
    }
    
    res.json({
        success: true,
        taskId: taskId,
        message: 'Task started successfully'
    });
});

// API endpoint to get task status
app.get('/api/task/:taskId', (req, res) => {
    const task = activeTasks.get(req.params.taskId);
    if (!task) {
        return res.status(404).json({
            success: false,
            error: 'Task not found'
        });
    }
    
    res.json({
        success: true,
        task: {
            id: task.id,
            title: task.title,
            status: task.status,
            progress: task.progress,
            output: task.output.join('\\n'),
            startTime: task.startTime,
            endTime: task.endTime,
            sandboxId: task.sandboxId
        }
    });
});

// API endpoint to get all tasks
app.get('/api/tasks', (req, res) => {
    const tasks = Array.from(activeTasks.values()).map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        progress: task.progress,
        startTime: task.startTime,
        endTime: task.endTime,
        sandboxId: task.sandboxId,
        output: task.output.slice(-3).join('\\n') // Last 3 lines for preview
    }));
    
    res.json({
        success: true,
        tasks: tasks.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    });
});

// API endpoint to install agent
app.post('/api/install-agent', async (req, res) => {
    const { agentName } = req.body;

    if (!agentName) {
        return res.status(400).json({
            success: false,
            error: 'Agent name is required'
        });
    }

    // SECURITY: agent names are `category/name` slugs. Reject anything else so a
    // value like "x; rm -rf ~" can never reach the child process.
    if (!/^[A-Za-z0-9._/-]+$/.test(agentName)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid agent name'
        });
    }

    try {
        console.log(chalk.blue('🔧 Installing agent:'), chalk.cyan(agentName));

        // SECURITY: shell:false (default) keeps agentName as a single argv entry —
        // no shell parses it, so metacharacters cannot inject commands.
        const child = spawn(NPX_CMD, ['claude-code-templates@latest', '--agent', agentName, '--yes'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = [];
        let error = [];
        
        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            output.push(...lines);
        });
        
        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            error.push(...lines);
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log(chalk.green('✅ Agent installed successfully:'), chalk.cyan(agentName));
                res.json({
                    success: true,
                    message: `Agent ${agentName} installed successfully`,
                    output: output.join('\n')
                });
            } else {
                console.error(chalk.red('❌ Agent installation failed:'), chalk.cyan(agentName));
                res.status(500).json({
                    success: false,
                    error: `Failed to install agent ${agentName}`,
                    output: error.join('\n')
                });
            }
        });
        
        child.on('error', (error) => {
            console.error(chalk.red('❌ Agent installation error:'), error.message);
            res.status(500).json({
                success: false,
                error: `Installation error: ${error.message}`
            });
        });
        
    } catch (error) {
        console.error(chalk.red('❌ Failed to start agent installation:'), error.message);
        res.status(500).json({
            success: false,
            error: `Failed to start installation: ${error.message}`
        });
    }
});

async function checkAndInstallAgent(agentName, task) {
    // Check if agent exists in .claude directory
    const claudeDir = path.join(process.cwd(), '.claude');
    const agentPath = path.join(claudeDir, 'agents', `${agentName}.md`);
    
    if (fs.existsSync(agentPath)) {
        return true; // Agent already exists
    }
    
    task.output.push(`🔧 Agent ${agentName} not found locally. Installing...`);
    
    // SECURITY: reject anything that is not a plain `category/name` slug.
    if (!/^[A-Za-z0-9._/-]+$/.test(agentName)) {
        task.output.push(`❌ Invalid agent name: ${agentName}`);
        return Promise.resolve(false);
    }

    return new Promise((resolve, reject) => {
        // SECURITY: shell:false (default) — agentName stays a single argv entry.
        const child = spawn(NPX_CMD, ['claude-code-templates@latest', '--agent', agentName, '--yes'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                task.output.push(`📦 ${line}`);
            });
        });
        
        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                task.output.push(`⚠️ ${line}`);
            });
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                task.output.push(`✅ Agent ${agentName} installed successfully`);
                resolve(true);
            } else {
                task.output.push(`❌ Failed to install agent ${agentName}`);
                resolve(false);
            }
        });
        
        child.on('error', (error) => {
            task.output.push(`❌ Installation error: ${error.message}`);
            resolve(false);
        });
    });
}

async function executeE2BTask(task) {
    try {
        task.output.push('🚀 Initializing E2B sandbox execution...');
        task.progress = 10;
        
        // Check and install agent if needed
        if (task.agent !== 'development-team/frontend-developer') {
            task.output.push(`🔍 Checking agent: ${task.agent}`);
            const agentInstalled = await checkAndInstallAgent(task.agent, task);
            if (!agentInstalled) {
                task.status = 'failed';
                task.endTime = new Date();
                task.output.push(`❌ Could not install required agent: ${task.agent}`);
                return;
            }
            task.progress = 15;
        }
        
        const e2bLauncherPath = path.join(__dirname, '../components/sandbox/e2b/e2b-launcher.py');
        const agentParam = `--agent=${task.agent} --yes`;
        
        // Build command arguments
        const args = [
            e2bLauncherPath,
            task.prompt,
            agentParam
        ];
        
        // Add API keys from environment if available
        if (process.env.E2B_API_KEY) {
            args.push(process.env.E2B_API_KEY);
        }
        if (process.env.ANTHROPIC_API_KEY) {
            args.push(process.env.ANTHROPIC_API_KEY);
        }
        
        task.output.push('🔧 Starting Python E2B launcher...');
        task.progress = 20;
        
        // Execute the E2B launcher from the user's working directory
        const child = spawn('python3', args, {
            cwd: process.cwd(), // This ensures it runs from where the user executed the command
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env, // Pass all environment variables including loaded ones
                PATH: process.env.PATH
            }
        });
        
        // Handle stdout
        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\\n').filter(line => line.trim());
            lines.forEach(line => {
                task.output.push(line);
                
                // Update progress based on output
                if (line.includes('Sandbox created:')) {
                    task.sandboxId = line.split('Sandbox created: ')[1] || 'unknown';
                    task.progress = 40;
                } else if (line.includes('Installing')) {
                    task.progress = 60;
                } else if (line.includes('Executing Claude Code')) {
                    task.progress = 80;
                } else if (line.includes('Downloaded:')) {
                    task.progress = 95;
                } else if (line.includes('Execution completed successfully')) {
                    task.progress = 100;
                    task.status = 'completed';
                    task.endTime = new Date();
                }
            });
        });
        
        // Handle stderr
        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\\n').filter(line => line.trim());
            lines.forEach(line => {
                task.output.push(`⚠️ ${line}`);
            });
        });
        
        // Handle process exit
        child.on('close', (code) => {
            if (code === 0) {
                if (task.status !== 'completed') {
                    task.status = 'completed';
                    task.endTime = new Date();
                    task.progress = 100;
                }
                task.output.push('✅ Task completed successfully!');
            } else {
                task.status = 'failed';
                task.endTime = new Date();
                
                // Check if it's an API key error
                const outputText = task.output.join(' ');
                if (outputText.includes('E2B API key is required') || outputText.includes('Anthropic API key is required')) {
                    task.output.push('❌ Missing API keys! Please add E2B_API_KEY and ANTHROPIC_API_KEY to your .env file');
                    task.output.push('🔑 Get E2B key: https://e2b.dev/dashboard');
                    task.output.push('🔑 Get Anthropic key: https://console.anthropic.com');
                } else {
                    task.output.push(`❌ Process exited with code: ${code}`);
                }
            }
        });
        
        // Handle process error
        child.on('error', (error) => {
            task.status = 'failed';
            task.endTime = new Date();
            task.output.push(`❌ Execution error: ${error.message}`);
        });
        
    } catch (error) {
        task.status = 'failed';
        task.endTime = new Date();
        task.output.push(`❌ Failed to start execution: ${error.message}`);
    }
}

async function executeLocalTask(task) {
    try {
        task.output.push('🖥️  Executing Claude Code locally...');
        task.progress = 10;
        
        // Check and install agent if needed
        if (task.agent !== 'development-team/frontend-developer') {
            task.output.push(`🔍 Checking agent: ${task.agent}`);
            const agentInstalled = await checkAndInstallAgent(task.agent, task);
            if (!agentInstalled) {
                task.status = 'failed';
                task.endTime = new Date();
                task.output.push(`❌ Could not install required agent: ${task.agent}`);
                return;
            }
            task.progress = 15;
        }
        
        task.output.push('🔍 Checking if Claude Code CLI is available...');
        
        // For local execution, we'll include the agent in the prompt if specified
        let finalPrompt = task.prompt;
        if (task.agent && task.agent !== 'development-team/frontend-developer') {
            finalPrompt = `As a ${task.agent.replace('-', ' ')}, ${task.prompt}`;
        }
        
        // Execute Claude Code locally with just the prompt.
        // SECURITY: never run through a shell. With shell:true, Node joins argv into
        // a single `sh -c` string and the attacker-controlled prompt is parsed by the
        // shell (command injection). shell:false keeps finalPrompt as a single argv[1].
        // Windows: resolve claude.cmd explicitly (CLAUDE_CMD) instead of re-enabling shell:true.
        const child = spawn(CLAUDE_CMD, [finalPrompt], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin to prevent hanging
            env: {
                ...process.env,
                PATH: process.env.PATH
            },
            timeout: 300000 // 5 minute timeout
        });
        
        task.output.push('🚀 Claude Code execution started');
        task.progress = 30;
        
        // Set up timeout to prevent hanging
        const executionTimeout = setTimeout(() => {
            task.output.push('⏰ Execution timeout reached (5 minutes)');
            task.output.push('💡 This might indicate Claude Code is waiting for input or has hung');
            task.status = 'failed';
            task.endTime = new Date();
            child.kill('SIGTERM');
        }, 300000); // 5 minutes
        
        // Handle stdout
        child.stdout.on('data', (data) => {
            const lines = data.toString().split('\\n').filter(line => line.trim());
            lines.forEach(line => {
                task.output.push(line);
                
                // Update progress based on output patterns
                if (line.includes('Reading') || line.includes('Analyzing')) {
                    task.progress = Math.min(task.progress + 5, 60);
                } else if (line.includes('Writing') || line.includes('Creating')) {
                    task.progress = Math.min(task.progress + 10, 90);
                } else if (line.includes('Done') || line.includes('Complete')) {
                    task.progress = 95;
                }
            });
        });
        
        // Handle stderr
        child.stderr.on('data', (data) => {
            const lines = data.toString().split('\\n').filter(line => line.trim());
            lines.forEach(line => {
                task.output.push(`⚠️ ${line}`);
            });
        });
        
        // Handle process exit
        child.on('close', (code) => {
            clearTimeout(executionTimeout); // Clear timeout when process exits
            
            if (code === 0) {
                task.status = 'completed';
                task.endTime = new Date();
                task.progress = 100;
                task.output.push('✅ Claude Code execution completed successfully!');
                task.output.push('📂 Files were created/modified in your current directory');
            } else {
                task.status = 'failed';
                task.endTime = new Date();
                
                const outputText = task.output.join(' ');
                if (outputText.includes('claude: command not found') || outputText.includes('not recognized')) {
                    task.output.push('❌ Claude Code CLI not found!');
                    task.output.push('💡 Please install Claude Code CLI first:');
                    task.output.push('🔗 Visit: https://claude.ai/code');
                } else {
                    task.output.push(`❌ Process exited with code: ${code}`);
                }
            }
        });
        
        // Handle process error
        child.on('error', (error) => {
            clearTimeout(executionTimeout); // Clear timeout on error
            
            task.status = 'failed';
            task.endTime = new Date();
            
            if (error.code === 'ENOENT') {
                task.output.push('❌ Claude Code CLI not found in PATH!');
                task.output.push('💡 Please install Claude Code CLI first:');
                task.output.push('🔗 Visit: https://claude.ai/code');
                task.output.push('🔗 Documentation: https://docs.anthropic.com/claude-code');
            } else {
                task.output.push(`❌ Execution error: ${error.message}`);
            }
        });
        
    } catch (error) {
        task.status = 'failed';
        task.endTime = new Date();
        task.output.push(`❌ Failed to start local execution: ${error.message}`);
    }
}

// Start server — bind to loopback only. This is a local developer tool that
// executes commands; binding to 0.0.0.0 exposes RCE to the whole LAN.
app.listen(PORT, '127.0.0.1', () => {
    console.log(chalk.blue('\\n🎨 Claude Code Studio Server'));
    console.log(chalk.cyan('═══════════════════════════════════════'));
    console.log(chalk.green(`🚀 Server running on http://localhost:${PORT}`));
    console.log(chalk.gray('💡 Local and cloud execution interface ready'));
    
    if (hasApiKeys) {
        console.log(chalk.green('\\n✅ All API keys are configured and ready!'));
    } else {
        console.log(chalk.yellow('\\n⚠️  API Keys Status:'));
        console.log(chalk.gray(`   • E2B_API_KEY: ${process.env.E2B_API_KEY ? 'Found' : 'Missing'}`));
        console.log(chalk.gray(`   • ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Found' : 'Missing'}`));
        console.log(chalk.yellow('   • Please add these keys to your .env file'));
    }
    console.log('');
});

module.exports = app;