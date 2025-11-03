const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WatchProgress = require('../models/WatchProgress');

// Simple in-memory cache with TTL (30s)
const cacheStore = new Map(); // key: userId, value: { data, exp }
const TTL_MS = 30 * 1000;

function setCache(userId, data) {
  cacheStore.set(String(userId), { data, exp: Date.now() + TTL_MS });
}

function getCache(userId) {
  const entry = cacheStore.get(String(userId));
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    cacheStore.delete(String(userId));
    return null;
  }
  return entry.data;
}

// Very light rate limiter per user (60 req/min)
const rateBuckets = new Map(); // key: userId|ip, value: { count, resetAt }
const LIMIT_PER_MIN = 60;

function rateLimit(key) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now + 60 * 1000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60 * 1000;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= LIMIT_PER_MIN;
}

function projectClean(query) {
  return query.select('-__v -createdAt -updatedAt');
}

function validateUpsert(body) {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('INVALID_BODY');
  if (!body.contentId) errors.push('CONTENT_ID_REQUIRED');
  if (!body.server) errors.push('SERVER_REQUIRED');
  if (!body.audio) errors.push('AUDIO_REQUIRED');
  if (typeof body.currentTime !== 'number') errors.push('CURRENT_TIME_NUMBER');
  if (body.isTVShow && (typeof body.season !== 'number' || typeof body.episode !== 'number')) {
    errors.push('SEASON_EPISODE_REQUIRED');
  }
  return errors;
}

// Get list for current user (most recent first, limited)
router.get('/', auth, async (req, res) => {
  try {
    // rate limiting per user
    if (!rateLimit(`GET:${req.user}`)) {
      return res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests' });
    }

    const { contentId, isTVShow, season, episode, server, audio } = req.query;
    if (contentId && server && audio) {
      // Return single item if filters provided
      const filter = {
        userId: req.user,
        contentId,
        isTVShow: isTVShow === 'true',
        season: season ? Number(season) : null,
        episode: episode ? Number(episode) : null,
        server,
        audio,
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
});

// Upsert progress
router.post('/', auth, async (req, res) => {
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

    // If very close to end, delete the record instead of saving
    if (duration && duration > 0 && duration - currentTime <= 240) {
      await WatchProgress.deleteOne({
        userId: req.user,
        contentId,
        isTVShow,
        season,
        episode,
        server,
        audio,
      });
      cacheStore.delete(String(req.user));
      return res.json({ removed: true });
    }

    const filter = { userId: req.user, contentId, isTVShow, season, episode, server, audio };
    const update = {
      $set: {
        currentTime,
        duration: duration || 0,
        title,
        poster,
        lastWatched: new Date(),
      },
    };

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    const doc = await projectClean(WatchProgress.findOneAndUpdate(filter, update, opts)).lean();
    cacheStore.delete(String(req.user));
    res.json({ item: doc });
  } catch (e) {
    console.error('recently-watched POST error:', e);
    res.status(500).json({ code: 'UPSERT_FAILED', message: 'Failed to save progress' });
  }
});

// Delete an item
router.delete('/', auth, async (req, res) => {
  try {
    const { contentId, isTVShow = false, season = null, episode = null, server, audio } = req.body || {};
    if (!contentId || !server || !audio) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: ['CONTENT_ID_REQUIRED','SERVER_REQUIRED','AUDIO_REQUIRED'] });
    }
    await WatchProgress.deleteOne({ userId: req.user, contentId, isTVShow, season, episode, server, audio });
    cacheStore.delete(String(req.user));
    res.json({ ok: true });
  } catch (e) {
    console.error('recently-watched DELETE error:', e);
    res.status(500).json({ code: 'DELETE_FAILED', message: 'Failed to remove item' });
  }
});

// Batch delete (bulkWrite) for better performance
router.post('/batch-delete', auth, async (req, res) => {
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
          server: it.server,
          audio: it.audio,
        }
      }
    }));
    const result = await WatchProgress.bulkWrite(ops, { ordered: false });
    cacheStore.delete(String(req.user));
    res.json({ ok: true, deleted: result?.deletedCount || 0 });
  } catch (e) {
    console.error('recently-watched BATCH_DELETE error:', e);
    res.status(500).json({ code: 'BATCH_DELETE_FAILED', message: 'Failed to remove items' });
  }
});

module.exports = router;


