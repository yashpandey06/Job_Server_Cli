const winston = require('winston');
const { Queue, JobStore, AgentStore } = require('./redis');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Job processor that handles job scheduling and execution
 */
class JobProcessor {
  constructor() {
    this.isRunning = false;
    this.processingInterval = null;
    this.groupingMap = new Map(); // Track jobs by app_version_id
  }

  /**
   * Start the job processor
   */
  start() {
    if (this.isRunning) {
      logger.warn('Job processor is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting job processor...');

    // Process jobs every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(error => {
        logger.error('Error in job processing cycle:', error);
      });
    }, 5000);

    // Clean up completed job groups every minute
    setInterval(() => {
      this.cleanupJobGroups();
    }, 60000);
  }

  /**
   * Stop the job processor
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    logger.info('Job processor stopped');
  }

  /**
   * Main job processing logic
   */
  async processJobs() {
    try {
      // Get available agents
      const agents = await AgentStore.getActiveAgents();
      const idleAgents = agents.filter(agent => agent.status === 'idle');

      if (idleAgents.length === 0) {
        // No idle agents available
        return;
      }

      // Process different queue types
      await this.processQueueByPriority('high', idleAgents);
      await this.processQueueByPriority('medium', idleAgents);
      await this.processQueueByPriority('low', idleAgents);

    } catch (error) {
      logger.error('Error processing jobs:', error);
    }
  }

  /**
   * Process jobs from a specific priority queue with org-based prioritization
   */
  async processQueueByPriority(priority, availableAgents) {
    const queueName = `jobs:${priority}`;
    
    // Get all jobs from queue and sort by org priority
    const allJobs = await Queue.getQueueJobs(queueName);
    if (allJobs.length === 0) return;
    
    // Org-specific priority mapping (higher priority orgs get processed first)
    const orgPriorities = {
      'qualgent': 100,
      'premium-org': 90,
      'enterprise': 80,
      'standard': 50
    };
    
    // Sort jobs by org priority, then by creation time
    allJobs.sort((a, b) => {
      const aPriority = orgPriorities[a.org_id] || 10;
      const bPriority = orgPriorities[b.org_id] || 10;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // Same org priority, sort by creation time
      return new Date(a.created_at) - new Date(b.created_at);
    });
    
    // Clear the queue and re-add sorted jobs
    while (await Queue.getNextJob(queueName)) {
      // Remove all jobs from queue
    }
    
    // Process jobs in priority order
    for (const job of allJobs) {
      if (availableAgents.length === 0) {
        // Re-add remaining jobs back to queue
        await Queue.addJob(queueName, job);
        continue;
      }
      
      // Find suitable agent for this job
      const suitableAgent = this.findSuitableAgent(job, availableAgents);
      if (!suitableAgent) {
        // No suitable agent, put job back in queue
        await Queue.addJob(queueName, job);
        continue;
      }

      // Check if we should group this job with existing ones
      const shouldGroup = await this.shouldGroupJob(job, suitableAgent);
      
      if (shouldGroup) {
        await this.addJobToGroup(job, suitableAgent);
      } else {
        await this.assignJobToAgent(job, suitableAgent);
        // Remove agent from available list
        const agentIndex = availableAgents.findIndex(a => a.id === suitableAgent.id);
        if (agentIndex > -1) {
          availableAgents.splice(agentIndex, 1);
        }
      }
    }
  }

  /**
   * Find suitable agent for a job based on target requirements
   */
  findSuitableAgent(job, agents) {
    return agents.find(agent => {
      // Match target capabilities
      if (job.target === 'emulator' && agent.capabilities?.emulator) {
        return true;
      }
      if (job.target === 'device' && agent.capabilities?.device) {
        return true;
      }
      if (job.target === 'browserstack' && agent.capabilities?.browserstack) {
        return true;
      }
      // Default: any agent can handle any target (for demo purposes)
      return true;
    });
  }

  /**
   * Check if job should be grouped with existing jobs on the agent
   */
  async shouldGroupJob(job, agent) {
    // Check if agent is already processing jobs for the same app_version_id
    const currentJob = agent.current_job;
    if (currentJob && currentJob.app_version_id === job.app_version_id) {
      return true;
    }

    // Check if there's an active group for this app_version_id on this agent
    const groupKey = `${agent.id}:${job.app_version_id}`;
    return this.groupingMap.has(groupKey);
  }

  /**
   * Add job to existing group
   */
  async addJobToGroup(job, agent) {
    const groupKey = `${agent.id}:${job.app_version_id}`;
    
    if (!this.groupingMap.has(groupKey)) {
      this.groupingMap.set(groupKey, {
        agent_id: agent.id,
        app_version_id: job.app_version_id,
        jobs: [],
        created_at: new Date().toISOString()
      });
    }

    const group = this.groupingMap.get(groupKey);
    group.jobs.push(job);

    // Update job status
    await JobStore.updateJobStatus(job.id, 'queued_for_group', {
      group_key: groupKey,
      agent_id: agent.id
    });

    logger.info(`Job added to group:`, { 
      jobId: job.id, 
      groupKey, 
      groupSize: group.jobs.length 
    });
  }

  /**
   * Assign job directly to agent
   */
  async assignJobToAgent(job, agent) {
    try {
      // Update agent status
      await AgentStore.updateAgentStatus(agent.id, 'busy', job);

      // Update job status
      await JobStore.updateJobStatus(job.id, 'running', {
        agent_id: agent.id,
        assigned_at: new Date().toISOString()
      });

      // Create a group for this app_version_id
      const groupKey = `${agent.id}:${job.app_version_id}`;
      this.groupingMap.set(groupKey, {
        agent_id: agent.id,
        app_version_id: job.app_version_id,
        jobs: [job],
        created_at: new Date().toISOString(),
        processing: true
      });

      logger.info(`Job assigned to agent:`, { 
        jobId: job.id, 
        agentId: agent.id,
        appVersionId: job.app_version_id
      });

      // Simulate job execution
      this.simulateJobExecution(job, agent);

    } catch (error) {
      logger.error('Error assigning job to agent:', error);
      // Put job back in queue
      const queueName = `jobs:${job.priority}`;
      await Queue.addJob(queueName, job);
    }
  }

  /**
   * Simulate job execution (in real implementation, this would communicate with actual agents)
   */
  async simulateJobExecution(job, agent) {
    const executionTime = Math.random() * 30000 + 10000; // 10-40 seconds
    
    setTimeout(async () => {
      try {
        // Simulate random success/failure
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
          await JobStore.updateJobStatus(job.id, 'completed', {
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
        } else {
          // Handle failure with retry logic
          const currentRetries = job.retry_count || 0;
          const maxRetries = 3;
          
          if (currentRetries < maxRetries) {
            // Retry the job
            const updatedJob = await JobStore.updateJobStatus(job.id, 'retrying', {
              retry_count: currentRetries + 1,
              last_error: 'Test execution failed: Assertion error in test case',
              retry_at: new Date(Date.now() + 5000).toISOString() // Retry after 5 seconds
            });
            
            logger.info(`Job failed, retrying: ${job.id} (attempt ${currentRetries + 1}/${maxRetries})`);
            
            // Re-queue the job for retry
            const queueName = `jobs:${job.priority}`;
            await Queue.addJob(queueName, {
              ...job,
              retry_count: currentRetries + 1,
              status: 'pending'
            });
          } else {
            // Max retries reached, mark as failed
            await JobStore.updateJobStatus(job.id, 'failed', {
              error: 'Test execution failed after maximum retries',
              retry_count: currentRetries,
              max_retries_reached: true
            });
            logger.error(`Job failed after ${maxRetries} retries: ${job.id}`);
          }
        }

        // Check if there are more jobs in the group
        const groupKey = `${agent.id}:${job.app_version_id}`;
        const group = this.groupingMap.get(groupKey);
        
        if (group && group.jobs.length > 1) {
          // Remove completed job from group
          group.jobs = group.jobs.filter(j => j.id !== job.id);
          
          if (group.jobs.length > 0) {
            // Process next job in group
            const nextJob = group.jobs[0];
            await JobStore.updateJobStatus(nextJob.id, 'running', {
              agent_id: agent.id,
              assigned_at: new Date().toISOString()
            });
            
            logger.info(`Processing next job in group:`, { 
              jobId: nextJob.id, 
              groupKey 
            });
            
            // Continue simulation for next job
            this.simulateJobExecution(nextJob, agent);
            return;
          }
        }

        // No more jobs in group, free up agent
        await AgentStore.updateAgentStatus(agent.id, 'idle', null);
        
        // Clean up group
        if (group) {
          this.groupingMap.delete(groupKey);
          logger.info(`Group completed and cleaned up:`, groupKey);
        }

      } catch (error) {
        logger.error('Error in job execution simulation:', error);
        await JobStore.updateJobStatus(job.id, 'failed', {
          error: 'Internal execution error'
        });
        await AgentStore.updateAgentStatus(agent.id, 'idle', null);
      }
    }, executionTime);
  }

  /**
   * Clean up old job groups
   */
  cleanupJobGroups() {
    const now = new Date();
    const cutoff = 10 * 60 * 1000; // 10 minutes

    for (const [groupKey, group] of this.groupingMap.entries()) {
      const groupAge = now - new Date(group.created_at);
      if (groupAge > cutoff && !group.processing) {
        this.groupingMap.delete(groupKey);
        logger.info(`Cleaned up stale group:`, groupKey);
      }
    }
  }

  /**
   * Get current job groups (for monitoring)
   */
  getJobGroups() {
    const groups = {};
    for (const [groupKey, group] of this.groupingMap.entries()) {
      groups[groupKey] = {
        ...group,
        job_count: group.jobs.length,
        job_ids: group.jobs.map(j => j.id)
      };
    }
    return groups;
  }
}

// Global job processor instance
let jobProcessor = null;

/**
 * Start the job processor
 */
function startJobProcessor() {
  if (!jobProcessor) {
    jobProcessor = new JobProcessor();
  }
  jobProcessor.start();
}

/**
 * Stop the job processor
 */
function stopJobProcessor() {
  if (jobProcessor) {
    jobProcessor.stop();
  }
}

/**
 * Get job processor instance (for monitoring)
 */
function getJobProcessor() {
  return jobProcessor;
}

module.exports = {
  JobProcessor,
  startJobProcessor,
  stopJobProcessor,
  getJobProcessor
};
