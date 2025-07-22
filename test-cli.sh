#!/bin/bash

# QualGent CLI Test Script for AppWright
# This script helps test the CLI with different AppWright configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 QualGent CLI - AppWright Testing Script${NC}"
echo "============================================="

# Check if server is running
check_server() {
    echo -e "\n${YELLOW}📡 Checking if QualGent server is running...${NC}"
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is running!${NC}"
        return 0
    else
        echo -e "${RED}❌ Server is not running. Please start with: npm start${NC}"
        return 1
    fi
}

# Test AppWright on Android BrowserStack
test_android_browserstack() {
    echo -e "\n${BLUE}📱 Testing AppWright on Android BrowserStack...${NC}"
    
    node src/cli/index.js submit \
        --org-id "qualgent" \
        --app-version-id "wikipedia-v1.0" \
        --test "tests/appwright/wikipedia-appwright.spec.js" \
        --target "browserstack" \
        --platform "android" \
        --appwright-project "android-browserstack" \
        --priority "medium" \
        --wait \
        --timeout 600
}

# Test convenience command
test_convenience_command() {
    echo -e "\n${BLUE}🚀 Testing convenience command for Android BrowserStack...${NC}"
    
    node src/cli/index.js test:android-browserstack \
        --org-id "qualgent" \
        --app-version-id "wikipedia-v1.0" \
        --test "tests/appwright/wikipedia-appwright.spec.js" \
        --wait \
        --timeout 600
}

# Test Android Emulator
test_android_emulator() {
    echo -e "\n${BLUE}🔧 Testing AppWright on Android Emulator...${NC}"
    
    node src/cli/index.js test:android-emulator \
        --org-id "qualgent" \
        --app-version-id "wikipedia-v1.0" \
        --test "tests/appwright/wikipedia-appwright.spec.js" \
        --wait \
        --timeout 300
}

# Test iOS BrowserStack
test_ios_browserstack() {
    echo -e "\n${BLUE}📱 Testing AppWright on iOS BrowserStack...${NC}"
    
    node src/cli/index.js test:ios-browserstack \
        --org-id "qualgent" \
        --app-version-id "wikipedia-v1.0" \
        --test "tests/appwright/wikipedia-appwright.spec.js" \
        --wait \
        --timeout 600
}

# Show CLI help
show_help() {
    echo -e "\n${YELLOW}📖 Available CLI commands:${NC}"
    node src/cli/index.js --help
    
    echo -e "\n${YELLOW}📖 Submit command options:${NC}"
    node src/cli/index.js submit --help
    
    echo -e "\n${YELLOW}📖 Convenience commands:${NC}"
    echo "  test:android-browserstack  - Run on Android BrowserStack"
    echo "  test:ios-browserstack      - Run on iOS BrowserStack" 
    echo "  test:android-emulator      - Run on Android Emulator"
}

# Main menu
main_menu() {
    echo -e "\n${YELLOW}📋 What would you like to test?${NC}"
    echo "1) Android BrowserStack (full command)"
    echo "2) Android BrowserStack (convenience command)"
    echo "3) Android Emulator"
    echo "4) iOS BrowserStack"
    echo "5) Show CLI help"
    echo "6) Check server status"
    echo "0) Exit"
    
    read -p "Enter your choice (0-6): " choice
    
    case $choice in
        1)
            test_android_browserstack
            ;;
        2)
            test_convenience_command
            ;;
        3)
            test_android_emulator
            ;;
        4)
            test_ios_browserstack
            ;;
        5)
            show_help
            ;;
        6)
            check_server
            ;;
        0)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid choice. Please try again.${NC}"
            ;;
    esac
}

# Start script
if check_server; then
    while true; do
        main_menu
        echo -e "\n${BLUE}Press Enter to continue...${NC}"
        read
    done
else
    echo -e "\n${YELLOW}💡 To start the server, run: npm start${NC}"
    echo -e "${YELLOW}💡 To register an agent, run: node src/cli/index.js register-agent --name test-agent --capabilities browserstack,emulator${NC}"
    exit 1
fi
