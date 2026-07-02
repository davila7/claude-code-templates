// API Security Example: OAuth/JWT Token Vulnerability
// For detailed guidance, see: owasp-comprehensive-security-skills.md#section-4-owasp-api-security-top-10
//
// This example demonstrates API authentication vulnerabilities including:
// - Broken JWT validation (no signature verification)
// - Missing token expiration checks
// - Overly permissive CORS
// - Function-level authorization bypass

const express = require('express');
const app = express();

// VULNERABLE: CORS allows any origin
app.use(require('cors')({ origin: '*' }));

// VULNERABLE: JWT parsed without verification
app.get('/api/orders', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  // Decoded without verifying signature!
  const decoded = Buffer.from(token.split('.')[1], 'base64').toString();
  const user = JSON.parse(decoded);
  
  const orders = db.query('SELECT * FROM orders WHERE user_id = ?', user.id);
  res.json(orders);
});

// VULNERABLE: Admin endpoint accessible to any authenticated user (no function-level auth)
app.delete('/api/admin/users/:id', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Auth required' });
  
  // Only checks if authenticated, not if user is admin!
  db.query('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ status: 'deleted' });
});

// SECURE: Proper JWT validation, CORS restriction, function-level authorization
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET;

app.use(require('cors')({ origin: 'https://myapp.com', credentials: true }));

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

app.get('/api/orders', verifyAuth, (req, res) => {
  const orders = db.query('SELECT * FROM orders WHERE user_id = ?', req.user.id);
  res.json(orders);
});

app.delete('/api/admin/users/:id', verifyAuth, requireAdmin, (req, res) => {
  db.query('DELETE FROM users WHERE id = ?', req.params.id);
  res.json({ status: 'deleted' });
});

app.listen(3000);
