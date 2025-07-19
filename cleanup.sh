#!/bin/bash

# QualGent Project Cleanup Script
# Removes unused files and keeps only essential ones

echo "🧹 QualGent Project Cleanup"
echo "=========================="
echo ""

cd /Users/ishaan743/Documents/qualgent

echo "📋 Files currently in use:"
echo "✅ Core QualGent files:"
echo "   - src/ (CLI and server)"
echo "   - scripts/test-agent.js"
echo "   - docker-compose.yml, Dockerfile.*"
echo "   - package.json, package-lock.json"
echo "   - README.md"
echo ""
echo "✅ Mobile app testing:"
echo "   - node-appium-app-browserstack-master/android/ (APK files and tests)"
echo "   - tests/mobile-app-demo.spec.js"
echo ""
echo "✅ Configuration:"
echo "   - browserstack.yml"
echo "   - playwright.config.js"
echo "   - .github/workflows/test.yml"
echo ""

echo "🗑️  Removing unused files and folders..."

# Remove unused Playwright web examples
if [ -d "node-js-playwright-browserstack" ]; then
    echo "   Removing node-js-playwright-browserstack (unused web examples)"
    rm -rf node-js-playwright-browserstack
fi

# Remove unused demo files
if [ -f "demo-wikipedia.sh" ]; then
    echo "   Removing demo-wikipedia.sh (old demo)"
    rm -f demo-wikipedia.sh
fi

if [ -f "demo-mobile-wikipedia.sh" ]; then
    echo "   Removing demo-mobile-wikipedia.sh (duplicate)"
    rm -f demo-mobile-wikipedia.sh
fi

if [ -f "generate-browserstack-build.sh" ]; then
    echo "   Removing generate-browserstack-build.sh (unused)"
    rm -f generate-browserstack-build.sh
fi

if [ -f "test-localsample-app.sh" ]; then
    echo "   Removing test-localsample-app.sh (unused)"
    rm -f test-localsample-app.sh
fi

# Remove unused test files
if [ -f "tests/wikipedia-microsoft.spec.js" ]; then
    echo "   Removing tests/wikipedia-microsoft.spec.js (old web test)"
    rm -f tests/wikipedia-microsoft.spec.js
fi

if [ -f "tests/localsample-app.spec.js" ]; then
    echo "   Removing tests/localsample-app.spec.js (old test)"
    rm -f tests/localsample-app.spec.js
fi

# Remove unused docs
if [ -f "COMPLETION_SUMMARY.md" ]; then
    echo "   Removing COMPLETION_SUMMARY.md (temporary)"
    rm -f COMPLETION_SUMMARY.md
fi

if [ -d "examples" ]; then
    echo "   Removing examples/ (unused)"
    rm -rf examples
fi

# Remove unused iOS files (keeping only Android for now)
if [ -d "node-appium-app-browserstack-master/ios" ]; then
    echo "   Removing iOS files (keeping only Android)"
    rm -rf node-appium-app-browserstack-master/ios
fi

# Remove test results and logs
if [ -d "test-results" ]; then
    echo "   Removing test-results/ (temporary)"
    rm -rf test-results
fi

if [ -d "playwright-report" ]; then
    echo "   Removing playwright-report/ (temporary)"
    rm -rf playwright-report
fi

# Remove log files in mobile app folder
if [ -d "node-appium-app-browserstack-master/android/log" ]; then
    echo "   Removing mobile app logs"
    rm -rf node-appium-app-browserstack-master/android/log
fi

if [ -f "node-appium-app-browserstack-master/android/browserstack.err" ]; then
    rm -f node-appium-app-browserstack-master/android/browserstack.err
fi

if [ -f "node-appium-app-browserstack-master/android/local.log" ]; then
    rm -f node-appium-app-browserstack-master/android/local.log
fi

# Remove .DS_Store files
find . -name ".DS_Store" -delete 2>/dev/null

echo ""
echo "✅ Cleanup completed!"
echo ""
echo "📁 Essential files remaining:"
echo "   Core: $(find src scripts -name "*.js" | wc -l | xargs) JavaScript files"
echo "   Config: $(ls *.yml *.json Dockerfile* docker-compose.yml 2>/dev/null | wc -l | xargs) configuration files"
echo "   Mobile: $(ls node-appium-app-browserstack-master/android/*.apk 2>/dev/null | wc -l | xargs) APK files"
echo "   Tests: $(find tests -name "*.js" | wc -l | xargs) test files"
echo ""
echo "🚀 Project is now clean and optimized!"
