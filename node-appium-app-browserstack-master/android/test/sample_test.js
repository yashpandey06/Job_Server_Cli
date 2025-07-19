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
    driver = buildDriver();
  });

  after(async () => {
    if (driver) {
      await driver.quit();
    }
  });

  it('should search for BrowserStack in Wikipedia app', async () => {
    try {
      console.log('🚀 Starting QualGent mobile app test...');
      
      await driver.wait(
        until.elementLocated(
          By.xpath(
            '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout/android.view.ViewGroup/android.support.v4.view.ViewPager/android.view.ViewGroup/android.widget.FrameLayout/android.support.v7.widget.RecyclerView/android.widget.FrameLayout[1]/android.widget.LinearLayout/android.widget.TextView'
          )
        ), 30000
      ).click();

      console.log('📱 Clicked on first article');

      var insertTextSelector = await driver.wait(
        until.elementLocated(
          By.xpath(
            '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.view.ViewGroup/android.widget.LinearLayout/android.support.v7.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.AutoCompleteTextView'
          ), 30000
        )
      );
      await insertTextSelector.sendKeys('BrowserStack');
      console.log('🔍 Entered search term: BrowserStack');
      await driver.sleep(5000);

      var allProductsName = await driver.findElements(
        By.xpath(
          '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.ListView/android.widget.LinearLayout'
        )
      );

      console.log(`📊 Found ${allProductsName.length} search results`);
      assert(allProductsName.length > 0);
      
      await driver.executeScript(
        'browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"passed","reason": "QualGent mobile app test - Wikipedia search completed successfully"}}'
      );
      
      console.log('✅ QualGent mobile app test completed successfully!');
      
    } catch (e) {
      console.error('❌ QualGent mobile app test failed:', e.message);
      await driver.executeScript(
        'browserstack_executor: {"action": "setSessionStatus", "arguments": {"status":"failed","reason": "QualGent mobile app test failed: ' + e.message + '"}}'
      );
      throw e;
    }
  });
});
