# Kinetic Setup Guide for bradmini.lan

## Quick Setup

### 1. Copy Kinetic to your CC4CKINETIC project

```bash
# On your local machine or directly on bradmini
cd /home/brad/Projects/CC4CKINETIC

# The kinetic/ folder should be placed here:
# /home/brad/Projects/CC4CKINETIC/kinetic/
```

### 2. Verify Structure

Your directory should look like:

```
/home/brad/Projects/CC4CKINETIC/
├── main.js                 # Original CC4C
├── package.json            # Original CC4C
├── bun.lock
├── Dockerfile
├── kinetic/                # ← New Kinetic module
│   ├── services/
│   │   ├── index.js
│   │   ├── appletv-sports.js
│   │   ├── peacock-enhanced.js
│   │   └── espn-plus.js
│   ├── utils/
│   │   ├── session-pool.js
│   │   ├── drm-detector.js
│   │   └── stream-interceptor.js
│   ├── config/
│   │   └── bradmini.json
│   ├── index.js
│   ├── package.json
│   ├── integration.example.js
│   └── README.md
└── ... other files
```

### 3. Test Kinetic Module

```bash
cd /home/brad/Projects/CC4CKINETIC

# Test loading the module
bun -e "const kinetic = require('./kinetic'); console.log('Kinetic loaded:', kinetic.config.server)"
```

### 4. Basic Integration (Minimal Changes)

Add this to your `main.js` right after the requires at the top:

```javascript
// Load Kinetic enhancements
const kinetic = require('./kinetic');
console.log('[Kinetic] Loaded with services:', Object.keys(kinetic.services.getAll()));
```

Then in your `/stream` endpoint handler, add this check:

```javascript
app.get('/stream{/:name}', async (req, res) => {
  var u = req.query.url
  let name = req.params.name
  
  if (name) {
    u = {
      // ... your existing name mappings ...
      
      // Add Kinetic shortcuts
      'appletv-mls': 'https://tv.apple.com/sport/mls/live',
      'peacock-sports': 'https://www.peacocktv.com/watch/sports',
    }[name]
  }

  // Check if Kinetic should handle this
  if (kinetic.shouldHandle(u)) {
    console.log('[Main] Using Kinetic handler for:', u);
    try {
      await kinetic.handleStream(
        u,
        await getCurrentBrowser(),
        setupPage,
        getStream,
        encodingParams,
        req,
        res
      );
      return; // Important: return after Kinetic handles it
    } catch (error) {
      console.error('[Main] Kinetic failed, using default:', error.message);
      // Fall through to default handler
    }
  }

  // Original CC4C handler
  await handleStreamRequest(req, res, u)
})
```

### 5. Add Kinetic Stats Endpoint

Add this route to see Kinetic statistics:

```javascript
app.get('/kinetic/stats', (req, res) => {
  res.json(kinetic.getStats());
});
```

### 6. Test It

```bash
# Start CC4C with Kinetic
cd /home/brad/Projects/CC4CKINETIC
bun main.js --port 5589

# In another terminal, test a stream
curl http://localhost:5589/stream?url=https://www.peacocktv.com/watch/sports

# Check Kinetic stats
curl http://localhost:5589/kinetic/stats
```

### 7. Docker Deployment (Optional)

If using Docker, add Kinetic to your Dockerfile:

```dockerfile
# Your existing Dockerfile...

# Copy Kinetic module
COPY kinetic/ /app/kinetic/

# Rest of your Dockerfile...
```

Then rebuild:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

## Configuration

Edit `kinetic/config/bradmini.json` to customize:

### Enable/Disable Services

```json
{
  "services": {
    "appletv-sports": {
      "enabled": true,      // ← Set to false to disable
      "sessionReuse": true
    }
  }
}
```

### Adjust Performance

```json
{
  "capture": {
    "videoBitrate": 8000000,  // 8 Mbps
    "audioBitrate": 256000,   // 256 kbps
    "frameRate": 60,          // 60 fps
    "width": 1920,
    "height": 1080
  }
}
```

### Enable Features

```json
{
  "features": {
    "drmDetection": true,        // Detect DRM streams
    "sessionPooling": true,      // Reuse browser sessions
    "streamInterception": false, // Try to extract stream URLs (experimental)
    "metrics": true              // Track statistics
  }
}
```

## Testing Individual Services

### Test Apple TV Sports

```bash
curl "http://bradmini.lan:5589/stream?url=https://tv.apple.com/sport/mls/live"
```

### Test Peacock

```bash
curl "http://bradmini.lan:5589/stream?url=https://www.peacocktv.com/watch/sports"
```

### Test ESPN+

```bash
curl "http://bradmini.lan:5589/stream?url=https://www.espn.com/watch/espnplus"
```

## Integration with FruitDeepLinks

In your FruitDeepLinks M3U generator:

```javascript
const KINETIC_BASE = 'http://bradmini.lan:5589';

// For each Apple TV Sports event:
events.forEach(event => {
  m3u += `#EXTINF:-1 tvg-id="${event.id}",${event.title}\n`;
  m3u += `chrome://${KINETIC_BASE}/stream?url=${encodeURIComponent(event.streamUrl)}\n`;
});
```

## Monitoring

### Check Session Pool Status

```bash
curl http://bradmini.lan:5589/kinetic/stats
```

### Clear Session Pool

```bash
curl -X POST http://bradmini.lan:5589/kinetic/sessions/clear
```

### Health Check

```bash
curl http://bradmini.lan:5589/kinetic/health
```

## Troubleshooting

### Kinetic not loading

```bash
# Check if module exists
ls -la /home/brad/Projects/CC4CKINETIC/kinetic/

# Test loading
cd /home/brad/Projects/CC4CKINETIC
bun -e "console.log(require('./kinetic'))"
```

### Service not being used

- Check `kinetic/config/bradmini.json` - ensure service is enabled
- Check logs for "[Kinetic] Using X handler" messages
- Verify URL matches the `canHandle()` logic in service file

### Session not reusing

- Ensure `sessionReuse: true` in config for that service
- Ensure `sessionPooling: true` in features
- Check session pool stats: `curl http://localhost:5589/kinetic/stats`

## Next Steps

1. ✅ Copy kinetic/ folder to `/home/brad/Projects/CC4CKINETIC/`
2. ✅ Add basic integration to main.js
3. ✅ Test with a simple stream
4. ✅ Monitor stats endpoint
5. ✅ Integrate with FruitDeepLinks
6. 📝 Add more services as needed

## Adding Your Own Service

1. Create `kinetic/services/my-service.js`
2. Implement `canHandle()` and `setup()` functions
3. Register in `kinetic/services/index.js`
4. Enable in `kinetic/config/bradmini.json`
5. Test!

See `kinetic/README.md` for detailed API documentation.
