const phimapiService = require('../services/phimapiService');

// Proxy: TMDB movie lookup
const tmdbMovieLookup = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await phimapiService.proxyTmdbMovie(id);
        res.json(data);
    } catch (e) {
        if (e.response) {
            res.status(e.response.status).json(e.response.data);
        } else {
            console.error('Phimapi TMDB proxy error:', e.message);
            res.status(500).json({ error: 'Proxy error' });
        }
    }
};

// Proxy: Search
const search = async (req, res) => {
    try {
        const { keyword, year } = req.query;
        if (!keyword) {
            return res.status(400).json({ error: 'Missing keyword parameter' });
        }

        const data = await phimapiService.searchPhimapi(keyword, year);
        res.json(data);
    } catch (e) {
        if (e.response) {
            res.status(e.response.status).json(e.response.data);
        } else {
            console.error('Phimapi search proxy error:', e.message);
            res.status(500).json({ error: 'Proxy error' });
        }
    }
};

// Proxy: Movie/TV detail by slug
const getDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        const data = await phimapiService.getDetail(slug);
        res.json(data);
    } catch (e) {
        if (e.response) {
            res.status(e.response.status).json(e.response.data);
        } else {
            console.error('Phimapi detail proxy error:', e.message);
            res.status(500).json({ error: 'Proxy error' });
        }
    }
};

module.exports = {
    tmdbMovieLookup,
    search,
    getDetail
};
