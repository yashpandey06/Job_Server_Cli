const express = require('express');
const { Queue, JobStore, AgentStore } = require('../services/redis');
const { getJobProcessor } = require('../services/jobProcessor');

const router = express.Router();

/**
 * GET /api/monitoring/metrics - System metrics for horizontal scaling
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      queues: {},
      agents: {},
      jobs: {},
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      }
    };
    const priorities = ['high', 'medium', 'low'];
    for (const priority of priorities) {
      const queueName = `jobs:${priority}`;
      const length = await Queue.getQueueLength(queueName);
      metrics.queues[priority] = {
        length,
        processing_rate: 0,
        avg_wait_time: 0
      };
    }
    const agents = await AgentStore.getActiveAgents();
    metrics.agents = {
      total: agents.length,
      idle: agents.filter(a => a.status === 'idle').length,
      busy: agents.filter(a => a.status === 'busy').length,
      offline: agents.filter(a => a.status === 'offline').length,
      by_capability: {
        emulator: agents.filter(a => a.capabilities?.emulator).length,
        device: agents.filter(a => a.capabilities?.device).length,
        browserstack: agents.filter(a => a.capabilities?.browserstack).length
      }
    };
    const jobProcessor = getJobProcessor();
    if (jobProcessor) {
      metrics.job_processor = {
        running: jobProcessor.isRunning,
        job_groups: Object.keys(jobProcessor.getJobGroups()).length
      };
    }
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/scale-recommendations - Scaling recommendations
 */
router.get('/scale-recommendations', async (req, res) => {
  try {
    const recommendations = {
      timestamp: new Date().toISOString(),
      scaling_needed: false,
      recommendations: []
    };
    const priorities = ['high', 'medium', 'low'];
    let totalQueueDepth = 0;
    for (const priority of priorities) {
      const queueName = `jobs:${priority}`;
      const length = await Queue.getQueueLength(queueName);
      totalQueueDepth += length;
    }
    const agents = await AgentStore.getActiveAgents();
    const idleAgents = agents.filter(a => a.status === 'idle').length;
    const busyAgents = agents.filter(a => a.status === 'busy').length;
    if (totalQueueDepth > 10 && idleAgents === 0) {
      recommendations.scaling_needed = true;
      recommendations.recommendations.push({
        type: 'scale_agents',
        reason: 'High queue depth with no idle agents',
        suggested_agents: Math.ceil(totalQueueDepth / 5),
        queue_depth: totalQueueDepth,
        idle_agents: idleAgents
      });
    }
    if (busyAgents > 0 && totalQueueDepth > busyAgents * 3) {
      recommendations.scaling_needed = true;
      recommendations.recommendations.push({
        type: 'scale_job_servers',
        reason: 'Queue depth exceeds processing capacity',
        current_capacity: busyAgents,
        required_capacity: Math.ceil(totalQueueDepth / 3)
      });
    }
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get scaling recommendations',
      message: error.message
    });
  }
});

/**
 * GET /api/monitoring/org-stats - Organization-specific statistics
 */
router.get('/org-stats', async (req, res) => {
  try {
    const { org_id } = req.query;
    const stats = {
      timestamp: new Date().toISOString(),
      organizations: {}
    };
    if (org_id) {
      const orgJobs = await JobStore.getJobsByOrg(org_id);
      stats.organizations[org_id] = {
        total_jobs: orgJobs.length,
        pending: orgJobs.filter(j => j.status === 'pending').length,
        running: orgJobs.filter(j => j.status === 'running').length,
        completed: orgJobs.filter(j => j.status === 'completed').length,
        failed: orgJobs.filter(j => j.status === 'failed').length,
        avg_execution_time: 0,
        success_rate: orgJobs.length > 0 ? 
          orgJobs.filter(j => j.status === 'completed').length / orgJobs.length : 0
      };
    } else {
      stats.message = 'Provide org_id parameter for specific organization statistics';
    }
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get organization statistics',
      message: error.message
    });
  }
});

module.exports = router;
