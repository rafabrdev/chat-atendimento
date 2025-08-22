const NodeCache = require('node-cache');

// Create cache instance with TTL of 5 minutes
const cache = new NodeCache({ stdTTL: 300 });

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const key = req.originalUrl || req.url;
    
    // Check if we have cached data
    const cachedData = cache.get(key);
    
    if (cachedData) {
      // Return cached data
      return res.json(cachedData);
    }
    
    // Store original res.json function
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, data, duration);
      }
      
      // Call original json function
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Function to clear cache for specific patterns
const clearCache = (pattern) => {
  const keys = cache.keys();
  const keysToDelete = pattern 
    ? keys.filter(key => key.includes(pattern))
    : keys;
  
  keysToDelete.forEach(key => cache.del(key));
  
  return keysToDelete.length;
};

// Function to clear all cache
const clearAllCache = () => {
  cache.flushAll();
};

// Get cache statistics
const getCacheStats = () => {
  return cache.getStats();
};

module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
  getCacheStats,
  cache
};
