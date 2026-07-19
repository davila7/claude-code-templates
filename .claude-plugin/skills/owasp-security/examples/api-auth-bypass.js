// API Security Example: OAuth/JWT Token Vulnerability
// For detailed guidance, see: SKILL.md#section-4-owasp-api-security-top-10-2023
//
// This example demonstrates API authentication vulnerabilities including:
// - Broken JWT validation (no signature verification)
// - Missing token expiration checks
// - Overly permissive CORS
// - Function-level authorization bypass

const express = require('express');
const app = express();

// NOTE: The /vulnerable/* and /secure/* routes below live in one file only for
// side-by-side comparison. Express matches routes in registration order, so the
// paths are kept distinct to keep both sets reachable. In a real app the
// vulnerable versions would not exist. (CORS here is illustrative; app-level
// middleware applies globally, so a real deployment would pick one policy.)

// VULNERABLE: CORS allows any origin
const cors = require('cors');

// VULNERABLE: JWT parsed without verification
app.get('/vulnerable/api/orders', cors({ origin: '*' }), (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  // Decoded without verifying signature!
  const decoded = Buffer.from(token.split('.')[1], 'base64').toString();
  const user = JSON.parse(decoded);
  
  const orders = db.query('SELECT * FROM orders WHERE user_id = ?', user.id);
  res.json(orders);
});

// VULNERABLE: Admin endpoint accessible to any authenticated user (no function-level auth)
app.delete('/vulnerable/api/admin/users/:id', cors({ origin: '*' }), (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Auth required' });
  
  // Only checks if authenticated, not if user is admin!
  db.query('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ status: 'deleted' });
});

// SECURE: Proper JWT validation, CORS restriction, function-level authorization
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

// SECURE: CORS restricted to a known origin, applied per-route below
const secureCors = cors({ origin: 'https://myapp.com', credentials: true });

const verifyAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required' });
  }
  next();
};

app.get('/secure/api/orders', secureCors, verifyAuth, (req, res) => {
  const orders = db.query('SELECT * FROM orders WHERE user_id = ?', req.user.id);
  res.json(orders);
});

app.delete('/secure/api/admin/users/:id', secureCors, verifyAuth, requireAdmin, (req, res) => {
  db.query('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ status: 'deleted' });
});

app.listen(3000);
