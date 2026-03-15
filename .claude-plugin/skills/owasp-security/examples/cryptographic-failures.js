// OWASP Top 10 - A02: Cryptographic Failures
// For detailed guidance, see: owasp-comprehensive-security-skills.md#section-1-owasp-top-10-2025
//
// This example demonstrates cryptographic failures including:
// - Weak encryption algorithms
// - Plaintext sensitive data
// - Missing TLS/HTTPS
// - Hardcoded secrets

const crypto = require('crypto');
const fs = require('fs');

// ===== VULNERABLE: Plaintext Storage =====
function vulnerable_store_password(username, password) {
    // VULNERABLE: Storing passwords in plaintext
    // If database is breached, all passwords exposed
    const userData = `${username}:${password}`;
    fs.appendFileSync('users.txt', userData + '\n');
    console.log("User stored (INSECURE)");
}

// ===== VULNERABLE: Weak Hashing =====
function vulnerable_weak_hash(password) {
    // VULNERABLE: MD5 or SHA1 are cryptographically broken
    // Can be cracked in seconds with rainbow tables
    const md5_hash = crypto.createHash('md5').update(password).digest('hex');
    return md5_hash;
}

// ===== VULNERABLE: Hardcoded Encryption Key =====
function vulnerable_encrypt_data(sensitiveData) {
    // VULNERABLE: Hardcoded key in source code
    // If code is leaked/decompiled, encryption is worthless
    const hardcoded_key = "my-secret-key-12345"; // 19 chars, not 32
    const cipher = crypto.createCipher('des', hardcoded_key); // DES is weak!
    
    let encrypted = cipher.update(sensitiveData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// ===== VULNERABLE: No HTTPS Enforcement =====
// HTTP communication (plaintext):
// GET /api/user/profile HTTP/1.1
// Host: api.example.com
// Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
// ^^ Token exposed in plaintext! Attacker can sniff network traffic

// ===== VULNERABLE: Secrets in Code/Logs =====
function vulnerable_api_call() {
    // VULNERABLE: API key in plaintext
    const api_key = "sk-abc123xyz789defgh1234567890"; // Hardcoded!
    
    // VULNERABLE: Logging secrets
    console.log(`API Key: ${api_key}`);
    console.log(`Authenticating with key: ${api_key}`);
    
    // If logs are ever exposed, attacker has the key
    // If code is checked into Git, secret is in history forever
}

// ===== VULNERABLE: Weak Random Number Generation =====
function vulnerable_generate_token() {
    // VULNERABLE: Math.random() is not cryptographically secure
    // Predictable token generation - attacker can guess tokens
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += Math.floor(Math.random() * 16).toString(16);
    }
    return token;
}

// ===== VULNERABLE: ECB Mode (No IVs) =====
function vulnerable_ecb_encryption(plaintext, key) {
    // VULNERABLE: ECB mode encrypts identical plaintext blocks identically
    // Patterns leak information even in ciphertext
    // All 16-byte blocks are encrypted independently
    const cipher = crypto.createCipheriv('aes-256-ecb', key, '');
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}


// ===== SECURE: Strong Password Hashing =====
function secure_hash_password(password) {
    // SECURE: Use bcrypt with salt rounds
    // bcrypt is slow (intentional) and includes salt
    // Takes milliseconds to hash, years to brute-force
    const bcrypt = require('bcrypt');
    const salt_rounds = 12;
    const hashed = bcrypt.hashSync(password, salt_rounds);
    return hashed;
}

// Verify password against hash
function secure_verify_password(password, hash) {
    const bcrypt = require('bcrypt');
    return bcrypt.compareSync(password, hash);
}

// ===== SECURE: Secrets from Environment =====
function secure_api_call() {
    // SECURE: Load secrets from environment variables
    const api_key = process.env.API_KEY;
    
    if (!api_key) {
        throw new Error("API_KEY not set in environment");
    }
    
    // SECURE: Don't log secrets
    console.log("Authenticating..."); // No key printed
    
    // Use api_key securely
    return api_key;
}

// ===== SECURE: AES-256-GCM with Random IV =====
function secure_encrypt_data(plaintext) {
    // SECURE: Configuration
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16); // Random IV each time
    
    // Encrypt
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag (prevents tampering)
    const auth_tag = cipher.getAuthTag();
    
    // Return IV + ciphertext + auth_tag (IV can be public, key is secret)
    return {
        iv: iv.toString('hex'),
        ciphertext: encrypted,
        auth_tag: auth_tag.toString('hex')
    };
}

function secure_decrypt_data(encrypted_obj) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    
    const decipher = crypto.createDecipheriv(
        algorithm,
        key,
        Buffer.from(encrypted_obj.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encrypted_obj.auth_tag, 'hex'));
    
    let decrypted = decipher.update(encrypted_obj.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

// ===== SECURE: Cryptographically Secure Random =====
function secure_generate_token() {
    // SECURE: Use crypto.randomBytes() for token generation
    // Cryptographically secure random number generator
    const token = crypto.randomBytes(32).toString('hex'); // 64 char hex
    return token;
}

// ===== SECURE: HTTPS Enforced =====
const https = require('https');
const express = require('express');

const app = express();

// SECURE: Redirect HTTP to HTTPS
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
        next();
    }
});

// SECURE: HSTS header (force HTTPS for future requests)
app.use((req, res, next) => {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// ===== SECURITY CHECKLIST =====
/*
✓ Use strong hashing: bcrypt (passwords), PBKDF2, or Argon2
✓ HTTPS/TLS 1.2+ enforced for all communications
✓ AES-256 encryption with authenticated mode (GCM, not ECB)
✓ Random IV/nonce for each encryption operation
✓ Cryptographically secure RNG for tokens/salts (crypto.randomBytes)
✓ Secrets in environment variables, never in code
✓ No hardcoded keys/API keys in source code
✓ Secrets not logged or printed to console
✓ Key rotation policies implemented
✓ All sensitive data encrypted at rest AND in transit
✓ Secrets managed via vault/secrets manager
✓ Regular security audits of cryptographic practices
*/

// ===== ENVIRONMENT SETUP =====
/*
# .env file (NOT in git)
DATABASE_ENCRYPTION_KEY=your-32-byte-hex-key-here-64-chars
API_KEY=sk-your-api-key-here
JWT_SECRET=your-jwt-secret-here

# Docker/Deploy
ENV DATABASE_ENCRYPTION_KEY ${DATABASE_ENCRYPTION_KEY}
ENV API_KEY ${API_KEY}
*/

module.exports = {
    secure_hash_password,
    secure_verify_password,
    secure_encrypt_data,
    secure_decrypt_data,
    secure_generate_token,
    secure_api_call
};
