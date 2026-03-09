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

function invalidateCache(userId) {
    cacheStore.delete(String(userId));
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

module.exports = {
    setCache,
    getCache,
    invalidateCache,
    rateLimit,
    projectClean,
    validateUpsert
};
