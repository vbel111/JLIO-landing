/**
 * Keyboard Shortcuts for Admin Dashboard
 */

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const keyboardHint = document.getElementById('keyboardHint');

    // Toggle keyboard hints with '?'
    if (e.key === '?' && !isInputFocused()) {
        e.preventDefault();
        if (keyboardHint) {
            keyboardHint.classList.toggle('visible');
        }
    }

    // Close modals with Escape
    if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => {
            modal.classList.remove('active');
        });

        // Also hide keyboard hint
        if (keyboardHint && keyboardHint.classList.contains('visible')) {
            keyboardHint.classList.remove('visible');
        }
    }

    // Delete selected stories with Delete key
    if (e.key === 'Delete' && !isInputFocused()) {
        e.preventDefault();
        if (window.storiesState && window.storiesState.selectedStories.size > 0) {
            if (typeof window.bulkDeleteStories === 'function') {
                window.bulkDeleteStories();
            }
        }
    }

    // Navigate pages with keyboard (1-6)
    if (e.key >= '1' && e.key <= '6' && !isInputFocused() && e.ctrlKey) {
        e.preventDefault();
        const pages = ['overview', 'stories', 'moderation', 'security', 'analytics', 'users'];
        const pageIndex = parseInt(e.key) - 1;
        if (pages[pageIndex] && typeof window.switchPage === 'function') {
            window.switchPage(pages[pageIndex]);
        }
    }

    // Refresh current page with Ctrl+R (override default in context)
    if (e.key === 'r' && e.ctrlKey && !e.shiftKey) {
        // Let default browser refresh work
    }
});

/**
 * Check if an input element is currently focused
 */
function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
    );
}

/**
 * Show loading overlay
 */
window.showLoading = function () {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }
};

/**
 * Hide loading overlay
 */
window.hideLoading = function () {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
};

/**
 * Show keyboard hints briefly on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    const keyboardHint = document.getElementById('keyboardHint');
    if (keyboardHint) {
        // Show hint for 5 seconds on first load
        setTimeout(() => {
            keyboardHint.classList.add('visible');
            setTimeout(() => {
                keyboardHint.classList.remove('visible');
            }, 5000);
        }, 2000);
    }
});

console.log('⌨️ Keyboard shortcuts loaded');
console.log('Press ? to show shortcuts');
