// Generate search data files from components.json
// This script reads the main components.json and creates separate JSON files for each category

(async function generateSearchData() {
    try {
        // Read the main components.json file
        const response = await fetch('components.json');
        const data = await response.json();
        
        console.log('Generating search data files...');
        
        // Create separate files for each category
        const categories = ['agents', 'commands', 'settings', 'hooks', 'mcps', 'templates'];
        
        for (const category of categories) {
            if (data[category] && Array.isArray(data[category])) {
                console.log(`Processing ${category}: ${data[category].length} items`);
                
                // Process each component to ensure search-friendly structure
                const processedComponents = data[category].map(component => ({
                    ...component,
                    // Add search-friendly fields
                    searchableText: [
                        component.name || component.title,
                        component.description,
                        component.category,
                        ...(component.tags || []),
                        component.keywords || '',
                        component.path || ''
                    ].filter(Boolean).join(' ').toLowerCase(),
                    
                    // Normalize common fields
                    title: component.name || component.title,
                    displayName: (component.name || component.title || '').replace(/[-_]/g, ' '),
                    category: category,
                    
                    // Add tags if not present
                    tags: component.tags || [component.category].filter(Boolean)
                }));
                
                // Save to individual file (simulate file creation)
                // In a real scenario, this would write to the server filesystem
                console.log(`Would save ${category}.json with ${processedComponents.length} components`);
                
                // For browser simulation, store in localStorage
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(`searchData_${category}`, JSON.stringify(processedComponents));
                }
                
                // Also store in a global variable for immediate use
                window.searchDataCache = window.searchDataCache || {};
                window.searchDataCache[category] = processedComponents;
            }
        }
        
        console.log('Search data generation complete!');
        
    } catch (error) {
        console.error('Error generating search data:', error);
    }
})();

// Function to get search data for a category
function getSearchData(category) {
    // Try localStorage first
    if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(`searchData_${category}`);
        if (data) {
            return JSON.parse(data);
        }
    }
    
    // Try global cache
    if (window.searchDataCache && window.searchDataCache[category]) {
        return window.searchDataCache[category];
    }
    
    return [];
}

// Make function globally available
window.getSearchData = getSearchData;