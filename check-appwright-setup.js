#!/usr/bin/env node

/**
 * AppWright Configuration Validator
 * Checks if AppWright configuration is properly set up for CLI usage
 */

const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

function checkAppWrightConfig() {
  log(colors.blue, '🔍', 'Checking AppWright configuration...');
  
  const configPath = path.join(process.cwd(), 'appwright.config.ts');
  
  if (!fs.existsSync(configPath)) {
    log(colors.red, '❌', 'appwright.config.ts not found!');
    return false;
  }
  
  try {
    const config = fs.readFileSync(configPath, 'utf8');
    
    // Check for required projects
    const requiredProjects = [
      'android-browserstack',
      'android-emulator',
      'ios-browserstack', 
      'ios-emulator'
    ];
    
    let foundProjects = [];
    
    requiredProjects.forEach(project => {
      if (config.includes(`name: "${project}"`)) {
        foundProjects.push(project);
        log(colors.green, '✅', `Found project: ${project}`);
      } else {
        log(colors.yellow, '⚠️ ', `Project not found: ${project}`);
      }
    });
    
    // Check BrowserStack configuration
    if (config.includes('provider: "browserstack"')) {
      log(colors.green, '✅', 'BrowserStack provider configured');
    } else {
      log(colors.red, '❌', 'BrowserStack provider not found!');
    }
    
    // Check build paths
    if (config.includes('buildPath:')) {
      log(colors.green, '✅', 'Build paths configured');
    } else {
      log(colors.yellow, '⚠️ ', 'Build paths not found');
    }
    
    return foundProjects.length > 0;
    
  } catch (error) {
    log(colors.red, '❌', `Error reading config: ${error.message}`);
    return false;
  }
}

function checkBrowserStackCredentials() {
  log(colors.blue, '🔍', 'Checking BrowserStack credentials...');
  
  const username = process.env.BROWSERSTACK_USERNAME;
  const accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
  
  if (username && accessKey) {
    log(colors.green, '✅', `BrowserStack username: ${username.substring(0, 8)}...`);
    log(colors.green, '✅', `BrowserStack access key: ${accessKey.substring(0, 8)}...`);
    return true;
  } else {
    log(colors.yellow, '⚠️ ', 'BrowserStack credentials not found in environment variables');
    log(colors.blue, 'ℹ️ ', 'Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables');
    return false;
  }
}

function checkBuildFiles() {
  log(colors.blue, '🔍', 'Checking build files...');
  
  const buildFiles = [
    'builds/wikipedia.apk',
    'builds/Wikipedia.app'
  ];
  
  let foundFiles = 0;
  
  buildFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      log(colors.green, '✅', `Found build file: ${filePath}`);
      foundFiles++;
    } else {
      log(colors.yellow, '⚠️ ', `Build file not found: ${filePath}`);
    }
  });
  
  return foundFiles > 0;
}

function checkTestFiles() {
  log(colors.blue, '🔍', 'Checking AppWright test files...');
  
  const testFiles = [
    'tests/appwright/wikipedia-appwright.spec.js'
  ];
  
  let foundTests = 0;
  
  testFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      log(colors.green, '✅', `Found test file: ${filePath}`);
      
      // Check if it's a proper AppWright test
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('from "appwright"') || content.includes("from 'appwright'")) {
        log(colors.green, '✅', `Valid AppWright test: ${filePath}`);
        foundTests++;
      } else {
        log(colors.yellow, '⚠️ ', `Not an AppWright test: ${filePath}`);
      }
    } else {
      log(colors.yellow, '⚠️ ', `Test file not found: ${filePath}`);
    }
  });
  
  return foundTests > 0;
}

function checkAppWrightInstallation() {
  log(colors.blue, '🔍', 'Checking AppWright installation...');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.dependencies && packageJson.dependencies.appwright) {
      log(colors.green, '✅', `AppWright version: ${packageJson.dependencies.appwright}`);
      return true;
    } else if (packageJson.devDependencies && packageJson.devDependencies.appwright) {
      log(colors.green, '✅', `AppWright version (dev): ${packageJson.devDependencies.appwright}`);
      return true;
    } else {
      log(colors.red, '❌', 'AppWright not found in package.json dependencies');
      return false;
    }
  } else {
    log(colors.red, '❌', 'package.json not found');
    return false;
  }
}

function main() {
  console.log(`${colors.blue}🧪 AppWright Configuration Validator${colors.reset}`);
  console.log('=====================================\n');
  
  let allGood = true;
  
  allGood &= checkAppWrightInstallation();
  console.log();
  
  allGood &= checkAppWrightConfig();
  console.log();
  
  allGood &= checkBrowserStackCredentials();
  console.log();
  
  allGood &= checkBuildFiles();
  console.log();
  
  allGood &= checkTestFiles();
  console.log();
  
  if (allGood) {
    log(colors.green, '🎉', 'All checks passed! Your AppWright setup looks good.');
    console.log('\n' + colors.blue + '💡 You can now run tests using:' + colors.reset);
    console.log('   qgjob test:android-browserstack --org-id "qualgent" --app-version-id "v1.0" --test "tests/appwright/wikipedia-appwright.spec.js" --wait');
  } else {
    log(colors.yellow, '⚠️ ', 'Some checks failed. Please review the issues above.');
    console.log('\n' + colors.blue + '💡 Common solutions:' + colors.reset);
    console.log('   - npm install appwright');
    console.log('   - Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY env vars');
    console.log('   - Ensure build files exist in builds/ directory');
    console.log('   - Check appwright.config.ts configuration');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAppWrightConfig,
  checkBrowserStackCredentials,
  checkBuildFiles,
  checkTestFiles,
  checkAppWrightInstallation
};
