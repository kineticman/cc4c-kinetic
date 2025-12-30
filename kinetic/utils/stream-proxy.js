// kinetic/utils/stream-proxy.js
// Direct stream proxying for non-DRM content

const fetch = require('node-fetch');

class StreamProxy {
  constructor() {
    this.activeProxies = new Map();
  }

  /**
   * Attempt to proxy a stream directly
   * Returns: { success: true, type: 'hls'|'dash' } or { success: false, reason: '...' }
   */
  async attemptDirectProxy(streamInfo, req, res) {
    console.log('[StreamProxy] Attempting direct proxy for:', streamInfo.url);
    
    try {
      // Test if the manifest is accessible
      const manifestResponse = await fetch(streamInfo.url, {
        headers: this._buildHeaders(streamInfo),
        timeout: 10000,
      });

      if (!manifestResponse.ok) {
        return {
          success: false,
          reason: `Manifest returned ${manifestResponse.status}`,
        };
      }

      const manifestText = await manifestResponse.text();
      
      // Check for DRM markers
      const hasDRM = this._detectDRM(manifestText, streamInfo.type);
      if (hasDRM) {
        return {
          success: false,
          reason: 'DRM detected in manifest',
        };
      }

      console.log('[StreamProxy] Direct proxy feasible, starting proxy...');

      // Start proxying
      if (streamInfo.type === 'hls') {
        await this._proxyHLS(streamInfo, manifestText, req, res);
      } else if (streamInfo.type === 'dash') {
        await this._proxyDASH(streamInfo, manifestText, req, res);
      }

      return { success: true, type: streamInfo.type };
      
    } catch (error) {
      console.error('[StreamProxy] Direct proxy failed:', error.message);
      return {
        success: false,
        reason: error.message,
      };
    }
  }

  /**
   * Proxy HLS stream
   */
  async _proxyHLS(streamInfo, manifestText, req, res) {
    const baseUrl = this._getBaseUrl(streamInfo.url);
    const proxyId = Date.now().toString();
    
    // Store proxy session with extended timeout (5 minutes for segment fetches)
    this.activeProxies.set(proxyId, {
      streamInfo,
      started: Date.now(),
      lastAccessed: Date.now(),
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    console.log(`[StreamProxy] Created persistent proxy session: ${proxyId}`);

    // Rewrite manifest URLs to go through our proxy
    const rewrittenManifest = this._rewriteHLSManifest(
      manifestText,
      baseUrl,
      proxyId,
      req.get('host')
    );

    // Set proper headers
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewrittenManifest);

    console.log(`[StreamProxy] HLS manifest sent, proxy ID: ${proxyId}`);
    console.log(`[StreamProxy] Proxy session will remain active for segment requests`);

    // DON'T cleanup on initial request close - let it persist for segment fetches
    // Cleanup will happen via timeout in the cleanup() method
  }

  /**
   * Proxy DASH stream
   */
  async _proxyDASH(streamInfo, manifestText, req, res) {
    const baseUrl = this._getBaseUrl(streamInfo.url);
    const proxyId = Date.now().toString();
    
    // Store proxy session with extended timeout
    this.activeProxies.set(proxyId, {
      streamInfo,
      started: Date.now(),
      lastAccessed: Date.now(),
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    console.log(`[StreamProxy] Created persistent proxy session: ${proxyId}`);

    // Rewrite manifest URLs
    const rewrittenManifest = this._rewriteDASHManifest(
      manifestText,
      baseUrl,
      proxyId,
      req.get('host')
    );

    res.setHeader('Content-Type', 'application/dash+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewrittenManifest);

    console.log(`[StreamProxy] DASH manifest sent, proxy ID: ${proxyId}`);
    console.log(`[StreamProxy] Proxy session will remain active for segment requests`);

    // DON'T cleanup on initial request close - let it persist for segment fetches
  }

  /**
   * Proxy a segment request
   */
  async proxySegment(proxyId, segmentPath, res) {
    const proxy = this.activeProxies.get(proxyId);
    
    if (!proxy) {
      console.error('[StreamProxy] Unknown or expired proxy ID:', proxyId);
      return res.status(404).send('Proxy session not found or expired');
    }

    // Update last accessed time to keep session alive
    proxy.lastAccessed = Date.now();

    try {
      const baseUrl = this._getBaseUrl(proxy.streamInfo.url);
      const segmentUrl = new URL(segmentPath, baseUrl).toString();
      
      console.log('[StreamProxy] Fetching segment:', segmentUrl);

      const response = await fetch(segmentUrl, {
        headers: this._buildHeaders(proxy.streamInfo),
        timeout: 30000,
      });

      if (!response.ok) {
        console.error('[StreamProxy] Segment fetch failed:', response.status);
        return res.status(response.status).send('Segment fetch failed');
      }

      // Copy headers
      res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp2t');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Pipe the segment
      response.body.pipe(res);
      
      console.log('[StreamProxy] Segment delivered successfully');
      
    } catch (error) {
      console.error('[StreamProxy] Segment proxy error:', error.message);
      res.status(500).send('Segment proxy error');
    }
  }

  /**
   * Build request headers from stream info
   */
  _buildHeaders(streamInfo) {
    const headers = {
      'User-Agent': streamInfo.headers?.userAgent || 'Mozilla/5.0',
      'Referer': streamInfo.headers?.referer || streamInfo.url,
    };

    // Add cookies if present
    if (streamInfo.cookies && streamInfo.cookies.length > 0) {
      headers['Cookie'] = streamInfo.cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    }

    return headers;
  }

  /**
   * Detect DRM in manifest
   */
  _detectDRM(manifestText, type) {
    if (type === 'hls') {
      // Check for HLS encryption
      return manifestText.includes('#EXT-X-KEY');
    } else if (type === 'dash') {
      // Check for DASH ContentProtection
      return manifestText.includes('ContentProtection') ||
             manifestText.includes('cenc:default_KID');
    }
    return false;
  }

  /**
   * Get base URL from manifest URL
   */
  _getBaseUrl(url) {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/'))}`;
  }

  /**
   * Rewrite HLS manifest to proxy through us
   */
  _rewriteHLSManifest(manifestText, baseUrl, proxyId, host) {
    const lines = manifestText.split('\n');
    const rewritten = [];

    for (let line of lines) {
      if (line.startsWith('#')) {
        // Keep comment lines as-is (except encryption keys)
        if (line.startsWith('#EXT-X-KEY')) {
          // Skip encryption keys (indicates DRM)
          console.warn('[StreamProxy] Found encryption key in manifest - should not happen');
        } else {
          rewritten.push(line);
        }
      } else if (line.trim() && !line.startsWith('#')) {
        // Rewrite segment/playlist URLs using query parameter
        const segmentUrl = line.startsWith('http') ? line : `${baseUrl}/${line}`;
        const proxiedUrl = `http://${host}/kinetic/proxy/${proxyId}?url=${encodeURIComponent(segmentUrl)}`;
        rewritten.push(proxiedUrl);
      } else {
        rewritten.push(line);
      }
    }

    return rewritten.join('\n');
  }

  /**
   * Rewrite DASH manifest to proxy through us
   */
  _rewriteDASHManifest(manifestText, baseUrl, proxyId, host) {
    // Simple URL rewriting for DASH using query params
    return manifestText.replace(
      /media="([^"]+)"/g,
      (match, url) => {
        const fullUrl = url.startsWith('http') ? url : `${baseUrl}/${url}`;
        const proxiedUrl = `http://${host}/kinetic/proxy/${proxyId}?url=${encodeURIComponent(fullUrl)}`;
        return `media="${proxiedUrl}"`;
      }
    );
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      activeProxies: this.activeProxies.size,
      proxies: Array.from(this.activeProxies.entries()).map(([id, proxy]) => ({
        id,
        type: proxy.streamInfo.type,
        age: Date.now() - proxy.started,
      })),
    };
  }

  /**
   * Cleanup expired proxies
   */
  cleanup() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes of inactivity

    for (const [id, proxy] of this.activeProxies.entries()) {
      const inactiveTime = now - (proxy.lastAccessed || proxy.started);
      if (inactiveTime > timeout) {
        console.log(`[StreamProxy] Removing expired proxy ${id} (inactive for ${Math.round(inactiveTime / 1000)}s)`);
        this.activeProxies.delete(id);
      }
    }
  }
}

// Export singleton
module.exports = new StreamProxy();

// Cleanup expired proxies every minute
setInterval(() => {
  module.exports.cleanup();
}, 60000);
