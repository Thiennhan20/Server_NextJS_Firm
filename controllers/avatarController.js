const avatarService = require('../services/avatarService');

// Proxy endpoint for external avatars (Google)
const proxyAvatar = async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ message: 'URL parameter is required' });
        }

        // Validate URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return res.status(400).json({ message: 'Invalid URL' });
        }

        const result = await avatarService.proxyAndOptimizeAvatar(url);

        res.set('X-Cache', result.fromCache ? 'HIT' : 'MISS');
        res.set('Content-Type', 'image/webp');
        res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.send(result.buffer);

    } catch (error) {
        console.error('Avatar proxy error:', error.message);
        res.status(500).json({
            message: 'Failed to proxy avatar',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Clear cache endpoint (for admin/debugging)
const clearCache = (req, res) => {
    const entriesCleared = avatarService.clearAvatarCache();
    res.json({
        message: 'Avatar cache cleared',
        entriesCleared
    });
};

module.exports = {
    proxyAvatar,
    clearCache
};
