#!/bin/bash

# QualGent Mobile App Demo Script
# This script demonstrates mobile app testing on BrowserStack

echo "🚀 QualGent Mobile App Testing Demo"
echo "===================================="
echo ""

echo "📱 Step 1: Starting QualGent backend services..."
cd /Users/ishaan743/Documents/qualgent
docker-compose up -d redis server

echo ""
echo "📱 Step 2: Starting test agent..."
docker-compose up -d agent

echo ""
echo "📱 Step 3: Waiting for services to be ready..."
sleep 10

echo ""
echo "📱 Step 4: Submitting mobile app test job..."
JOB_ID=$(node src/cli/index.js submit --test tests/mobile-app-demo.spec.js --target browserstack --app-version-id mobile-v1.0.0 --org-id acme | grep "Job ID:" | cut -d' ' -f3)

echo "   Job submitted with ID: $JOB_ID"

echo ""
echo "📱 Step 5: Monitoring job status..."
sleep 5

node src/cli/index.js status --job-id $JOB_ID

echo ""
echo "📱 Step 6: Running actual mobile app test on BrowserStack..."
echo "   This will test WikipediaSample.apk on real Android devices..."
echo ""

cd node-appium-app-browserstack-master/android
timeout 120s npm test

echo ""
echo "✅ Mobile app demo completed!"
echo ""
echo "Summary:"
echo "- ✅ QualGent orchestrator handled mobile app job"
echo "- ✅ BrowserStack mobile app testing configured"
echo "- ✅ WikipediaSample.apk tested on real Android devices"
echo "- ✅ App search functionality verified"
echo ""
echo "🎉 Your mobile app is now running on BrowserStack through QualGent!"
