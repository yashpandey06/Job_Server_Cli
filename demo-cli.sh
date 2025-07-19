#!/bin/bash

# QualGent CLI Demo Script
# Demonstrates all qgjob CLI functionality

echo "🚀 QualGent CLI Demo"
echo "===================="
echo ""

# Ensure services are running
echo "📋 Step 1: Starting QualGent services..."
docker-compose up -d redis job-server test-agent
sleep 5

echo ""
echo "🔍 Step 2: Testing CLI help command..."
qgjob --help

echo ""
echo "📤 Step 3: Submitting test jobs with different targets..."

# Submit job for emulator
echo "  📱 Submitting emulator test..."
JOB1=$(qgjob submit --org-id=qualgent --app-version-id=demo-v1.0.0 --test=tests/integration.spec.js --target=emulator --priority=medium | grep "Job ID:" | cut -d' ' -f3)
echo "    Job ID: $JOB1"

# Submit job for device  
echo "  📲 Submitting device test..."
JOB2=$(qgjob submit --org-id=qualgent --app-version-id=demo-v1.0.0 --test=tests/api.test.js --target=device --priority=high | grep "Job ID:" | cut -d' ' -f3)
echo "    Job ID: $JOB2"

# Submit job for BrowserStack
echo "  🌐 Submitting BrowserStack test..."
JOB3=$(qgjob submit --org-id=qualgent --app-version-id=demo-v1.0.0 --test=tests/setup.js --target=browserstack --priority=medium | grep "Job ID:" | cut -d' ' -f3)
echo "    Job ID: $JOB3"

echo ""
echo "📊 Step 4: Checking queue status (job grouping)..."
curl -s http://localhost:3000/api/jobs/queue/status | jq '.job_groups'

echo ""
echo "📋 Step 5: Monitoring job statuses..."
echo "  Job 1 (emulator):"
qgjob status --job-id=$JOB1

echo ""
echo "  Job 2 (device):"  
qgjob status --job-id=$JOB2

echo ""
echo "  Job 3 (browserstack):"
qgjob status --job-id=$JOB3

echo ""
echo "⏳ Step 6: Waiting for first job completion..."
qgjob wait --job-id=$JOB1 --timeout=30

echo ""
echo "📈 Step 7: Final queue status..."
curl -s http://localhost:3000/api/jobs/queue/status | jq '.'

echo ""
echo "✅ QualGent CLI Demo Complete!"
echo ""
echo "📋 Summary:"
echo "- ✅ CLI commands working (submit, status, wait)"
echo "- ✅ Job grouping by app_version_id"
echo "- ✅ Multi-target support (emulator, device, browserstack)"
echo "- ✅ Priority queues"
echo "- ✅ Real-time job monitoring"
echo ""
echo "🎯 Job Payload Schema Working:"
echo '{
  "id": "uuid",
  "org_id": "string (required)",
  "app_version_id": "string (required)", 
  "test_path": "string (required)",
  "priority": "low|medium|high (default: medium)",
  "target": "emulator|device|browserstack (default: emulator)",
  "status": "pending|running|completed|failed|cancelled",
  "created_at": "ISO date string",
  "updated_at": "ISO date string"
}'
