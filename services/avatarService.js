const axios = require('axios');
const { optimizeAvatar } = require('../utils/avatarOptimizer');

// In-memory cache for proxied avatars (production should use Redis)
const avatarCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function proxyAndOptimizeAvatar(url) {
    // Check cache
    const cached = avatarCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('Avatar cache HIT:', url.substring(0, 50));
        return { buffer: cached.buffer, fromCache: true };
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

    return { buffer, fromCache: false };
}

function clearAvatarCache() {
    const size = avatarCache.size;
    avatarCache.clear();
    return size;
}

module.exports = {
    proxyAndOptimizeAvatar,
    clearAvatarCache
};
