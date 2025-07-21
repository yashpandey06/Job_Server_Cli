#!/bin/bash

# QualGent Local Device Setup Script
# This script helps set up your local Android device for AppWright testing

echo "🚀 QualGent Local Device Setup for AppWright Testing"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if adb is installed
echo -e "\n${BLUE}1. Checking ADB installation...${NC}"
if command -v adb &> /dev/null; then
    echo -e "${GREEN}✅ ADB is installed${NC}"
    adb version
else
    echo -e "${RED}❌ ADB is not installed${NC}"
    echo -e "${YELLOW}💡 Please install Android SDK and add platform-tools to PATH${NC}"
    exit 1
fi

# Check if Appium is installed
echo -e "\n${BLUE}2. Checking Appium installation...${NC}"
if command -v appium &> /dev/null; then
    echo -e "${GREEN}✅ Appium is installed${NC}"
    appium --version
else
    echo -e "${RED}❌ Appium is not installed${NC}"
    echo -e "${YELLOW}💡 Install Appium with: npm install -g appium${NC}"
    echo -e "${YELLOW}💡 Also install UiAutomator2 driver: appium driver install uiautomator2${NC}"
    exit 1
fi

# Check connected devices
echo -e "\n${BLUE}3. Checking connected Android devices...${NC}"
devices=$(adb devices | grep -v "List of devices" | grep -v "^$" | wc -l)
if [ $devices -gt 0 ]; then
    echo -e "${GREEN}✅ Found $devices connected device(s):${NC}"
    adb devices
    
    # Get device info for the first device
    device_id=$(adb devices | grep -v "List of devices" | grep -v "^$" | head -1 | cut -f1)
    if [ ! -z "$device_id" ]; then
        echo -e "\n${BLUE}Device Information:${NC}"
        echo "Device ID: $device_id"
        echo "Android Version: $(adb -s $device_id shell getprop ro.build.version.release)"
        echo "Device Model: $(adb -s $device_id shell getprop ro.product.model)"
        echo "Device Brand: $(adb -s $device_id shell getprop ro.product.brand)"
    fi
else
    echo -e "${RED}❌ No devices connected${NC}"
    echo -e "${YELLOW}💡 Please:${NC}"
    echo -e "${YELLOW}   - Connect your Android device via USB${NC}"
    echo -e "${YELLOW}   - Enable USB Debugging in Developer Options${NC}"
    echo -e "${YELLOW}   - Accept USB debugging permission on device${NC}"
    exit 1
fi

# Check if Wikipedia APK exists
echo -e "\n${BLUE}4. Checking Wikipedia APK...${NC}"
apk_path="./node-appium-app-browserstack-master/android/WikipediaSample.apk"
if [ -f "$apk_path" ]; then
    echo -e "${GREEN}✅ Wikipedia APK found: $apk_path${NC}"
    ls -lh "$apk_path"
else
    echo -e "${RED}❌ Wikipedia APK not found: $apk_path${NC}"
    echo -e "${YELLOW}💡 Make sure the BrowserStack sample app directory exists${NC}"
fi

# Check device screen status
echo -e "\n${BLUE}5. Checking device screen status...${NC}"
screen_state=$(adb shell dumpsys power | grep "Display Power" | head -1)
echo "Screen state: $screen_state"
if [[ $screen_state == *"ON"* ]]; then
    echo -e "${GREEN}✅ Device screen is ON${NC}"
else
    echo -e "${YELLOW}⚠️ Device screen might be OFF - please unlock your device${NC}"
fi

# Create environment file for device-specific settings
echo -e "\n${BLUE}6. Creating environment configuration...${NC}"
if [ ! -z "$device_id" ]; then
    android_version=$(adb -s $device_id shell getprop ro.build.version.release)
    device_model=$(adb -s $device_id shell getprop ro.product.model)
    
    cat > .env.local-device << EOF
# Local Device Configuration for QualGent AppWright Testing
DEVICE_UDID=$device_id
DEVICE_NAME=$device_model
ANDROID_VERSION=$android_version
APPIUM_SERVER=http://127.0.0.1:4723/wd/hub
APK_PATH=./node-appium-app-browserstack-master/android/WikipediaSample.apk
EOF
    echo -e "${GREEN}✅ Created .env.local-device configuration file${NC}"
fi

# Final instructions
echo -e "\n${GREEN}🎉 Setup Complete!${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. ${YELLOW}Start Appium server:${NC} appium"
echo -e "2. ${YELLOW}Run local device test:${NC} npm run test:local-device"
echo -e "   ${YELLOW}Or with mocha:${NC} mocha tests/mobile-app-wikipedia-local.spec.js --timeout 120000"
echo -e "3. ${YELLOW}Or use qgjob:${NC} qgjob submit --org-id \"test-org\" --app-version-id \"wiki-v1.0\" --test \"tests/mobile-app-wikipedia-local.spec.js\" --target \"device\" --priority \"medium\""

echo -e "\n${BLUE}Troubleshooting:${NC}"
echo -e "- Make sure your device screen is unlocked"
echo -e "- Close any running instances of the Wikipedia app"
echo -e "- Check Appium server logs if tests fail"
echo -e "- Verify USB debugging is enabled and authorized"

echo -e "\n${GREEN}Happy Testing! 🧪📱${NC}"
