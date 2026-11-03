const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all origins (supports GitHub Pages or local testing)
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Instagram Reel Downloader Backend API is running smoothly.'
  });
});

/**
 * Endpoint: GET /api/resolve?url=<instagram_reel_url>
 * Proxies request to https://igdl.app/api/resolve/?u=<encoded_url>
 */
app.get('/api/resolve', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Missing required query parameter: url'
    });
  }

  // Basic check for Instagram domain
  const isInstagramUrl = /(?:instagram\.com)\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i.test(url);
  if (!isInstagramUrl) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Instagram URL format. Expected a reel, post, or tv link.'
    });
  }

  try {
    const targetUrl = `https://igdl.app/api/resolve/?u=${encodeURIComponent(url)}`;

    // Using native global fetch available in Node.js 18+
    const apiResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        success: false,
        error: `Third-party service error (${apiResponse.status}). Please try again later.`
      });
    }

    const data = await apiResponse.json();

    // Pass data directly to client
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in /api/resolve proxy:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve reel details from provider. Please check if the reel is public or try again later.'
    });
  }
});

/**
 * Endpoint: GET /api/download?url=<media_url>&filename=<name>
 * Stream file with Content-Disposition attachment so browser immediately triggers download
 */
app.get('/api/download', async (req, res) => {
  const { url, filename } = req.query;

  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const fileRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!fileRes.ok) {
      return res.redirect(url);
    }

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const safeFilename = (filename || 'instagram_media').replace(/[^a-zA-Z0-9_.-]/g, '_');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    // Stream native web stream into express response
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    console.error('Error in proxy download:', err);
    // Fallback: redirect browser directly to url
    return res.redirect(url);
  }
});

// Port configuration for Render (falls back to 3000 locally)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
