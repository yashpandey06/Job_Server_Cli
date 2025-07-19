#!/bin/bash

# Local GitHub Actions Simulation Test Script
# This script simulates the GitHub Actions workflow locally to validate everything works

set -e

echo "🧪 QualGent GitHub Actions Local Test Simulation"
echo "================================================"

# Environment setup
export NODE_ENV=test
export ORG_ID=qualgent
export APP_VERSION_ID=local-test-$(date +%s)
export REDIS_URL=redis://localhost:6379
export REDIS_HOST=localhost
export REDIS_PORT=6379
export QGJOB_API_URL=http://localhost:3000/api

echo "📋 Environment Variables:"
echo "  ORG_ID: $ORG_ID"
echo "  APP_VERSION_ID: $APP_VERSION_ID"
echo "  NODE_ENV: $NODE_ENV"
echo ""

# Check prerequisites
echo "✅ Checking prerequisites..."

if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis not found. Please install Redis first."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ jq not found. Please install jq first."
    exit 1
fi

# Start Redis if not running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "🚀 Starting Redis server..."
    redis-server --daemonize yes --port 6379
    sleep 2
fi

echo "✅ Prerequisites check passed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Install qgjob CLI globally
echo "🔧 Installing qgjob CLI globally..."
npm link

# Verify qgjob is available
echo "🧪 Testing qgjob CLI..."
qgjob --version

# Create .env file
echo "📄 Creating .env file..."
cat > .env << EOF
PORT=3000
NODE_ENV=test
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
QGJOB_API_URL=http://localhost:3000/api
MAX_CONCURRENT_JOBS=5
JOB_TIMEOUT=300000
EOF

# Start QualGent job server
echo "🚀 Starting QualGent job server..."
npm start &
SERVER_PID=$!
echo $SERVER_PID > server.pid

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
  if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Server is ready"
    break
  fi
  echo "  Waiting for server... ($i/30)"
  sleep 2
done

# Verify server health
echo "🏥 Checking server health..."
echo "=== Server Health ==="
curl -s http://localhost:3000/api/health | jq '.'
echo ""

# Register test agents (simulating GitHub Actions)
echo "🤖 Registering test agents..."

# Register emulator agent
echo "  Registering emulator agent..."
EMULATOR_AGENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "local-emulator-agent",
    "capabilities": {
      "emulator": true,
      "device": false,
      "browserstack": false
    },
    "metadata": {
      "type": "local-test",
      "location": "local-machine"
    }
  }')
echo "  Emulator agent: $EMULATOR_AGENT_RESPONSE"
EMULATOR_AGENT_ID=$(echo "$EMULATOR_AGENT_RESPONSE" | jq -r '.agent.id // empty')

# Register device agent
echo "  Registering device agent..."
DEVICE_AGENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "local-device-agent",
    "capabilities": {
      "emulator": false,
      "device": true,
      "browserstack": false
    },
    "metadata": {
      "type": "local-test",
      "location": "local-machine"
    }
  }')
echo "  Device agent: $DEVICE_AGENT_RESPONSE"
DEVICE_AGENT_ID=$(echo "$DEVICE_AGENT_RESPONSE" | jq -r '.agent.id // empty')

# Register BrowserStack agent (if credentials available)
if [[ -n "$BROWSERSTACK_USERNAME" && -n "$BROWSERSTACK_ACCESS_KEY" ]]; then
  echo "  Registering BrowserStack agent..."
  BROWSERSTACK_AGENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/agents \
    -H "Content-Type: application/json" \
    -d '{
      "name": "local-browserstack-agent",
      "capabilities": {
        "emulator": true,
        "device": true,
        "browserstack": true
      },
      "metadata": {
        "type": "local-test",
        "location": "browserstack-cloud"
      }
    }')
  echo "  BrowserStack agent: $BROWSERSTACK_AGENT_RESPONSE"
  BROWSERSTACK_AGENT_ID=$(echo "$BROWSERSTACK_AGENT_RESPONSE" | jq -r '.agent.id // empty')
else
  echo "  BrowserStack credentials not available, skipping BrowserStack agent"
fi

# Verify agents are registered
echo "🔍 Verifying registered agents..."
curl -s http://localhost:3000/api/agents | jq '.agents[] | {id: .id, name: .name, capabilities: .capabilities, status: .status}'
echo ""

# Start agent heartbeat process
echo "💓 Starting agent heartbeat process..."
send_heartbeats() {
  while true; do
    # Get all agent IDs
    AGENT_IDS=$(curl -s http://localhost:3000/api/agents | jq -r '.agents[].id')
    
    for agent_id in $AGENT_IDS; do
      # Send heartbeat for each agent
      curl -s -X PUT "http://localhost:3000/api/agents/$agent_id/heartbeat" > /dev/null 2>&1 || true
    done
    
    sleep 10
  done
}

send_heartbeats &
HEARTBEAT_PID=$!
echo "  Agent heartbeat process started with PID: $HEARTBEAT_PID"

# Submit test jobs
echo "📝 Submitting test jobs using qgjob CLI..."

# Wait for agents to be ready
sleep 3

# Test 1: Integration test (emulator)
echo "  Submitting integration test..."
JOB1=$(qgjob submit \
  --org-id=$ORG_ID \
  --app-version-id=$APP_VERSION_ID-integration \
  --test=tests/integration.spec.js \
  --priority=medium \
  --target=emulator | grep "Job ID:" | cut -d' ' -f3)
echo "  Integration test job: $JOB1"

# Test 2: BrowserStack Wikipedia test (if credentials available)
if [[ -n "$BROWSERSTACK_USERNAME" && -n "$BROWSERSTACK_ACCESS_KEY" ]]; then
  echo "  Submitting BrowserStack Wikipedia test..."
  JOB2=$(qgjob submit \
    --org-id="test-org" \
    --app-version-id="wiki-v1.0" \
    --test="tests/mobile-app-wikipedia.spec.js" \
    --target="browserstack" \
    --priority="high" | grep "Job ID:" | cut -d' ' -f3)
  echo "  BrowserStack Wikipedia test job: $JOB2"
else
  echo "  BrowserStack credentials not available, skipping BrowserStack test"
  JOB2=""
fi

# Test 3: Device test
echo "  Submitting device test..."
JOB3=$(qgjob submit \
  --org-id=$ORG_ID \
  --app-version-id=$APP_VERSION_ID-device \
  --test=tests/integration.spec.js \
  --priority=low \
  --target=device | grep "Job ID:" | cut -d' ' -f3)
echo "  Device test job: $JOB3"

echo ""
echo "=== Submitted Jobs ==="
echo "Job 1 (Integration/Emulator): $JOB1"
if [[ -n "$JOB2" ]]; then
  echo "Job 2 (Wikipedia/BrowserStack): $JOB2"
fi
echo "Job 3 (Integration/Device): $JOB3"
echo ""

# Wait for job completion
echo "⏳ Waiting for jobs to complete..."

# Function to check job status
check_job() {
  local job_id=$1
  local job_name=$2
  local timeout=180
  local count=0
  
  if [[ -z "$job_id" ]]; then
    echo "Skipping $job_name (job ID is empty)"
    return 0
  fi
  
  echo "Checking $job_name (ID: $job_id)..."
  
  while [ $count -lt $timeout ]; do
    status=$(qgjob status --job-id=$job_id | grep "Status:" | cut -d' ' -f2)
    echo "[$job_name] Status: $status (${count}s elapsed)"
    
    case $status in
      "completed")
        echo "✅ $job_name completed successfully"
        return 0
        ;;
      "failed")
        echo "❌ $job_name failed"
        echo "=== $job_name Final Status ==="
        qgjob status --job-id=$job_id
        return 1
        ;;
      "running"|"pending"|"retrying")
        sleep 5
        count=$((count + 5))
        ;;
      *)
        echo "Unknown status for $job_name: $status"
        sleep 5
        count=$((count + 5))
        ;;
    esac
  done
  
  echo "⏰ $job_name timed out after ${timeout}s"
  echo "=== $job_name Final Status ==="
  qgjob status --job-id=$job_id
  return 1
}

# Check each job
job_failures=0

check_job "$JOB1" "Integration Emulator Test" || job_failures=$((job_failures + 1))
check_job "$JOB2" "BrowserStack Wikipedia Test" || job_failures=$((job_failures + 1))
check_job "$JOB3" "Integration Device Test" || job_failures=$((job_failures + 1))

# Final status summary
echo ""
echo "=== Final Job Status Summary ==="
if [[ -n "$JOB1" ]]; then
  echo "Integration Emulator Test:"
  qgjob status --job-id=$JOB1 | head -10
  echo ""
fi

if [[ -n "$JOB2" ]]; then
  echo "BrowserStack Wikipedia Test:"
  qgjob status --job-id=$JOB2 | head -10
  echo ""
fi

if [[ -n "$JOB3" ]]; then
  echo "Integration Device Test:"
  qgjob status --job-id=$JOB3 | head -10
  echo ""
fi

# Cleanup
echo "🧹 Cleaning up..."

# Stop heartbeat process
if [[ -n "$HEARTBEAT_PID" ]]; then
  echo "  Stopping agent heartbeat process..."
  kill $HEARTBEAT_PID 2>/dev/null || true
fi

# Stop job server
if [ -f server.pid ]; then
  echo "  Stopping job server..."
  kill $(cat server.pid) 2>/dev/null || true
  rm -f server.pid
fi

# Stop any remaining node processes
pkill -f "node src/server/index.js" 2>/dev/null || true

echo "  Cleanup completed"

# Final result
if [ $job_failures -gt 0 ]; then
  echo ""
  echo "❌ Test failed: $job_failures job(s) failed"
  exit 1
else
  echo ""
  echo "✅ All tests passed successfully!"
  echo "🎉 GitHub Actions workflow should work correctly!"
fi
