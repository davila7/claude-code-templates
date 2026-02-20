// Generate search data from components.json
// Stores processed search data in memory only (no localStorage to avoid quota issues)

(async function generateSearchData() {
    try {
        const response = await fetch('components.json');
        const data = await response.json();

        const categories = ['agents', 'commands', 'settings', 'hooks', 'mcps', 'templates'];
        window.searchDataCache = {};

        for (const category of categories) {
            if (data[category] && Array.isArray(data[category])) {
                window.searchDataCache[category] = data[category].map(component => ({
                    ...component,
                    searchableText: [
                        component.name || component.title,
                        component.description,
                        component.category,
                        ...(component.tags || []),
                        component.keywords || '',
                        component.path || ''
                    ].filter(Boolean).join(' ').toLowerCase(),
                    title: component.name || component.title,
                    displayName: (component.name || component.title || '').replace(/[-_]/g, ' '),
                    category: category,
                    tags: component.tags || [component.category].filter(Boolean)
                }));
            }
        }

        console.log('Search data generation complete!');

    } catch (error) {
        console.error('Error generating search data:', error);
    }
})();

// Function to get search data for a category
function getSearchData(category) {
    if (window.searchDataCache && window.searchDataCache[category]) {
        return window.searchDataCache[category];
    }
    return [];
}

window.getSearchData = getSearchData;
