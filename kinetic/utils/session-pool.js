// kinetic/utils/session-pool.js
// Session pooling for browser page reuse

const sessions = new Map();
const sessionTimestamps = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

module.exports = {
  /**
   * Get or create a session for a service
   */
  async getOrCreate(serviceName, createFn) {
    const existing = sessions.get(serviceName);
    
    // Check if session exists and is still valid
    if (existing && !existing.isClosed()) {
      const timestamp = sessionTimestamps.get(serviceName);
      const age = Date.now() - timestamp;
      
      if (age < SESSION_TIMEOUT) {
        console.log(`[SessionPool] Reusing session for ${serviceName} (age: ${Math.floor(age / 1000)}s)`);
        return existing;
      } else {
        console.log(`[SessionPool] Session expired for ${serviceName}, creating new one`);
        await this.remove(serviceName);
      }
    }
    
    // Create new session
    console.log(`[SessionPool] Creating new session for ${serviceName}`);
    const session = await createFn();
    sessions.set(serviceName, session);
    sessionTimestamps.set(serviceName, Date.now());
    
    return session;
  },

  /**
   * Release a session back to the pool (but keep it alive)
   */
  release(serviceName, page) {
    if (page && !page.isClosed()) {
      console.log(`[SessionPool] Released session for ${serviceName}`);
      sessionTimestamps.set(serviceName, Date.now());
    }
  },

  /**
   * Remove a session from the pool
   */
  async remove(serviceName) {
    const session = sessions.get(serviceName);
    if (session && !session.isClosed()) {
      try {
        await session.close();
      } catch (e) {
        console.error(`[SessionPool] Error closing session for ${serviceName}:`, e.message);
      }
    }
    sessions.delete(serviceName);
    sessionTimestamps.delete(serviceName);
    console.log(`[SessionPool] Removed session for ${serviceName}`);
  },

  /**
   * Clear all sessions
   */
  async clearAll() {
    console.log(`[SessionPool] Clearing all ${sessions.size} sessions`);
    for (const [serviceName, session] of sessions.entries()) {
      if (session && !session.isClosed()) {
        try {
          await session.close();
        } catch (e) {
          console.error(`[SessionPool] Error closing session for ${serviceName}:`, e.message);
        }
      }
    }
    sessions.clear();
    sessionTimestamps.clear();
  },

  /**
   * Get pool statistics
   */
  getStats() {
    const stats = {
      total: sessions.size,
      sessions: []
    };
    
    for (const [serviceName, session] of sessions.entries()) {
      const timestamp = sessionTimestamps.get(serviceName);
      const age = timestamp ? Date.now() - timestamp : 0;
      
      stats.sessions.push({
        service: serviceName,
        alive: !session.isClosed(),
        age: Math.floor(age / 1000), // seconds
      });
    }
    
    return stats;
  },

  /**
   * Cleanup expired sessions
   */
  async cleanupExpired() {
    const now = Date.now();
    const toRemove = [];
    
    for (const [serviceName, timestamp] of sessionTimestamps.entries()) {
      if (now - timestamp > SESSION_TIMEOUT) {
        toRemove.push(serviceName);
      }
    }
    
    if (toRemove.length > 0) {
      console.log(`[SessionPool] Cleaning up ${toRemove.length} expired sessions`);
      for (const serviceName of toRemove) {
        await this.remove(serviceName);
      }
    }
  },
};

// Periodic cleanup every 5 minutes
setInterval(() => {
  module.exports.cleanupExpired().catch(err => {
    console.error('[SessionPool] Cleanup error:', err);
  });
}, 5 * 60 * 1000);
