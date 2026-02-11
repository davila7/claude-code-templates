// Event Tracker for Claude Code Templates Website
// Batches and sends website analytics events (search, cart, component views)

class EventTracker {
    constructor() {
        this.queue = [];
        this.flushInterval = 30000; // 30 seconds
        this.maxQueueSize = 20;
        this.endpoint = '/api/track-website-events';
        this.sessionId = this.getOrCreateSessionId();
        this.visitorId = this.getOrCreateVisitorId();
        this.screenWidth = window.screen?.width || null;
        this.referrer = document.referrer || null;
        this.timer = null;

        this.startAutoFlush();
        this.setupBeforeUnload();
    }

    getOrCreateSessionId() {
        let id = sessionStorage.getItem('cct_session_id');
        if (!id) {
            id = this.generateId();
            sessionStorage.setItem('cct_session_id', id);
        }
        return id;
    }

    getOrCreateVisitorId() {
        let id = localStorage.getItem('cct_visitor_id');
        if (!id) {
            id = this.generateId();
            localStorage.setItem('cct_visitor_id', id);
        }
        return id;
    }

    generateId() {
        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    track(eventType, eventData) {
        this.queue.push({
            event_type: eventType,
            event_data: eventData || {},
            page_path: window.location.pathname,
            timestamp: new Date().toISOString()
        });

        if (this.queue.length >= this.maxQueueSize) {
            this.flush();
        }
    }

    flush() {
        if (this.queue.length === 0) return;

        const events = this.queue.splice(0);
        const payload = JSON.stringify({
            events: events,
            session_id: this.sessionId,
            visitor_id: this.visitorId,
            screen_width: this.screenWidth,
            referrer: this.referrer
        });

        // Use sendBeacon for reliability (survives page unloads)
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            const sent = navigator.sendBeacon(this.endpoint, blob);
            if (!sent) {
                // Fallback to fetch if sendBeacon fails
                this.sendViaFetch(payload);
            }
        } else {
            this.sendViaFetch(payload);
        }
    }

    sendViaFetch(payload) {
        fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(() => {
            // Silent failure - analytics should never break user experience
        });
    }

    startAutoFlush() {
        this.timer = setInterval(() => this.flush(), this.flushInterval);
    }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', () => this.flush());
        // Also flush on visibility change (mobile tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flush();
            }
        });
    }
}

// Initialize global instance
window.eventTracker = new EventTracker();
