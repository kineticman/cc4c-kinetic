// kinetic-integration.example.js
// Example of how to integrate Kinetic into CC4C main.js

const kinetic = require('./kinetic');

/**
 * INTEGRATION APPROACH #1: Wrapper Function
 * 
 * Wrap the existing handleStreamRequest to add Kinetic support
 */
function wrapHandleStreamRequest(originalHandleStreamRequest) {
  return async function handleStreamRequest(req, res, url) {
    // Check if Kinetic should handle this URL
    if (kinetic.shouldHandle(url)) {
      console.log('[Kinetic] Taking over stream handling for:', url);
      
      try {
        await kinetic.handleStream(
          url,
          browser,            // Your browser instance
          setupPage,          // Your setupPage function
          getStream,          // getStream from puppeteer-stream
          encodingParams,     // Your encoding params
          req,
          res
        );
      } catch (error) {
        console.error('[Kinetic] Handler failed, falling back to default:', error.message);
        // Fall back to original handler on error
        return await originalHandleStreamRequest(req, res, url);
      }
    } else {
      // Use original CC4C handler
      return await originalHandleStreamRequest(req, res, url);
    }
  };
}

/**
 * INTEGRATION APPROACH #2: Add Kinetic Routes
 * 
 * Add dedicated Kinetic endpoints to Express app
 */
function addKineticRoutes(app) {
  // Kinetic-specific stream endpoint
  app.get('/kinetic/stream', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).send('Missing url parameter');
    }
    
    if (!kinetic.shouldHandle(url)) {
      return res.status(400).send('URL not supported by Kinetic handlers');
    }
    
    try {
      await kinetic.handleStream(
        url,
        await getCurrentBrowser(),
        setupPage,
        getStream,
        encodingParams,
        req,
        res
      );
    } catch (error) {
      console.error('[Kinetic] Stream failed:', error);
      res.status(500).send(`Kinetic stream failed: ${error.message}`);
    }
  });
  
  // Kinetic stats endpoint
  app.get('/kinetic/stats', (req, res) => {
    res.json(kinetic.getStats());
  });
  
  // Kinetic metadata endpoint
  app.get('/kinetic/metadata', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).send('Missing url parameter');
    }
    
    try {
      const browser = await getCurrentBrowser();
      const page = await browser.newPage();
      await page.goto(url);
      
      const metadata = await kinetic.getMetadata(url, page);
      await page.close();
      
      res.json(metadata || {error: 'No metadata available'});
    } catch (error) {
      res.status(500).json({error: error.message});
    }
  });
  
  // Session pool management
  app.post('/kinetic/sessions/clear', async (req, res) => {
    await kinetic.cleanup();
    res.json({success: true, message: 'Session pool cleared'});
  });
  
  app.get('/kinetic/sessions', (req, res) => {
    res.json(kinetic.sessionPool.getStats());
  });
  
  // Health check
  app.get('/kinetic/health', (req, res) => {
    res.json({
      status: 'ok',
      kinetic: {
        enabled: true,
        services: Object.keys(kinetic.config.services).filter(
          s => kinetic.config.services[s].enabled
        ),
        features: kinetic.config.features,
      }
    });
  });
}

/**
 * INTEGRATION APPROACH #3: Service Name Mapping
 * 
 * Add Kinetic services to the stream name mapping
 */
function getKineticStreamNames() {
  return {
    // Apple TV Sports
    'appletv-nba': 'https://tv.apple.com/sport/nba/live',
    'appletv-mlb': 'https://tv.apple.com/sport/mlb/live',
    'appletv-mls': 'https://tv.apple.com/sport/mls/live',
    'appletv-nhl': 'https://tv.apple.com/sport/nhl/live',
    
    // Peacock Sports
    'peacock-nbc-sports': 'https://www.peacocktv.com/watch/sports/nbc-sports',
    'peacock-premier-league': 'https://www.peacocktv.com/watch/sports/premier-league',
    
    // ESPN+
    'espn-plus': 'https://www.espn.com/watch/espnplus',
  };
}

/**
 * Example main.js modifications
 */
function exampleMainJsIntegration() {
  // At the top of main.js, after requires:
  const kinetic = require('./kinetic');
  
  // In your app setup, add Kinetic routes:
  addKineticRoutes(app);
  
  // In your stream name mapping:
  const streamNames = {
    // Original CC4C streams
    nbc: 'https://www.nbc.com/live?brand=nbc&callsign=nbc',
    // ... other streams ...
    
    // Add Kinetic streams
    ...getKineticStreamNames(),
  };
  
  // In your /stream endpoint:
  app.get('/stream{/:name}', async (req, res) => {
    let url = req.query.url || streamNames[req.params.name];
    
    // Let Kinetic handle if appropriate
    if (kinetic.shouldHandle(url)) {
      return await kinetic.handleStream(
        url,
        await getCurrentBrowser(),
        setupPage,
        getStream,
        encodingParams,
        req,
        res
      );
    }
    
    // Otherwise use original CC4C logic
    return await handleStreamRequest(req, res, url);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await kinetic.cleanup();
    process.exit(0);
  });
}

/**
 * Example M3U generation with Kinetic
 */
function generateM3UWithKinetic() {
  return `#EXTM3U

# Apple TV Sports via Kinetic
#EXTINF:-1 channel-id="appletv-mls" tvg-logo="mls.png",MLS Season Pass
chrome://bradmini.lan:5589/stream/appletv-mls

#EXTINF:-1 channel-id="appletv-mlb" tvg-logo="mlb.png",MLB on Apple TV
chrome://bradmini.lan:5589/stream/appletv-mlb

# Peacock Sports via Kinetic
#EXTINF:-1 channel-id="peacock-epl" tvg-logo="epl.png",Premier League
chrome://bradmini.lan:5589/stream/peacock-premier-league

# ESPN+ via Kinetic
#EXTINF:-1 channel-id="espn-plus" tvg-logo="espn.png",ESPN+
chrome://bradmini.lan:5589/stream/espn-plus

# Or use direct URLs
#EXTINF:-1 channel-id="custom-event",Custom Event
chrome://bradmini.lan:5589/stream?url=https://tv.apple.com/sport/event/12345
`;
}

module.exports = {
  wrapHandleStreamRequest,
  addKineticRoutes,
  getKineticStreamNames,
  exampleMainJsIntegration,
  generateM3UWithKinetic,
};
