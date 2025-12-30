// kinetic/services/test-streams.js
// Test service for publicly available non-DRM HLS streams

module.exports = {
  name: 'Test Streams',
  
  /**
   * Check if this service can handle the URL
   */
  canHandle(url) {
    return url.includes('test.kinetic') || 
           url.includes('demo.unified-streaming.com') ||
           url.includes('bitmovin.com') ||
           url.includes('cloudflarestream.com');
  },

  /**
   * Setup automation for test streams
   */
  async setup(page, url) {
    console.log('[Test Streams] Setting up stream...');
    
    try {
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for video element
      const hasVideo = await page.evaluate(() => {
        const video = document.querySelector('video');
        return !!video;
      });

      if (hasVideo) {
        console.log('[Test Streams] Video element found');
        
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
            video.muted = false;
          }
        });
      }

      console.log('[Test Streams] Stream setup complete');
      
    } catch (error) {
      console.error('[Test Streams] Setup failed:', error.message);
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
            title: 'Test Stream',
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
    console.log('[Test Streams] Cleaning up...');
  },
};
