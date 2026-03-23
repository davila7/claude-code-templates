export default function DatabaseRequiredMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[--color-surface-3] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[--color-text-tertiary]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[--color-text-primary] mb-2">Database Required</h2>
      <p className="text-sm text-[--color-text-tertiary] mb-6 max-w-md">
        Collections require a cloud database to work. Please set up a Neon database and add the connection string to your <code className="px-1.5 py-0.5 bg-[--color-surface-3] rounded text-xs">.env</code> file.
      </p>
      <div className="bg-[--color-surface-2] border border-[--color-border] rounded-lg p-4 max-w-lg text-left">
        <div className="text-xs font-medium text-[--color-text-secondary] mb-2">Setup Steps:</div>
        <ol className="text-xs text-[--color-text-tertiary] space-y-2 list-decimal list-inside">
          <li>Create a free database at <a href="https://neon.tech" target="_blank" rel="noopener" className="text-[--color-accent-500] hover:underline">neon.tech</a></li>
          <li>Copy your connection string</li>
          <li>Add to <code className="px-1 py-0.5 bg-[--color-surface-3] rounded">NEON_DATABASE_URL</code> in <code className="px-1 py-0.5 bg-[--color-surface-3] rounded">.env</code></li>
          <li>Run the migration: <code className="px-1 py-0.5 bg-[--color-surface-3] rounded">psql $NEON_DATABASE_URL &lt; migrations/001_add_collection_sharing.sql</code></li>
          <li>Restart the dev server</li>
        </ol>
      </div>
      <a
        href="https://neon.tech"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
      >
        Get Started with Neon →
      </a>
    </div>
  );
}
