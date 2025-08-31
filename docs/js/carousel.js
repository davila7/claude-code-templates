// Company Stacks Carousel functionality
class CompanyCarousel {
    constructor() {
        this.carousel = document.getElementById('companyCarousel');
        this.leftBtn = document.querySelector('.carousel-btn-left');
        this.rightBtn = document.querySelector('.carousel-btn-right');
        this.scrollAmount = 280; // Width of one card plus gap
        this.autoScrollInterval = null;
        this.init();
    }

    init() {
        if (!this.carousel) return;
        
        this.updateButtons();
        this.setupEventListeners();
        this.startAutoScroll();
    }

    setupEventListeners() {
        // Scroll event to update button states
        this.carousel.addEventListener('scroll', () => {
            this.updateButtons();
        });

        // Stop auto-scroll on hover
        this.carousel.addEventListener('mouseenter', () => {
            this.stopAutoScroll();
        });

        // Resume auto-scroll when mouse leaves
        this.carousel.addEventListener('mouseleave', () => {
            this.startAutoScroll();
        });

        // Touch/swipe support for mobile
        let startX = 0;
        let scrollLeft = 0;
        let isDown = false;

        this.carousel.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - this.carousel.offsetLeft;
            scrollLeft = this.carousel.scrollLeft;
            this.carousel.style.cursor = 'grabbing';
            this.stopAutoScroll();
        });

        this.carousel.addEventListener('mouseleave', () => {
            isDown = false;
            this.carousel.style.cursor = 'grab';
        });

        this.carousel.addEventListener('mouseup', () => {
            isDown = false;
            this.carousel.style.cursor = 'grab';
            this.startAutoScroll();
        });

        this.carousel.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - this.carousel.offsetLeft;
            const walk = (x - startX) * 2;
            this.carousel.scrollLeft = scrollLeft - walk;
        });

        // Touch events for mobile
        this.carousel.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - this.carousel.offsetLeft;
            scrollLeft = this.carousel.scrollLeft;
            this.stopAutoScroll();
        });

        this.carousel.addEventListener('touchmove', (e) => {
            if (!startX) return;
            const x = e.touches[0].pageX - this.carousel.offsetLeft;
            const walk = (x - startX) * 2;
            this.carousel.scrollLeft = scrollLeft - walk;
        });

        this.carousel.addEventListener('touchend', () => {
            startX = 0;
            this.startAutoScroll();
        });
    }

    scrollLeft() {
        this.carousel.scrollBy({
            left: -this.scrollAmount,
            behavior: 'smooth'
        });
        this.stopAutoScroll();
        setTimeout(() => this.startAutoScroll(), 3000);
    }

    scrollRight() {
        this.carousel.scrollBy({
            left: this.scrollAmount,
            behavior: 'smooth'
        });
        this.stopAutoScroll();
        setTimeout(() => this.startAutoScroll(), 3000);
    }

    updateButtons() {
        const scrollLeft = this.carousel.scrollLeft;
        const maxScroll = this.carousel.scrollWidth - this.carousel.clientWidth;

        // Update left button
        if (this.leftBtn) {
            this.leftBtn.disabled = scrollLeft <= 0;
            this.leftBtn.style.opacity = scrollLeft <= 0 ? '0.5' : '1';
        }

        // Update right button
        if (this.rightBtn) {
            this.rightBtn.disabled = scrollLeft >= maxScroll - 1; // -1 for rounding errors
            this.rightBtn.style.opacity = scrollLeft >= maxScroll - 1 ? '0.5' : '1';
        }
    }

    startAutoScroll() {
        this.stopAutoScroll();
        this.autoScrollInterval = setInterval(() => {
            const maxScroll = this.carousel.scrollWidth - this.carousel.clientWidth;
            const currentScroll = this.carousel.scrollLeft;
            
            if (currentScroll >= maxScroll - 1) {
                // Reset to beginning
                this.carousel.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                });
            } else {
                // Scroll to next item
                this.scrollRight();
            }
        }, 4000); // Auto-scroll every 4 seconds
    }

    stopAutoScroll() {
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
            this.autoScrollInterval = null;
        }
    }
}

// Global functions for button clicks
function scrollCarousel(direction) {
    if (window.companyCarousel) {
        if (direction === 'left') {
            window.companyCarousel.scrollLeft();
        } else {
            window.companyCarousel.scrollRight();
        }
    }
}

// Initialize carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.companyCarousel = new CompanyCarousel();
});

// Re-initialize if page content changes
function reinitializeCarousel() {
    if (window.companyCarousel) {
        window.companyCarousel.stopAutoScroll();
    }
    window.companyCarousel = new CompanyCarousel();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CompanyCarousel, scrollCarousel, reinitializeCarousel };
}