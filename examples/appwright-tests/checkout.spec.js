// Example AppWright checkout test
describe('Checkout Flow', () => {
  beforeEach(async () => {
    await app.launch();
    // Login first
    await screen.getByRole('button', { name: 'Sign In' }).tap();
    await screen.getByLabelText('Email').fill('user@example.com');
    await screen.getByLabelText('Password').fill('validpassword');
    await screen.getByRole('button', { name: 'Sign In' }).tap();
  });

  it('should complete purchase with valid payment', async () => {
    // Add items to cart
    await screen.getByRole('button', { name: 'Shop' }).tap();
    await screen.getByText('Product 1').tap();
    await screen.getByRole('button', { name: 'Add to Cart' }).tap();
    
    // Go to cart
    await screen.getByRole('button', { name: 'Cart' }).tap();
    await expect(screen.getByText('Product 1')).toBeVisible();
    
    // Checkout
    await screen.getByRole('button', { name: 'Checkout' }).tap();
    
    // Shipping information
    await screen.getByLabelText('Full Name').fill('John Doe');
    await screen.getByLabelText('Address').fill('123 Main St');
    await screen.getByLabelText('City').fill('Anytown');
    await screen.getByLabelText('ZIP Code').fill('12345');
    await screen.getByRole('button', { name: 'Continue' }).tap();
    
    // Payment information
    await screen.getByLabelText('Card Number').fill('4111111111111111');
    await screen.getByLabelText('Expiry Date').fill('12/25');
    await screen.getByLabelText('CVV').fill('123');
    await screen.getByRole('button', { name: 'Complete Purchase' }).tap();
    
    // Verify success
    await expect(screen.getByText('Order Confirmed')).toBeVisible();
    await expect(screen.getByText('Thank you for your purchase!')).toBeVisible();
  });

  it('should handle invalid payment information', async () => {
    // Add item and go to checkout
    await screen.getByRole('button', { name: 'Shop' }).tap();
    await screen.getByText('Product 1').tap();
    await screen.getByRole('button', { name: 'Add to Cart' }).tap();
    await screen.getByRole('button', { name: 'Cart' }).tap();
    await screen.getByRole('button', { name: 'Checkout' }).tap();
    
    // Skip shipping (assuming saved)
    await screen.getByRole('button', { name: 'Use Saved Address' }).tap();
    
    // Invalid payment
    await screen.getByLabelText('Card Number').fill('1234567890123456');
    await screen.getByLabelText('Expiry Date').fill('01/20');
    await screen.getByLabelText('CVV').fill('999');
    await screen.getByRole('button', { name: 'Complete Purchase' }).tap();
    
    await expect(screen.getByText('Payment failed')).toBeVisible();
  });
});
