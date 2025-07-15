const redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

let client = null;

/**
 * Initialize Redis connection
 */
async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  client = redis.createClient({
    url: redisUrl,
    retry_strategy: (options) => {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        logger.error('Redis connection refused');
        return new Error('Redis connection refused');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        logger.error('Retry time exhausted');
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        logger.error('Too many retry attempts');
        return undefined;
      }
      return Math.min(options.attempt * 100, 3000);
    }
  });

  client.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    logger.info('Connected to Redis');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('end', () => {
    logger.info('Redis connection ended');
  });

  await client.connect();
  return client;
}

/**
 * Get Redis client instance
 */
function getRedisClient() {
  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
}

/**
 * Queue operations
 */
const Queue = {
  /**
   * Add job to queue
   */
  async addJob(queueName, job) {
    const client = getRedisClient();
    const jobString = JSON.stringify(job);
    await client.lPush(queueName, jobString);
    logger.info(`Job added to queue ${queueName}:`, job.id);
  },

  /**
   * Get next job from queue
   */
  async getNextJob(queueName) {
    const client = getRedisClient();
    const jobString = await client.rPop(queueName);
    if (jobString) {
      return JSON.parse(jobString);
    }
    return null;
  },

  /**
   * Get queue length
   */
  async getQueueLength(queueName) {
    const client = getRedisClient();
    return await client.lLen(queueName);
  },

  /**
   * Get all jobs in queue (for monitoring)
   */
  async getQueueJobs(queueName) {
    const client = getRedisClient();
    const jobs = await client.lRange(queueName, 0, -1);
    return jobs.map(job => JSON.parse(job));
  }
};

/**
 * Job storage operations
 */
const JobStore = {
  /**
   * Store job data
   */
  async setJob(jobId, jobData) {
    const client = getRedisClient();
    const key = `job:${jobId}`;
    await client.setEx(key, 86400, JSON.stringify(jobData)); // TTL: 24 hours
    logger.info(`Job stored:`, jobId);
  },

  /**
   * Get job data
   */
  async getJob(jobId) {
    const client = getRedisClient();
    const key = `job:${jobId}`;
    const jobString = await client.get(key);
    if (jobString) {
      return JSON.parse(jobString);
    }
    return null;
  },

  /**
   * Update job status
   */
  async updateJobStatus(jobId, status, additionalData = {}) {
    const job = await this.getJob(jobId);
    if (job) {
      job.status = status;
      job.updated_at = new Date().toISOString();
      
      if (status === 'running') {
        job.started_at = new Date().toISOString();
      } else if (status === 'completed' || status === 'failed') {
        job.completed_at = new Date().toISOString();
      }
      
      // Merge additional data
      Object.assign(job, additionalData);
      
      await this.setJob(jobId, job);
      logger.info(`Job status updated:`, { jobId, status });
      return job;
    }
    return null;
  },

  /**
   * Get jobs by organization
   */
  async getJobsByOrg(orgId) {
    const client = getRedisClient();
    const keys = await client.keys('job:*');
    const jobs = [];
    
    for (const key of keys) {
      const jobString = await client.get(key);
      if (jobString) {
        const job = JSON.parse(jobString);
        if (job.org_id === orgId) {
          jobs.push(job);
        }
      }
    }
    
    return jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
};

/**
 * Agent management
 */
const AgentStore = {
  /**
   * Register agent
   */
  async registerAgent(agentId, agentData) {
    const client = getRedisClient();
    const key = `agent:${agentId}`;
    const agent = {
      ...agentData,
      id: agentId,
      status: 'idle',
      last_seen: new Date().toISOString(),
      registered_at: new Date().toISOString()
    };
    
    await client.setEx(key, 300, JSON.stringify(agent)); // TTL: 5 minutes
    logger.info(`Agent registered:`, agentId);
    return agent;
  },

  /**
   * Update agent heartbeat
   */
  async updateAgentHeartbeat(agentId) {
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.last_seen = new Date().toISOString();
      const client = getRedisClient();
      const key = `agent:${agentId}`;
      await client.setEx(key, 300, JSON.stringify(agent));
    }
  },

  /**
   * Get agent
   */
  async getAgent(agentId) {
    const client = getRedisClient();
    const key = `agent:${agentId}`;
    const agentString = await client.get(key);
    if (agentString) {
      return JSON.parse(agentString);
    }
    return null;
  },

  /**
   * Get all active agents
   */
  async getActiveAgents() {
    const client = getRedisClient();
    const keys = await client.keys('agent:*');
    const agents = [];
    
    for (const key of keys) {
      const agentString = await client.get(key);
      if (agentString) {
        const agent = JSON.parse(agentString);
        // Consider agent active if last seen within 2 minutes
        const lastSeen = new Date(agent.last_seen);
        const now = new Date();
        if (now - lastSeen < 120000) {
          agents.push(agent);
        }
      }
    }
    
    return agents;
  },

  /**
   * Update agent status
   */
  async updateAgentStatus(agentId, status, currentJob = null) {
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.status = status;
      agent.current_job = currentJob;
      agent.last_seen = new Date().toISOString();
      
      const client = getRedisClient();
      const key = `agent:${agentId}`;
      await client.setEx(key, 300, JSON.stringify(agent));
      logger.info(`Agent status updated:`, { agentId, status });
      return agent;
    }
    return null;
  }
};

module.exports = {
  initializeRedis,
  getRedisClient,
  Queue,
  JobStore,
  AgentStore
};
