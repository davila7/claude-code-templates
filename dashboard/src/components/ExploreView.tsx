import { useState, useEffect } from 'react';

interface Collection {
  id: string;
  name: string;
  description: string;
  slug: string;
  itemCount: number;
  likes: number;
  views: number;
  isPublic: boolean;
  createdAt: string;
}

export default function ExploreView() {
  const [activeTab, setActiveTab] = useState<'collections'>('collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  // Load collections on mount
  useEffect(() => {
    async function loadCollections() {
      try {
        const response = await fetch('/api/collections/public');
        const data = await response.json();
        setCollections(data.collections || []);
      } catch (error) {
        console.error('Failed to load collections:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCollections();
  }, []);

  const categories = [
    'all',
    'agents',
    'commands',
    'skills',
    'mcp',
    'productivity',
    'web-dev',
    'data-science',
  ];

  const filteredCollections = collections.filter((collection) => {
    const matchesSearch = searchQuery === '' || 
      collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      collection.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Explore Collections
          </h1>
          <p className="text-sm text-text-secondary">Discover curated collections from the community</p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-2 text-text-primary px-4 py-2.5 pl-10 rounded-lg border border-border focus:border-accent-500 focus:outline-none text-[13px]"
            />
            <svg
              className="absolute left-3 top-3 w-4 h-4 text-text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-accent-500 text-white'
                    : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-border'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-5 h-5 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px] text-text-tertiary">Loading collections...</span>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[13px] text-text-tertiary">No collections found</p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="mt-2 text-[13px] text-text-secondary hover:text-text-primary underline underline-offset-4"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCollections.map((collection) => (
              <div
                key={collection.id}
                className="group bg-surface-1 rounded-xl p-5 border border-border hover:border-border-hover transition-all cursor-pointer"
                onClick={() => window.location.href = `/collections/${collection.slug}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-500 transition-colors mb-1">
                      {collection.name}
                    </h3>
                    <p className="text-[12px] text-text-tertiary line-clamp-2 leading-relaxed">
                      {collection.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      {collection.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      {collection.views}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    {collection.itemCount} items
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
