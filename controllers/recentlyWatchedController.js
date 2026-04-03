const WatchProgress = require('../models/WatchProgress');
const { setCache, getCache, invalidateCache, rateLimit, projectClean, validateUpsert } = require('../services/recentlyWatchedService');

// Normalize server/audio to prevent duplicates from case/whitespace differences
function normalizeField(val) {
    if (!val || typeof val !== 'string') return val;
    return val.toLowerCase().replace(/\s/g, '');
}

// Get list for current user (most recent first, limited)
const getList = async (req, res) => {
    try {
        // rate limiting per user
        if (!rateLimit(`GET:${req.user}`)) {
            return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests' });
        }

        const { contentId, isTVShow, season, episode } = req.query;
        if (contentId) {
            // Return single item — only need content identity, not server/audio
            const filter = {
                userId: req.user,
                contentId,
                isTVShow: isTVShow === 'true',
                season: season ? Number(season) : null,
                episode: episode ? Number(episode) : null,
            };
            const item = await projectClean(WatchProgress.findOne(filter)).lean();
            return res.json({ item });
        }

        // Try cache first
        const cached = getCache(req.user);
        if (cached) return res.json({ items: cached });

        const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
        const items = await projectClean(WatchProgress.find({ userId: req.user }))
            .sort({ lastWatched: -1 })
            .limit(limit)
            .lean();
        setCache(req.user, items);
        res.json({ items });
    } catch (e) {
        console.error('recently-watched GET error:', e);
        res.status(500).json({ code: 'GET_FAILED', message: 'Failed to fetch recently watched' });
    }
};

// Upsert progress
const upsertProgress = async (req, res) => {
    try {
        // rate limiting per user
        if (!rateLimit(`POST:${req.user}`)) {
            return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests' });
        }

        const {
            contentId,
            isTVShow = false,
            season = null,
            episode = null,
            server,
            audio,
            currentTime,
            duration,
            title = '',
            poster = ''
        } = req.body || {};

        const errors = validateUpsert(req.body);
        if (errors.length) return res.status(400).json({ code: 'VALIDATION_ERROR', errors });

        // Normalize server/audio at backend (single source of truth)
        const normServer = normalizeField(server);
        const normAudio = normalizeField(audio);

        // Filter only by content identity (not server/audio)
        const filter = { userId: req.user, contentId, isTVShow, season, episode };

        const update = {
            $set: {
                currentTime,
                duration: duration || 0,
                server: normServer,
                audio: normAudio,
                title,
                poster,
                lastWatched: new Date(),
            },
        };

        const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
        const doc = await projectClean(WatchProgress.findOneAndUpdate(filter, update, opts)).lean();
        invalidateCache(req.user);
        res.json({ item: doc });
    } catch (e) {
        console.error('recently-watched POST error:', e);
        res.status(500).json({ code: 'UPSERT_FAILED', message: 'Failed to save progress' });
    }
};

// Delete an item
const deleteItem = async (req, res) => {
    try {
        const { contentId, isTVShow = false, season = null, episode = null } = req.body || {};
        if (!contentId) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', errors: ['CONTENT_ID_REQUIRED'] });
        }
        await WatchProgress.deleteOne({ userId: req.user, contentId, isTVShow, season, episode });
        invalidateCache(req.user);
        res.json({ ok: true });
    } catch (e) {
        console.error('recently-watched DELETE error:', e);
        res.status(500).json({ code: 'DELETE_FAILED', message: 'Failed to remove item' });
    }
};

// Batch delete (bulkWrite) for better performance
const batchDelete = async (req, res) => {
    try {
        if (!rateLimit(`BDEL:${req.user}`)) {
            return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests' });
        }
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ code: 'VALIDATION_ERROR', errors: ['ITEMS_REQUIRED'] });
        }
        const ops = items.map((it) => ({
            deleteOne: {
                filter: {
                    userId: req.user,
                    contentId: it.contentId,
                    isTVShow: !!it.isTVShow,
                    season: it.isTVShow ? (it.season ?? null) : null,
                    episode: it.isTVShow ? (it.episode ?? null) : null,
                }
            }
        }));
        const result = await WatchProgress.bulkWrite(ops, { ordered: false });
        invalidateCache(req.user);
        res.json({ ok: true, deleted: result?.deletedCount || 0 });
    } catch (e) {
        console.error('recently-watched BATCH_DELETE error:', e);
        res.status(500).json({ code: 'BATCH_DELETE_FAILED', message: 'Failed to remove items' });
    }
};

module.exports = {
    getList,
    upsertProgress,
    deleteItem,
    batchDelete
};
