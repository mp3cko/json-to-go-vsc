/**
 * JSON to Go extension for VS Code.
 *
 * Date: March 2025
 * Author: Mario Petričko
 * GitHub: http://github.com/maracko/json-to-go-vsc
 *
 * Apache License
 * Version 2.0, January 2004
 * http://www.apache.org/licenses/
 *
 */

/**
 * A simple in-memory cache with TTL support and optional automatic cleanup of expired items on a set interval
 */
class Cache {
  #cache;
  #defaultTTL;
  #cleanupTimer;

  /**
   * @param {number|null} defaultTTL - Default time to live in seconds, null for no expiry
   * @param {number} cleanupInterval - Interval in seconds to clean up expired entries,null or 0 for no automatic cleanup (default: 60s)
   */
  constructor(defaultTTL = null, cleanupInterval = 60) {
    if (defaultTTL !== null && !this.#isPositiveNumber(defaultTTL)) {
      throw new Error(
        `Invalid defaultTTL(${defaultTTL}), must be a positive integer or null`,
      );
    }
    this.#defaultTTL = defaultTTL;
    this.#cache = new Map();

    if (this.#isPositiveNumber(cleanupInterval)) {
      this.startCleanup(cleanupInterval);
    }
  }

  /**
   * Set a value in the cache
   * @param {string} key - The cache key
   * @param {any} val - The value to store
   * @param {number|null|undefined} ttl - Time to live in seconds, null for no expiry, undefined to use default TTL
   * @returns {boolean} - Success status
   */
  set(key, val, ttl) {
    try {
      let expiry;
      switch (ttl) {
      case null:
        expiry = null;
        break;
      case undefined:
        // Use default TTL if set
        expiry = this.#defaultTTL
          ? Date.now() + this.#defaultTTL * 1000
          : null;
        break;
      default:
        if (!this.#isPositiveNumber(ttl)) {
          throw new Error(
            `Invalid TTL(${ttl}), must be a positive integer, null, or undefined`,
          );
        }
        expiry = Date.now() + ttl * 1000;
        break;
      }

      this.#cache.set(key, {
        value: val,
        expiry,
      });

      return true;
    } catch (error) {
      console.error('Cache set error:', error);

      return false;
    }
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {any|undefined} - The cached value or undefined if not found or expired
   */
  get(key) {
    if (!this.#cache.has(key)) {
      return undefined;
    }

    if (this.#isExpired(key)) {
      this.delete(key);

      return undefined;
    }

    return this.#cache.get(key).value;
  }

  /**
   * Delete an item from the cache
   * @param {string} key - The cache key
   * @returns {boolean} - True if item was deleted, false if it didn't exist
   */
  delete(key) {
    return this.#cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.#cache.clear();
  }

  /**
   * Implement the vscode Disposable interface
   */
  dispose() {
    this.stopCleanup();
    this.clear();
  }

  /**
   * Get the number of items in the cache
   * @returns {number} - Number of items
   */
  size() {
    return this.#cache.size;
  }

  /**
   * Check if a key exists in cache
   * @param {string} key - The cache key
   * @returns {boolean} - True if the key exists and is not expired
   */
  has(key) {
    return this.#cache.has(key) && !this.#isExpired(key);
  }

  /**
   * Get all valid keys in the cache
   * @returns {string[]} - Array of non-expired keys
   */
  keys() {
    const keys = [];
    for (const key of this.#cache.keys()) {
      if (this.has(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Stop the automatic cleanup process
   * @returns {boolean} - True if cleanup was stopped, false if it was not running
   */
  startCleanup(interval = 60) {
    if (!this.#isPositiveNumber(interval)) {
      throw new Error(
        `Invalid startCleanup() interval(${interval}), must be a positive integer`,
      );
    }

    this.stopCleanup();

    this.#cleanupTimer = setInterval(
      () => this.#cleanExpired(),
      interval * 1000,
    );
  }

  /**
   * Stop the automatic cleanup process
   * @returns {boolean} - True if cleanup was stopped, false if it was not running
   */
  stopCleanup() {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;

      return true;
    }

    return false;
  }

  #isPositiveNumber(val) {
    return typeof val === 'number' && !isNaN(val) && val > 0;
  }

  /**
   * Check if an item has expired
   * @param {string} key - The cache key
   * @returns {boolean} - True if item has expired
   * @private
   */
  #isExpired(key) {
    const item = this.#cache.get(key);
    if (item.expiry === null) {
      return false;
    }

    return item.expiry < Date.now();
  }

  /**
   * Remove all expired items from the cache
   * @returns {number} - Number of removed items
   */
  #cleanExpired() {
    let removed = 0;
    for (const key of this.#cache.keys()) {
      if (this.#isExpired(key)) {
        this.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

module.exports = Cache;
