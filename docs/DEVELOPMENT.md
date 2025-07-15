# QualGent Test Orchestrator - Development Guide

## Architecture Overview

### Job Processing Flow

```
1. Job Submission (CLI/API) → 2. Queue by Priority → 3. Group by app_version_id
                                       ↓
6. Update Status ← 5. Execute Tests ← 4. Assign to Agent
```

### Component Responsibilities

#### CLI Tool (`src/cli/index.js`)
- Command-line interface for job submission
- Job status checking and monitoring
- Communication with backend API

#### Backend Service (`src/server/`)
- REST API for job management
- Agent registration and heartbeat
- Health monitoring endpoints

#### Job Processor (`src/server/services/jobProcessor.js`)
- Intelligent job scheduling
- App version grouping logic
- Agent assignment based on capabilities

#### Redis Service (`src/server/services/redis.js`)
- Queue management (priority-based)
- Job data storage with TTL
- Agent registration and heartbeat tracking

### Grouping Algorithm

Jobs are grouped by `app_version_id` to minimize app installation overhead:

1. **New Job Arrives** → Check if agent already has this app version
2. **Agent Available** → Create new group or add to existing group
3. **Sequential Execution** → Process jobs in group one by one
4. **Group Cleanup** → Remove completed groups from memory

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `REDIS_URL` | redis://localhost:6379 | Redis connection string |
| `LOG_LEVEL` | info | Logging level (error, warn, info, debug) |
| `NODE_ENV` | development | Runtime environment |

### Redis Keys

- `job:{id}` - Job data (TTL: 24h)
- `agent:{id}` - Agent data (TTL: 5min)
- `jobs:high` - High priority queue
- `jobs:medium` - Medium priority queue
- `jobs:low` - Low priority queue

## Adding New Features

### New CLI Command

1. Add command to `src/cli/index.js`
2. Define options and validation
3. Implement action function
4. Add tests

### New API Endpoint

1. Create route in appropriate file under `src/server/routes/`
2. Add validation schema (Joi)
3. Implement business logic
4. Add error handling
5. Update API documentation

### New Agent Capability

1. Extend agent schema in `src/server/routes/agents.js`
2. Update job assignment logic in `jobProcessor.js`
3. Add capability matching in `findSuitableAgent()`

## Testing Strategy

### Unit Tests
- Individual function testing
- Mock external dependencies
- Focus on business logic

### Integration Tests
- API endpoint testing
- Database interactions
- Service communication

### End-to-End Tests
- Full workflow testing
- CLI integration
- Docker environment testing

## Deployment

### Local Development
```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start server
npm run dev

# Register agent
node scripts/test-agent.js
```

### Production Deployment
```bash
# Using Docker Compose
docker-compose up -d

# Health check
curl http://localhost:3000/api/health
```

### Scaling Considerations

1. **Multiple Job Servers** - Use Redis for coordination
2. **Agent Scaling** - Deploy agents across multiple machines
3. **Database Scaling** - Consider PostgreSQL for persistence
4. **Load Balancing** - Use nginx or cloud load balancers

## Monitoring & Alerting

### Key Metrics to Monitor

- Queue depths (jobs waiting)
- Job completion rates
- Agent availability
- Processing times
- Error rates

### Health Checks

- `/api/health` - Basic service health
- `/api/health/detailed` - Comprehensive system status
- Redis connectivity
- Job processor status

## Troubleshooting

### Common Issues

1. **Jobs Stuck in Queue**
   - Check agent availability: `GET /api/agents`
   - Verify agent capabilities match job targets
   - Check Redis connectivity

2. **High Memory Usage**
   - Monitor job group cleanup
   - Check Redis memory usage
   - Review log retention policies

3. **Slow Job Processing**
   - Analyze job grouping efficiency
   - Check agent performance
   - Review queue priorities

### Debug Commands

```bash
# Check queue status
curl http://localhost:3000/api/jobs/queue/status | jq

# List active agents
curl http://localhost:3000/api/agents | jq

# Get job details
curl http://localhost:3000/api/jobs/{job-id} | jq

# Check Redis keys
redis-cli keys "*"

# Monitor logs
tail -f logs/combined.log
```

## Performance Optimization

### Job Processing
- Batch similar jobs together
- Use priority queues effectively
- Optimize agent selection algorithm

### API Performance
- Implement request caching
- Use connection pooling
- Add request rate limiting

### Redis Optimization
- Configure appropriate TTLs
- Use Redis pipelining for batch operations
- Monitor memory usage and eviction policies
