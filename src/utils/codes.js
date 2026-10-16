const crypto = require('node:crypto');

// No ambiguous characters (0/O, 1/I) since staff read codes aloud at the door.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Cryptographically random code. 32^6 combinations (~1 billion) means one
// code cannot be guessed from another.
function genCode(length = 6) {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

module.exports = { genCode };
