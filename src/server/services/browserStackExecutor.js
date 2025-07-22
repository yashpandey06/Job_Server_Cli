/**
 * BrowserStack Test Executor
 * Executes real tests on BrowserStack using the browserstack-node-sdk
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

class BrowserStackExecutor {
  constructor() {
    this.browserstackConfig = this.loadBrowserStackConfig();
  }

  /**
   * Load BrowserStack configuration
   */
  loadBrowserStackConfig() {
    try {
      const configPath = path.join(process.cwd(), 'browserstack.yml');
      if (fs.existsSync(configPath)) {
        const yaml = require('js-yaml');
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
        return config;
      }
    } catch (error) {
      logger.error('Failed to load BrowserStack config:', error);
    }
    
    return {
      userName: process.env.BROWSERSTACK_USERNAME,
      accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
      projectName: 'QualGent Test Orchestrator',
      buildName: 'QualGent Mobile Tests'
    };
  }

  /**
   * Execute a test job on BrowserStack
   * @param {Object} job - The job to execute
   * @param {Object} agent - The agent executing the job
   * @returns {Promise<Object>} - Test execution result
   */
  async executeJob(job, agent) {
    logger.info(`🚀 Starting BrowserStack execution for job: ${job.id}`);
    logger.info(`📱 Test: ${job.test_path}`);
    logger.info(`🎯 Target: ${job.target}`);
    logger.info(`🏢 Org: ${job.org_id}`);
    logger.info(`📦 App Version: ${job.app_version_id}`);

    const startTime = Date.now();

    try {
      // Set up environment variables for BrowserStack
      const buildNumber = this.generateBuildNumber();
      const sessionName = `${job.org_id} - ${job.app_version_id} - ${path.basename(job.test_path)}`;
      
      const env = {
        ...process.env,
        BROWSERSTACK_USERNAME: this.browserstackConfig.userName,
        BROWSERSTACK_ACCESS_KEY: this.browserstackConfig.accessKey,
        BUILD_NUMBER: buildNumber,
        BROWSERSTACK_BUILD_NAME: `QualGent Mobile Build #${buildNumber}`,
        BROWSERSTACK_SESSION_NAME: sessionName,
        JOB_ID: job.id,
        ORG_ID: job.org_id,
        APP_VERSION_ID: job.app_version_id
      };

      // Determine the test command based on target
      let testCommand;
      let testArgs;
      let workingDir;

      // Check if this is an AppWright test
      const isAppWrightTest = await this.isAppWrightTest(job.test_path);
      
      if (job.target === 'browserstack') {
        if (isAppWrightTest) {
          // Run AppWright test on BrowserStack
          logger.info(`🧪 Executing AppWright test: ${job.test_path}`);
          return await this.executeAppWrightTest(job, agent, env, buildNumber, sessionName, startTime);
        } else {
          // Use the legacy BrowserStack setup from node-appium-app-browserstack-master
          workingDir = path.join(process.cwd(), 'node-appium-app-browserstack-master', 'android');
          testCommand = 'npm';
          testArgs = ['run', 'test'];
          
          logger.info(`📁 Working directory: ${workingDir}`);
          logger.info(`🔧 Using BrowserStack configuration from: ${path.join(workingDir, 'browserstack.yml')}`);
        }
        
      } else if (job.target === 'emulator') {
        if (isAppWrightTest) {
          // Run AppWright test on emulator
          logger.info(`🧪 Executing AppWright test on emulator: ${job.test_path}`);
          return await this.executeAppWrightTest(job, agent, env, buildNumber, sessionName, startTime);
        } else {
          // Run legacy test locally with emulator (simplified for demo)
          workingDir = process.cwd();
          testCommand = 'npm';
          testArgs = ['run', 'test:mobile', '--', '--grep', path.basename(job.test_path, '.spec.js')];
        }
      } else {
        throw new Error(`Unsupported target: ${job.target}`);
      }

      logger.info(`📋 Command: ${testCommand} ${testArgs.join(' ')}`);
      logger.info(`📍 Working Dir: ${workingDir}`);

      // Execute the test
      const result = await this.runTestCommand(testCommand, testArgs, env, workingDir);
      const duration = Date.now() - startTime;

      logger.info(`✅ Test execution completed in ${duration}ms`);

      return {
        status: result.exitCode === 0 ? 'passed' : 'failed',
        test_results: {
          total: result.testStats?.total || 1,
          passed: result.testStats?.passed || (result.exitCode === 0 ? 1 : 0),
          failed: result.testStats?.failed || (result.exitCode === 0 ? 0 : 1),
          duration: duration,
          output: result.output,
          exitCode: result.exitCode
        },
        browserstack_session: result.browserstackSession,
        build_info: {
          build_number: buildNumber,
          build_name: `QualGent Mobile Build #${buildNumber}`,
          session_name: sessionName,
          dashboard_url: `https://app-automate.browserstack.com/dashboard/v2/builds`
        },
        execution_details: {
          command: `${testCommand} ${testArgs.join(' ')}`,
          working_directory: workingDir,
          target: job.target,
          agent_id: agent.id,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString()
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Test execution failed: ${error.message}`);

      return {
        status: 'failed',
        error: error.message,
        test_results: {
          total: 1,
          passed: 0,
          failed: 1,
          duration: duration,
          output: error.output || error.message
        },
        execution_details: {
          target: job.target,
          agent_id: agent.id,
          started_at: new Date(startTime).toISOString(),
          failed_at: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Check if the test file is an AppWright test
   */
  async isAppWrightTest(testPath) {
    try {
      const fs = require('fs').promises;
      const content = await fs.readFile(testPath, 'utf8');
      
      // Check if the test file imports from "appwright"
      return content.includes('from "appwright"') || content.includes("from 'appwright'");
    } catch (error) {
      logger.warn(`Could not check test type for ${testPath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute AppWright test
   */
  async executeAppWrightTest(job, agent, env, buildNumber, sessionName, startTime) {
    logger.info(`🎯 Executing AppWright test: ${job.test_path}`);
    logger.info(`🚀 AppWright Project: ${job.appwright_project || 'default'}`);
    
    try {
      // For AppWright tests, we need to use the appwright.config.ts configuration
      const workingDir = process.cwd();
      const configPath = path.join(workingDir, 'appwright.config.ts');
      
      // Check if AppWright config exists
      const fs = require('fs');
      if (!fs.existsSync(configPath)) {
        throw new Error('AppWright config file not found. Please ensure appwright.config.ts exists.');
      }

      let testCommand, testArgs;
      let projectName = job.appwright_project;
      
      // Auto-detect project based on target if not specified
      if (!projectName) {
        if (job.target === 'browserstack') {
          projectName = 'android-browserstack'; // default to android
        } else if (job.target === 'emulator') {
          projectName = 'android-emulator'; // default to android
        }
      }
      
      if (job.target === 'browserstack') {
        // Run AppWright test on BrowserStack using the specified project
        testCommand = 'npx';
        testArgs = ['appwright', 'test'];
        
        if (projectName) {
          testArgs.push('--project');
          testArgs.push(projectName);
        }
        
        // For AppWright, we run all tests in the project since it handles test discovery
        // If specific test filtering is needed, use grep pattern
        if (job.test_path && job.test_path !== '*' && job.test_path.includes('.spec.js')) {
          // Extract test name pattern for filtering
          const testFileName = job.test_path.split('/').pop().replace('.spec.js', '');
          testArgs.push('--grep');
          testArgs.push(testFileName);
        }
        
        // Set BrowserStack specific environment variables
        env.BROWSERSTACK_USERNAME = env.BROWSERSTACK_USERNAME || process.env.BROWSERSTACK_USERNAME;
        env.BROWSERSTACK_ACCESS_KEY = env.BROWSERSTACK_ACCESS_KEY || process.env.BROWSERSTACK_ACCESS_KEY;
        env.BROWSERSTACK_BUILD = `AppWright Mobile Build #${buildNumber}`;
        env.BROWSERSTACK_SESSION = sessionName;
        
        logger.info(`🌐 Running AppWright test on BrowserStack`);
        logger.info(`🔧 Build: ${env.BROWSERSTACK_BUILD}`);
        logger.info(`🎯 Project: ${projectName}`);
        
      } else if (job.target === 'emulator') {
        // Run AppWright test on local emulator
        testCommand = 'npx';
        testArgs = ['appwright', 'test'];
        
        if (projectName) {
          testArgs.push('--project');
          testArgs.push(projectName);
        }
        
        // For AppWright, we run all tests in the project since it handles test discovery
        // If specific test filtering is needed, use grep pattern
        if (job.test_path && job.test_path !== '*' && job.test_path.includes('.spec.js')) {
          // Extract test name pattern for filtering
          const testFileName = job.test_path.split('/').pop().replace('.spec.js', '');
          testArgs.push('--grep');
          testArgs.push(testFileName);
        }
        
        logger.info(`📱 Running AppWright test on local emulator`);
        logger.info(`🎯 Project: ${projectName}`);
      }
      
      logger.info(`📋 Command: ${testCommand} ${testArgs.join(' ')}`);
      logger.info(`📍 Working Dir: ${workingDir}`);

      // Execute the AppWright test
      const result = await this.runAppWrightTestCommand(testCommand, testArgs, env, workingDir);
      const duration = Date.now() - startTime;

      logger.info(`✅ AppWright test execution completed in ${duration}ms`);

      return {
        status: result.exitCode === 0 ? 'passed' : 'failed',
        test_results: {
          total: result.testStats?.total || 1,
          passed: result.testStats?.passed || (result.exitCode === 0 ? 1 : 0),
          failed: result.testStats?.failed || (result.exitCode === 0 ? 0 : 1),
          duration: duration,
          output: result.output,
          exitCode: result.exitCode,
          framework: 'AppWright',
          project: projectName
        },
        browserstack_session: result.browserstackSession,
        build_info: {
          build_number: buildNumber,
          build_name: `AppWright Mobile Build #${buildNumber}`,
          session_name: sessionName,
          dashboard_url: job.target === 'browserstack' 
            ? `https://app-automate.browserstack.com/dashboard/v2/builds`
            : null
        },
        execution_details: {
          command: `${testCommand} ${testArgs.join(' ')}`,
          working_directory: workingDir,
          target: job.target,
          agent_id: agent.id,
          framework: 'AppWright',
          project: projectName,
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString()
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ AppWright test execution failed: ${error.message}`);

      return {
        status: 'failed',
        error: error.message,
        test_results: {
          total: 1,
          passed: 0,
          failed: 1,
          duration: duration,
          output: error.output || error.message,
          framework: 'AppWright',
          project: projectName || 'unknown'
        },
        execution_details: {
          target: job.target,
          agent_id: agent.id,
          framework: 'AppWright',
          project: projectName || 'unknown',
          started_at: new Date(startTime).toISOString(),
          failed_at: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  /**
   * Run AppWright test command and capture output
   */
  async runAppWrightTestCommand(command, args, env, workingDir = process.cwd()) {
    return new Promise((resolve, reject) => {
      logger.info(`🏃 Executing AppWright: ${command} ${args.join(' ')}`);
      logger.info(`📍 Working directory: ${workingDir}`);

      const child = spawn(command, args, {
        env,
        stdio: 'pipe',
        shell: true,
        cwd: workingDir
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        logger.info(`🧪 AppWright Output: ${output.trim()}`);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logger.warn(`⚠️  AppWright Warning: ${output.trim()}`);
      });

      child.on('close', (exitCode) => {
        logger.info(`🏁 AppWright process exited with code: ${exitCode}`);

        // Parse AppWright test statistics from output
        const testStats = this.parseAppWrightTestStats(stdout + stderr);

        // Extract BrowserStack session info if available
        const browserstackSession = this.extractBrowserStackSession(stdout + stderr);

        resolve({
          exitCode,
          output: stdout + stderr,
          testStats,
          browserstackSession
        });
      });

      child.on('error', (error) => {
        logger.error(`💥 AppWright process error: ${error.message}`);
        reject(error);
      });

      // Set timeout for AppWright test execution (15 minutes for BrowserStack tests)
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('AppWright test execution timed out after 15 minutes'));
      }, 15 * 60 * 1000);
    });
  }

  /**
   * Parse AppWright test statistics from output
   */
  parseAppWrightTestStats(output) {
    const stats = {
      total: 0,
      passed: 0,
      failed: 0
    };

    // AppWright test result patterns
    const patterns = [
      /(\d+) passed/i,
      /(\d+) failed/i,
      /(\d+) tests? ran/i,
      /Results:\s*(\d+) passed,\s*(\d+) failed/i
    ];

    const passedMatch = output.match(/(\d+) passed/i);
    const failedMatch = output.match(/(\d+) failed/i);
    const totalMatch = output.match(/(\d+) tests? ran/i);

    if (passedMatch) {
      stats.passed = parseInt(passedMatch[1]);
    }

    if (failedMatch) {
      stats.failed = parseInt(failedMatch[1]);
    }

    if (totalMatch) {
      stats.total = parseInt(totalMatch[1]);
    } else {
      stats.total = stats.passed + stats.failed;
    }

    // If no stats found, default to 1 test
    if (stats.total === 0) {
      stats.total = 1;
    }

    return stats;
  }

  /**
   * Generate a unique build number
   */
  generateBuildNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}-${random}`;
  }

  /**
   * Run test command and capture output
   */
  async runTestCommand(command, args, env, workingDir = process.cwd()) {
    return new Promise((resolve, reject) => {
      logger.info(`🏃 Executing: ${command} ${args.join(' ')}`);
      logger.info(`📍 Working directory: ${workingDir}`);

      const child = spawn(command, args, {
        env,
        stdio: 'pipe',
        shell: true,
        cwd: workingDir
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        logger.info(`📊 Test Output: ${output.trim()}`);
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logger.warn(`⚠️  Test Warning: ${output.trim()}`);
      });

      child.on('close', (exitCode) => {
        logger.info(`🏁 Process exited with code: ${exitCode}`);

        // Parse test statistics from output if available
        const testStats = this.parseTestStats(stdout + stderr);

        // Extract BrowserStack session info if available
        const browserstackSession = this.extractBrowserStackSession(stdout + stderr);

        resolve({
          exitCode,
          output: stdout + stderr,
          testStats,
          browserstackSession
        });
      });

      child.on('error', (error) => {
        logger.error(`💥 Process error: ${error.message}`);
        reject(error);
      });

      // Set timeout for test execution (10 minutes for BrowserStack tests)
      setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Test execution timed out after 10 minutes'));
      }, 10 * 60 * 1000);
    });
  }

  /**
   * Parse test statistics from output
   */
  parseTestStats(output) {
    // Look for common test output patterns
    const patterns = [
      /(\d+) passing/i,
      /(\d+) failing/i,
      /(\d+) tests? completed/i,
      /Tests:\s*(\d+)/i
    ];

    const stats = {
      total: 0,
      passed: 0,
      failed: 0
    };

    // Try to extract numbers from output
    const passingMatch = output.match(/(\d+) passing/i);
    const failingMatch = output.match(/(\d+) failing/i);

    if (passingMatch) {
      stats.passed = parseInt(passingMatch[1]);
    }

    if (failingMatch) {
      stats.failed = parseInt(failingMatch[1]);
    }

    stats.total = stats.passed + stats.failed;

    // If no stats found, default to 1 test
    if (stats.total === 0) {
      stats.total = 1;
    }

    return stats;
  }

  /**
   * Extract BrowserStack session information from output
   */
  extractBrowserStackSession(output) {
    const sessionMatch = output.match(/Session ID: ([a-f0-9-]+)/i);
    const urlMatch = output.match(/Dashboard: (https:\/\/[^\s]+)/i);

    if (sessionMatch || urlMatch) {
      return {
        sessionId: sessionMatch ? sessionMatch[1] : null,
        dashboardUrl: urlMatch ? urlMatch[1] : null
      };
    }

    return null;
  }
}

module.exports = BrowserStackExecutor;
