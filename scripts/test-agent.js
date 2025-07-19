const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = process.env.QGJOB_API_URL || 'http://localhost:3000/api';
const AGENT_NAME = process.env.AGENT_NAME || `test-agent-${Date.now()}`;
const CAPABILITIES = process.env.AGENT_CAPABILITIES || 'all';

// Parse capabilities - default to supporting all targets
const capabilities = {
  emulator: CAPABILITIES.includes('emulator') || CAPABILITIES.includes('all'),
  device: CAPABILITIES.includes('device') || CAPABILITIES.includes('all'), 
  browserstack: CAPABILITIES.includes('browserstack') || CAPABILITIES.includes('all')
};

console.log(`Starting test agent: ${AGENT_NAME}`);
console.log(`Capabilities:`, capabilities);

let agentId = null;

/**
 * Register the agent with the server
 */
async function registerAgent() {
  try {
    const response = await axios.post(`${API_URL}/agents`, {
      name: AGENT_NAME,
      capabilities: capabilities,
      metadata: {
        platform: 'docker',
        version: '1.0.0'
      }
    });
    
    agentId = response.data.agent.id;
    console.log(`Agent registered with ID: ${agentId}`);
    return agentId;
  } catch (error) {
    console.error('Failed to register agent:', error.message);
    throw error;
  }
}

/**
 * Send heartbeat to keep agent alive
 */
async function sendHeartbeat() {
  if (!agentId) return;
  
  try {
    await axios.put(`${API_URL}/agents/${agentId}/heartbeat`);
    console.log(`Heartbeat sent for agent: ${agentId}`);
  } catch (error) {
    console.error('Failed to send heartbeat:', error.message);
  }
}

/**
 * Update agent status
 */
async function updateStatus(status, currentJob = null) {
  if (!agentId) return;
  
  try {
    await axios.put(`${API_URL}/agents/${agentId}/status`, {
      status: status,
      current_job: currentJob
    });
    console.log(`Status updated to: ${status}`);
  } catch (error) {
    console.error('Failed to update status:', error.message);
  }
}

/**
 * Poll for available jobs
 */
async function pollForJobs() {
  if (!agentId) return;
  
  try {
    // Check if there are any jobs assigned to this agent
    const response = await axios.get(`${API_URL}/agents/${agentId}/jobs`);
    const jobs = response.data.jobs || [];
    
    for (const job of jobs) {
      if (job.status === 'pending') {
        console.log(`📋 Found job: ${job.id}, executing...`);
        await executeJob(job);
      }
    }
  } catch (error) {
    // Ignore errors from polling - server may be temporarily unavailable
    console.debug('Error polling for jobs:', error.message);
  }
}

/**
 * Execute a job
 */
async function executeJob(job) {
  try {
    console.log(`🎯 Claiming job ${job.id} (${job.name})`);
    console.log(`📝 Job details:`, JSON.stringify(job, null, 2));
    
    // Claim the job
    await axios.put(`${API_URL}/agents/${agentId}/jobs/${job.id}/claim`);
    console.log(`✅ Job ${job.id} claimed successfully, executing...`);
    
    // Execute the job based on target type
    let success = false;
    let results = null;
    let errorMessage = null;
    
    try {
      if (job.target === 'browserstack') {
        results = await runBrowserStackTest(job);
        success = true;
      } else if (job.target === 'emulator') {
        results = await runEmulatorTest(job);
        success = true;
      } else if (job.target === 'device') {
        results = await runDeviceTest(job);
        success = true;
      } else {
        throw new Error(`Unsupported target type: ${job.target}`);
      }
      
      console.log(`✅ Job ${job.id} executed successfully`);
      
    } catch (execError) {
      console.error(`❌ Job ${job.id} execution failed:`, execError.message);
      success = false;
      errorMessage = execError.message;
    }
    
    // Report job completion
    await axios.put(`${API_URL}/agents/${agentId}/jobs/${job.id}/complete`, {
      success,
      error_message: errorMessage,
      results
    });
    
    console.log(`📊 Job ${job.id} completion reported`);
    
  } catch (error) {
    console.error(`💥 Error executing job ${job.id}:`, error.message);
  }
}

/**
 * Run BrowserStack test
 */
async function runBrowserStackTest(job) {
  console.log('🌐 Running BrowserStack test...');
  
  // Run the test based on job type
  if (job.test_path && job.test_path.includes('mobile-app')) {
    // Run mobile app test using Appium + BrowserStack
    console.log('📱 Detected mobile app test, running Appium on BrowserStack...');
    
    // Set BrowserStack credentials
    process.env.BROWSERSTACK_USERNAME = 'yashpandey_IyJiZW';
    process.env.BROWSERSTACK_ACCESS_KEY = 'PXqHpxFxL84ANkkddefE';
    
    // Change to the Appium directory and run the test
    const appiumDir = 'node-appium-app-browserstack-master/android';
    return await runCommand('npm', ['test'], { cwd: appiumDir });
  } else {
    // Run regular web test
    return await runCommand('npm', ['test']);
  }
}

/**
 * Run emulator test
 */
async function runEmulatorTest(job) {
  console.log('📱 Running emulator test...');
  
  // Run the mobile app test on emulator
  if (job.test_path && job.test_path.includes('mobile-app')) {
    console.log('📱 Detected mobile app test, running Appium on emulator...');
    
    // Change to the Appium directory and run the test
    const appiumDir = 'node-appium-app-browserstack-master/android';
    return await runCommand('npm', ['test'], { cwd: appiumDir });
  } else {
    return await runCommand('npm', ['test']);
  }
}

/**
 * Run device test
 */
async function runDeviceTest(job) {
  console.log('📲 Running device test...');
  
  // Run the mobile app test on real device
  if (job.test_path && job.test_path.includes('mobile-app')) {
    console.log('📱 Detected mobile app test, running Appium on device...');
    
    // Change to the Appium directory and run the test
    const appiumDir = 'node-appium-app-browserstack-master/android';
    return await runCommand('npm', ['test'], { cwd: appiumDir });
  } else {
    return await runCommand('npm', ['test']);
  }
}

/**
 * Helper to run shell commands
 */
async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const spawnOptions = { 
      stdio: 'pipe',
      cwd: options.cwd || process.cwd()
    };
    
    console.log(`🔧 Running command: ${command} ${args.join(' ')} in ${spawnOptions.cwd}`);
    
    const childProcess = spawn(command, args, spawnOptions);
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString().trim());
    });
    
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(data.toString().trim());
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });
    
    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start command: ${error.message}`));
    });
  });
}

/**
 * Main agent loop
 */
async function runAgent() {
  try {
    // Register agent
    await registerAgent();
    
    // Set up heartbeat interval (every 30 seconds)
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);
    
    // Set up job polling interval (every 5 seconds)  
    const pollingInterval = setInterval(pollForJobs, 5000);
    
    console.log('Agent is now running and waiting for jobs...');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down agent...');
      clearInterval(heartbeatInterval);
      clearInterval(pollingInterval);
      if (agentId) {
        await updateStatus('offline');
      }
      process.exit(0);
    });
    
    // Keep the process running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Agent error:', error);
    process.exit(1);
  }
}

// Start the agent
runAgent();
