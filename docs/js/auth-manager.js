/**
 * Authentication Manager for Claude Code Templates
 * Handles user authentication with Supabase (GitHub OAuth)
 */

class AuthManager {
    constructor() {
        this.user = null;
        this.session = null;
        this.supabaseUrl = null;
        this.supabaseKey = null;
        this.supabase = null;
        this.onAuthStateChange = null;
    }

    /**
     * Load configuration from API endpoint
     */
    async loadConfig() {
        try {
            // Add timestamp to prevent caching
            const response = await fetch(`/api/config?t=${Date.now()}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Config API error:', response.status, errorData);
                throw new Error(`Failed to load configuration: ${response.status}`);
            }
            const config = await response.json();
            this.supabaseUrl = config.supabase.url;
            this.supabaseKey = config.supabase.anonKey;
            console.log('✅ Configuration loaded from API');
            return true;
        } catch (error) {
            console.error('❌ Error loading configuration:', error);
            console.error('Please ensure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY are set in Vercel environment variables');
            return false;
        }
    }

    /**
     * Initialize Supabase client
     */
    async init() {
        // Load configuration first
        const configLoaded = await this.loadConfig();
        if (!configLoaded) {
            console.error('Failed to load configuration. Authentication will not work.');
            return false;
        }

        if (typeof supabase === 'undefined') {
            console.error('Supabase client not loaded. Please include the Supabase CDN script.');
            return false;
        }

        if (!this.supabaseUrl || !this.supabaseKey) {
            console.error('Supabase credentials are missing. Please check environment variables.');
            return false;
        }

        this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);

        // Check current session
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
            this.session = session;
            this.user = session.user;
            console.log('User already logged in:', this.user.email);
        }

        // Listen for auth state changes
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            this.session = session;
            this.user = session?.user || null;

            // Call callback if registered
            if (this.onAuthStateChange) {
                this.onAuthStateChange(event, session);
            }
        });

        return true;
    }

    /**
     * Sign in with GitHub
     */
    async signInWithGitHub() {
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: window.location.href
            }
        });

        if (error) {
            console.error('Error signing in with GitHub:', error);
            return { success: false, error };
        }

        return { success: true, data };
    }

    /**
     * Sign out
     */
    async signOut() {
        const { error } = await this.supabase.auth.signOut();

        if (error) {
            console.error('Error signing out:', error);
            return { success: false, error };
        }

        this.user = null;
        this.session = null;
        return { success: true };
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.user !== null;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Get user avatar URL
     */
    getUserAvatar() {
        return this.user?.user_metadata?.avatar_url || null;
    }

    /**
     * Get user name
     */
    getUserName() {
        return this.user?.user_metadata?.full_name ||
               this.user?.user_metadata?.user_name ||
               this.user?.email ||
               'User';
    }

    /**
     * Register callback for auth state changes
     */
    onStateChange(callback) {
        this.onAuthStateChange = callback;
    }
}

// Global instance
if (typeof window !== 'undefined') {
    window.AuthManager = AuthManager;
}
