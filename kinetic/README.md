# Kinetic - Enhanced CC4C Module

Kinetic is a modular enhancement system for Chrome Capture for Channels (CC4C) that provides:

- **Service-specific automation** for Apple TV Sports, Peacock, ESPN+, and more
- **Session pooling** for faster stream startup and reduced resource usage
- **DRM detection** to identify encrypted streams
- **Stream interception** for potential direct streaming (experimental)
- **Enhanced metadata extraction** for better EPG integration

## Directory Structure

```
kinetic/
├── services/           # Service-specific handlers
│   ├── index.js        # Service registry
│   ├── appletv-sports.js
│   ├── peacock-enhanced.js
│   └── espn-plus.js
├── utils/              # Utility modules
│   ├── session-pool.js
│   ├── drm-detector.js
│   └── stream-interceptor.js
├── config/             # Configuration files
│   └── bradmini.json
├── index.js            # Main Kinetic module
└── README.md           # This file
```

## Features

### Service-Specific Handlers

Each service has custom automation logic:

- **Apple TV Sports**: Fullscreen video, hide overlays, optimize playback
- **Peacock Enhanced**: Smart unmuting, quality selection, UI cleanup
- **ESPN+**: Video optimization, UI hiding

### Session Pooling

Reuses authenticated browser sessions for:
- Faster stream startup (no re-authentication)
- Lower resource usage
- Better reliability

### DRM Detection

Automatically detects if a stream uses DRM/EME:
- Checks for MediaKeys
- Listens for encrypted events
- Knows common DRM services

### Stream Interception (Experimental)

Attempts to capture actual stream URLs:
- Intercepts .m3u8 and .mpd manifests
- Extracts authentication headers
- Tests for direct streaming capability

## Configuration

Edit `config/bradmini.json` to customize:

```json
{
  "services": {
    "appletv-sports": {
      "enabled": true,
      "sessionReuse": true,
      "timeout": 30000
    }
  },
  "features": {
    "sessionPooling": true,
    "drmDetection": true,
    "streamInterception": false
  }
}
```

## Integration with Main CC4C

In your main CC4C code, integrate Kinetic like this:

```javascript
const kinetic = require('./kinetic');

// In your stream handler:
if (kinetic.shouldHandle(url)) {
  return await kinetic.handleStream(
    url, browser, setupPage, getStream, encodingParams, req, res
  );
}

// Or get stats:
app.get('/kinetic/stats', (req, res) => {
  res.json(kinetic.getStats());
});
```

## Adding New Services

Create a new service file in `services/`:

```javascript
// services/my-service.js
module.exports = {
  name: 'My Service',
  
  canHandle(url) {
    return url.includes('myservice.com');
  },
  
  async setup(page, url) {
    // Your automation logic
    await page.waitForSelector('video');
    // ... etc
  },
  
  async getMetadata(page) {
    // Extract metadata
    return {title: 'Event Name'};
  },
};
```

Then register it in `services/index.js`:

```javascript
const myService = require('./my-service');
const services = {
  'my-service': myService,
  // ... other services
};
```

## API Reference

### `kinetic.shouldHandle(url)`

Check if URL should use Kinetic handler.

**Returns:** `boolean`

### `kinetic.handleStream(url, browser, setupPage, getStream, encodingParams, req, res)`

Handle a stream request with Kinetic enhancements.

**Returns:** `Promise<{page, stream, service}>`

### `kinetic.getStats()`

Get Kinetic statistics including session pool info.

**Returns:** `object`

### `kinetic.getMetadata(url, page)`

Extract metadata for a stream.

**Returns:** `Promise<object>`

### `kinetic.cleanup()`

Cleanup all Kinetic resources (session pool, etc).

**Returns:** `Promise<void>`

## Session Pool Management

Sessions are automatically managed:
- **Timeout**: 30 minutes (configurable)
- **Periodic cleanup**: Every 5 minutes
- **Manual cleanup**: Call `kinetic.cleanup()`

## Performance Tips

1. **Enable session reuse** for frequently used services
2. **Set appropriate timeouts** per service
3. **Use hardware acceleration** in config
4. **Monitor with** `/kinetic/stats` endpoint

## Future Enhancements

- [ ] Direct stream URL proxying for non-DRM content
- [ ] Multi-quality capture selection
- [ ] Advanced error recovery
- [ ] Service health monitoring
- [ ] Auto-configuration based on detected capabilities

## Integration with FruitDeepLinks

Perfect combo with your Apple TV Sports scraper:

```javascript
// In FruitDeepLinks M3U generator
const events = await getAppleTVEvents();
events.forEach(event => {
  m3u += `#EXTINF:-1 tvg-id="${event.id}",${event.title}\n`;
  m3u += `chrome://bradmini.lan:5589/stream?url=${event.streamUrl}\n`;
});
```

## Troubleshooting

### Session not reusing
- Check `sessionReuse: true` in config
- Verify `sessionPooling: true` in features
- Check logs for session timeout messages

### Service not being used
- Verify service `enabled: true` in config
- Check `canHandle()` logic matches your URL
- Review console logs for service detection

### DRM detection failing
- DRM detection is informational only
- All streams still use screen capture by default
- Check logs for DRM detection results

## License

Part of Chrome Capture for Channels - follows upstream license.
