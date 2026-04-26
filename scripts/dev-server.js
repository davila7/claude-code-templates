const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// --- Middleware for logging requests ---
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// --- Helper function to safely send files ---
const sendHtml = (res, filePath) => {
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('File error:', err.message);
            res.status(err.status || 500).send('Page not found');
        }
    });
};

// Serve static files
app.use(express.static('docs'));

// Filter routes
const filterRoutes = ['agents', 'commands', 'settings', 'hooks', 'mcps', 'templates'];
filterRoutes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        sendHtml(res, path.join(__dirname, 'docs', 'index.html'));
    });
});

// Component route
app.get('/component/:type/:name', (req, res) => {
    sendHtml(res, path.join(__dirname, 'docs', 'component.html'));
});

// Blog route with safer path handling
app.get('/blog/*', (req, res) => {
    const blogPath = req.params[0]; // safer than replace
    const fullPath = path.join(__dirname, 'docs', 'blog', blogPath, 'index.html');
    sendHtml(res, fullPath);
});

// Root route
app.get('/', (req, res) => {
    sendHtml(res, path.join(__dirname, 'docs', 'index.html'));
});

// --- Global 404 handler ---
app.use((req, res) => {
    res.status(404).send('Route not found');
});

// --- Global error handler ---
app.use((err, req, res, next) => {
    console.error('Unexpected error:', err.stack);
    res.status(500).send('Something went wrong');
});

app.listen(port, () => {
    console.log(`Development server running at http://localhost:${port}`);
});
