const tmdbService = require('../services/tmdbService');

// TMDB proxy route
const proxyTmdbRequest = async (req, res) => {
    try {
        const { endpoint, ...params } = req.query;

        const result = await tmdbService.fetchFromTmdb(endpoint, params);

        if (result.fromCache) {
            res.set({ 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
            return res.json(result.data);
        }

        res.set({
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            'Content-Type': 'application/json',
            'X-Cache': 'MISS'
        });

        res.json(result.data);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                error: error.error,
                details: error.details
            });
        }
        console.error('💥 TMDB API error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

module.exports = {
    proxyTmdbRequest
};
