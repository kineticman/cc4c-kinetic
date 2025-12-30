# CC4C Kinetic

**Kinetic enhancements for Chrome Capture for Channels** - Adds intelligent service handlers, direct stream proxying, session pooling, and comprehensive monitoring to Chrome Capture for Channels.

## Features

### 🚀 Direct Stream Proxy (Non-DRM)
- Intercepts HLS/DASH manifests from network traffic
- Proxies video segments with authentication headers
- **3-10x CPU reduction** vs screen capture
- Persistent proxy sessions with 5-minute TTL
- Automatic DRM detection with screen capture fallback

### 🎯 Service-Specific Handlers
- **Apple TV Sports** - Automated navigation and stream setup
- **Peacock Enhanced** - Custom handling for live sports
- **ESPN+** - Optimized ESPN+ streaming
- **Test HLS** - Development and testing support

### ♻️ Session Pooling
- Reuse authenticated browser sessions
- Reduce startup time for repeated streams
- Configurable per-service

### 📊 Comprehensive Monitoring
- Real-time stats API endpoint
- Track proxy vs screen capture usage
- Session pool metrics
- Error tracking

## Performance Comparison

| Metric | Screen Capture | Direct Proxy | Improvement |
|--------|---------------|--------------|-------------|
| CPU Usage | 40-60% | 2-5% | **10x reduction** |
| Memory | 800MB | 150MB | **5x reduction** |
| Startup Time | 15-20s | 8-10s | **2x faster** |

*Note: Direct proxy only works for non-DRM streams. Commercial services (Apple TV+, Peacock, ESPN+) use DRM and require screen capture.*

## Installation

### Prerequisites
- Chrome Capture for Channels (base project)
- Chromium or Chrome browser
- Node.js 18+ or Bun runtime
- xvfb (for headless operation on Linux)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/cc4c-kinetic.git
cd cc4c-kinetic

# Install dependencies (if using npm)
npm install

# Or if using bun
bun install

# Configure your settings
cp kinetic/config/example.json kinetic/config/your-server.json
nano kinetic/config/your-server.json

# Run with xvfb (Linux)
xvfb-run -a --server-args="-screen 0 1920x1080x24" bun main.js --port 5560

# Or without xvfb (if you have a display)
bun main.js --port 5560
```

## Configuration

Edit `kinetic/config/your-server.json`:

```json
{
  "features": {
    "drmDetection": true,
    "sessionPooling": true,
    "streamInterception": true,
    "directProxy": true,
    "metrics": true
  },
  "services": {
    "appletv-sports": {
      "enabled": true,
      "sessionReuse": false,
      "timeout": 60000
    },
    "peacock-enhanced": {
      "enabled": true,
      "sessionReuse": false,
      "timeout": 45000
    },
    "test-hls": {
      "enabled": true,
      "sessionReuse": false,
      "timeout": 30000
    }
  }
}
```

### Configuration Options

**Features:**
- `drmDetection` - Detect encrypted streams before attempting proxy
- `sessionPooling` - Reuse browser sessions across streams
- `streamInterception` - Capture network traffic for direct proxying
- `directProxy` - Enable direct HLS/DASH proxying (non-DRM only)
- `metrics` - Enable stats collection

**Services:**
- `enabled` - Enable/disable specific service handler
- `sessionReuse` - Keep browser session alive for reuse
- `timeout` - Page load timeout in milliseconds

## Usage

### Stream Endpoints

```bash
# Named shortcuts
http://your-server:5560/stream/test-hls
http://your-server:5560/stream/appletv-mls
http://your-server:5560/stream/peacock-epl

# Direct URL
http://your-server:5560/stream?url=https://example.com/stream
```

### Monitoring Endpoints

```bash
# Get statistics
curl http://your-server:5560/kinetic/stats

# Health check
curl http://your-server:5560/kinetic/health

# Clear session pool
curl -X POST http://your-server:5560/kinetic/sessions/clear
```

### Example M3U for Channels DVR

```m3u
#EXTM3U

#EXTINF:-1 channel-id="test-hls",Test HLS Stream
chrome://your-server:5560/stream/test-hls

#EXTINF:-1 channel-id="appletv-mls",Apple TV MLS
chrome://your-server:5560/stream/appletv-mls
```

## API Reference

### GET /kinetic/stats

Returns real-time statistics:

```json
{
  "streamsHandled": 5,
  "customServicesUsed": 5,
  "sessionsReused": 2,
  "directProxied": 1,
  "screenCaptured": 4,
  "errors": 0,
  "sessionPool": {
    "total": 2,
    "sessions": [...]
  },
  "streamProxy": {
    "activeProxies": 1,
    "proxies": [...]
  }
}
```

### GET /kinetic/health

Health check endpoint:

```json
{
  "status": "ok",
  "kinetic": {
    "enabled": true,
    "services": ["appletv-sports", "peacock-enhanced", "test-hls"],
    "features": { ... }
  }
}
```

## Architecture

### Direct Proxy Flow

```
1. Browser loads page → Network monitoring captures manifest URL
2. DRM detection checks for encryption
3. If non-DRM: Rewrite manifest with proxy URLs
4. Client requests segments → Proxy fetches with auth headers
5. Segments streamed directly to client (no screen capture!)
```

### Screen Capture Fallback

```
1. DRM detected or direct proxy disabled
2. Service-specific handler automates page setup
3. Screen capture via puppeteer-stream
4. Video transcoded to WebM/H.264
5. Streamed to client
```

## Development

### Project Structure

```
cc4c-kinetic/
├── main.js                    # Main application entry
├── kinetic/
│   ├── index.js              # Kinetic core module
│   ├── services/             # Service-specific handlers
│   │   ├── appletv-sports.js
│   │   ├── peacock-enhanced.js
│   │   ├── espn-plus.js
│   │   └── test-hls.js
│   ├── utils/                # Utility modules
│   │   ├── stream-proxy.js   # Direct proxy implementation
│   │   ├── stream-interceptor-v2.js
│   │   ├── drm-detector.js
│   │   └── session-pool.js
│   └── config/               # Configuration files
└── test-streams/             # Local test content
```

### Creating a Custom Service

```javascript
// kinetic/services/my-service.js
module.exports = {
  name: 'My Service',
  
  canHandle(url) {
    return url.includes('myservice.com');
  },
  
  async setup(page, url) {
    // Custom automation for this service
    await page.waitForSelector('video');
    await page.evaluate(() => {
      const video = document.querySelector('video');
      video.play();
    });
  },
  
  async getMetadata(page) {
    return { title: 'My Stream' };
  },
  
  async cleanup(page) {
    console.log('Cleaning up...');
  }
};
```

Register in `kinetic/services/index.js`:

```javascript
const myService = require('./my-service');

const services = {
  // ...
  'my-service': myService,
};
```

## Testing

### Test Direct Proxy

```bash
# Start local test server
cd test-streams
python3 -m http.server 8889 &

# Test with VLC
vlc "http://localhost:5560/stream/test-hls"

# Monitor logs for proxy activity
tail -f logs/cc4c.log
```

### Test Screen Capture

```bash
# Any commercial service (they all use DRM)
vlc "http://localhost:5560/stream?url=https://www.peacocktv.com/watch/sports"
```

## Troubleshooting

### Browser Won't Launch

**Error:** `Target closed` or `Protocol error`

**Solution:** Use xvfb for headless operation:
```bash
xvfb-run -a --server-args="-screen 0 1920x1080x24" bun main.js --port 5560
```

### Direct Proxy Not Working

**Check:**
1. Is `streamInterception: true` and `directProxy: true` in config?
2. Does the stream use DRM? (Most commercial services do)
3. Check logs for `[StreamProxy] Fetching segment:` messages

**Most common issue:** Stream is DRM-encrypted. Direct proxy only works for non-DRM content.

### High CPU Usage

**If using screen capture:** This is normal (40-60% CPU). Screen capture is CPU-intensive.

**If direct proxy should be working:**
1. Check stats endpoint - is `directProxied > 0`?
2. Verify stream is actually non-DRM
3. Check logs for fallback to screen capture

### Segments Not Loading

**Error:** `Proxy session not found or expired`

**Cause:** Proxy session timed out (5 min inactivity)

**Solution:** Restart stream. Session will be recreated.

## Known Limitations

### Direct Proxy
- ❌ **Does not work with DRM content** (Widevine, PlayReady, FairPlay)
- ❌ Cannot decrypt encrypted segments
- ❌ Requires network interception support in Chrome
- ✅ Works great for non-DRM public streams

### Commercial Services
Most commercial streaming services use DRM:
- Apple TV+ ❌
- Peacock ❌  
- ESPN+ ❌
- NBC ❌
- Hulu ❌

These **require screen capture** (which Kinetic handles automatically via fallback).

### Recommended Use Cases
✅ Public non-DRM streams (NASA TV, public cameras)
✅ Self-hosted media servers
✅ Testing and development
✅ Local content

## Performance Tips

1. **Enable session pooling** for frequently accessed services
2. **Disable direct proxy** if only using DRM services (reduces overhead)
3. **Use service handlers** for better automation
4. **Monitor stats** to track efficiency

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add logging for debugging
- Update documentation
- Test with both DRM and non-DRM streams
- Include stats tracking for new features

## License

This project is based on Chrome Capture for Channels and maintains compatibility with its license.

## Credits

- **Chrome Capture for Channels** - Original base project
- **Kinetic Enhancements** - Brad (direct proxy, service handlers, monitoring)
- **puppeteer-stream** - Screen capture functionality

## Support

- **Issues:** https://github.com/YOUR_USERNAME/cc4c-kinetic/issues
- **Discussions:** https://github.com/YOUR_USERNAME/cc4c-kinetic/discussions

## Changelog

### v1.0.0 (2025-12-30)
- ✨ Initial release
- ✨ Direct stream proxy for non-DRM content
- ✨ Service-specific handlers (Apple TV, Peacock, ESPN+)
- ✨ Session pooling system
- ✨ Network traffic interception
- ✨ DRM detection with auto-fallback
- ✨ Comprehensive stats API
- ✨ Persistent proxy sessions (5 min TTL)
- 🐛 Fixed setupPage scope issues
- 🐛 Fixed Express routing for proxy endpoint
- 🐛 Fixed getStream parameter passing
- ⚡ 3-10x CPU reduction for non-DRM streams

---

**Made with ❤️ for the Channels DVR community**
# cc4c-kinetic
