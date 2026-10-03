// API Base URL
const API_URL = '/api';

// DOM Elements
const authPage = document.getElementById('authPage');
const mainPage = document.getElementById('mainPage');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authTabs = document.querySelectorAll('.auth-tab');
const currentUserSpan = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const composeBtn = document.querySelector('.compose-btn');
const closeComposeBtn = document.getElementById('closeCompose');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const inboxList = document.getElementById('inboxList');
const sentList = document.getElementById('sentList');
const starredList = document.getElementById('starredList');
const draftsList = document.getElementById('draftsList');
const composeForm = document.getElementById('composeForm');
const mailDetailView = document.getElementById('mailDetailView');
const mailDetail = document.getElementById('mailDetail');
const backBtn = document.getElementById('backBtn');
const starBtn = document.getElementById('starBtn');
const deleteBtn = document.getElementById('deleteBtn');
const inboxBadge = document.getElementById('inboxBadge');
const caffeenaBtn = document.getElementById('caffeenaBtn');
const caffeenaModal = document.getElementById('caffeenaModal');
const closeModal = document.getElementById('closeModal');
const caffeenaMessages = document.getElementById('caffeenaMessages');
const caffeenaSuggestions = document.getElementById('caffeenaSuggestions');

// State
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let currentMail = null;
let currentView = 'inbox';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (token && user) {
        showMainPage();
    }
});

// Auth Tab Switching
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        loginForm.classList.toggle('active', tabName === 'login');
        registerForm.classList.toggle('active', tabName === 'register');
    });
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            user = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            showMainPage();
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        alert('Error logging in. Please try again.');
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            user = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            showMainPage();
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        alert('Error registering. Please try again.');
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    token = null;
    user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showAuthPage();
});

// Compose Button
composeBtn.addEventListener('click', () => {
    switchView('compose');
});

closeComposeBtn.addEventListener('click', () => {
    switchView('inbox');
});

// Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        const view = item.dataset.view;
        switchView(view);
    });
});

// Switch View
function switchView(view) {
    currentView = view;
    
    navItems.forEach(i => i.classList.remove('active'));
    const activeNav = document.querySelector(`[data-view="${view}"]`);
    if (activeNav) activeNav.classList.add('active');
    
    views.forEach(v => v.classList.remove('active'));
    
    if (view === 'inbox') {
        document.getElementById('inboxView').classList.add('active');
        loadInbox();
    } else if (view === 'sent') {
        document.getElementById('sentView').classList.add('active');
        loadSent();
    } else if (view === 'starred') {
        document.getElementById('starredView').classList.add('active');
        loadStarred();
    } else if (view === 'drafts') {
        document.getElementById('draftsView').classList.add('active');
        loadDrafts();
    } else if (view === 'compose') {
        document.getElementById('composeView').classList.add('active');
    }
}

// Load Inbox
async function loadInbox() {
    try {
        const response = await fetch(`${API_URL}/mail/inbox`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            renderMailList(data.mails, inboxList, 'inbox');
            updateInboxBadge(data.mails);
        }
    } catch (error) {
        console.error('Error loading inbox:', error);
    }
}

// Load Sent
async function loadSent() {
    try {
        const response = await fetch(`${API_URL}/mail/sent`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            renderMailList(data.mails, sentList, 'sent');
        }
    } catch (error) {
        console.error('Error loading sent:', error);
    }
}

// Load Starred (placeholder - local storage for now)
function loadStarred() {
    const starred = JSON.parse(localStorage.getItem('starred') || '[]');
    renderMailList(starred, starredList, 'starred');
}

// Load Drafts (placeholder - local storage for now)
function loadDrafts() {
    const drafts = JSON.parse(localStorage.getItem('drafts') || '[]');
    renderMailList(drafts, draftsList, 'drafts');
}

// Update Inbox Badge
function updateInboxBadge(mails) {
    const unreadCount = mails.filter(mail => !mail.isRead).length;
    inboxBadge.textContent = unreadCount;
    inboxBadge.style.display = unreadCount > 0 ? 'inline' : 'none';
}

// Render Mail List
function renderMailList(mails, container, type) {
    container.innerHTML = '';
    
    if (!mails || mails.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 40px;">No mails found</p>';
        return;
    }
    
    mails.forEach(mail => {
        const mailItem = document.createElement('div');
        mailItem.className = `mail-item ${!mail.isRead ? 'unread' : ''}`;
        
        const senderName = type === 'inbox' ? (mail.sender?.username || 'Unknown') : (mail.recipient?.username || 'Unknown');
        const date = mail.createdAt ? new Date(mail.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
        
        mailItem.innerHTML = `
            <div class="mail-checkbox" data-mail-id="${mail._id || mail.id}"></div>
            <div class="mail-content">
                <div class="mail-header">
                    <span class="mail-sender">${senderName}</span>
                    <span class="mail-date">${date}</span>
                </div>
                <div class="mail-subject">${mail.subject || 'No Subject'}</div>
                <div class="mail-preview">${(mail.body || '').substring(0, 100)}...</div>
            </div>
        `;
        
        // Checkbox functionality
        const checkbox = mailItem.querySelector('.mail-checkbox');
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            checkbox.classList.toggle('checked');
        });
        
        mailItem.addEventListener('click', () => showMailDetail(mail, type));
        container.appendChild(mailItem);
    });
}

// Show Mail Detail
async function showMailDetail(mail, type) {
    currentMail = mail;
    
    if (!mail.isRead && type === 'inbox' && mail._id) {
        await markAsRead(mail._id);
    }
    
    const senderName = type === 'inbox' ? (mail.sender?.username || 'Unknown') : (mail.recipient?.username || 'Unknown');
    const senderEmail = type === 'inbox' ? (mail.sender?.email || 'No email') : (mail.recipient?.email || 'No email');
    const date = mail.createdAt ? new Date(mail.createdAt).toLocaleString() : new Date().toLocaleString();
    
    // Check if starred
    const starred = JSON.parse(localStorage.getItem('starred') || '[]');
    const isStarred = starred.some(s => s._id === mail._id || s.id === mail.id);
    
    starBtn.textContent = isStarred ? '⭐' : '☆';
    
    mailDetail.innerHTML = `
        <div class="mail-detail-header">
            <div class="mail-detail-subject">${mail.subject || 'No Subject'}</div>
            <div class="mail-detail-meta">
                <span>From: ${senderName} (${senderEmail})</span>
                <span>${date}</span>
            </div>
        </div>
        <div class="mail-detail-body">${mail.body || 'No content'}</div>
    `;
    
    views.forEach(v => v.classList.remove('active'));
    mailDetailView.classList.add('active');
}

// Mark as Read
async function markAsRead(mailId) {
    try {
        await fetch(`${API_URL}/mail/${mailId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (error) {
        console.error('Error marking as read:', error);
    }
}

// Star Toggle
starBtn.addEventListener('click', () => {
    if (!currentMail) return;
    
    const starred = JSON.parse(localStorage.getItem('starred') || '[]');
    const index = starred.findIndex(s => s._id === currentMail._id || s.id === currentMail.id);
    
    if (index > -1) {
        starred.splice(index, 1);
        starBtn.textContent = '☆';
    } else {
        starred.push(currentMail);
        starBtn.textContent = '⭐';
    }
    
    localStorage.setItem('starred', JSON.stringify(starred));
});

// Delete Mail
deleteBtn.addEventListener('click', async () => {
    if (!currentMail || !currentMail._id) return;
    
    if (confirm('Are you sure you want to delete this email?')) {
        try {
            await fetch(`${API_URL}/mail/${currentMail._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // Also remove from starred if present
            const starred = JSON.parse(localStorage.getItem('starred') || '[]');
            const filteredStarred = starred.filter(s => s._id !== currentMail._id);
            localStorage.setItem('starred', JSON.stringify(filteredStarred));
            
            switchView('inbox');
        } catch (error) {
            console.error('Error deleting mail:', error);
            alert('Error deleting mail');
        }
    }
});

// Back Button
backBtn.addEventListener('click', () => {
    mailDetailView.classList.remove('active');
    switchView(currentView === 'inbox' ? 'inbox' : 'sent');
});

// Compose Mail
composeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const recipientEmail = document.getElementById('recipientEmail').value;
    const subject = document.getElementById('subject').value;
    const body = document.getElementById('body').value;
    
    try {
        const response = await fetch(`${API_URL}/mail/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ recipientEmail, subject, body })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Mail sent successfully!');
            composeForm.reset();
            switchView('sent');
        } else {
            alert(data.message || 'Failed to send mail');
        }
    } catch (error) {
        alert('Error sending mail. Please try again.');
    }
});

// Save Draft
document.getElementById('saveDraft').addEventListener('click', () => {
    const recipientEmail = document.getElementById('recipientEmail').value;
    const subject = document.getElementById('subject').value;
    const body = document.getElementById('body').value;
    
    const draft = {
        id: Date.now(),
        recipientEmail,
        subject,
        body,
        createdAt: new Date().toISOString()
    };
    
    const drafts = JSON.parse(localStorage.getItem('drafts') || '[]');
    drafts.push(draft);
    localStorage.setItem('drafts', JSON.stringify(drafts));
    
    alert('Draft saved!');
    composeForm.reset();
    switchView('drafts');
});

// Caffeena AI Modal
caffeenaBtn.addEventListener('click', () => {
    caffeenaModal.classList.remove('hidden');
    askCaffeena('check_new_mail');
});

closeModal.addEventListener('click', () => {
    caffeenaModal.classList.add('hidden');
});

// Ask Caffeena
async function askCaffeena(action, mailContent = null) {
    try {
        const response = await fetch(`${API_URL}/ai/caffeena`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action, mailContent })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayCaffeenaResponse(data);
        }
    } catch (error) {
        console.error('Error asking Caffeena:', error);
        displayCaffeenaResponse({
            agent: 'Caffeena',
            avatar: '☕',
            message: 'I encountered an error. Please try again.',
            suggestions: ['Try again', 'Close']
        });
    }
}

// Display Caffeena Response
function displayCaffeenaResponse(data) {
    caffeenaMessages.innerHTML = `
        <div class="caffeena-message">
            <strong>${data.agent}:</strong> ${data.message}
        </div>
    `;
    
    caffeenaSuggestions.innerHTML = '';
    
    if (data.suggestions && data.suggestions.length > 0) {
        data.suggestions.forEach(suggestion => {
            const btn = document.createElement('button');
            btn.className = 'suggestion-btn';
            btn.textContent = suggestion;
            btn.addEventListener('click', () => handleCaffeenaSuggestion(suggestion));
            caffeenaSuggestions.appendChild(btn);
        });
    }
}

// Handle Caffeena Suggestions
function handleCaffeenaSuggestion(suggestion) {
    const lowerSuggestion = suggestion.toLowerCase();
    
    if (lowerSuggestion.includes('read now') || lowerSuggestion.includes('read anyway')) {
        caffeenaModal.classList.add('hidden');
        switchView('inbox');
    } else if (lowerSuggestion.includes('mark as spam')) {
        if (currentMail && currentMail._id) {
            deleteMail(currentMail._id);
        }
        caffeenaModal.classList.add('hidden');
    } else if (lowerSuggestion.includes('spam check')) {
        askCaffeena('spam_check');
    } else if (lowerSuggestion.includes('analyze')) {
        if (currentMail) {
            askCaffeena('analyze_mail', currentMail.body);
        }
    } else if (lowerSuggestion.includes('suggest reply')) {
        if (currentMail) {
            askCaffeena('suggest_reply', currentMail.body);
        }
    } else if (lowerSuggestion.includes('delete')) {
        if (currentMail && currentMail._id) {
            deleteMail(currentMail._id);
        }
        caffeenaModal.classList.add('hidden');
    } else if (lowerSuggestion.includes('close')) {
        caffeenaModal.classList.add('hidden');
    } else {
        // Show the suggestion as a message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'caffeena-message';
        messageDiv.textContent = suggestion;
        caffeenaMessages.appendChild(messageDiv);
    }
}

// Delete Mail
async function deleteMail(mailId) {
    try {
        await fetch(`${API_URL}/mail/${mailId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadInbox();
    } catch (error) {
        console.error('Error deleting mail:', error);
    }
}

// Show Pages
function showAuthPage() {
    authPage.classList.remove('hidden');
    mainPage.classList.add('hidden');
}

function showMainPage() {
    authPage.classList.add('hidden');
    mainPage.classList.remove('hidden');
    currentUserSpan.textContent = user.username;
    switchView('inbox');
}
