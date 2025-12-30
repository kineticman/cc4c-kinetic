// kinetic/services/peacock-enhanced.js
// Enhanced handler for Peacock streams with better automation

module.exports = {
  name: 'Peacock Enhanced',
  
  /**
   * Check if this service can handle the URL
   */
  canHandle(url) {
    return url.includes('peacocktv.com') || url.includes('peacock.com');
  },

  /**
   * Setup automation for Peacock
   */
  async setup(page, url) {
    console.log('[Peacock Enhanced] Setting up stream...');
    
    try {
      // Wait for the video player to load
      await page.waitForSelector('video', {timeout: 20000});
      console.log('[Peacock Enhanced] Video player found');

      // Wait a moment for player to initialize
      await page.waitForTimeout(2000);

      // Check for and handle the mute button
      try {
        const muteButton = await page.waitForSelector(
          '[data-testid="playback-volume-muted-icon"]',
          {visible: true, timeout: 5000}
        );
        
        if (muteButton) {
          console.log('[Peacock Enhanced] Unmuting via button...');
          await page.keyboard.press('m');
        }
      } catch (e) {
        console.log('[Peacock Enhanced] No mute button found, trying alternative methods');
        
        // Alternative: directly unmute the video element
        await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video) {
            video.muted = false;
            video.volume = 1.0;
          }
        });
      }

      // Try to set quality to highest available
      try {
        console.log('[Peacock Enhanced] Attempting to set quality...');
        await this._setQuality(page);
      } catch (e) {
        console.log('[Peacock Enhanced] Quality setting not available:', e.message);
      }

      // Optimize video display
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

        // Hide overlays and UI
        const hideSelectors = [
          '[class*="overlay"]',
          '[class*="controls"]',
          '[class*="ui-"]',
          '.header',
          '.nav',
        ];
        
        hideSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            if (!el.contains(video)) {
              el.style.display = 'none';
            }
          });
        });
      });

      console.log('[Peacock Enhanced] Stream setup complete');
      
    } catch (error) {
      console.error('[Peacock Enhanced] Setup failed:', error.message);
      throw error;
    }
  },

  /**
   * Attempt to set video quality
   */
  async _setQuality(page, quality = '1080p') {
    try {
      // Try to click settings button
      const settingsButton = await page.$('[data-testid="settings-button"]');
      if (settingsButton) {
        await settingsButton.click();
        await page.waitForTimeout(500);

        // Look for quality selector
        const qualityButton = await page.$(`[data-testid="quality-${quality}"]`);
        if (qualityButton) {
          await qualityButton.click();
          console.log(`[Peacock Enhanced] Set quality to ${quality}`);
        }

        // Close settings
        await page.keyboard.press('Escape');
      }
    } catch (error) {
      // Quality setting not available or UI changed
      console.log('[Peacock Enhanced] Could not set quality:', error.message);
    }
  },

  /**
   * Extract stream metadata
   */
  async getMetadata(page) {
    try {
      return await page.evaluate(() => {
        const meta = {};
        
        // Extract title information
        const titleEl = document.querySelector('[class*="title"], h1, h2');
        if (titleEl) meta.title = titleEl.innerText;

        const video = document.querySelector('video');
        if (video) {
          meta.duration = video.duration;
          meta.currentTime = video.currentTime;
          meta.videoWidth = video.videoWidth;
          meta.videoHeight = video.videoHeight;
          meta.paused = video.paused;
        }

        return meta;
      });
    } catch (error) {
      console.error('[Peacock Enhanced] Failed to extract metadata:', error.message);
      return {};
    }
  },

  /**
   * Cleanup when stream ends
   */
  async cleanup(page) {
    console.log('[Peacock Enhanced] Cleaning up...');
    // Add any necessary cleanup logic here
  },
};
