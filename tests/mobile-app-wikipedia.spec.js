/**
 * QualGent Mobile App Test - Wikipedia Android (BrowserStack)
 */

var assert = require('assert');
const { Builder, By, until } = require('selenium-webdriver');

var buildDriver = function() {
  return new Builder()
    .usingServer('http://127.0.0.1:4723/wd/hub')
    .build();
};

describe('QualGent Mobile App Test - Wikipedia Android', () => {
  let driver;

  before(async () => {
    console.log('🚀 Initializing QualGent mobile app test...');
    driver = buildDriver();
  });

  after(async () => {
    if (driver) {
      console.log('🧹 Cleaning up driver...');
      await driver.quit();
    }
  });

  it('should search for BrowserStack in Wikipedia app', async () => {
    try {
      console.log('📱 Starting Wikipedia app test on mobile device...');
      
      // Wait for the first article to be visible and click it
      console.log('⏳ Waiting for first article to load...');
      await driver.wait(
        until.elementLocated(
          By.xpath(
            '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout/android.view.ViewGroup/android.support.v4.view.ViewPager/android.view.ViewGroup/android.widget.FrameLayout/android.support.v7.widget.RecyclerView/android.widget.FrameLayout[1]/android.widget.LinearLayout/android.widget.TextView'
          )
        ), 30000
      ).click();

      console.log('📱 Clicked on first article');

      // Wait for search input field and enter search text
      console.log('🔍 Looking for search field...');
      var insertTextSelector = await driver.wait(
        until.elementLocated(
          By.xpath(
            '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.view.ViewGroup/android.widget.LinearLayout/android.support.v7.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.AutoCompleteTextView'
          ), 30000
        )
      );
      
      await insertTextSelector.sendKeys('BrowserStack');
      console.log('🔍 Entered search term: BrowserStack');
      
      // Wait for search results to appear
      console.log('⏳ Waiting for search results...');
      await driver.sleep(5000);

      // Check if search results are displayed
      var allProductsName = await driver.findElements(
        By.xpath(
          '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.ListView/android.widget.LinearLayout'
        )
      );

      console.log(`📊 Found ${allProductsName.length} search results`);
      
      // Assert that we have search results
      assert(allProductsName.length > 0, 'Expected to find search results but none were found');
      
      // Mark test as passed in BrowserStack
      await driver.executeScript(
        'browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"passed","reason": "QualGent mobile app test - Wikipedia search completed successfully"}}'
      );
      
      console.log('✅ QualGent mobile app test completed successfully!');
      console.log(`📈 Test Results: Found ${allProductsName.length} search results for "BrowserStack"`);
      
    } catch (e) {
      console.error('❌ QualGent mobile app test failed:', e.message);
      console.error('Stack trace:', e.stack);
      
      // Mark test as failed in BrowserStack
      await driver.executeScript(
        'browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"failed","reason": "QualGent mobile app test failed: ' + e.message + '"}}'
      );
      
      throw e;
    }
  });

  it('should verify app is running on mobile device', async () => {
    try {
      console.log('📱 Verifying mobile device capabilities...');
      
      // Get device info to verify we're running on mobile
      const capabilities = await driver.getSession();
      const deviceName = capabilities.get('deviceName') || 'Unknown device';
      const platformName = capabilities.get('platformName') || 'Unknown platform';
      const platformVersion = capabilities.get('platformVersion') || 'Unknown version';
      
      console.log(`📱 Device: ${deviceName}`);
      console.log(`🤖 Platform: ${platformName} ${platformVersion}`);
      
      // Verify app is responsive
      const appElement = await driver.wait(
        until.elementLocated(By.xpath('//*[@class="android.widget.FrameLayout"]')),
        10000
      );
      
      const isDisplayed = await appElement.isDisplayed();
      assert(isDisplayed, 'App UI should be displayed properly');
      
      console.log('✅ Mobile app is running properly on device');
      
      // Report success to BrowserStack
      await driver.executeScript(
        'browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"passed","reason": "Device verification completed successfully"}}'
      );
      
    } catch (error) {
      console.error('❌ Device verification failed:', error.message);
      
      await driver.executeScript(
        'browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"failed","reason": "Device verification failed: ' + error.message + '"}}'
      );
      
      throw error;
    }
  });
});
