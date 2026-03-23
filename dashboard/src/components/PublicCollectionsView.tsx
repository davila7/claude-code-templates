import { useState, useEffect } from 'react';
import { collectionsApi } from '../lib/collections-api';
import DatabaseRequiredMessage from './DatabaseRequiredMessage';
import type { Collection } from '../lib/types';

function useGlobalAuth() {
  const [state, setState] = useState({ isSignedIn: false, isLoaded: false });

  useEffect(() => {
    function check() {
      const clerk = (window as any).Clerk;
      if (clerk?.loaded) {
        setState({ isSignedIn: !!clerk.user, isLoaded: true });
      }
    }
    check();
    const interval = setInterval(check, 500);
    const handleChange = () => check();
    window.addEventListener('clerk:session', handleChange);
    return () => { clearInterval(interval); window.removeEventListener('clerk:session', handleChange); };
  }, []);

  const getToken = async () => {
    const clerk = (window as any).Clerk;
    return clerk?.session?.getToken() ?? null;
  };

  return { ...state, getToken };
}

function pluralType(type: string): string {
  return type.endsWith('s') ? type : type + 's';
}

export default function PublicCollectionsView() {
  const { isSignedIn, isLoaded, getToken } = useGlobalAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'liked' | 'a-z'>('popular');
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState(false);

  useEffect(() => {
    loadCollections();
  }, [search, sortBy]);

  async function loadCollections() {
    setLoading(true);
    setDatabaseError(false);
    try {
      const cols = await collectionsApi.listPublic({ search, sort: sortBy, limit: 50 });
      setCollections(cols);
    } catch (err: any) {
      console.error('Failed to load public collections:', err);
      if (err.message?.includes('Database not configured') || err.message?.includes('503')) {
        setDatabaseError(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate(collectionId: string) {
    if (!isSignedIn) {
      alert('Please sign in to duplicate collections');
      return;
    }

    setDuplicating(collectionId);
    try {
      const token = await getToken();
      if (!token) return;

      await collectionsApi.duplicate(token, collectionId);
      alert('Collection duplicated to your collections');
      window.location.href = '/my-components';
    } catch (err) {
      console.error('Failed to duplicate:', err);
      alert('Failed to duplicate collection');
    } finally {
      setDuplicating(null);
    }
  }

  async function handleLike(collectionId: string) {
    if (!isSignedIn) {
      alert('Please sign in to like collections');
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const result = await collectionsApi.toggleLike(token, collectionId);
      
      // Update local state
      setCollections(prev => prev.map(c => {
        if (c.id === collectionId) {
          return {
            ...c,
            is_liked: result.liked,
            like_count: (c.like_count || 0) + (result.liked ? 1 : -1)
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to like:', err);
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (databaseError) {
    return <DatabaseRequiredMessage />;
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-0">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Discover Collections
          </h1>
          <p className="text-sm text-text-secondary">
            Browse and use collections shared by the community
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collections..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-1 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2.5 bg-surface-1 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 transition-all cursor-pointer"
          >
            <option value="popular">Most Popular</option>
            <option value="recent">Recently Added</option>
            <option value="liked">Most Liked</option>
            <option value="a-z">A-Z</option>
          </select>
        </div>

        {/* Collections Grid */}
        {collections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">No collections found</p>
            <p className="text-xs text-text-tertiary">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => {
              const itemCount = collection.collection_items?.length || 0;
              const typeGroups: Record<string, number> = {};
              
              collection.collection_items?.forEach(item => {
                const type = pluralType(item.component_type);
                typeGroups[type] = (typeGroups[type] || 0) + 1;
              });

              return (
                <div
                  key={collection.id}
                  className="group bg-surface-1 border border-border rounded-xl overflow-hidden hover:border-border-hover hover:shadow-lg transition-all duration-200"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-32 bg-gradient-to-br from-accent-500/10 via-accent-600/5 to-surface-2 flex items-center justify-center border-b border-border">
                    <svg className="w-12 h-12 text-accent-500/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2 17V7a2 2 0 012-2h5l2 2h9a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2z" />
                    </svg>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-text-primary mb-2 line-clamp-1 group-hover:text-accent-500 transition-colors">
                      {collection.name}
                    </h3>
                    {collection.description && (
                      <p className="text-xs text-text-secondary line-clamp-2 mb-3 leading-relaxed">
                        {collection.description}
                      </p>
                    )}

                    {/* Tags */}
                    {collection.tags && collection.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {collection.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] bg-surface-2 text-text-tertiary rounded-full border border-border">
                            {tag}
                          </span>
                        ))}
                        {collection.tags.length > 3 && (
                          <span className="px-2 py-0.5 text-[10px] text-text-tertiary">
                            +{collection.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-3 text-xs text-text-tertiary mb-4">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        {itemCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {collection.view_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill={collection.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {collection.like_count || 0}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDuplicate(collection.id)}
                        disabled={duplicating === collection.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 shadow-sm"
                      >
                        {duplicating === collection.id ? (
                          <>
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Duplicating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Duplicate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleLike(collection.id)}
                        className={`px-3 py-2 rounded-lg text-xs transition-all ${
                          collection.is_liked
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                            : 'bg-surface-2 text-text-tertiary hover:bg-surface-3 hover:text-text-secondary border border-border'
                        }`}
                        title={collection.is_liked ? 'Unlike' : 'Like'}
                      >
                        <svg className="w-4 h-4" fill={collection.is_liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <a
                        href={`/collection/${collection.slug}`}
                        className="px-3 py-2 bg-surface-2 hover:bg-surface-3 text-text-tertiary hover:text-text-primary rounded-lg text-xs transition-all border border-border"
                        title="View details"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
