# QualGent Test Orchestrator

A comprehensive CLI tool and backend service for queueing, grouping, and deploying AppWright tests across local devices, emulators, and BrowserStack.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Tool      │    │  Backend API    │    │   Redis Queue   │
│   (qgjob)       │───▶│  (job-server)   │───▶│   & Storage     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        ▲
                              ▼                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Job Processor   │    │   Test Agents   │
                       │ (Scheduler)     │◀───│   (Workers)     │
                       └─────────────────┘    └─────────────────┘
```

### Key Components

1. **CLI Tool (`qgjob`)** - Submit and monitor test jobs
2. **Backend Service** - REST API for job orchestration
3. **Job Processor** - Intelligent job scheduling and grouping
4. **Redis** - Queue management and data storage
5. **Test Agents** - Execute tests on various targets
6. **GitHub Actions** - CI/CD integration

### Core Features

- ✅ **Job Grouping** - Groups jobs by `app_version_id` to minimize app installations
- ✅ **Priority Queues** - High, medium, low priority job processing
- ✅ **Multi-Target Support** - Emulator, device, and BrowserStack execution
- ✅ **Fault Tolerance** - Retry mechanisms and crash recovery
- ✅ **Horizontal Scalability** - Multiple agents and job processors
- ✅ **Real-time Monitoring** - Health checks and job status tracking

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- Redis (or use Docker Compose)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd qualgent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running with Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Check service health
curl http://localhost:3000/api/health

# Submit a test job
docker-compose exec job-server node src/cli/index.js submit \
  --org-id=qualgent \
  --app-version-id=v1.0.0 \
  --test=tests/onboarding.spec.js
```

### Running Locally

1. **Start Redis**
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:7-alpine
   
   # Or install locally (macOS)
   brew install redis
   redis-server
   ```

2. **Start the backend service**
   ```bash
   npm start
   # Server will run on http://localhost:3000
   ```

3. **Register a test agent (in another terminal)**
   ```bash
   node scripts/test-agent.js
   ```

## 📱 CLI Usage

### Submit a Job

```bash
# Basic job submission
qgjob submit --org-id=qualgent --app-version-id=xyz123 --test=tests/onboarding.spec.js

# With priority and target
qgjob submit \
  --org-id=qualgent \
  --app-version-id=xyz123 \
  --test=tests/login.spec.js \
  --priority=high \
  --target=device

# Submit and wait for completion
qgjob submit \
  --org-id=qualgent \
  --app-version-id=xyz123 \
  --test=tests/checkout.spec.js \
  --wait \
  --timeout=300
```

### Check Job Status

```bash
# Get job status
qgjob status --job-id=abc456

# Wait for job completion
qgjob wait --job-id=abc456 --timeout=300
```

### Job Payload Schema

```json
{
  "id": "uuid",
  "org_id": "string (required)",
  "app_version_id": "string (required)", 
  "test_path": "string (required)",
  "priority": "low|medium|high (default: medium)",
  "target": "emulator|device|browserstack (default: emulator)",
  "status": "pending|running|completed|failed|cancelled",
  "created_at": "ISO date string",
  "updated_at": "ISO date string"
}
```

## 🔄 Job Grouping & Scheduling

### How Grouping Works

1. **Same App Version** - Jobs with identical `app_version_id` are grouped together
2. **Target Matching** - Groups are formed per target type (emulator/device/browserstack)
3. **Agent Assignment** - Groups are assigned to agents with matching capabilities
4. **Sequential Execution** - Jobs in a group run sequentially to avoid reinstalls

### Example Grouping Scenario

```bash
# These jobs will be grouped together (same app_version_id)
qgjob submit --org-id=qualgent --app-version-id=v2.1.0 --test=tests/login.spec.js
qgjob submit --org-id=qualgent --app-version-id=v2.1.0 --test=tests/checkout.spec.js
qgjob submit --org-id=qualgent --app-version-id=v2.1.0 --test=tests/profile.spec.js

# This job will be in a separate group (different app_version_id)
qgjob submit --org-id=qualgent --app-version-id=v2.0.0 --test=tests/regression.spec.js
```

**Benefits:**
- App is installed once per version per agent
- Reduced execution time and resource usage
- Better agent utilization

## 🔧 API Reference

### Job Management

- `POST /api/jobs` - Submit a new job
- `GET /api/jobs/:id` - Get job status
- `GET /api/jobs` - List jobs (with filtering)
- `PUT /api/jobs/:id/status` - Update job status
- `DELETE /api/jobs/:id` - Cancel job
- `GET /api/jobs/queue/status` - Get queue status

### Agent Management

- `POST /api/agents` - Register agent
- `GET /api/agents` - List active agents
- `GET /api/agents/:id` - Get agent details
- `PUT /api/agents/:id/heartbeat` - Update heartbeat
- `PUT /api/agents/:id/status` - Update agent status
- `DELETE /api/agents/:id` - Unregister agent

### Health & Monitoring

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health information

## 🔄 GitHub Actions Integration

### Basic Workflow

```yaml
name: AppWright Test
on: [push]

jobs:
  run-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - run: npm ci
    - run: npm start &
    
    - name: Submit and wait for tests
      run: |
        qgjob submit --org-id=qualgent --app-version-id=${{ github.sha }} \
          --test=tests/onboarding.spec.js --wait --timeout=300
```

### Advanced Workflow Features

- **Parallel Job Submission** - Submit multiple tests simultaneously
- **Job Grouping** - Automatic grouping by app version (git SHA)
- **Failure Handling** - Build fails if any test fails
- **Status Reporting** - Detailed job status and results
- **Service Health** - Validates orchestrator health before testing

## 🐳 Docker Deployment

### Services

- **job-server** - Main orchestrator service (port 3000)
- **redis** - Job queue and storage (port 6379)  
- **test-agent** - Example worker agent

### Configuration

```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scaling agents
docker-compose up -d --scale test-agent=3

# View logs
docker-compose logs -f job-server
```

## 📊 Monitoring & Observability

### Health Endpoints

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed system information
curl http://localhost:3000/api/health/detailed

# Queue status and job groups
curl http://localhost:3000/api/jobs/queue/status

# Active agents
curl http://localhost:3000/api/agents
```

### Key Metrics

- **Queue Lengths** - Jobs waiting in each priority queue
- **Agent Status** - Active/idle/busy agent counts
- **Job Groups** - Current grouping efficiency
- **Processing Times** - Job execution durations
- **Success Rates** - Test pass/fail statistics

## 🔒 Production Considerations

### Security

- Add API authentication (JWT tokens)
- Implement rate limiting
- Use HTTPS in production
- Secure Redis with authentication
- Validate all inputs

### Scalability

- **Horizontal Scaling** - Deploy multiple job-server instances
- **Agent Scaling** - Add more test agents as needed
- **Database** - Consider PostgreSQL for larger deployments
- **Load Balancing** - Use nginx or cloud load balancers

### Reliability

- **Persistent Storage** - Configure Redis persistence
- **Backup Strategy** - Regular job data backups
- **Circuit Breakers** - Handle agent failures gracefully
- **Dead Letter Queues** - Handle permanently failed jobs

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Test with Docker
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### Test Coverage

- CLI command validation
- API endpoint testing
- Job processing logic
- Agent communication
- Error handling scenarios
- Docker integration

## 🏃‍♂️ Development

### Project Structure

```
src/
├── cli/           # CLI tool implementation
├── server/        # Backend service
│   ├── routes/    # API endpoints
│   └── services/  # Business logic
└── shared/        # Common utilities

tests/             # Example AppWright tests
scripts/           # Utility scripts
docs/             # Additional documentation
```

### Adding New Features

1. **New CLI Commands** - Extend `src/cli/index.js`
2. **API Endpoints** - Add routes in `src/server/routes/`
3. **Job Processing** - Modify `src/server/services/jobProcessor.js`
4. **Agent Types** - Extend agent capabilities

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Redis
REDIS_URL=redis://localhost:6379

# CLI
QGJOB_API_URL=http://localhost:3000/api
```

## 📝 Example: End-to-End Test Submission

```bash
# 1. Start services
docker-compose up -d

# 2. Submit grouped jobs (same app version)
qgjob submit --org-id=myorg --app-version-id=v1.2.3 --test=tests/onboarding.spec.js --priority=high
qgjob submit --org-id=myorg --app-version-id=v1.2.3 --test=tests/login.spec.js --priority=medium  
qgjob submit --org-id=myorg --app-version-id=v1.2.3 --test=tests/checkout.spec.js --priority=medium

# 3. Monitor execution
curl http://localhost:3000/api/jobs/queue/status | jq

# 4. Check results
qgjob status --job-id=<job-id>
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Built for QualGent Backend Coding Challenge** 🚀

## ✅ Bonus Features Implemented

### 🔄 Retry and Failure Handling
- **Automatic Retries**: Failed jobs are automatically retried up to 3 times with exponential backoff
- **Retry Tracking**: Jobs track retry count and last error for debugging
- **Smart Failure Handling**: Distinguishes between temporary failures (retryable) and permanent failures

### 🏆 Prioritization Within Organizations
- **Org-Specific Priority**: Organizations have priority levels (Premium > Enterprise > Standard)
- **Smart Queue Management**: Jobs are sorted by org priority first, then by job priority, then by creation time
- **Configurable Priority Mapping**: Easy to adjust org priorities in the job processor

### 📈 Horizontal Scalability
- **Multi-Agent Support**: Run multiple agents across different machines
- **Load Balancing**: Jobs distributed based on agent capabilities and availability
- **Monitoring Endpoints**: `/api/monitoring/metrics` and `/api/monitoring/scale-recommendations`
- **Redis-Based Coordination**: Stateless job servers can be scaled horizontally
- **Docker Compose Ready**: Easy deployment and scaling with containerization

### 📊 Additional Monitoring Features
- **Real-time Metrics**: System performance, queue depths, agent utilization
- **Scaling Recommendations**: Automatic suggestions for when to scale agents or job servers
- **Organization Statistics**: Per-org job success rates and performance metrics

With the backend server running (default: http://localhost:3000):

### 1. Submit a Test Job

```bash
node src/cli/index.js submit --org-id=qualgent --app-version-id=demo-v1 --test=examples/appwright-tests/onboarding.spec.js
```

### 2. Submit Multiple Jobs (Grouping Demo)

```bash
# All jobs with the same app_version_id will be grouped and run on the same agent
node src/cli/index.js submit --org-id=qualgent --app-version-id=demo-v1 --test=examples/appwright-tests/onboarding.spec.js --priority=high --target=emulator
node src/cli/index.js submit --org-id=qualgent --app-version-id=demo-v1 --test=examples/appwright-tests/login.spec.js --priority=medium --target=emulator
node src/cli/index.js submit --org-id=qualgent --app-version-id=demo-v1 --test=examples/appwright-tests/checkout.spec.js --priority=medium --target=emulator
```

### 3. Check Job Status

```bash
node src/cli/index.js status --job-id=<JOB_ID>
```

### 4. Wait for Job Completion (CI/CD style)

```bash
node src/cli/index.js wait --job-id=<JOB_ID> --timeout=120
```

### 5. Monitor Queue and Agents

```bash
curl http://localhost:3000/api/jobs/queue/status | jq
curl http://localhost:3000/api/agents | jq
```

### 6. Run the Full Demo

```bash
./demo.sh
```

---

- The CLI tool (`qgjob`) submits jobs to the backend and checks their status.
- Jobs with the same `app_version_id` are grouped for efficient execution.
- Agents (workers) process jobs and update their status.
- You can monitor everything via the REST API or CLI.
