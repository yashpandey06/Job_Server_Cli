// Integration test for Docker environment
describe('Integration Test', () => {
  it('should run basic app functionality test', async () => {
    await app.launch();
    
    // Basic smoke test
    await expect(screen.getByText('Welcome')).toBeVisible();
    
    // Test navigation
    if (await screen.queryByRole('button', { name: 'Sign In' })) {
      await screen.getByRole('button', { name: 'Sign In' }).tap();
      await expect(screen.getByLabelText('Email')).toBeVisible();
    }
    
    console.log('Integration test completed successfully');
  });
});
