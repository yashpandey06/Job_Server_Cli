const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { Queue, JobStore } = require('../services/redis');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Job submission schema
const jobSchema = Joi.object({
  org_id: Joi.string().required(),
  app_version_id: Joi.string().required(),
  test_path: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  target: Joi.string().valid('emulator', 'device', 'browserstack').default('emulator'),
  id: Joi.string().optional(),
  created_at: Joi.date().optional(),
  status: Joi.string().optional()
});

/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Submit a new test job
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - org_id
 *               - app_version_id
 *               - test_path
 *             properties:
 *               org_id:
 *                 type: string
 *                 description: Organization identifier
 *                 example: "qualgent"
 *               app_version_id:
 *                 type: string
 *                 description: Application version for grouping
 *                 example: "v1.2.3"
 *               test_path:
 *                 type: string
 *                 description: Path to test file
 *                 example: "examples/appwright-tests/onboarding.spec.js"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *               target:
 *                 type: string
 *                 enum: [emulator, device, browserstack]
 *                 default: emulator
 *     responses:
 *       201:
 *         description: Job submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 job:
 *                   $ref: '#/components/schemas/Job'
 *                 queue_position:
 *                   type: integer
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = jobSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    // Create job object
    const job = {
      id: value.id || uuidv4(),
      org_id: value.org_id,
      app_version_id: value.app_version_id,
      test_path: value.test_path,
      priority: value.priority,
      target: value.target,
      status: 'pending',
      created_at: value.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store job
    await JobStore.setJob(job.id, job);

    // Add to appropriate priority queue
    const queueName = `jobs:${job.priority}`;
    await Queue.addJob(queueName, job);

    // Get queue position
    const queueLength = await Queue.getQueueLength(queueName);

    logger.info(`Job submitted:`, { 
      jobId: job.id, 
      orgId: job.org_id, 
      appVersionId: job.app_version_id 
    });

    res.status(201).json({
      message: 'Job submitted successfully',
      job: job,
      queue_position: queueLength
    });

  } catch (error) {
    logger.error('Error submitting job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to submit job'
    });
  }
});

/**
 * @swagger
 * /jobs/{jobId}:
 *   get:
 *     summary: Get job status and details
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Validate job ID format
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        error: 'Invalid job ID',
        message: 'Job ID must be a valid string'
      });
    }

    const job = await JobStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    res.json(job);

  } catch (error) {
    logger.error('Error getting job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve job'
    });
  }
});

/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: List jobs with optional filtering
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: org_id
 *         schema:
 *           type: string
 *         description: Filter by organization ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed, retrying, cancelled]
 *         description: Filter by job status
 *       - in: query
 *         name: app_version_id
 *         schema:
 *           type: string
 *         description: Filter by app version ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of jobs to return
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Job'
 *                 total:
 *                   type: integer
 *                 filters:
 *                   type: object
 */
router.get('/', async (req, res) => {
  try {
    const { org_id, status, app_version_id, limit = 50 } = req.query;

    let jobs = [];

    if (org_id) {
      jobs = await JobStore.getJobsByOrg(org_id);
    } else {
      // This is a simplified implementation - in production, you'd want pagination
      const client = require('../services/redis').getRedisClient();
      const keys = await client.keys('job:*');
      
      for (const key of keys.slice(0, parseInt(limit))) {
        const jobString = await client.get(key);
        if (jobString) {
          jobs.push(JSON.parse(jobString));
        }
      }
      
      // Sort by creation date
      jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // Apply filters
    if (status) {
      jobs = jobs.filter(job => job.status === status);
    }

    if (app_version_id) {
      jobs = jobs.filter(job => job.app_version_id === app_version_id);
    }

    res.json({
      jobs: jobs.slice(0, parseInt(limit)),
      total: jobs.length,
      filters: { org_id, status, app_version_id, limit }
    });

  } catch (error) {
    logger.error('Error listing jobs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list jobs'
    });
  }
});

/**
 * PUT /api/jobs/:jobId/status - Update job status (for agents)
 */
router.put('/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, result, error: errorMessage } = req.body;

    // Validate status
    const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const job = await JobStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    // Update job status
    const additionalData = {};
    if (result) additionalData.result = result;
    if (errorMessage) additionalData.error = errorMessage;

    const updatedJob = await JobStore.updateJobStatus(jobId, status, additionalData);

    logger.info(`Job status updated:`, { 
      jobId, 
      oldStatus: job.status, 
      newStatus: status 
    });

    res.json({
      message: 'Job status updated successfully',
      job: updatedJob
    });

  } catch (error) {
    logger.error('Error updating job status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update job status'
    });
  }
});

/**
 * DELETE /api/jobs/:jobId - Cancel job
 */
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await JobStore.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`
      });
    }

    // Only allow cancellation of pending or running jobs
    if (!['pending', 'running'].includes(job.status)) {
      return res.status(400).json({
        error: 'Cannot cancel job',
        message: `Job with status '${job.status}' cannot be cancelled`
      });
    }

    // Update job status to cancelled
    const updatedJob = await JobStore.updateJobStatus(jobId, 'cancelled');

    logger.info(`Job cancelled:`, { jobId });

    res.json({
      message: 'Job cancelled successfully',
      job: updatedJob
    });

  } catch (error) {
    logger.error('Error cancelling job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel job'
    });
  }
});

/**
 * GET /api/jobs/queue/status - Get queue status
 */
router.get('/queue/status', async (req, res) => {
  try {
    const queueStatus = {};
    const priorities = ['high', 'medium', 'low'];

    for (const priority of priorities) {
      const queueName = `jobs:${priority}`;
      const length = await Queue.getQueueLength(queueName);
      queueStatus[priority] = {
        length,
        jobs: length > 0 ? await Queue.getQueueJobs(queueName) : []
      };
    }

    // Get job processor status
    const jobProcessor = require('../services/jobProcessor').getJobProcessor();
    const jobGroups = jobProcessor ? jobProcessor.getJobGroups() : {};

    res.json({
      queues: queueStatus,
      job_groups: jobGroups,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get queue status'
    });
  }
});

module.exports = router;
