#!/usr/bin/env node

const { program } = require('commander');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Configuration
const API_BASE_URL = process.env.QGJOB_API_URL || 'http://localhost:3000/api';

/**
 * Detect if a test file is an AppWright test
 * @param {string} testPath - Path to the test file
 * @returns {Promise<boolean>} - True if it's an AppWright test
 */
async function detectAppWrightTest(testPath) {
  try {
    const fs = require('fs').promises;
    const content = await fs.readFile(testPath, 'utf8');
    
    // Check if the test file imports from "appwright"
    return content.includes('from "appwright"') || content.includes("from 'appwright'");
  } catch (error) {
    logger.warn(`Could not read test file ${testPath}: ${error.message}`);
    return false;
  }
}

/**
 * Get default AppWright project based on target and platform
 * @param {string} target - Target environment (browserstack, emulator, device)
 * @param {string} platform - Platform (android, ios)
 * @returns {string} - AppWright project name
 */
function getDefaultAppWrightProject(target, platform = 'android') {
  const projectMap = {
    'browserstack': {
      'android': 'android-browserstack',
      'ios': 'ios-browserstack'
    },
    'emulator': {
      'android': 'android-emulator',
      'ios': 'ios-emulator'
    },
    'device': {
      'android': 'android-emulator', // fallback to emulator config
      'ios': 'ios-emulator'
    }
  };

  return projectMap[target]?.[platform] || 'android-emulator';
}

/**
 * Submit a test job to the orchestrator
 * @param {Object} options - Job submission options
 */
async function submitJob(options) {
  try {
    // Detect if this is an AppWright test
    const isAppWrightTest = await detectAppWrightTest(options.test);
    
    const jobPayload = {
      id: uuidv4(),
      org_id: options.orgId,
      app_version_id: options.appVersionId,
      test_path: options.test,
      priority: options.priority || 'medium',
      target: options.target || 'emulator',
      created_at: new Date().toISOString(),
      status: 'pending',
      test_framework: isAppWrightTest ? 'appwright' : 'legacy',
      appwright_project: options.appwrightProject || getDefaultAppWrightProject(options.target, options.platform)
    };

    logger.info(`Submitting ${jobPayload.test_framework} job for org: ${options.orgId}, app_version: ${options.appVersionId}`);
    
    const response = await axios.post(`${API_BASE_URL}/jobs`, jobPayload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 201) {
      logger.info(`Job submitted successfully!`);
      console.log(`Job ID: ${response.data.job.id}`);
      console.log(`Status: ${response.data.job.status}`);
      console.log(`Queue Position: ${response.data.queue_position || 'N/A'}`);
      return response.data.job.id;
    }
  } catch (error) {
    if (error.response) {
      logger.error(`API Error: ${error.response.status} - ${error.response.data.message || error.response.data}`);
    } else if (error.request) {
      logger.error('Network Error: Unable to reach the job server. Make sure the server is running.');
    } else {
      logger.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Check the status of a job
 * @param {string} jobId - The job ID to check
 */
async function checkStatus(jobId) {
  try {
    logger.info(`Checking status for job: ${jobId}`);
    
    const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`, {
      timeout: 10000
    });

    if (response.status === 200) {
      const job = response.data;
      console.log(`Job ID: ${job.id}`);
      console.log(`Organization: ${job.org_id}`);
      console.log(`App Version: ${job.app_version_id}`);
      console.log(`Test: ${job.test_path}`);
      console.log(`Status: ${job.status}`);
      console.log(`Priority: ${job.priority}`);
      console.log(`Target: ${job.target}`);
      console.log(`Created: ${job.created_at}`);
      
      if (job.started_at) {
        console.log(`Started: ${job.started_at}`);
      }
      
      if (job.completed_at) {
        console.log(`Completed: ${job.completed_at}`);
      }
      
      if (job.error) {
        console.log(`Error: ${job.error}`);
      }
      
      if (job.result) {
        console.log(`Result: ${JSON.stringify(job.result, null, 2)}`);
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logger.error(`Job not found: ${jobId}`);
    } else if (error.response) {
      logger.error(`API Error: ${error.response.status} - ${error.response.data.message || error.response.data}`);
    } else if (error.request) {
      logger.error('Network Error: Unable to reach the job server. Make sure the server is running.');
    } else {
      logger.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Register an agent with the orchestrator
 * @param {Object} options - Agent registration options
 */
async function registerAgent(options) {
  try {
    const agentPayload = {
      name: options.name,
      capabilities: {
        emulator: options.capabilities.includes('emulator'),
        device: options.capabilities.includes('device'),
        browserstack: options.capabilities.includes('browserstack')
      },
      metadata: {
        type: options.type || 'manual',
        location: options.location || 'unknown'
      }
    };

    logger.info(`Registering agent: ${options.name}`);
    
    const response = await axios.post(`${API_BASE_URL}/agents`, agentPayload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 201) {
      logger.info(`Agent registered successfully!`);
      console.log(`Agent ID: ${response.data.agent.id}`);
      console.log(`Agent Name: ${response.data.agent.name}`);
      console.log(`Capabilities: ${JSON.stringify(response.data.agent.capabilities)}`);
      console.log(`Status: ${response.data.agent.status}`);
      return response.data.agent.id;
    }
  } catch (error) {
    if (error.response) {
      logger.error(`API Error: ${error.response.status} - ${error.response.data.message || error.response.data}`);
    } else if (error.request) {
      logger.error('Network Error: Unable to reach the job server. Make sure the server is running.');
    } else {
      logger.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

/**
 * Wait for job completion and poll status
 * @param {string} jobId - The job ID to wait for
 * @param {number} timeout - Timeout in seconds (default: 300)
 */
async function waitForCompletion(jobId, timeout = 300) {
  const startTime = Date.now();
  const timeoutMs = timeout * 1000;
  
  logger.info(`Waiting for job completion: ${jobId} (timeout: ${timeout}s)`);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await axios.get(`${API_BASE_URL}/jobs/${jobId}`);
      const job = response.data;
      
      console.log(`Status: ${job.status}`);
      
      if (job.status === 'completed') {
        console.log('Job completed successfully!');
        if (job.result) {
          console.log(`Result: ${JSON.stringify(job.result, null, 2)}`);
        }
        return true;
      } else if (job.status === 'failed') {
        console.log('Job failed!');
        if (job.error) {
          console.log(`Error: ${job.error}`);
        }
        process.exit(1);
      }
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      logger.error(`Error polling job status: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  logger.error(`Timeout waiting for job completion after ${timeout} seconds`);
  process.exit(1);
}

// CLI Setup
program
  .name('qgjob')
  .description('QualGent Job Orchestrator CLI')
  .version('1.0.0');

program
  .command('submit')
  .description('Submit a test job')
  .requiredOption('--org-id <orgId>', 'Organization ID')
  .requiredOption('--app-version-id <appVersionId>', 'App Version ID')
  .requiredOption('--test <testPath>', 'Path to test file')
  .option('--priority <priority>', 'Job priority (low, medium, high)', 'medium')
  .option('--target <target>', 'Target environment (emulator, device, browserstack)', 'emulator')
  .option('--platform <platform>', 'Platform (android, ios)', 'android')
  .option('--appwright-project <project>', 'AppWright project name (android-browserstack, ios-browserstack, etc.)')
  .option('--wait', 'Wait for job completion')
  .option('--timeout <seconds>', 'Timeout for waiting (seconds)', '300')
  .action(async (options) => {
    const jobId = await submitJob(options);
    
    if (options.wait) {
      await waitForCompletion(jobId, parseInt(options.timeout));
    }
  });

program
  .command('register-agent')
  .description('Register an agent with the orchestrator')
  .requiredOption('--name <name>', 'Agent name')
  .requiredOption('--capabilities <capabilities>', 'Comma-separated list of capabilities (emulator,device,browserstack)')
  .option('--type <type>', 'Agent type', 'manual')
  .option('--location <location>', 'Agent location', 'unknown')
  .action(async (options) => {
    // Parse capabilities
    options.capabilities = options.capabilities.split(',').map(c => c.trim());
    await registerAgent(options);
  });

program
  .command('status')
  .description('Check job status')
  .requiredOption('--job-id <jobId>', 'Job ID to check')
  .action((options) => checkStatus(options.jobId));

program
  .command('wait')
  .description('Wait for job completion')
  .requiredOption('--job-id <jobId>', 'Job ID to wait for')
  .option('--timeout <seconds>', 'Timeout in seconds', '300')
  .action(async (options) => {
    await waitForCompletion(options.jobId, parseInt(options.timeout));
  });

// Convenience commands for AppWright testing
program
  .command('test:android-browserstack')
  .description('Run AppWright test on Android BrowserStack')
  .requiredOption('--org-id <orgId>', 'Organization ID')
  .requiredOption('--app-version-id <appVersionId>', 'App Version ID')
  .requiredOption('--test <testPath>', 'Path to test file')
  .option('--priority <priority>', 'Job priority (low, medium, high)', 'medium')
  .option('--wait', 'Wait for job completion')
  .option('--timeout <seconds>', 'Timeout for waiting (seconds)', '600')
  .action(async (options) => {
    const jobOptions = {
      ...options,
      target: 'browserstack',
      platform: 'android',
      appwrightProject: 'android-browserstack'
    };
    
    logger.info('🤖 Running AppWright test on Android BrowserStack...');
    const jobId = await submitJob(jobOptions);
    
    if (options.wait) {
      await waitForCompletion(jobId, parseInt(options.timeout));
    }
  });

program
  .command('test:ios-browserstack')
  .description('Run AppWright test on iOS BrowserStack')
  .requiredOption('--org-id <orgId>', 'Organization ID')
  .requiredOption('--app-version-id <appVersionId>', 'App Version ID')
  .requiredOption('--test <testPath>', 'Path to test file')
  .option('--priority <priority>', 'Job priority (low, medium, high)', 'medium')
  .option('--wait', 'Wait for job completion')
  .option('--timeout <seconds>', 'Timeout for waiting (seconds)', '600')
  .action(async (options) => {
    const jobOptions = {
      ...options,
      target: 'browserstack',
      platform: 'ios',
      appwrightProject: 'ios-browserstack'
    };
    
    logger.info('📱 Running AppWright test on iOS BrowserStack...');
    const jobId = await submitJob(jobOptions);
    
    if (options.wait) {
      await waitForCompletion(jobId, parseInt(options.timeout));
    }
  });

program
  .command('test:android-emulator')
  .description('Run AppWright test on Android Emulator')
  .requiredOption('--org-id <orgId>', 'Organization ID')
  .requiredOption('--app-version-id <appVersionId>', 'App Version ID')
  .requiredOption('--test <testPath>', 'Path to test file')
  .option('--priority <priority>', 'Job priority (low, medium, high)', 'medium')
  .option('--wait', 'Wait for job completion')
  .option('--timeout <seconds>', 'Timeout for waiting (seconds)', '300')
  .action(async (options) => {
    const jobOptions = {
      ...options,
      target: 'emulator',
      platform: 'android',
      appwrightProject: 'android-emulator'
    };
    
    logger.info('🔧 Running AppWright test on Android Emulator...');
    const jobId = await submitJob(jobOptions);
    
    if (options.wait) {
      await waitForCompletion(jobId, parseInt(options.timeout));
    }
  });

// Parse command line arguments
program.parse();
