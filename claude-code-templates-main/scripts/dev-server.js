const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Serve static files from docs directory
app.use(express.static('docs'));

// Handle filter routes - redirect to index.html
const filterRoutes = ['agents', 'commands', 'settings', 'hooks', 'mcps', 'templates'];
filterRoutes.forEach(filter => {
    app.get(`/${filter}`, (req, res) => {
        res.sendFile(path.join(__dirname, 'docs', 'index.html'));
    });
});

// Handle component routes
app.get('/component/:type/:name', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'component.html'));
});

// Handle blog routes
app.get('/blog/*', (req, res) => {
    const blogPath = req.path.replace('/blog', '');
    res.sendFile(path.join(__dirname, 'docs', 'blog', blogPath, 'index.html'), (err) => {
        if (err) {
            res.status(404).send('Blog post not found');
        }
    });
});

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

app.listen(port, () => {
    console.log(`Development server running at http://localhost:${port}`);
    console.log('Testing URLs:');
    console.log(`- http://localhost:${port}/ (agents)`);
    console.log(`- http://localhost:${port}/mcps`);
    console.log(`- http://localhost:${port}/commands`);
    console.log(`- http://localhost:${port}/settings`);
    console.log(`- http://localhost:${port}/hooks`);
    console.log(`- http://localhost:${port}/templates`);
});