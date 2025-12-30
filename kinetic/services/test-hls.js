// kinetic/services/test-hls.js
// Test service for non-DRM HLS streams

module.exports = {
  name: 'Test HLS',
  
  /**
   * Check if this service can handle the URL
   */
  canHandle(url) {
    return url.includes('test-hls') || 
           url.includes('bipbop') || 
           url.includes('sintel') ||
           url.includes('nasa') ||
           url.includes('localhost:8889');
  },

  /**
   * Setup - minimal since these are direct HLS streams
   */
  async setup(page, url) {
    console.log('[Test HLS] Setting up stream...');
    
    try {
      // Just wait for page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('[Test HLS] Stream setup complete');
      
    } catch (error) {
      console.error('[Test HLS] Setup failed:', error.message);
      throw error;
    }
  },

  /**
   * Extract stream metadata
   */
  async getMetadata(page) {
    return {
      title: 'Test HLS Stream',
      type: 'hls',
    };
  },

  /**
   * Cleanup when stream ends
   */
  async cleanup(page) {
    console.log('[Test HLS] Cleaning up...');
  },
};
