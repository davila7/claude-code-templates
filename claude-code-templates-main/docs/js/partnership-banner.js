/**
 * Partnership Banner - GLM Z.AI
 * Handles banner click tracking
 */

(function() {
    'use strict';

    /**
     * Initialize partnership banner
     */
    function initPartnershipBanner() {
        // Track CTA clicks
        const primaryCTA = document.getElementById('partnershipPrimaryCTA');
        if (primaryCTA) {
            primaryCTA.addEventListener('click', function(e) {
                trackEvent('partnership_click', {
                    partner: 'z.ai',
                    action: 'subscribe_link',
                    component: 'glm-coding-plan'
                });
            });
        }
    }

    /**
     * Track analytics event
     */
    function trackEvent(eventName, params) {
        // Google Analytics (gtag)
        if (typeof gtag === 'function') {
            gtag('event', eventName, params);
        }

        // Console log for debugging
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Partnership Banner Event:', eventName, params);
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPartnershipBanner);
    } else {
        initPartnershipBanner();
    }
})();
