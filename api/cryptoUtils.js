const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

/**
 * Hash a password using Node's built-in scrypt algorithm.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Scrambled password in `salt:hash` format
 */
async function hashPassword(password) {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash (or old plaintext password).
 * @param {string} password - Plaintext password input
 * @param {string} storedHash - Stored string from database
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    // Backward-compatibility: allow old plaintext passwords to log in
    return password === storedHash;
  }
  const [salt, hash] = parts;
  const derivedKey = await scrypt(password, salt, 64);
  return derivedKey.toString('hex') === hash;
}

module.exports = { hashPassword, verifyPassword };
