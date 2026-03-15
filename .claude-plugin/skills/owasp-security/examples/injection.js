// SQL Injection Example
// For detailed guidance, see: owasp-comprehensive-security-skills.md#section-1-owasp-top-10-2025
//
// This example demonstrates SQL injection via unsafe string concatenation.
// The 'id' parameter is directly concatenated into the SQL query without
// parameterization, allowing attackers to inject malicious SQL code.

const express = require('express');
const app = express();

app.get('/user', (req, res) => {
  // UNSAFE: String concatenation with user input
  const q = "SELECT * FROM users WHERE id = " + req.query.id;
  db.query(q, (err, rows) => {
    res.json(rows);
  });
});
