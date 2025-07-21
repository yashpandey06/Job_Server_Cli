
/**
 * QualGent Mobile App Test - Wikipedia Android (Local Device)
 */

var assert = require('assert');
const { Builder, By, until } = require('selenium-webdriver');
const path = require('path');

const APPIUM_SERVER = 'http://127.0.0.1:4723/wd/hub';
const APK_PATH = path.join(__dirname, '..', 'node-appium-app-browserstack-master', 'android', 'WikipediaSample.apk');

var buildDriver = function() {
  const capabilities = {
    platformName: 'Android',
    platformVersion: process.env.ANDROID_VERSION || '11.0',
    deviceName: process.env.DEVICE_NAME || 'Local Android Device',
    app: APK_PATH,
    automationName: 'UiAutomator2',
    noReset: false,
    fullReset: true,
    newCommandTimeout: 300,
    udid: process.env.DEVICE_UDID || 'auto',
    autoGrantPermissions: true,
    autoAcceptAlerts: true
  };

  console.log('🔧 Connecting to local Appium server:', APPIUM_SERVER);
  console.log('📱 Device capabilities:', JSON.stringify(capabilities, null, 2));

  return new Builder()
    .usingServer(APPIUM_SERVER)
    .withCapabilities(capabilities)
    .build();
};

describe('QualGent Mobile App Test - Wikipedia Android (Local Device)', () => {
  let driver;

  before(async function() {
    this.timeout(60000);
    console.log('🚀 Initializing QualGent mobile app test on local device...');
    console.log('📱 APK Path:', APK_PATH);
    
    try {
      driver = buildDriver();
      console.log('✅ Connected to local device successfully');
    } catch (error) {
      console.error('❌ Failed to connect to local device:', error.message);
      console.error('💡 Make sure:');
      console.error('   - Appium server is running (appium)');
      console.error('   - Android device is connected via USB');
      console.error('   - USB debugging is enabled');
      console.error('   - ADB can see your device (adb devices)');
      throw error;
    }
  });

  after(async () => {
    if (driver) {
      console.log('🧹 Cleaning up driver...');
      await driver.quit();
    }
  });

  it('should search for BrowserStack in Wikipedia app on local device', async function() {
    this.timeout(120000);
    
    try {
      console.log('📱 Starting Wikipedia app test on local Android device...');
      
      console.log('⏳ Waiting for app to initialize on local device...');
      await driver.sleep(5000);
      
      console.log('⏳ Waiting for first article to load...');
      const firstArticle = await driver.wait(
        until.elementLocated(
          By.xpath(
            '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout/android.view.ViewGroup/android.support.v4.view.ViewPager/android.view.ViewGroup/android.widget.FrameLayout/android.support.v7.widget.RecyclerView/android.widget.FrameLayout[1]/android.widget.LinearLayout/android.widget.TextView'
          )
        ), 45000
      );
      
      await firstArticle.click();
      console.log('📱 Clicked on first article');
      await driver.sleep(3000);

      console.log('🔍 Looking for search field...');
      const searchField = await driver.wait(
        until.elementLocated(
          By.xpath(
            '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.view.ViewGroup/android.widget.LinearLayout/android.support.v7.widget.LinearLayoutCompat/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.LinearLayout/android.widget.AutoCompleteTextView'
          ), 45000
        )
      );
      
      await searchField.clear();
      await searchField.sendKeys('BrowserStack');
      console.log('🔍 Entered search term: BrowserStack');
      
      console.log('⏳ Waiting for search results...');
      await driver.sleep(8000);
      
      const searchResults = await driver.findElements(
        By.xpath(
          '/hierarchy/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.FrameLayout/android.widget.LinearLayout[1]/android.widget.FrameLayout[2]/android.widget.FrameLayout/android.widget.LinearLayout/android.widget.ListView/android.widget.LinearLayout'
        )
      );

      console.log(`📊 Found ${searchResults.length} search results on local device`);
      
      assert(searchResults.length > 0, 'Expected to find search results but none were found on local device');
      
      const session = await driver.getSession();
      const deviceInfo = {
        platformName: session.get('platformName') || 'Android',
        platformVersion: session.get('platformVersion') || 'Unknown',
        deviceName: session.get('deviceName') || 'Local Device'
      };
      
      console.log('✅ QualGent mobile app test completed successfully on local device!');
      console.log(`📱 Device: ${deviceInfo.deviceName} (${deviceInfo.platformName} ${deviceInfo.platformVersion})`);
      console.log(`📈 Test Results: Found ${searchResults.length} search results for "BrowserStack"`);
      
      return {
        status: 'passed',
        device: deviceInfo,
        results: searchResults.length,
        execution_type: 'local_device'
      };
      
    } catch (e) {
      console.error('❌ QualGent mobile app test failed on local device:', e.message);
      console.error('Stack trace:', e.stack);
      
      console.error('💡 Troubleshooting tips:');
      console.error('   - Check if Wikipedia app is installed and working');
      console.error('   - Try manually opening the app to see if it loads');
      console.error('   - Check Appium server logs for more details');
      console.error('   - Verify device screen is unlocked');
      
      throw e;
    }
  });

  it('should verify app is running properly on local device', async function() {
    this.timeout(60000);
    
    try {
      console.log('📱 Verifying mobile device capabilities on local device...');
      
      const session = await driver.getSession();
      const deviceName = session.get('deviceName') || 'Unknown local device';
      const platformName = session.get('platformName') || 'Android';
      const platformVersion = session.get('platformVersion') || 'Unknown version';
      
      console.log(`📱 Local Device: ${deviceName}`);
      console.log(`🤖 Platform: ${platformName} ${platformVersion}`);
      
      const appElement = await driver.wait(
        until.elementLocated(By.xpath('//*[@class="android.widget.FrameLayout"]')),
        15000
      );
      
      const isDisplayed = await appElement.isDisplayed();
      assert(isDisplayed, 'App UI should be displayed properly on local device');
      
      const windowSize = await driver.manage().window().getSize();
      console.log(`📐 Screen resolution: ${windowSize.width}x${windowSize.height}`);
      
      console.log('✅ Mobile app is running properly on local device');
      
      return {
        status: 'passed',
        device: { deviceName, platformName, platformVersion },
        screen: windowSize,
        execution_type: 'local_device'
      };
      
    } catch (error) {
      console.error('❌ Local device verification failed:', error.message);
      throw error;
    }
  });
});

module.exports = {
  buildDriver,
  APPIUM_SERVER,
  APK_PATH
};
