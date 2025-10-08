// Shared Utility Functions

function copyToClipboard(text, message = 'Command copied to clipboard!') {
    navigator.clipboard.writeText(text).then(() => {
        showNotification(message, 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showNotification('Failed to copy command', 'error');
    });
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications first
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => {
        if (notif.parentNode) {
            notif.parentNode.removeChild(notif);
        }
    });

    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}
