<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# QualGent Test Orchestrator - Copilot Instructions

This is a Node.js project for a test orchestration platform that includes:

## Project Structure
- `src/cli/` - CLI tool (`qgjob`) for submitting and checking test jobs
- `src/server/` - Backend service for job orchestration and queueing  
- `src/shared/` - Shared utilities and schemas
- `tests/` - Test files and example AppWright test scripts

## Key Technologies
- Node.js with Express for the backend API
- Redis for job queueing and caching
- Commander.js for CLI interface
- Docker for containerization
- GitHub Actions for CI/CD

## Architecture Patterns
- Modular service layers (queue, scheduler, execution)
- Job grouping by app_version_id for efficiency
- RESTful API design with proper error handling
- Retry mechanisms and fault tolerance

## Code Style Guidelines
- Use ES6+ features and async/await
- Implement proper error handling and logging
- Follow RESTful API conventions
- Include JSDoc comments for functions
- Use environment variables for configuration
