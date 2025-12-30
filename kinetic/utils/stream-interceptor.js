// kinetic/utils/stream-interceptor.js
// Intercept network requests to extract stream URLs

module.exports = {
  /**
   * Enable stream URL interception on a page
   */
  async enable(page) {
    const streamUrls = [];
    
    await page.setRequestInterception(true);
    
    page.on('request', request => {
      const url = request.url();
      
      // Detect HLS manifests
      if (url.includes('.m3u8')) {
        console.log('[Stream Interceptor] Found HLS manifest:', url);
        streamUrls.push({
          type: 'hls',
          url: url,
          timestamp: Date.now()
        });
      }
      
      // Detect DASH manifests
      if (url.includes('.mpd')) {
        console.log('[Stream Interceptor] Found DASH manifest:', url);
        streamUrls.push({
          type: 'dash',
          url: url,
          timestamp: Date.now()
        });
      }
      
      // Detect TS segments (might indicate HLS)
      if (url.includes('.ts') && !url.includes('timestamp')) {
        // Only log first few to avoid spam
        if (streamUrls.filter(s => s.type === 'hls-segment').length < 3) {
          console.log('[Stream Interceptor] Found TS segment (HLS)');
          streamUrls.push({
            type: 'hls-segment',
            url: url,
            timestamp: Date.now()
          });
        }
      }
      
      request.continue();
    });
    
    return {
      getStreamUrls: () => streamUrls,
      getManifests: () => streamUrls.filter(s => s.type === 'hls' || s.type === 'dash'),
      clear: () => streamUrls.length = 0,
    };
  },

  /**
   * Extract stream URL with authentication headers
   */
  async extractWithAuth(page) {
    const interceptor = await this.enable(page);
    
    // Wait for stream to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const manifests = interceptor.getManifests();
    
    if (manifests.length === 0) {
      return null;
    }
    
    // Get the first manifest (usually the main one)
    const manifest = manifests[0];
    
    // Extract cookies and headers
    const cookies = await page.cookies();
    const headers = await page.evaluate(() => {
      // Try to extract common auth headers from page context
      return {
        userAgent: navigator.userAgent,
        referer: window.location.href,
      };
    });
    
    return {
      url: manifest.url,
      type: manifest.type,
      cookies: cookies,
      headers: headers,
    };
  },

  /**
   * Test if direct streaming is possible (no DRM)
   */
  async testDirectStream(page, streamInfo) {
    console.log('[Stream Interceptor] Testing direct stream access...');
    
    try {
      // Try to fetch the manifest
      const response = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url);
          const text = await res.text();
          return {
            success: true,
            status: res.status,
            contentType: res.headers.get('content-type'),
            hasEncryption: text.includes('#EXT-X-KEY') || text.includes('ContentProtection'),
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }
      }, streamInfo.url);
      
      if (!response.success) {
        console.log('[Stream Interceptor] Direct access failed:', response.error);
        return false;
      }
      
      if (response.hasEncryption) {
        console.log('[Stream Interceptor] Stream is encrypted (DRM)');
        return false;
      }
      
      console.log('[Stream Interceptor] Direct streaming appears possible!');
      return true;
      
    } catch (error) {
      console.error('[Stream Interceptor] Test failed:', error.message);
      return false;
    }
  },
};
