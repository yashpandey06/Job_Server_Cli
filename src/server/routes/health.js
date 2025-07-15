const express = require('express');
const { getRedisClient } = require('../services/redis');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'QualGent Job Orchestrator',
      version: '1.0.0'
    };

    // Check Redis connection
    try {
      const client = getRedisClient();
      await client.ping();
      health.redis = 'connected';
    } catch (error) {
      health.redis = 'disconnected';
      health.status = 'unhealthy';
    }

    // Check job processor
    const jobProcessor = require('../services/jobProcessor').getJobProcessor();
    health.job_processor = jobProcessor && jobProcessor.isRunning ? 'running' : 'stopped';

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * GET /api/health/detailed - Detailed health check
 */
router.get('/detailed', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'QualGent Job Orchestrator',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development'
    };

    // Check Redis connection and get info
    try {
      const client = getRedisClient();
      await client.ping();
      health.redis = {
        status: 'connected',
        info: await client.info('memory')
      };
    } catch (error) {
      health.redis = {
        status: 'disconnected',
        error: error.message
      };
      health.status = 'unhealthy';
    }

    // Check job processor and get stats
    const jobProcessor = require('../services/jobProcessor').getJobProcessor();
    if (jobProcessor && jobProcessor.isRunning) {
      health.job_processor = {
        status: 'running',
        job_groups: jobProcessor.getJobGroups()
      };
    } else {
      health.job_processor = {
        status: 'stopped'
      };
    }

    // Get queue lengths
    try {
      const { Queue } = require('../services/redis');
      health.queues = {
        high: await Queue.getQueueLength('jobs:high'),
        medium: await Queue.getQueueLength('jobs:medium'),
        low: await Queue.getQueueLength('jobs:low')
      };
    } catch (error) {
      health.queues = { error: error.message };
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
