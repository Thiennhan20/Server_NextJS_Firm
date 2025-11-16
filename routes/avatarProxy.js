const express = require('express');
const router = express.Router();
const axios = require('axios');
const { optimizeAvatar } = require('../utils/avatarOptimizer');

// In-memory cache for proxied avatars (production should use Redis)
const avatarCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Proxy endpoint for external avatars (Google, Facebook)
 * Caches and optimizes external images
 */
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ message: 'URL parameter is required' });
    }

    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ message: 'Invalid URL' });
    }

    // Check cache
    const cached = avatarCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Avatar cache HIT:', url.substring(0, 50));
      res.set('X-Cache', 'HIT');
      res.set('Content-Type', 'image/webp');
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      return res.send(cached.buffer);
    }

    console.log('Avatar cache MISS, fetching:', url.substring(0, 50));

    // Fetch from external URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Optimize image
    const optimized = await optimizeAvatar(Buffer.from(response.data));
    
    // Extract buffer from base64
    const base64Data = optimized.replace(/^data:image\/webp;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Cache it
    avatarCache.set(url, {
      buffer,
      timestamp: Date.now()
    });

    // Clean old cache entries (simple LRU)
    if (avatarCache.size > 1000) {
      const firstKey = avatarCache.keys().next().value;
      avatarCache.delete(firstKey);
    }

    res.set('X-Cache', 'MISS');
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.send(buffer);

  } catch (error) {
    console.error('Avatar proxy error:', error.message);
    res.status(500).json({ 
      message: 'Failed to proxy avatar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Clear cache endpoint (for admin/debugging)
 */
router.post('/clear-cache', (req, res) => {
  const size = avatarCache.size;
  avatarCache.clear();
  res.json({ 
    message: 'Avatar cache cleared',
    entriesCleared: size
  });
});

module.exports = router;
