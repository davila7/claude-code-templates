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
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error('Failed to load configuration');
            }
            const config = await response.json();
            this.supabaseUrl = config.supabase.url;
            this.supabaseKey = config.supabase.anonKey;
            console.log('✅ Configuration loaded from API');
            return true;
        } catch (error) {
            console.error('❌ Error loading configuration:', error);
            // Fallback to hardcoded values for local development
            this.supabaseUrl = 'https://jljwamruwpyexzcftocx.supabase.co';
            this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsandhdXJ1d3B5ZXh6Y2Z0b2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA2NjA4OTQsImV4cCI6MjA0NjIzNjg5NH0.m8vO0FgQqUMQb2x6tKEW1VcZdEqRXHBdZqr-XQGZ0n8';
            console.log('ℹ️ Using fallback configuration');
            return true;
        }
    }

    /**
     * Initialize Supabase client
     */
    async init() {
        // Load configuration first
        await this.loadConfig();

        if (typeof supabase === 'undefined') {
            console.error('Supabase client not loaded. Please include the Supabase CDN script.');
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
