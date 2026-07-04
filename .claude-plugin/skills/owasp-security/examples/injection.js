// SQL Injection Example
// For detailed guidance, see: SKILL.md#section-1-owasp-top-10-2021
//
// This example demonstrates SQL injection via unsafe string concatenation.
// The 'id' parameter is directly concatenated into the SQL query without
// parameterization, allowing attackers to inject malicious SQL code.

const express = require('express');
const app = express();

// ===== VULNERABLE: String Concatenation =====
app.get('/user/unsafe', (req, res) => {
  // VULNERABLE: String concatenation with user input
  const q = "SELECT * FROM users WHERE id = " + req.query.id;
  db.query(q, (err, rows) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(rows);
  });
});

// ===== SECURE: Parameterized Queries =====
app.get('/user/safe', (req, res) => {
  // SECURE: Use parameterized queries (prepared statements)
  const q = "SELECT * FROM users WHERE id = ?";
  const params = [req.query.id];
  
  db.query(q, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }
    
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(rows);
  });
});

// ===== SECURE: Input Validation + Parameterized Query =====
app.get('/user/safest', (req, res) => {
  const userId = req.query.id;
  
  // Use strict numeric validation: ensure userId contains only digits
  if (!userId || !/^\d+$/.test(userId) || parseInt(userId) <= 0 || !Number.isSafeInteger(parseInt(userId))) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  
  const q = "SELECT id, name, email FROM users WHERE id = ?";
  const params = [parseInt(userId)];
  
  db.query(q, params, (err, rows) => {
    if (err) {
      console.error("DB Error:", err);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(rows[0]);
  });
});

app.listen(3000);
