# Local Device Testing Guide

## Prerequisites

1. **Install Appium:**
   ```bash
   npm install -g appium
   appium driver install uiautomator2
   ```

2. **Android SDK Setup:**
   - Install Android SDK
   - Set ANDROID_HOME environment variable
   - Add platform-tools to PATH

3. **Device Setup:**
   - Enable USB Debugging on Android device
   - Connect device via USB
   - Run `adb devices` to verify connection

## Running Tests

### Option 1: Using npm script
```bash
npm run test:local-device
```

### Option 2: Using mocha directly
```bash
mocha tests/mobile-app-wikipedia-local.spec.js --timeout 120000
```

### Option 3: Using qgjob CLI
```bash
qgjob submit --org-id "test-org" --app-version-id "wiki-v1.0" --test "tests/mobile-app-wikipedia-local.spec.js" --target "device" --priority "medium"
```

## Setup Script

Run the setup script to check your environment:
```bash
chmod +x setup-local-device.sh
./setup-local-device.sh
```

## Test Flow

1. **Local Test** (`tests/mobile-app-wikipedia-local.spec.js`) - Runs on connected device via local Appium
2. **BrowserStack Test** (`tests/mobile-app-wikipedia.spec.js`) - Runs on BrowserStack cloud devices

Both tests perform the same Wikipedia app automation but use different execution environments.
