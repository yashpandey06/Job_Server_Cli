// Example AppWright login test
describe('User Login', () => {
  beforeEach(async () => {
    await app.launch();
    // Navigate to login if needed
    if (await screen.queryByText('Get Started')) {
      await screen.getByRole('button', { name: 'Sign In' }).tap();
    }
  });

  it('should login with valid credentials', async () => {
    await screen.getByLabelText('Email').fill('user@example.com');
    await screen.getByLabelText('Password').fill('validpassword');
    await screen.getByRole('button', { name: 'Sign In' }).tap();
    
    await expect(screen.getByText('Dashboard')).toBeVisible();
    await expect(screen.getByText('Welcome back!')).toBeVisible();
  });

  it('should show error for invalid credentials', async () => {
    await screen.getByLabelText('Email').fill('invalid@example.com');
    await screen.getByLabelText('Password').fill('wrongpassword');
    await screen.getByRole('button', { name: 'Sign In' }).tap();
    
    await expect(screen.getByText('Invalid credentials')).toBeVisible();
  });

  it('should handle forgot password flow', async () => {
    await screen.getByRole('button', { name: 'Forgot Password?' }).tap();
    await screen.getByLabelText('Email').fill('user@example.com');
    await screen.getByRole('button', { name: 'Reset Password' }).tap();
    
    await expect(screen.getByText('Reset link sent to your email')).toBeVisible();
  });
});
