const request = require('supertest');
const express = require('express');

// Mock the Redis module for testing
jest.mock('../src/server/services/redis', () => ({
  initializeRedis: jest.fn().mockResolvedValue({}),
  getRedisClient: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn().mockResolvedValue('redis_version:7.0.0'),
  }),
  Queue: {
    addJob: jest.fn().mockResolvedValue(true),
    getNextJob: jest.fn().mockResolvedValue(null),
    getQueueLength: jest.fn().mockResolvedValue(0),
    getQueueJobs: jest.fn().mockResolvedValue([])
  },
  JobStore: {
    setJob: jest.fn().mockResolvedValue(true),
    getJob: jest.fn().mockResolvedValue(null),
    updateJobStatus: jest.fn().mockResolvedValue({}),
    getJobsByOrg: jest.fn().mockResolvedValue([])
  },
  AgentStore: {
    registerAgent: jest.fn().mockResolvedValue({}),
    getAgent: jest.fn().mockResolvedValue(null),
    getActiveAgents: jest.fn().mockResolvedValue([]),
    updateAgentStatus: jest.fn().mockResolvedValue({}),
    updateAgentHeartbeat: jest.fn().mockResolvedValue(true)
  }
}));

// Mock the job processor
jest.mock('../src/server/services/jobProcessor', () => ({
  startJobProcessor: jest.fn(),
  stopJobProcessor: jest.fn(),
  getJobProcessor: jest.fn().mockReturnValue({
    isRunning: true,
    getJobGroups: jest.fn().mockReturnValue({})
  })
}));

const healthRoutes = require('../src/server/routes/health');
const jobRoutes = require('../src/server/routes/jobs');

describe('API Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/health', healthRoutes);
    app.use('/api/jobs', jobRoutes);
  });

  describe('Health Endpoints', () => {
    test('GET /api/health should return service status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'QualGent Job Orchestrator');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });

    test('GET /api/health/detailed should return detailed status', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('redis');
      expect(response.body).toHaveProperty('job_processor');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Job Endpoints', () => {
    test('POST /api/jobs should create a new job', async () => {
      const jobData = {
        org_id: 'test-org',
        app_version_id: 'v1.0.0',
        test_path: 'tests/example.spec.js',
        priority: 'medium',
        target: 'emulator'
      };

      const response = await request(app)
        .post('/api/jobs')
        .send(jobData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Job submitted successfully');
      expect(response.body).toHaveProperty('job');
      expect(response.body.job).toHaveProperty('org_id', 'test-org');
      expect(response.body.job).toHaveProperty('status', 'pending');
    });

    test('POST /api/jobs should validate required fields', async () => {
      const invalidJobData = {
        org_id: 'test-org'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/jobs')
        .send(invalidJobData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation error');
    });

    test('GET /api/jobs/queue/status should return queue information', async () => {
      const response = await request(app)
        .get('/api/jobs/queue/status')
        .expect(200);

      expect(response.body).toHaveProperty('queues');
      expect(response.body).toHaveProperty('job_groups');
      expect(response.body.queues).toHaveProperty('high');
      expect(response.body.queues).toHaveProperty('medium');
      expect(response.body.queues).toHaveProperty('low');
    });
  });
});
