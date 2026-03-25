const chalk = require('chalk');
const inquirer = require('inquirer');

// Note: Custom checkbox prompt was causing choices not to display
// Removed custom prompt to fix command selection issue
const { getAvailableLanguages, getFrameworksForLanguage } = require('./templates');
const { getCommandsForLanguageAndFramework } = require('./command-scanner');
const { getHooksForLanguage, getMCPsForLanguage } = require('./hook-scanner');
const { getAgentsForLanguageAndFramework, getInstalledAgents, formatAgentChoices } = require('./agents');

async function interactivePrompts(projectInfo, options = {}) {
  const state = {
    currentStep: 0,
    answers: {},
    steps: []
  };

  // Build steps array based on options
  if (!options.language) state.steps.push('language');
  if (!options.framework) state.steps.push('framework');
  state.steps.push('commands', 'hooks', 'mcps', 'agents', 'analytics', 'confirm');

  while (state.currentStep < state.steps.length) {
    const stepName = state.steps[state.currentStep];
    const result = await showStep(stepName, state.answers, projectInfo, options);
    
    if (result.action === 'back') {
      if (state.currentStep > 0) {
        state.currentStep--;
        // Clear the answer for the step we're going back from
        delete state.answers[stepName];
      }
    } else if (result.action === 'next') {
      state.answers[stepName] = result.value;
      state.currentStep++;
    } else if (result.action === 'exit') {
      return { confirm: false };
    }
  }

  return state.answers;
}

async function showStep(stepName, currentAnswers, projectInfo, options) {
  // Handle async data fetching for agents step
  let additionalData = {};
  if (stepName === 'agents') {
    additionalData.installedAgents = await getInstalledAgents();
  }
  
  const stepConfig = getStepConfig(stepName, currentAnswers, projectInfo, options, additionalData);
  
  if (!stepConfig) {
    return { action: 'next', value: null };
  }

  // Add back option if not first step
  const isFirstStep = stepName === 'language' || (options.language && stepName === 'framework') || 
                      (options.language && options.framework && stepName === 'commands');
  
  if (!isFirstStep && stepConfig.type === 'list') {
    stepConfig.choices = [
      { value: '__back__', name: chalk.gray('← Back') },
      new inquirer.Separator(),
      ...stepConfig.choices
    ];
  }

  const answer = await inquirer.prompt([stepConfig]);
  const value = answer[stepName];

  if (value === '__back__') {
    return { action: 'back' };
  }

  return { action: 'next', value };
}

function getStepConfig(stepName, currentAnswers, projectInfo, options, additionalData = {}) {
  switch (stepName) {
    case 'language':
      return {
        type: 'list',
        name: 'language',
        message: 'Select your programming language:',
        choices: getAvailableLanguages(),
        default: projectInfo.detectedLanguage || 'common',
        prefix: chalk.blue('🔤')
      };

    case 'framework':
      const selectedLanguage = currentAnswers.language || options.language;
      const frameworks = getFrameworksForLanguage(selectedLanguage);
      
      if (frameworks.length === 0) {
        return null; // Skip this step
      }
      
      return {
        type: 'list',
        name: 'framework',
        message: 'Select your framework (optional):',
        choices: [
          { value: 'none', name: 'None / Generic' },
          ...frameworks
        ],
        default: projectInfo.detectedFramework || 'none',
        prefix: chalk.green('🎯')
      };

    case 'commands':
      const commandLanguage = currentAnswers.language || options.language;
      const commandFramework = currentAnswers.framework || options.framework;
      
      if (!commandLanguage || commandLanguage === 'common') {
        return {
          type: 'checkbox',
          name: 'commands',
          message: 'Select commands to include (use space to select):',
          choices: [
            {
              value: 'basic-commands',
              name: 'Basic development commands',
              checked: true
            }
          ],
          prefix: chalk.cyan('📋')
        };
      }
      
      const availableCommands = getCommandsForLanguageAndFramework(commandLanguage, commandFramework);
      
      return {
        type: 'checkbox',
        name: 'commands',
        message: 'Select commands to include (use space to select):',
        choices: availableCommands.map(cmd => ({
          value: cmd.name,
          name: `${cmd.displayName} - ${cmd.description}`,
          checked: cmd.checked
        })),
        prefix: chalk.cyan('📋'),
        pageSize: 10
      };

    case 'hooks':
      const hookLanguage = currentAnswers.language || options.language;
      
      if (!hookLanguage || hookLanguage === 'common') {
        return null; // Skip hooks selection for common templates
      }
      
      const availableHooks = getHooksForLanguage(hookLanguage);
      
      if (availableHooks.length === 0) {
        return null; // Skip if no hooks available
      }
      
      return {
        type: 'checkbox',
        name: 'hooks',
        message: 'Select automation hooks to include (use space to select):',
        choices: availableHooks.map(hook => ({
          value: hook.id,
          name: `${hook.type}: ${hook.description}`,
          checked: hook.checked
        })),
        prefix: chalk.magenta('🔧'),
        pageSize: 15
      };

    case 'mcps':
      const mcpLanguage = currentAnswers.language || options.language;
      
      if (!mcpLanguage) {
        return null; // Skip if no language selected
      }
      
      const availableMCPs = getMCPsForLanguage(mcpLanguage);
      
      if (availableMCPs.length === 0) {
        return null; // Skip if no MCPs available
      }
      
      return {
        type: 'checkbox',
        name: 'mcps',
        message: 'Select MCP servers to include (use space to select):',
        choices: availableMCPs.map(mcp => ({
          value: mcp.id,
          name: `${mcp.name} - ${mcp.description}`,
          checked: mcp.checked
        })),
        prefix: chalk.blue('🔧'),
        pageSize: 15
      };

    case 'agents':
      const agentLanguage = currentAnswers.language || options.language;
      const agentFramework = currentAnswers.framework || options.framework;
      
      if (!agentLanguage) {
        return null; // Skip if no language selected
      }
      
      const availableAgents = getAgentsForLanguageAndFramework(agentLanguage, agentFramework);
      
      if (availableAgents.length === 0) {
        return null; // Skip if no agents available
      }
      
      const installedAgents = additionalData.installedAgents || [];
      const agentChoices = formatAgentChoices(availableAgents, installedAgents);
      
      return {
        type: 'checkbox',
        name: 'agents',
        message: 'Select Claude Code agents to install (use space to select):',
        choices: agentChoices,
        prefix: chalk.magenta('🤖'),
        pageSize: 10
      };

    case 'analytics':
      return {
        type: 'confirm',
        name: 'analytics',
        message: 'Launch Claude Code Analytics Dashboard? (Real-time monitoring of your Claude Code usage)',
        default: false,
        prefix: chalk.blue('📊')
      };

    case 'confirm':
      const confirmLanguage = currentAnswers.language || options.language || 'common';
      const confirmFramework = currentAnswers.framework || options.framework || 'none';
      const commandCount = currentAnswers.commands ? currentAnswers.commands.length : 0;
      const hookCount = currentAnswers.hooks ? currentAnswers.hooks.length : 0;
      const mcpCount = currentAnswers.mcps ? currentAnswers.mcps.length : 0;
      const agentCount = currentAnswers.agents ? currentAnswers.agents.length : 0;
      
      let message = `Setup Claude Code for ${chalk.cyan(confirmLanguage)}`;
      if (confirmFramework !== 'none') {
        message += ` with ${chalk.green(confirmFramework)}`;
      }
      if (commandCount > 0) {
        message += ` (${chalk.yellow(commandCount)} commands)`;
      }
      if (hookCount > 0) {
        message += ` (${chalk.magenta(hookCount)} hooks)`;
      }
      if (mcpCount > 0) {
        message += ` (${chalk.blue(mcpCount)} MCP)`;
      }
      if (agentCount > 0) {
        message += ` (${chalk.magenta(agentCount)} agents)`;
      }
      message += '?';
      
      return {
        type: 'list',
        name: 'confirm',
        message,
        choices: [
          { value: '__back__', name: chalk.gray('← Back to modify settings') },
          new inquirer.Separator(),
          { value: true, name: chalk.green('✅ Yes, proceed with setup') },
          { value: false, name: chalk.red('❌ No, cancel setup') }
        ],
        default: true,
        prefix: chalk.red('🚀')
      };

    default:
      return null;
  }
}

function createPrompts(projectInfo, options = {}) {
  const prompts = [];
  
  // Language selection
  if (!options.language) {
    const languages = getAvailableLanguages();
    prompts.push({
      type: 'list',
      name: 'language',
      message: 'Select your programming language:',
      choices: languages,
      default: projectInfo.detectedLanguage || 'common',
      prefix: chalk.blue('🔤')
    });
  }
  
  // Framework selection (conditional)
  if (!options.framework) {
    prompts.push({
      type: 'list',
      name: 'framework',
      message: 'Select your framework (optional):',
      choices: (answers) => {
        const selectedLanguage = answers.language || options.language;
        const frameworks = getFrameworksForLanguage(selectedLanguage);
        return [
          { value: 'none', name: 'None / Generic' },
          ...frameworks
        ];
      },
      default: projectInfo.detectedFramework || 'none',
      prefix: chalk.green('🎯'),
      when: (answers) => {
        const selectedLanguage = answers.language || options.language;
        const frameworks = getFrameworksForLanguage(selectedLanguage);
        return frameworks.length > 0;
      }
    });
  }
  
  // Command selection
  prompts.push({
    type: 'checkbox',
    name: 'commands',
    message: 'Select commands to include (use space to select):',
    choices: (answers) => {
      const selectedLanguage = answers.language || options.language;
      const selectedFramework = answers.framework || options.framework;
      
      if (!selectedLanguage || selectedLanguage === 'common') {
        return [
          {
            value: 'basic-commands',
            name: 'Basic development commands',
            checked: true
          }
        ];
      }
      
      const availableCommands = getCommandsForLanguageAndFramework(selectedLanguage, selectedFramework);
      
      return availableCommands.map(cmd => ({
        value: cmd.name,
        name: `${cmd.displayName} - ${cmd.description}`,
        checked: cmd.checked
      }));
    },
    prefix: chalk.cyan('📋'),
    when: (answers) => {
      const selectedLanguage = answers.language || options.language;
      return selectedLanguage && selectedLanguage !== 'common';
    }
  });

  // Hook selection
  prompts.push({
    type: 'checkbox',
    name: 'hooks',
    message: 'Select automation hooks to include (use space to select):',
    choices: (answers) => {
      const selectedLanguage = answers.language || options.language;
      
      if (!selectedLanguage || selectedLanguage === 'common') {
        return [];
      }
      
      const availableHooks = getHooksForLanguage(selectedLanguage);
      
      return availableHooks.map(hook => ({
        value: hook.id,
        name: `${hook.type}: ${hook.description}`,
        checked: hook.checked
      }));
    },
    prefix: chalk.magenta('🔧'),
    pageSize: 15,
    when: (answers) => {
      const selectedLanguage = answers.language || options.language;
      if (!selectedLanguage || selectedLanguage === 'common') {
        return false;
      }
      const availableHooks = getHooksForLanguage(selectedLanguage);
      return availableHooks.length > 0;
    }
  });

  // MCP selection
  prompts.push({
    type: 'checkbox',
    name: 'mcps',
    message: 'Select MCP servers to include (use space to select):',
    choices: (answers) => {
      const selectedLanguage = answers.language || options.language;
      
      if (!selectedLanguage) {
        return [];
      }
      
      const availableMCPs = getMCPsForLanguage(selectedLanguage);
      
      return availableMCPs.map(mcp => ({
        value: mcp.id,
        name: `${mcp.name} - ${mcp.description}`,
        checked: mcp.checked
      }));
    },
    prefix: chalk.blue('🔧'),
    pageSize: 15,
    when: (answers) => {
      const selectedLanguage = answers.language || options.language;
      if (!selectedLanguage) {
        return false;
      }
      const availableMCPs = getMCPsForLanguage(selectedLanguage);
      return availableMCPs.length > 0;
    }
  });
  
  // Confirmation
  prompts.push({
    type: 'confirm',
    name: 'confirm',
    message: (answers) => {
      const language = answers.language || options.language || 'common';
      const framework = answers.framework || options.framework || 'none';
      const commandCount = answers.commands ? answers.commands.length : 0;
      const hookCount = answers.hooks ? answers.hooks.length : 0;
      const mcpCount = answers.mcps ? answers.mcps.length : 0;
      
      let message = `Setup Claude Code for ${chalk.cyan(language)}`;
      if (framework !== 'none') {
        message += ` with ${chalk.green(framework)}`;
      }
      if (commandCount > 0) {
        message += ` (${chalk.yellow(commandCount)} commands)`;
      }
      if (hookCount > 0) {
        message += ` (${chalk.magenta(hookCount)} hooks)`;
      }
      if (mcpCount > 0) {
        message += ` (${chalk.blue(mcpCount)} MCP)`;
      }
      message += '?';
      
      return message;
    },
    default: true,
    prefix: chalk.red('🚀')
  });
  
  return prompts;
}

function createProjectTypePrompt(detectedTypes) {
  if (detectedTypes.length === 0) {
    return null;
  }
  
  return {
    type: 'list',
    name: 'projectType',
    message: 'We detected multiple project types. Which one should we prioritize?',
    choices: detectedTypes.map(type => ({
      value: type.language,
      name: `${type.language} (${type.confidence}% confidence)`
    })),
    prefix: chalk.magenta('🔍')
  };
}

module.exports = {
  createPrompts,
  createProjectTypePrompt,
  interactivePrompts
};