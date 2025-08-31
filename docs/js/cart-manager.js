// Shopping Cart Manager for Claude Code Templates
class CartManager {
    constructor() {
        this.cart = {
            agents: [],
            commands: [],
            settings: [],
            hooks: [],
            mcps: []
        };
        this.init();
    }

    init() {
        // Load cart from localStorage if exists
        this.loadCartFromStorage();
        this.updateCartUI();
        this.updateFloatingButton();
        
        // Use requestAnimationFrame instead of setTimeout for better performance
        this.scheduleButtonUpdate();
        
        // Listen for filter changes to update buttons
        this.setupFilterListeners();
    }
    
    // Optimized button update scheduling
    scheduleButtonUpdate() {
        if (this.updatePending) return;
        
        this.updatePending = true;
        requestAnimationFrame(() => {
            this.updateAddToCartButtons();
            this.updatePending = false;
        });
    }

    // Add item to cart
    addToCart(item, type) {
        // Check if item already exists
        const existingItem = this.cart[type].find(cartItem => cartItem.path === item.path);
        if (existingItem) {
            this.showNotification(`${item.name} is already in your stack!`, 'warning');
            return false;
        }

        // Add item to cart
        this.cart[type].push({
            name: item.name,
            path: item.path,
            category: item.category || '',
            description: item.description || '',
            icon: this.getTypeIcon(type)
        });

        this.saveCartToStorage();
        this.updateCartUI();
        this.updateFloatingButton();
        this.showNotification(`${item.name} added to stack!`, 'success');
        return true;
    }

    // Remove item from cart
    removeFromCart(itemPath, type) {
        this.cart[type] = this.cart[type].filter(item => item.path !== itemPath);
        this.saveCartToStorage();
        this.updateCartUI();
        this.updateFloatingButton();
        this.showNotification('Item removed from stack', 'info');
    }

    // Clear entire cart
    clearCart() {
        if (this.getTotalItems() === 0) return;
        
        if (confirm('Are you sure you want to clear your entire stack?')) {
            this.cart = { agents: [], commands: [], settings: [], hooks: [], mcps: [] };
            this.saveCartToStorage();
            this.updateCartUI();
            this.updateFloatingButton();
            this.showNotification('Stack cleared', 'info');
        }
    }

    // Get total items count
    getTotalItems() {
        return this.cart.agents.length + this.cart.commands.length + this.cart.settings.length + this.cart.hooks.length + this.cart.mcps.length;
    }

    // Check if item is in cart
    isInCart(itemPath, type) {
        return this.cart[type].some(item => item.path === itemPath);
    }

    // Update cart UI
    updateCartUI() {
        const cartEmpty = document.getElementById('cartEmpty');
        const cartItems = document.getElementById('cartItems');
        const cartFooter = document.getElementById('cartFooter');
        const cartClearProminent = document.getElementById('cartClearProminent');
        const clearCount = document.getElementById('clearCount');
        
        const totalItems = this.getTotalItems();

        if (totalItems === 0) {
            cartEmpty.style.display = 'block';
            cartItems.style.display = 'none';
            cartFooter.style.display = 'none';
            // Hide prominent clear button when cart is empty
            if (cartClearProminent) cartClearProminent.style.display = 'none';
        } else {
            cartEmpty.style.display = 'none';
            cartItems.style.display = 'block';
            cartFooter.style.display = 'block';
            
            // Show and update prominent clear button
            if (cartClearProminent) {
                cartClearProminent.style.display = 'block';
                if (clearCount) {
                    clearCount.textContent = `(${totalItems})`;
                }
            }
            
            this.renderCartItems();
            this.updateCommand();
        }
    }

    // Render cart items
    renderCartItems() {
        // Update counts
        document.getElementById('agentsCount').textContent = this.cart.agents.length;
        document.getElementById('commandsCount').textContent = this.cart.commands.length;
        document.getElementById('settingsCount').textContent = this.cart.settings.length;
        document.getElementById('hooksCount').textContent = this.cart.hooks.length;
        document.getElementById('mcpsCount').textContent = this.cart.mcps.length;

        // Render sections
        this.renderSection('agents', 'agentsList');
        this.renderSection('commands', 'commandsList');
        this.renderSection('settings', 'settingsList');
        this.renderSection('hooks', 'hooksList');
        this.renderSection('mcps', 'mcpsList');
    }

    // Render a specific section
    renderSection(type, containerId) {
        const container = document.getElementById(containerId);
        const items = this.cart[type];

        if (items.length === 0) {
            container.innerHTML = '<div class="no-items">No items added</div>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="cart-item">
                <div class="cart-item-icon">${item.icon}</div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-path">${item.path}</div>
                </div>
                <button class="cart-item-remove" onclick="cartManager.removeFromCart('${item.path}', '${type}')" title="Remove from stack">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    // Update generated command
    updateCommand() {
        let command = 'npx claude-code-templates@latest';
        
        if (this.cart.agents.length > 0) {
            const agentPaths = this.cart.agents.map(item => item.path).join(',');
            command += ` --agent ${agentPaths}`;
        }
        
        if (this.cart.commands.length > 0) {
            const commandPaths = this.cart.commands.map(item => item.path).join(',');
            command += ` --command "${commandPaths}"`;
        }
        
        if (this.cart.settings.length > 0) {
            const settingsPaths = this.cart.settings.map(item => item.path).join(',');
            command += ` --setting "${settingsPaths}"`;
        }
        
        if (this.cart.hooks.length > 0) {
            const hooksPaths = this.cart.hooks.map(item => item.path).join(',');
            command += ` --hook "${hooksPaths}"`;
        }
        
        if (this.cart.mcps.length > 0) {
            const mcpPaths = this.cart.mcps.map(item => item.path).join(',');
            command += ` --mcp "${mcpPaths}"`;
        }

        document.getElementById('generatedCommand').textContent = command;
    }

    // Update floating button
    updateFloatingButton() {
        const floatingBtn = document.getElementById('cartFloatingBtn');
        const badge = document.getElementById('cartBadge');
        const totalItems = this.getTotalItems();

        if (totalItems > 0) {
            floatingBtn.style.display = 'flex';
            badge.textContent = totalItems;
        } else {
            floatingBtn.style.display = 'none';
        }

        // Update all add-to-cart buttons in the page
        this.updateAddToCartButtons();
    }

    // Update add-to-cart buttons state
    updateAddToCartButtons() {
        document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            const type = btn.dataset.type;
            const path = btn.dataset.path;
            
            if (this.isInCart(path, type)) {
                btn.classList.add('added');
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                    </svg>
                    Added to Stack
                `;
            } else {
                btn.classList.remove('added');
                btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,7H18V6A2,2 0 0,0 16,4H8A2,2 0 0,0 6,6V7H5A1,1 0 0,0 4,8A1,1 0 0,0 5,9H6V19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V9H19A1,1 0 0,0 20,8A1,1 0 0,0 19,7M8,6H16V7H8V6M16,19H8V9H16V19Z"/>
                    </svg>
                    Add to Stack
                `;
            }
        });
    }

    // Get type icon
    getTypeIcon(type) {
        const icons = {
            agents: '🤖',
            commands: '⚡',
            settings: '⚙️',
            hooks: '🪝',
            mcps: '🔌'
        };
        return icons[type] || '📦';
    }

    // Save cart to localStorage
    saveCartToStorage() {
        localStorage.setItem('claudeCodeCart', JSON.stringify(this.cart));
    }

    // Load cart from localStorage
    loadCartFromStorage() {
        const saved = localStorage.getItem('claudeCodeCart');
        if (saved) {
            try {
                this.cart = JSON.parse(saved);
                // Ensure all arrays exist
                if (!this.cart.agents) this.cart.agents = [];
                if (!this.cart.commands) this.cart.commands = [];
                if (!this.cart.settings) this.cart.settings = [];
                if (!this.cart.hooks) this.cart.hooks = [];
                if (!this.cart.mcps) this.cart.mcps = [];
            } catch (e) {
                console.warn('Failed to load cart from storage:', e);
                this.cart = { agents: [], commands: [], settings: [], hooks: [], mcps: [] };
            }
        }
    }

    // Optimized filter listeners with debouncing
    setupFilterListeners() {
        // Debounced update function
        let updateTimeout;
        const debouncedUpdate = () => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => this.scheduleButtonUpdate(), 150);
        };
        
        // Listen for filter button clicks (more efficient than MutationObserver)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn') || 
                e.target.closest('.filter-btn')) {
                debouncedUpdate();
            }
        });
        
        // Lightweight MutationObserver for critical changes only
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            for (const mutation of mutations) {
                // Only update for significant DOM changes
                if (mutation.type === 'childList' && 
                    mutation.addedNodes.length > 0 && 
                    Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === 1 && 
                        (node.classList?.contains('unified-card') || 
                         node.querySelector?.('.unified-card'))
                    )) {
                    shouldUpdate = true;
                    break;
                }
            }
            
            if (shouldUpdate) {
                debouncedUpdate();
            }
        });

        // Observe only the unified grid with specific options
        const unifiedGrid = document.getElementById('unifiedGrid');
        if (unifiedGrid) {
            observer.observe(unifiedGrid, {
                childList: true,
                subtree: false // Only direct children, not deep nesting
            });
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `cart-notification cart-notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Show with animation using requestAnimationFrame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => notification.classList.add('show'));
        });

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Get notification icon
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
}

// Global cart manager instance
const cartManager = new CartManager();

// Global functions for cart operations
function openCart() {
    const sidebar = document.getElementById('shoppingCart');
    const floatingButton = document.getElementById('cartFloatingBtn');
    
    sidebar.classList.add('active');
    
    // Hide floating cart button when sidebar is open
    if (floatingButton) {
        floatingButton.style.transform = 'translateX(100px)';
        floatingButton.style.opacity = '0';
        floatingButton.style.pointerEvents = 'none';
    }
    
    // Create subtle overlay that doesn't block content visibility
    if (window.innerWidth > 768) {
        const overlay = document.createElement('div');
        overlay.id = 'cartOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            z-index: 999;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: auto;
        `;
        document.body.appendChild(overlay);
        
        // Fade in overlay
        setTimeout(() => overlay.style.opacity = '1', 10);
        
        // Close on overlay click
        overlay.addEventListener('click', closeCart);
    }
}

function closeCart() {
    const sidebar = document.getElementById('shoppingCart');
    const floatingButton = document.getElementById('cartFloatingBtn');
    
    sidebar.classList.remove('active');
    
    // Show floating cart button again when sidebar is closed
    if (floatingButton) {
        floatingButton.style.transform = 'translateX(0)';
        floatingButton.style.opacity = '1';
        floatingButton.style.pointerEvents = 'auto';
    }
    
    // Remove dynamic overlay
    const overlay = document.getElementById('cartOverlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

function clearCart() {
    cartManager.clearCart();
}

function copyCartCommand() {
    const command = document.getElementById('generatedCommand').textContent;
    copyToClipboard(command, 'Command copied to clipboard!');
}

function downloadStack() {
    const command = document.getElementById('generatedCommand').textContent;
    
    // Ask user if they want to execute the command
    const shouldExecute = confirm(`Ready to download your stack?\n\nThis will run:\n${command}\n\nDo you want to proceed?`);
    
    if (shouldExecute) {
        // Copy command to clipboard for user convenience
        copyToClipboard(command);
        
        // Show instructions
        cartManager.showNotification('Command copied! Paste it in your terminal to download the stack.', 'success');
        
        // Optionally clear the cart after download
        setTimeout(() => {
            if (confirm('Stack command is ready! Would you like to clear your cart?')) {
                cartManager.clearCart();
                closeCart();
            }
        }, 2000);
    }
}

function addToCart(item, type) {
    return cartManager.addToCart(item, type);
}

// Close cart when clicking on overlay (handled by dynamic overlay now)
/* document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('shoppingCart');
    if (e.target === sidebar && sidebar.classList.contains('active')) {
        closeCart();
    }
}); */

// Close cart with escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCart();
    }
});

// Share functionality - Dropdown style
function toggleShareDropdown() {
    const shareDropdown = document.getElementById('shareDropdown');
    shareDropdown.classList.toggle('open');
}

function shareOnTwitter() {
    const command = document.getElementById('generatedCommand').textContent.trim();
    const message = `🚀 Just created this Claude Code Templates stack!

Just run this command:
${command}

Create yours at https://aitmpl.com`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
    window.open(twitterUrl, '_blank');
    
    // Close dropdown after sharing
    document.getElementById('shareDropdown').classList.remove('open');
}

function shareOnThreads() {
    const command = document.getElementById('generatedCommand').textContent.trim();
    const message = `🚀 Just created this Claude Code Templates stack!

Just run this command:
${command}

Create yours at https://aitmpl.com`;
    const threadsUrl = `https://threads.net/intent/post?text=${encodeURIComponent(message)}`;
    window.open(threadsUrl, '_blank');
    
    // Close dropdown after sharing
    document.getElementById('shareDropdown').classList.remove('open');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const shareDropdown = document.getElementById('shareDropdown');
    if (shareDropdown && !shareDropdown.contains(e.target)) {
        shareDropdown.classList.remove('open');
    }
});