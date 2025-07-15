# AppWright Test Examples

This directory contains example AppWright test files that demonstrate the types of tests that would be executed by the QualGent Test Orchestrator.

## Test Files

- `onboarding.spec.js` - User onboarding flow tests
- `login.spec.js` - Authentication and login tests  
- `checkout.spec.js` - E-commerce checkout flow tests
- `integration.spec.js` - Basic integration tests for CI/CD

## Usage

These test files are used as examples in the CLI and GitHub Actions workflows:

```bash
# Submit an onboarding test
qgjob submit --org-id=qualgent --app-version-id=v1.0.0 --test=examples/appwright-tests/onboarding.spec.js

# Submit a login test with high priority
qgjob submit --org-id=qualgent --app-version-id=v1.0.0 --test=examples/appwright-tests/login.spec.js --priority=high

# Submit a checkout test for device target
qgjob submit --org-id=qualgent --app-version-id=v1.0.0 --test=examples/appwright-tests/checkout.spec.js --target=device
```

## AppWright Framework

These tests are written in a hypothetical AppWright testing framework syntax that includes:

- `app.launch()` - Launch the mobile application
- `screen.getByText()` - Find elements by text content
- `screen.getByRole()` - Find elements by accessibility role
- `screen.getByLabelText()` - Find elements by label
- `.tap()` - Tap/click on elements
- `.fill()` - Fill input fields
- `expect().toBeVisible()` - Assert element visibility

## Grouping Example

When jobs with the same `app_version_id` are submitted, they will be grouped together for efficient execution:

```bash
# These three jobs will be grouped and run sequentially on the same agent
# to avoid reinstalling the app multiple times
qgjob submit --org-id=qualgent --app-version-id=v2.1.0 --test=examples/appwright-tests/onboarding.spec.js
qgjob submit --org-id=qualgent --app-version-id=v2.1.0 --test=examples/appwright-tests/login.spec.js  
qgjob submit --org-id=qualgent --app-version-id=v2.1.0 --test=examples/appwright-tests/checkout.spec.js
```
