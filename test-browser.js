const {launch} = require('puppeteer-stream');
const {launch: puppeteerLaunch} = require('puppeteer-core');

(async () => {
  try {
    console.log('Attempting to launch browser...');
    
    const browser = await launch(
      {
        launch: opts => {
          console.log('Launch opts:', JSON.stringify(opts, null, 2));
          return puppeteerLaunch(opts);
        },
      },
      {
        executablePath: '/snap/bin/chromium',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      }
    );
    
    console.log('✓ Browser launched!');
    await browser.close();
    console.log('✓ Test complete!');
  } catch (error) {
    console.error('✗ Failed:', error.message);
    console.error('Stack:', error.stack);
  }
})();
