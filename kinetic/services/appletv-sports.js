// kinetic/services/appletv-sports.js
// Custom handler for Apple TV Sports streams

module.exports = {
  name: 'Apple TV Sports',
  
  /**
   * Check if this service can handle the URL
   */
  canHandle(url) {
    return url.includes('tv.apple.com') && 
           (url.includes('sport') || url.includes('live'));
  },

  /**
   * Setup automation for Apple TV Sports
   */
  async setup(page, url) {
    console.log('[Apple TV Sports] Setting up stream...');
    
    try {
      // Wait for video player to load
      await page.waitForSelector('video', {timeout: 20000});
      console.log('[Apple TV Sports] Video element found');

      // Wait for video to be ready
      await page.waitForFunction(
        () => {
          const video = document.querySelector('video');
          return video && video.readyState >= 3; // HAVE_FUTURE_DATA
        },
        {timeout: 15000}
      );

      // Fullscreen and optimize the video element
      await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          // Position video fullscreen
          video.style.setProperty('position', 'fixed', 'important');
          video.style.top = '0';
          video.style.left = '0';
          video.style.width = '100vw';
          video.style.height = '100vh';
          video.style.zIndex = '999999';
          video.style.objectFit = 'contain';
          video.style.background = 'black';

          // Hide UI overlays
          const overlays = document.querySelectorAll('[class*="overlay"], [class*="controls"], [class*="ui"]');
          overlays.forEach(el => el.style.display = 'none');

          // Ensure playback
          video.play();
          video.muted = false;
          video.removeAttribute('muted');
        }
      });

      // Try to trigger fullscreen (may not work in headless)
      try {
        await page.keyboard.press('f');
      } catch (e) {
        console.log('[Apple TV Sports] Fullscreen key press failed (expected in some modes)');
      }

      console.log('[Apple TV Sports] Stream setup complete');
      
    } catch (error) {
      console.error('[Apple TV Sports] Setup failed:', error.message);
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
        
        // Try to extract event information
        const titleEl = document.querySelector('[class*="title"]');
        if (titleEl) meta.title = titleEl.innerText;

        const eventEl = document.querySelector('[class*="event"]');
        if (eventEl) meta.event = eventEl.innerText;

        const sportEl = document.querySelector('[class*="sport"]');
        if (sportEl) meta.sport = sportEl.innerText;

        // Video element info
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
      console.error('[Apple TV Sports] Failed to extract metadata:', error.message);
      return {};
    }
  },

  /**
   * Cleanup when stream ends
   */
  async cleanup(page) {
    console.log('[Apple TV Sports] Cleaning up...');
    // Add any necessary cleanup logic here
  },
};
