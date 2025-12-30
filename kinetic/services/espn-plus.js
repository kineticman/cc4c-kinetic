// kinetic/services/espn-plus.js
// Custom handler for ESPN+ streams

module.exports = {
  name: 'ESPN Plus',
  
  /**
   * Check if this service can handle the URL
   */
  canHandle(url) {
    return url.includes('espn.com/watch') || 
           url.includes('plus.espn.com') ||
           url.includes('espnplus.com');
  },

  /**
   * Setup automation for ESPN+
   */
  async setup(page, url) {
    console.log('[ESPN+] Setting up stream...');
    
    try {
      // Wait for video player
      await page.waitForSelector('video', {timeout: 20000});
      console.log('[ESPN+] Video player found');

      // Wait for video to be ready
      await page.waitForFunction(
        () => {
          const video = document.querySelector('video');
          return video && video.readyState >= 3;
        },
        {timeout: 15000}
      );

      // Fullscreen and optimize video
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
          video.volume = 1.0;
        }

        // Hide ESPN UI elements
        const hideElements = document.querySelectorAll(
          '.Header, .Nav, [class*="overlay"], [class*="controls"]'
        );
        hideElements.forEach(el => el.style.display = 'none');
      });

      // Try fullscreen
      try {
        await page.keyboard.press('f');
      } catch (e) {
        console.log('[ESPN+] Fullscreen toggle failed (expected in some modes)');
      }

      console.log('[ESPN+] Stream setup complete');
      
    } catch (error) {
      console.error('[ESPN+] Setup failed:', error.message);
      throw error;
    }
  },

  /**
   * Extract stream metadata
   */
  async getMetadata(page) {
    try {
      return await page.evaluate(() => {
        const meta = {};
        
        const titleEl = document.querySelector('[class*="title"]');
        if (titleEl) meta.title = titleEl.innerText;

        const video = document.querySelector('video');
        if (video) {
          meta.duration = video.duration;
          meta.currentTime = video.currentTime;
          meta.videoWidth = video.videoWidth;
          meta.videoHeight = video.videoHeight;
        }

        return meta;
      });
    } catch (error) {
      console.error('[ESPN+] Failed to extract metadata:', error.message);
      return {};
    }
  },

  /**
   * Cleanup when stream ends
   */
  async cleanup(page) {
    console.log('[ESPN+] Cleaning up...');
  },
};
