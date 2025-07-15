const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = process.env.QGJOB_API_URL || 'http://localhost:3000/api';
const AGENT_NAME = process.env.AGENT_NAME || `test-agent-${Date.now()}`;
const CAPABILITIES = process.env.AGENT_CAPABILITIES || 'emulator';

// Parse capabilities - default to supporting all for demo
const capabilities = {
  emulator: CAPABILITIES.includes('emulator') || CAPABILITIES.includes('all') || !CAPABILITIES.includes('device') && !CAPABILITIES.includes('browserstack'),
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
 * Simulate job execution
 */
async function simulateJobExecution(job) {
  console.log(`Starting job execution: ${job.id}`);
  
  // Update status to busy
  await updateStatus('busy', job);
  
  // Simulate execution time (5-15 seconds)
  const executionTime = Math.random() * 10000 + 5000;
  await new Promise(resolve => setTimeout(resolve, executionTime));
  
  // Simulate success/failure (90% success rate)
  const success = Math.random() > 0.1;
  
  try {
    if (success) {
      await axios.put(`${API_URL}/jobs/${job.id}/status`, {
        status: 'completed',
        result: {
          status: 'passed',
          test_results: {
            total: 10,
            passed: 10,
            failed: 0,
            duration: executionTime
          }
        }
      });
      console.log(`Job completed successfully: ${job.id}`);
    } else {
      await axios.put(`${API_URL}/jobs/${job.id}/status`, {
        status: 'failed',
        error: 'Test execution failed: Assertion error in test case'
      });
      console.log(`Job failed: ${job.id}`);
    }
  } catch (error) {
    console.error('Failed to update job status:', error.message);
  }
  
  // Update agent status back to idle
  await updateStatus('idle');
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
    
    console.log('Agent is now running and waiting for jobs...');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down agent...');
      clearInterval(heartbeatInterval);
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
