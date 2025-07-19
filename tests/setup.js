// Test setup file
require('dotenv').config({ path: '.env.test' });

// Global test setup
beforeAll(() => {
  // Suppress console output during tests
  if (process.env.NODE_ENV === 'test') {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Cleanup after all tests
});
