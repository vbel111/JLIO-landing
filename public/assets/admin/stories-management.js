/**
 * Stories Management UI
 * Comprehensive story browsing, filtering, and bulk management
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    query,
    where,
    orderBy,
    Timestamp,
    deleteDoc,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBgu6wGpsomoC9r44QC0aBWqUFjwk8yRZI",
    authDomain: "jlio-de9c4.firebaseapp.com",
    projectId: "jlio-de9c4",
    storageBucket: "jlio-de9c4.firebasestorage.app",
    messagingSenderId: "620411268963",
    appId: "1:620411268963:web:7038fb998374ea5c3f6d56"
};

// Initialize Firebase for this module
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global state for stories management
const storiesState = {
    allStories: [],
    filteredStories: [],
    selectedStories: new Set(),
    currentPage: 1,
    pageSize: 20,
    filters: {
        search: '',
        community: 'all',
        tag: 'all',
        sort: 'recent'
    }
};

/**
 * Format timestamp to relative time (Time Ago)
 */
function formatTimeAgo(date) {
    if (!date) return 'Unknown';

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";

    return Math.floor(seconds) + " seconds ago";
}

/**
 * Load and display stories
 */
window.loadStoriesData = async function () {
    console.log('📖 Loading stories data...');
    if (typeof showLoading === 'function') showLoading();

    try {
        const storiesSnapshot = await getDocs(collection(db, 'stories'));

        storiesState.allStories = [];
        storiesSnapshot.forEach(doc => {
            storiesState.allStories.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ Loaded ${storiesState.allStories.length} stories`);

        // Update stats
        updateStoriesStats();

        // Populate tag filter
        populateTagFilter();

        // Apply filters and display
        applyStoriesFilters();

    } catch (error) {
        console.error('❌ Error loading stories:', error);
        document.getElementById('storiesList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <h3>Error Loading Stories</h3>
        <p>${error.message}</p>
      </div>
    `;
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
};

/**
 * Update stories statistics
 */
function updateStoriesStats() {
    const totalStories = storiesState.allStories.length;
    const globalStories = storiesState.allStories.filter(s => s.community === 'global').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    const todayStories = storiesState.allStories.filter(s =>
        s.createdAt && s.createdAt >= todayTimestamp
    ).length;

    const totalReplies = storiesState.allStories.reduce((sum, s) => sum + (s.replyCount || 0), 0);

    document.getElementById('totalStoriesCount').textContent = totalStories;
    document.getElementById('globalStoriesCount').textContent = globalStories;
    document.getElementById('todayStoriesCount').textContent = todayStories;
    document.getElementById('repliesCount').textContent = totalReplies;
}

/**
 * Populate tag filter dropdown with unique tags
 */
function populateTagFilter() {
    const tags = new Set();
    storiesState.allStories.forEach(story => {
        if (story.tags && Array.isArray(story.tags)) {
            story.tags.forEach(tag => tags.add(tag));
        }
    });

    const tagFilter = document.getElementById('tagFilter');
    const currentValue = tagFilter.value;

    // Clear existing options except "All Tags"
    tagFilter.innerHTML = '<option value="all">All Tags</option>';

    // Add tags
    Array.from(tags).sort().forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = `#${tag}`;
        tagFilter.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue !== 'all' && tags.has(currentValue)) {
        tagFilter.value = currentValue;
    }
}

/**
 * Apply filters to stories
 */
function applyStoriesFilters() {
    let filtered = [...storiesState.allStories];

    // Search filter
    if (storiesState.filters.search) {
        const searchLower = storiesState.filters.search.toLowerCase();
        filtered = filtered.filter(story =>
            story.text?.toLowerCase().includes(searchLower)
        );
    }

    // Community filter
    if (storiesState.filters.community !== 'all') {
        filtered = filtered.filter(story =>
            story.community === storiesState.filters.community
        );
    }

    // Tag filter
    if (storiesState.filters.tag !== 'all') {
        filtered = filtered.filter(story =>
            story.tags && story.tags.includes(storiesState.filters.tag)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        switch (storiesState.filters.sort) {
            case 'oldest':
                return (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0);
            case 'most_replies':
                return (b.replyCount || 0) - (a.replyCount || 0);
            case 'most_reactions':
                return (b.reactionCount || 0) - (a.reactionCount || 0);
            case 'recent':
            default:
                return (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0);
        }
    });

    storiesState.filteredStories = filtered;
    storiesState.currentPage = 1;
    displayStories();
}

/**
 * Display stories with pagination
 */
function displayStories() {
    const storiesList = document.getElementById('storiesList');
    const start = (storiesState.currentPage - 1) * storiesState.pageSize;
    const end = start + storiesState.pageSize;
    const pageStories = storiesState.filteredStories.slice(start, end);

    if (pageStories.length === 0) {
        storiesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📖</div>
        <h3>No Stories Found</h3>
        <p>Try adjusting your filters or search terms.</p>
      </div>
    `;
        document.getElementById('storiesPagination').style.display = 'none';
        return;
    }

    storiesList.innerHTML = pageStories.map(story => createStoryCard(story)).join('');

    // Update pagination
    const totalPages = Math.ceil(storiesState.filteredStories.length / storiesState.pageSize);
    document.getElementById('pageInfo').textContent = `Page ${storiesState.currentPage} of ${totalPages}`;
    document.getElementById('storiesPagination').style.display = totalPages > 1 ? 'flex' : 'none';
}

/**
 * Create story card HTML
 */
function createStoryCard(story) {
    const isSelected = storiesState.selectedStories.has(story.id);
    const createdDate = story.createdAt?.toDate();
    const communityBadge = story.community === 'global' ? '🌍 Global' : '📍 Local';

    return `
    <div class="story-item ${isSelected ? 'selected' : ''}" data-story-id="${story.id}">
      <input 
        type="checkbox" 
        class="story-checkbox" 
        ${isSelected ? 'checked' : ''}
        onchange="toggleStorySelection('${story.id}')"
        onclick="event.stopPropagation()"
      >
      <div class="story-content-wrapper" onclick="openStoryModal('${story.id}')">
        <div class="story-header">
          <div class="story-meta">
            <span>${communityBadge}</span>
            <span>•</span>
            <span>${formatTimeAgo(createdDate)}</span>
            <span>•</span>
            <span>Author: ${story.authorId || 'Unknown'}</span>
          </div>
        </div>
        
        <div class="story-text">${story.text || 'No content'}</div>
        
        ${story.tags && story.tags.length > 0 ? `
          <div class="story-tags">
            ${story.tags.map(tag => `<span class="story-tag">#${tag}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="story-stats">
          <span>💬 ${story.replyCount || 0} replies</span>
          <span>❤️ ${story.reactionCount || 0} reactions</span>
          ${story.views ? `<span>👁️ ${story.views} views</span>` : ''}
        </div>
      </div>
      
      <div class="story-actions" onclick="event.stopPropagation()">
        <button onclick="openStoryModal('${story.id}')">👁️ View</button>
        <button class="delete-btn" onclick="deleteSingleStory('${story.id}')">🗑️ Delete</button>
      </div>
    </div>
  `;
}

/**
 * Toggle story selection
 */
window.toggleStorySelection = function (storyId) {
    if (storiesState.selectedStories.has(storyId)) {
        storiesState.selectedStories.delete(storyId);
    } else {
        storiesState.selectedStories.add(storyId);
    }

    updateSelectionUI();
};

/**
 * Toggle select all stories
 */
window.toggleSelectAll = function () {
    const checkbox = document.getElementById('selectAllStories');
    const pageStories = getCurrentPageStories();

    if (checkbox.checked) {
        pageStories.forEach(story => storiesState.selectedStories.add(story.id));
    } else {
        pageStories.forEach(story => storiesState.selectedStories.delete(story.id));
    }

    updateSelectionUI();
    displayStories(); // Refresh to show checkboxes
};

/**
 * Clear all selections
 */
window.clearSelection = function () {
    storiesState.selectedStories.clear();
    document.getElementById('selectAllStories').checked = false;
    updateSelectionUI();
    displayStories();
};

/**
 * Get stories on current page
 */
function getCurrentPageStories() {
    const start = (storiesState.currentPage - 1) * storiesState.pageSize;
    const end = start + storiesState.pageSize;
    return storiesState.filteredStories.slice(start, end);
}

/**
 * Update selection UI elements
 */
function updateSelectionUI() {
    const count = storiesState.selectedStories.size;
    document.getElementById('selectedCount').textContent = count;
    document.getElementById('selectionInfo').textContent = `${count} selected`;

    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const bulkActionsBar = document.getElementById('bulkActionsBar');

    if (count > 0) {
        bulkDeleteBtn.style.display = 'inline-block';
        bulkActionsBar.style.display = 'flex';
    } else {
        bulkDeleteBtn.style.display = 'none';
        bulkActionsBar.style.display = 'none';
    }
}

/**
 * Delete single story
 */
window.deleteSingleStory = async function (storyId) {
    if (!confirm('Delete this story? This action cannot be undone.')) return;

    if (typeof showLoading === 'function') showLoading();

    try {
        if (!window.adminApi || typeof window.adminApi.deleteStory !== 'function') {
            alert('Admin API not available.');
            return;
        }

        await window.adminApi.deleteStory(storyId);
        alert('Story deleted successfully.');

        // Remove from local state
        storiesState.allStories = storiesState.allStories.filter(s => s.id !== storyId);
        storiesState.selectedStories.delete(storyId);

        applyStoriesFilters();
        updateStoriesStats();

    } catch (error) {
        console.error('Delete story failed:', error);
        alert('Failed to delete story. See console for details.');
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
};

/**
 * Bulk delete selected stories
 */
window.bulkDeleteStories = async function () {
    const count = storiesState.selectedStories.size;
    if (!confirm(`Delete ${count} selected ${count === 1 ? 'story' : 'stories'}? This action cannot be undone.`)) {
        return;
    }

    if (typeof showLoading === 'function') showLoading();

    try {
        if (!window.adminApi || typeof window.adminApi.deleteStory !== 'function') {
            alert('Admin API not available.');
            return;
        }

        const storyIds = Array.from(storiesState.selectedStories);
        let successCount = 0;
        let failCount = 0;

        for (const storyId of storyIds) {
            try {
                await window.adminApi.deleteStory(storyId);
                successCount++;
                storiesState.allStories = storiesState.allStories.filter(s => s.id !== storyId);
            } catch (error) {
                console.error(`Failed to delete story ${storyId}:`, error);
                failCount++;
            }
        }

        storiesState.selectedStories.clear();
        applyStoriesFilters();
        updateStoriesStats();
        updateSelectionUI();

        alert(`Deleted ${successCount} ${successCount === 1 ? 'story' : 'stories'}.${failCount > 0 ? ` ${failCount} failed.` : ''}`);

    } catch (error) {
        console.error('Bulk delete failed:', error);
        alert('Bulk delete operation failed.');
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
};

/**
 * Refresh stories
 */
window.refreshStories = function () {
    storiesState.selectedStories.clear();
    updateSelectionUI();
    loadStoriesData();
};

/**
 * Pagination controls
 */
window.loadStoriesPage = function (direction) {
    const totalPages = Math.ceil(storiesState.filteredStories.length / storiesState.pageSize);

    if (direction === 'next' && storiesState.currentPage < totalPages) {
        storiesState.currentPage++;
    } else if (direction === 'prev' && storiesState.currentPage > 1) {
        storiesState.currentPage--;
    }

    displayStories();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/**
 * Open story detail modal
 */
window.openStoryModal = async function (storyId) {
    try {
        const story = storiesState.allStories.find(s => s.id === storyId);
        if (!story) return;

        // Get story replies
        let replies = [];
        try {
            const repliesSnapshot = await getDocs(
                query(
                    collection(db, 'storyReplies'),
                    where('storyId', '==', storyId),
                    orderBy('createdAt', 'desc')
                )
            );

            replies = repliesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error loading replies:', error);
        }

        const modalBody = document.getElementById('storyModalBody');
        modalBody.innerHTML = `
      <div class="story-details">
        <div class="story-detail-header">
          <h3>Story Details</h3>
        </div>
        
        <div class="story-detail-content">
          <div class="story-detail-text">${story.text || 'No content'}</div>
          
          <div class="story-detail-meta">
            <div class="meta-item">
              <span class="meta-label">Story ID</span>
              <span class="meta-value">${storyId}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Author ID</span>
              <span class="meta-value">${story.authorId || 'Unknown'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Community</span>
              <span class="meta-value">${story.community === 'global' ? '🌍 Global' : '📍 Local'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Created</span>
              <span class="meta-value">${formatTimeAgo(story.createdAt?.toDate())}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Replies</span>
              <span class="meta-value">${story.replyCount || 0}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Reactions</span>
              <span class="meta-value">${story.reactionCount || 0}</span>
            </div>
          </div>
          
          ${story.tags && story.tags.length > 0 ? `
            <div class="story-tags">
              ${story.tags.map(tag => `<span class="story-tag">#${tag}</span>`).join('')}
            </div>
          ` : ''}
          
          ${replies.length > 0 ? `
            <div class="story-replies-section">
              <h4>Replies (${replies.length})</h4>
              ${replies.map(reply => `
                <div class="reply-item">
                  <div class="reply-text">${reply.text || 'No content'}</div>
                  <div class="reply-meta">
                    <span>Author: ${reply.authorId || 'Anonymous'}</span>
                    <span>•</span>
                    <span>${formatTimeAgo(reply.createdAt?.toDate())}</span>
                    ${reply.reactionCount ? `<span>• ❤️ ${reply.reactionCount}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="color: #6B7280; margin-top: 20px;">No replies yet.</p>'}
        </div>
        
        <div class="story-actions-footer">
          <button class="action-btn" onclick="closeModal('storyModal')">Close</button>
          <button class="action-btn danger" onclick="deleteStoryFromModal('${storyId}')">🗑️ Delete Story</button>
        </div>
      </div>
    `;

        document.getElementById('storyModal').classList.add('active');

    } catch (error) {
        console.error('Error opening story modal:', error);
        alert('Failed to load story details.');
    }
};

/**
 * Delete story from modal
 */
window.deleteStoryFromModal = async function (storyId) {
    closeModal('storyModal');
    await deleteSingleStory(storyId);
};

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Search input
    const searchInput = document.getElementById('storySearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            storiesState.filters.search = e.target.value;
            applyStoriesFilters();
        });
    }

    // Community filter
    const communityFilter = document.getElementById('communityFilter');
    if (communityFilter) {
        communityFilter.addEventListener('change', (e) => {
            storiesState.filters.community = e.target.value;
            applyStoriesFilters();
        });
    }

    // Tag filter
    const tagFilter = document.getElementById('tagFilter');
    if (tagFilter) {
        tagFilter.addEventListener('change', (e) => {
            storiesState.filters.tag = e.target.value;
            applyStoriesFilters();
        });
    }

    // Sort filter
    const sortFilter = document.getElementById('sortFilter');
    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            storiesState.filters.sort = e.target.value;
            applyStoriesFilters();
        });
    }
});

console.log('📖 Stories Management UI loaded');
