// kinetic/utils/stream-interceptor-v2.js
// Alternative stream interceptor using Network domain (works with older Chrome)

class StreamInterceptorV2 {
  constructor() {
    this.interceptedRequests = new Map();
  }

  /**
   * Extract stream URL and authentication using Network domain
   */
  async extractWithAuth(page) {
    console.log('[StreamInterceptor] Starting network monitoring...');
    
    const streamInfo = {
      url: null,
      type: null,
      headers: {},
      cookies: [],
    };

    const client = await page.target().createCDPSession();
    
    try {
      // Enable network tracking
      await client.send('Network.enable');
      
      // Set up request interceptor
      const requestUrls = [];
      
      client.on('Network.requestWillBeSent', (params) => {
        const url = params.request.url;
        
        // Look for HLS manifests
        if (url.includes('.m3u8')) {
          console.log('[StreamInterceptor] Found HLS manifest:', url);
          if (!streamInfo.url) {
            streamInfo.url = url;
            streamInfo.type = 'hls';
            streamInfo.headers = params.request.headers;
          }
          requestUrls.push({ url, type: 'hls', headers: params.request.headers });
        }
        
        // Look for DASH manifests
        else if (url.includes('.mpd')) {
          console.log('[StreamInterceptor] Found DASH manifest:', url);
          if (!streamInfo.url) {
            streamInfo.url = url;
            streamInfo.type = 'dash';
            streamInfo.headers = params.request.headers;
          }
          requestUrls.push({ url, type: 'dash', headers: params.request.headers });
        }
        
        // Look for video segments
        else if (url.includes('.ts') || url.includes('.m4s') || url.includes('segment')) {
          // This is a segment, parent should be manifest
          if (!streamInfo.url && requestUrls.length > 0) {
            const manifest = requestUrls[requestUrls.length - 1];
            streamInfo.url = manifest.url;
            streamInfo.type = manifest.type;
            streamInfo.headers = manifest.headers;
          }
        }
      });

      // Wait for network activity to settle
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get cookies
      const cookies = await page.cookies();
      streamInfo.cookies = cookies;

      // Clean up
      await client.send('Network.disable');
      await client.detach();

      if (streamInfo.url) {
        console.log('[StreamInterceptor] Successfully extracted stream info');
        return streamInfo;
      } else {
        console.log('[StreamInterceptor] No stream URL found in network traffic');
        return null;
      }

    } catch (error) {
      console.error('[StreamInterceptor] Extraction failed:', error.message);
      try {
        await client.detach();
      } catch (e) {
        // Already detached
      }
      return null;
    }
  }

  /**
   * Alternative method: Extract from video element source
   */
  async extractFromVideoElement(page) {
    try {
      console.log('[StreamInterceptor] Attempting to extract from video element...');
      
      const videoInfo = await page.evaluate(() => {
        const video = document.querySelector('video');
        if (!video) return null;

        // Try to get source from video element
        let src = video.currentSrc || video.src;
        
        // Check if using MediaSource (blob URL)
        if (src && src.startsWith('blob:')) {
          // Can't extract direct URL from blob, but we can get network info
          return {
            isBlob: true,
            src: src,
          };
        }

        // Check source elements
        if (!src) {
          const sources = video.querySelectorAll('source');
          for (const source of sources) {
            if (source.src) {
              src = source.src;
              break;
            }
          }
        }

        return {
          isBlob: false,
          src: src,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        };
      });

      if (videoInfo && videoInfo.src && !videoInfo.isBlob) {
        console.log('[StreamInterceptor] Found video source:', videoInfo.src);
        
        // Determine type from URL
        let type = null;
        if (videoInfo.src.includes('.m3u8')) type = 'hls';
        else if (videoInfo.src.includes('.mpd')) type = 'dash';

        const cookies = await page.cookies();
        
        return {
          url: videoInfo.src,
          type: type,
          headers: {
            'User-Agent': await page.evaluate(() => navigator.userAgent),
            'Referer': page.url(),
          },
          cookies: cookies,
        };
      }

      console.log('[StreamInterceptor] No usable video source found');
      return null;

    } catch (error) {
      console.error('[StreamInterceptor] Video element extraction failed:', error.message);
      return null;
    }
  }

  /**
   * Combined extraction: Try both methods
   */
  async extract(page) {
    // Try network monitoring first
    let streamInfo = await this.extractWithAuth(page);
    
    // If that didn't work, try video element
    if (!streamInfo) {
      streamInfo = await this.extractFromVideoElement(page);
    }

    return streamInfo;
  }
}

module.exports = new StreamInterceptorV2();
