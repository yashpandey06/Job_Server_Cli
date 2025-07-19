const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { AgentStore } = require('../services/redis');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Agent registration schema
const agentSchema = Joi.object({
  name: Joi.string().required(),
  capabilities: Joi.object({
    emulator: Joi.boolean().default(true),
    device: Joi.boolean().default(false),
    browserstack: Joi.boolean().default(false)
  }).default({ emulator: true, device: false, browserstack: false }),
  metadata: Joi.object().default({})
});

/**
 * POST /api/agents - Register a new agent
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = agentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const agentId = uuidv4();
    const agentData = {
      name: value.name,
      capabilities: value.capabilities,
      metadata: value.metadata
    };

    const agent = await AgentStore.registerAgent(agentId, agentData);

    logger.info(`Agent registered:`, { 
      agentId, 
      name: agent.name, 
      capabilities: agent.capabilities 
    });

    res.status(201).json({
      message: 'Agent registered successfully',
      agent: agent
    });

  } catch (error) {
    logger.error('Error registering agent:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to register agent'
    });
  }
});

/**
 * GET /api/agents - List all active agents
 */
router.get('/', async (req, res) => {
  try {
    const agents = await AgentStore.getActiveAgents();

    res.json({
      agents: agents,
      total: agents.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error listing agents:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list agents'
    });
  }
});

/**
 * GET /api/agents/:agentId - Get agent details
 */
router.get('/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist or is not active`
      });
    }

    res.json(agent);

  } catch (error) {
    logger.error('Error getting agent:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve agent'
    });
  }
});

/**
 * PUT /api/agents/:agentId/heartbeat - Update agent heartbeat
 */
router.put('/:agentId/heartbeat', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    await AgentStore.updateAgentHeartbeat(agentId);

    res.json({
      message: 'Heartbeat updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error updating agent heartbeat:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update heartbeat'
    });
  }
});

/**
 * PUT /api/agents/:agentId/status - Update agent status
 */
router.put('/:agentId/status', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, current_job } = req.body;

    // Validate status
    const validStatuses = ['idle', 'busy', 'maintenance', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    const updatedAgent = await AgentStore.updateAgentStatus(agentId, status, current_job);

    logger.info(`Agent status updated:`, { 
      agentId, 
      oldStatus: agent.status, 
      newStatus: status 
    });

    res.json({
      message: 'Agent status updated successfully',
      agent: updatedAgent
    });

  } catch (error) {
    logger.error('Error updating agent status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update agent status'
    });
  }
});

/**
 * DELETE /api/agents/:agentId - Unregister agent
 */
router.delete('/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    // In Redis, we just let the TTL expire, but we can mark it as offline
    await AgentStore.updateAgentStatus(agentId, 'offline', null);

    logger.info(`Agent unregistered:`, { agentId });

    res.json({
      message: 'Agent unregistered successfully'
    });

  } catch (error) {
    logger.error('Error unregistering agent:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to unregister agent'
    });
  }
});

/**
 * GET /api/agents/:id/jobs - Get jobs assigned to this agent
 */
router.get('/:id/jobs', async (req, res) => {
  try {
    const { id: agentId } = req.params;

    // Check if agent exists
    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    // Get jobs assigned to this agent (this is a simple implementation)
    // In a production system, you'd have a proper job assignment mechanism
    const { JobStore } = require('../services/redis');
    const allJobs = await JobStore.getAllJobs();
    
    // Filter jobs that match this agent's capabilities and are pending
    const agentJobs = allJobs.filter(job => {
      // Check if job status is pending and matches agent capabilities
      if (job.status !== 'pending') return false;
      
      // Check if agent has capability for this target
      const hasCapability = agent.capabilities && agent.capabilities[job.target];
      return hasCapability;
    });

    res.json({
      agent_id: agentId,
      jobs: agentJobs
    });

  } catch (error) {
    logger.error('Error getting agent jobs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get agent jobs'
    });
  }
});

/**
 * PUT /api/agents/:id/jobs/:jobId/claim - Claim a job for execution
 */
router.put('/:id/jobs/:jobId/claim', async (req, res) => {
  try {
    const { id: agentId, jobId } = req.params;

    // Check if agent exists
    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    // Get and claim the job
    const { JobStore } = require('../services/redis');
    const job = await JobStore.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    if (job.status !== 'pending') {
      return res.status(409).json({
        error: 'Job not available',
        message: `Job is in ${job.status} status and cannot be claimed`
      });
    }

    // Check if agent has capability for this job
    const hasCapability = agent.capabilities && agent.capabilities[job.target];
    if (!hasCapability) {
      return res.status(403).json({
        error: 'Insufficient capabilities',
        message: `Agent does not have capability for target: ${job.target}`
      });
    }

    // Claim the job
    job.status = 'running';
    job.assigned_agent = agentId;
    job.started_at = new Date().toISOString();
    
    await JobStore.updateJob(jobId, job);

    res.json({
      message: 'Job claimed successfully',
      job: job
    });

  } catch (error) {
    logger.error('Error claiming job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to claim job'
    });
  }
});

/**
 * PUT /api/agents/:id/jobs/:jobId/complete - Mark job as completed
 */
router.put('/:id/jobs/:jobId/complete', async (req, res) => {
  try {
    const { id: agentId, jobId } = req.params;
    const { success, error_message, results } = req.body;

    // Check if agent exists
    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    // Get and update the job
    const { JobStore } = require('../services/redis');
    const job = await JobStore.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    if (job.assigned_agent !== agentId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: `Job is not assigned to agent ${agentId}`
      });
    }

    // Update job status
    job.status = success ? 'completed' : 'failed';
    job.completed_at = new Date().toISOString();
    if (error_message) job.error_message = error_message;
    if (results) job.results = results;
    
    await JobStore.updateJob(jobId, job);

    res.json({
      message: 'Job status updated successfully',
      job: job
    });

  } catch (error) {
    logger.error('Error completing job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to complete job'
    });
  }
});

/**
 * PUT /api/agents/:id/jobs/:jobId/claim - Claim a job
 */
router.put('/:id/jobs/:jobId/claim', async (req, res) => {
  try {
    const { id: agentId, jobId } = req.params;

    // Check if agent exists
    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    // Get the job
    const { JobStore } = require('../services/redis');
    const job = await JobStore.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    if (job.status !== 'pending') {
      return res.status(400).json({
        error: 'Job cannot be claimed',
        message: `Job status is ${job.status}, only pending jobs can be claimed`
      });
    }

    // Claim the job
    await JobStore.updateJobStatus(jobId, 'running', {
      assigned_agent: agentId,
      claimed_at: new Date().toISOString()
    });

    // Update agent status
    await AgentStore.updateAgentStatus(agentId, 'busy');

    res.json({
      message: 'Job claimed successfully',
      job_id: jobId,
      agent_id: agentId
    });

  } catch (error) {
    logger.error('Error claiming job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to claim job'
    });
  }
});

/**
 * PUT /api/agents/:id/jobs/:jobId/complete - Complete a job
 */
router.put('/:id/jobs/:jobId/complete', async (req, res) => {
  try {
    const { id: agentId, jobId } = req.params;
    const { success, error_message, results } = req.body;

    // Check if agent exists
    const agent = await AgentStore.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `Agent with ID ${agentId} does not exist`
      });
    }

    // Get the job
    const { JobStore } = require('../services/redis');
    const job = await JobStore.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    if (job.assigned_agent !== agentId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Job is not assigned to this agent'
      });
    }

    // Complete the job
    const status = success ? 'completed' : 'failed';
    await JobStore.updateJobStatus(jobId, status, {
      completed_at: new Date().toISOString(),
      result: results,
      error: error_message
    });

    // Update agent status back to idle
    await AgentStore.updateAgentStatus(agentId, 'idle');

    res.json({
      message: 'Job completed successfully',
      job_id: jobId,
      agent_id: agentId,
      status
    });

  } catch (error) {
    logger.error('Error completing job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to complete job'
    });
  }
});

module.exports = router;
