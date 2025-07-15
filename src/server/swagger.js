const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'QualGent Test Orchestrator API',
      version: '1.0.0',
      description: 'API for managing AppWright test jobs, agents, and monitoring',
      contact: {
        name: 'QualGent',
        email: 'support@qualgent.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server'
      },
      {
        url: 'https://your-production-url.com/api',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Job: {
          type: 'object',
          required: ['org_id', 'app_version_id', 'test_path'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique job identifier'
            },
            org_id: {
              type: 'string',
              description: 'Organization identifier'
            },
            app_version_id: {
              type: 'string',
              description: 'Application version identifier for grouping'
            },
            test_path: {
              type: 'string',
              description: 'Path to the test file'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              default: 'medium',
              description: 'Job priority level'
            },
            target: {
              type: 'string',
              enum: ['emulator', 'device', 'browserstack'],
              default: 'emulator',
              description: 'Target execution environment'
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'retrying', 'cancelled'],
              description: 'Current job status'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Job creation timestamp'
            },
            started_at: {
              type: 'string',
              format: 'date-time',
              description: 'Job execution start timestamp'
            },
            completed_at: {
              type: 'string',
              format: 'date-time',
              description: 'Job completion timestamp'
            },
            retry_count: {
              type: 'integer',
              minimum: 0,
              description: 'Number of retry attempts'
            },
            result: {
              type: 'object',
              description: 'Test execution results'
            },
            error: {
              type: 'string',
              description: 'Error message if job failed'
            }
          }
        },
        Agent: {
          type: 'object',
          required: ['name', 'capabilities'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique agent identifier'
            },
            name: {
              type: 'string',
              description: 'Agent name'
            },
            status: {
              type: 'string',
              enum: ['idle', 'busy', 'maintenance', 'offline'],
              description: 'Current agent status'
            },
            capabilities: {
              type: 'object',
              properties: {
                emulator: {
                  type: 'boolean',
                  description: 'Can run emulator tests'
                },
                device: {
                  type: 'boolean',
                  description: 'Can run device tests'
                },
                browserstack: {
                  type: 'boolean',
                  description: 'Can run BrowserStack tests'
                }
              }
            },
            current_job: {
              $ref: '#/components/schemas/Job',
              description: 'Currently executing job'
            },
            last_seen: {
              type: 'string',
              format: 'date-time',
              description: 'Last heartbeat timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        },
        Health: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy'],
              description: 'Overall system health'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            service: {
              type: 'string',
              description: 'Service name'
            },
            version: {
              type: 'string',
              description: 'Service version'
            },
            redis: {
              type: 'string',
              description: 'Redis connection status'
            },
            job_processor: {
              type: 'string',
              description: 'Job processor status'
            }
          }
        }
      }
    }
  },
  apis: ['./src/server/routes/*.js'], // Path to the API docs
};

const specs = swaggerJSDoc(options);

module.exports = specs;
