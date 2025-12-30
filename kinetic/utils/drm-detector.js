// kinetic/utils/drm-detector.js
// Detect if a stream uses DRM/EME

module.exports = {
  /**
   * Detect if a page is using DRM
   */
  async detect(page) {
    console.log('[DRM Detector] Checking for DRM...');
    
    try {
      const drmInfo = await page.evaluate(() => {
        return new Promise((resolve) => {
          const video = document.querySelector('video');
          
          if (!video) {
            resolve({hasDRM: false, reason: 'No video element found'});
            return;
          }

          // Check if video already has mediaKeys
          if (video.mediaKeys) {
            resolve({
              hasDRM: true,
              reason: 'MediaKeys already attached',
              keySystem: video.mediaKeys.keySystem || 'unknown'
            });
            return;
          }

          // Listen for encrypted event
          const timeout = setTimeout(() => {
            resolve({hasDRM: false, reason: 'No encrypted event in 5s'});
          }, 5000);

          video.addEventListener('encrypted', (event) => {
            clearTimeout(timeout);
            resolve({
              hasDRM: true,
              reason: 'Encrypted event fired',
              initDataType: event.initDataType,
              systemId: event.systemId
            });
          }, {once: true});

          // Trigger playback to test
          video.play().catch(() => {});
        });
      });

      if (drmInfo.hasDRM) {
        console.log('[DRM Detector] DRM detected:', drmInfo.reason);
        console.log('[DRM Detector] Details:', drmInfo);
      } else {
        console.log('[DRM Detector] No DRM detected:', drmInfo.reason);
      }

      return drmInfo;
      
    } catch (error) {
      console.error('[DRM Detector] Detection failed:', error.message);
      return {hasDRM: null, reason: 'Detection error', error: error.message};
    }
  },

  /**
   * Check if a URL is known to use DRM
   */
  isKnownDRMService(url) {
    const drmServices = [
      'peacocktv.com',
      'nbc.com/live',
      'sling.com',
      'espn.com',
      'hulu.com',
      'disneyplus.com',
      'netflix.com',
      'hbomax.com',
      'paramountplus.com',
      'fubo.tv',
      'directv.com',
      'youtube.tv',
      'tv.apple.com',
    ];

    return drmServices.some(service => url.includes(service));
  },

  /**
   * Get recommended capture method based on DRM
   */
  getRecommendedMethod(url, drmInfo = null) {
    // If we have DRM info from detection
    if (drmInfo && drmInfo.hasDRM === true) {
      return {
        method: 'screen-capture',
        reason: 'DRM detected',
        canOptimize: false
      };
    }

    // If it's a known DRM service
    if (this.isKnownDRMService(url)) {
      return {
        method: 'screen-capture',
        reason: 'Known DRM service',
        canOptimize: false
      };
    }

    // Otherwise, could potentially use direct stream
    return {
      method: 'screen-capture', // Still default to this for safety
      reason: 'No DRM detected',
      canOptimize: true // Could explore stream interception
    };
  },
};
