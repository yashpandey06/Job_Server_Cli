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

module.exports = router;
