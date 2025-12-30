// kinetic/services/weatherscan.js
// Test service for non-DRM direct proxying

module.exports = {
  name: 'WeatherScan',
  
  /**
   * Check if this service can handle the URL
   */
  canHandle(url) {
    return url.includes('weatherscan.net');
  },

  /**
   * Setup automation for WeatherScan
   * This is a simple non-DRM stream perfect for testing direct proxy
   */
  async setup(page, url) {
    console.log('[WeatherScan] Setting up stream...');
    
    try {
      // Wait for page to load - use a simple Promise instead of waitForTimeout
      await new Promise(resolve => setTimeout(resolve, 3000));

      // WeatherScan is usually just a simple video element
      const hasVideo = await page.evaluate(() => {
        const video = document.querySelector('video');
        return !!video;
      });

      if (hasVideo) {
        console.log('[WeatherScan] Video element found');
        
        await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video) {
            video.style.setProperty('position', 'fixed', 'important');
            video.style.top = '0';
            video.style.left = '0';
            video.style.width = '100vw';
            video.style.height = '100vh';
            video.style.zIndex = '999999';
            video.style.objectFit = 'contain';
            video.style.background = 'black';
            video.play();
          }
        });
      }

      console.log('[WeatherScan] Stream setup complete');
      
    } catch (error) {
      console.error('[WeatherScan] Setup failed:', error.message);
      throw error;
    }
  },

  /**
   * Extract stream metadata
   */
  async getMetadata(page) {
    try {
      return await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          return {
            title: 'WeatherScan',
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            currentSrc: video.currentSrc,
          };
        }
        return {};
      });
    } catch (error) {
      return {};
    }
  },

  /**
   * Cleanup when stream ends
   */
  async cleanup(page) {
    console.log('[WeatherScan] Cleaning up...');
  },
};
