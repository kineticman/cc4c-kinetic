// kinetic/index.js
// Main Kinetic integration module for CC4C

const services = require('./services');
const sessionPool = require('./utils/session-pool');
const drmDetector = require('./utils/drm-detector');
const streamInterceptor = require('./utils/stream-interceptor-v2');
const streamProxy = require('./utils/stream-proxy');
const config = require('./config/bradmini.json');

class KineticEnhancer {
  constructor() {
    this.services = services;
    this.sessionPool = sessionPool;
    this.drmDetector = drmDetector;
    this.streamInterceptor = streamInterceptor;
    this.streamProxy = streamProxy;
    this.config = config;
    this.stats = {
      streamsHandled: 0,
      customServicesUsed: 0,
      sessionsReused: 0,
      directProxied: 0,
      screenCaptured: 0,
      errors: 0,
    };
  }

  /**
   * Check if a URL should use custom Kinetic handling
   */
  shouldHandle(url) {
    const service = this.services.getServiceForUrl(url);
    if (!service) return false;

    const serviceConfig = this.config.services[service.name.toLowerCase().replace(/\s+/g, '-')];
    return serviceConfig && serviceConfig.enabled;
  }

  /**
   * Handle a stream request with Kinetic enhancements
   */
  async handleStream(url, browser, setupPage, getStream, encodingParams, req, res) {
    this.stats.streamsHandled++;
    
    const service = this.services.getServiceForUrl(url);
    
    if (!service) {
      throw new Error('No service handler found for URL');
    }

    console.log(`[Kinetic] Using ${service.name} handler for ${url}`);
    this.stats.customServicesUsed++;

    const serviceName = service.name.toLowerCase().replace(/\s+/g, '-');
    const serviceConfig = this.config.services[serviceName];
    
    let page;
    let streamInfo = null;
    
    // Try to reuse session if enabled
    if (serviceConfig.sessionReuse && this.config.features.sessionPooling) {
      page = await this.sessionPool.getOrCreate(serviceName, async () => {
        console.log(`[Kinetic] Creating new authenticated session for ${service.name}`);
        const newPage = await setupPage(browser);
        
        // Start network monitoring BEFORE navigation if interception enabled
        if (this.config.features.streamInterception) {
          streamInfo = await this._startNetworkMonitoring(newPage);
        }
        
        await newPage.goto(url, {waitUntil: 'networkidle2', timeout: serviceConfig.timeout || 30000});
        await service.setup(newPage, url);
        
        // Extract stream info after page loads
        if (this.config.features.streamInterception && !streamInfo) {
          streamInfo = await this._extractStreamInfo(newPage);
        }
        
        return newPage;
      });
      
      if (page) {
        this.stats.sessionsReused++;
        console.log(`[Kinetic] Reusing existing session for ${service.name}`);
        
        // Just navigate to new content if URL changed
        if (page.url() !== url) {
          // Start monitoring before navigation
          if (this.config.features.streamInterception) {
            streamInfo = await this._startNetworkMonitoring(page);
          }
          
          await page.goto(url, {waitUntil: 'networkidle2', timeout: serviceConfig.timeout || 30000});
          await service.setup(page, url);
          
          // Extract after navigation
          if (this.config.features.streamInterception && !streamInfo) {
            streamInfo = await this._extractStreamInfo(page);
          }
        }
      }
    } else {
      // Create fresh page
      page = await setupPage(browser);
      
      // Start network monitoring BEFORE navigation if interception enabled
      if (this.config.features.streamInterception) {
        streamInfo = await this._startNetworkMonitoring(page);
      }
      
      await page.goto(url, {waitUntil: 'networkidle2', timeout: serviceConfig.timeout || 30000});
      await service.setup(page, url);
      
      // Extract stream info after page loads if we didn't get it during monitoring
      if (this.config.features.streamInterception && !streamInfo) {
        streamInfo = await this._extractStreamInfo(page);
      }
    }

    // Optional: Detect DRM if enabled
    let drmInfo = { hasDRM: false };
    if (this.config.features.drmDetection) {
      drmInfo = await this.drmDetector.detect(page);
      console.log(`[Kinetic] DRM detection result:`, drmInfo);
    }

    // Try direct proxying if we got stream info and no DRM
    if (streamInfo && this.config.features.directProxy && !drmInfo.hasDRM) {
      console.log('[Kinetic] Attempting direct stream proxy...');
      const proxyResult = await this.streamProxy.attemptDirectProxy(streamInfo, req, res);
      
      if (proxyResult.success) {
        console.log('[Kinetic] Direct proxy successful!');
        this.stats.directProxied++;
        
        // Clean up page since we're not screen capturing
        if (!serviceConfig.sessionReuse) {
          await page.close();
        }
        
        return { page, stream: null, service, proxied: true };
      } else {
        console.log('[Kinetic] Direct proxy failed:', proxyResult.reason);
        console.log('[Kinetic] Falling back to screen capture');
      }
    }

    this.stats.screenCaptured++;

    // Start the capture stream with proper video/audio parameters
    const stream = await getStream(page, {
      video: true,
      audio: true,
      videoBitsPerSecond: encodingParams.videoBitsPerSecond,
      audioBitsPerSecond: encodingParams.audioBitsPerSecond,
      mimeType: encodingParams.mimeType,
      videoConstraints: {
        mandatory: {
          minWidth: 1920,
          minHeight: 1080,
          maxWidth: 1920,
          maxHeight: 1080,
          minFrameRate: encodingParams.minFrameRate,
          maxFrameRate: encodingParams.maxFrameRate,
        },
      },
    });
    stream.pipe(res);

    // Handle cleanup
    req.on('close', async () => {
      console.log(`[Kinetic] Stream closed for ${service.name}`);
      stream.destroy();
      
      if (serviceConfig.sessionReuse && this.config.features.sessionPooling) {
        // Keep page alive for reuse
        this.sessionPool.release(serviceName, page);
      } else {
        // Close page immediately
        await page.close();
      }
      
      if (service.cleanup) {
        await service.cleanup(page);
      }
    });

    res.on('error', async (err) => {
      console.error(`[Kinetic] Stream error for ${service.name}:`, err.message);
      this.stats.errors++;
      stream.destroy();
      
      if (!serviceConfig.sessionReuse) {
        await page.close();
      }
    });

    return {page, stream, service};
  }

  /**
   * Get metadata for a stream
   */
  async getMetadata(url, page) {
    const service = this.services.getServiceForUrl(url);
    if (service && service.getMetadata) {
      return await service.getMetadata(page);
    }
    return null;
  }

  /**
   * Start network monitoring before page navigation
   */
  async _startNetworkMonitoring(page) {
    try {
      console.log('[Kinetic] Starting network monitoring before navigation...');
      
      const client = await page.target().createCDPSession();
      const capturedUrls = [];
      
      await client.send('Network.enable');
      
      // Set up request listener
      const requestHandler = (params) => {
        const url = params.request.url;
        
        if (url.includes('.m3u8')) {
          console.log('[Kinetic] Captured HLS manifest:', url);
          capturedUrls.push({
            url,
            type: 'hls',
            headers: params.request.headers,
          });
        } else if (url.includes('.mpd')) {
          console.log('[Kinetic] Captured DASH manifest:', url);
          capturedUrls.push({
            url,
            type: 'dash',
            headers: params.request.headers,
          });
        }
      };
      
      client.on('Network.requestWillBeSent', requestHandler);
      
      // Store for later retrieval
      page._kineticMonitoring = {
        client,
        capturedUrls,
        requestHandler,
      };
      
      return null; // We'll extract after navigation
      
    } catch (error) {
      console.error('[Kinetic] Failed to start network monitoring:', error.message);
      return null;
    }
  }

  /**
   * Extract stream info after page loads
   */
  async _extractStreamInfo(page) {
    try {
      // Get captured URLs from monitoring
      if (page._kineticMonitoring) {
        const { client, capturedUrls, requestHandler } = page._kineticMonitoring;
        
        // Wait a bit for requests to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Clean up monitoring
        try {
          client.off('Network.requestWillBeSent', requestHandler);
          await client.send('Network.disable');
          await client.detach();
        } catch (e) {
          // Already cleaned up
        }
        
        delete page._kineticMonitoring;
        
        if (capturedUrls.length > 0) {
          const manifest = capturedUrls[0];
          const cookies = await page.cookies();
          
          console.log('[Kinetic] Successfully extracted stream info from monitoring');
          return {
            url: manifest.url,
            type: manifest.type,
            headers: manifest.headers,
            cookies: cookies,
          };
        }
      }
      
      // Fallback to video element extraction
      console.log('[Kinetic] No URLs captured, trying video element...');
      return await this.streamInterceptor.extractFromVideoElement(page);
      
    } catch (error) {
      console.error('[Kinetic] Failed to extract stream info:', error.message);
      return null;
    }
  }

  /**
   * Get Kinetic statistics
   */
  getStats() {
    return {
      ...this.stats,
      sessionPool: this.sessionPool.getStats(),
      streamProxy: this.streamProxy.getStats(),
    };
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    console.log('[Kinetic] Cleaning up all resources...');
    await this.sessionPool.clearAll();
  }
}

// Export singleton instance
module.exports = new KineticEnhancer();
