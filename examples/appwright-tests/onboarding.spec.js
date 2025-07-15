// Example AppWright onboarding test
describe('App Onboarding', () => {
  it('should complete user onboarding flow', async () => {
    // Launch app
    await app.launch();
    
    // Welcome screen
    await expect(screen.getByText('Welcome')).toBeVisible();
    await screen.getByRole('button', { name: 'Get Started' }).tap();
    
    // Permission requests
    await screen.getByRole('button', { name: 'Allow Notifications' }).tap();
    await screen.getByRole('button', { name: 'Allow Location' }).tap();
    
    // Account setup
    await screen.getByLabelText('Email').fill('test@example.com');
    await screen.getByLabelText('Password').fill('password123');
    await screen.getByRole('button', { name: 'Create Account' }).tap();
    
    // Verify success
    await expect(screen.getByText('Account Created Successfully')).toBeVisible();
    await expect(screen.getByText('Welcome to the App!')).toBeVisible();
  });
  
  it('should skip onboarding when requested', async () => {
    await app.launch();
    await screen.getByRole('button', { name: 'Skip' }).tap();
    await expect(screen.getByText('Main Dashboard')).toBeVisible();
  });
});
