import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAOmXMwzVhnLpMsLiB8JzyT3ZVMG2w1JmE",
    authDomain: "feature-requests-7ee3c.firebaseapp.com",
    projectId: "feature-requests-7ee3c",
    storageBucket: "feature-requests-7ee3c.firebasestorage.app",
    messagingSenderId: "256362942849",
    appId: "1:256362942849:web:18b99ffe1341e9c3d05880"
};

// Admin emails
const ADMIN_EMAILS = ['averyopela1@gmail.com'];

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const requestForm = document.getElementById('request-form');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const requestsList = document.getElementById('requests-list');
const filterButtons = document.querySelectorAll('.filter-btn');
const authStatus = document.getElementById('auth-status');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmit = document.getElementById('auth-submit');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authError = document.getElementById('auth-error');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authUsername = document.getElementById('auth-username');
const closeModal = document.getElementById('close-modal');
const submitAuthPrompt = document.getElementById('submit-auth-prompt');
const loginToSubmit = document.getElementById('login-to-submit');
const authConfirmPassword = document.getElementById('auth-confirm-password');
const sortSelect = document.getElementById('sort-select');
const categoryInput = document.getElementById('category');
const categoryFilter = document.getElementById('category-filter');
const requestTypeInput = document.getElementById('request-type');
const typeFilter = document.getElementById('type-filter');

// Category display names
const CATEGORIES = {
    '': 'Uncategorized',
    'feature-requests': 'Feature Requests App',
    'project-infinity': 'Project Infinity',
    'boids': 'Boids',
    'chopping-choppers': 'Chopping Choppers',
    'gravity-golf': 'Gravity Golf',
    'watermelon-chicken-farm': 'Watermelon Chicken Farm',
    'new-game': 'New Game Idea'
};

// Request type display names
const REQUEST_TYPES = {
    'feature': 'Feature',
    'bug': 'Bug'
};

// Account modal elements
const accountModal = document.getElementById('account-modal');
const accountForm = document.getElementById('account-form');
const accountUsername = document.getElementById('account-username');
const accountSuccess = document.getElementById('account-success');
const accountError = document.getElementById('account-error');
const closeAccountModal = document.getElementById('close-account-modal');
const signOutBtn = document.getElementById('sign-out-btn');

let currentFilter = 'all';
let currentSort = 'votes';
let currentCategory = 'all';
let currentType = 'all';
let isSignUpMode = false;
let currentUser = null;
let currentUserData = null;
let usersCache = {};
let allRequests = [];

// Check if user is admin
function isAdmin() {
    return currentUser && ADMIN_EMAILS.includes(currentUser.email);
}

// Get user data from Firestore
async function getUserData(userId) {
    if (usersCache[userId]) return usersCache[userId];

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            usersCache[userId] = userDoc.data();
            return usersCache[userId];
        }
    } catch (error) {
        console.error('Error getting user data:', error);
    }
    return null;
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        currentUserData = await getUserData(user.uid);
    } else {
        currentUserData = null;
    }
    updateAuthUI(user);
    renderRequests(allRequests);
});

function updateAuthUI(user) {
    if (user) {
        const displayName = currentUserData?.username || user.email;
        authStatus.innerHTML = `
            <button id="account-btn" class="account-btn">${escapeHtml(displayName)}</button>
        `;
        document.getElementById('account-btn').addEventListener('click', openAccountModal);
        requestForm.classList.remove('hidden');
        submitAuthPrompt.classList.add('hidden');
    } else {
        authStatus.innerHTML = `<button id="sign-in-btn" class="sign-in-btn">Sign In</button>`;
        document.getElementById('sign-in-btn').addEventListener('click', openAuthModal);
        requestForm.classList.add('hidden');
        submitAuthPrompt.classList.remove('hidden');
    }
}

function openAuthModal() {
    authModal.classList.remove('hidden');
    authError.classList.add('hidden');
    authEmail.value = '';
    authPassword.value = '';
    authUsername.value = '';
    authConfirmPassword.value = '';
}

function closeAuthModalFn() {
    authModal.classList.add('hidden');
}

function openAccountModal() {
    accountModal.classList.remove('hidden');
    accountSuccess.classList.add('hidden');
    accountError.classList.add('hidden');
    accountUsername.value = currentUserData?.username || '';
}

function closeAccountModalFn() {
    accountModal.classList.add('hidden');
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
        authTitle.textContent = 'Sign Up';
        authSubmit.textContent = 'Sign Up';
        authSwitchText.textContent = 'Already have an account?';
        authSwitchBtn.textContent = 'Sign In';
        authConfirmPassword.classList.remove('hidden');
        authConfirmPassword.required = true;
        authUsername.classList.remove('hidden');
        authUsername.required = true;
        authEmail.placeholder = 'Email (optional)';
    } else {
        authTitle.textContent = 'Sign In';
        authSubmit.textContent = 'Sign In';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Sign Up';
        authConfirmPassword.classList.add('hidden');
        authConfirmPassword.required = false;
        authUsername.classList.add('hidden');
        authUsername.required = false;
        authEmail.placeholder = 'Email or Username';
    }
    authError.classList.add('hidden');
    authConfirmPassword.value = '';
    authUsername.value = '';
}

// Generate a placeholder email for users who don't provide one
function generatePlaceholderEmail(username) {
    const hash = Math.random().toString(36).substring(2, 10);
    return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${hash}@featurerequests.local`;
}

// Look up email by username for sign-in
async function findEmailByUsername(username) {
    try {
        const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
        const q = query(collection(db, 'users'));
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (data.username && data.username.toLowerCase() === username.toLowerCase()) {
                return data.email;
            }
        }
    } catch (error) {
        console.error('Error finding user by username:', error);
    }
    return null;
}

async function handleAuth(e) {
    e.preventDefault();
    let email = authEmail.value.trim();
    const password = authPassword.value;
    const confirmPassword = authConfirmPassword.value;
    const username = authUsername.value.trim();

    authError.classList.add('hidden');

    if (isSignUpMode) {
        if (password !== confirmPassword) {
            authError.textContent = 'Passwords do not match.';
            authError.classList.remove('hidden');
            return;
        }
        if (!username) {
            authError.textContent = 'Username is required.';
            authError.classList.remove('hidden');
            return;
        }
        // Generate placeholder email if not provided
        if (!email) {
            email = generatePlaceholderEmail(username);
        }
    } else {
        // Sign in mode - allow username instead of email
        if (!email) {
            authError.textContent = 'Email is required to sign in.';
            authError.classList.remove('hidden');
            return;
        }
        // Check if user entered username instead of email
        if (!email.includes('@')) {
            authSubmit.disabled = true;
            const foundEmail = await findEmailByUsername(email);
            if (foundEmail) {
                email = foundEmail;
            } else {
                authError.textContent = 'Username not found. Please use your email.';
                authError.classList.remove('hidden');
                authSubmit.disabled = false;
                return;
            }
        }
    }

    authSubmit.disabled = true;

    try {
        if (isSignUpMode) {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Save username to Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                username,
                email,
                createdAt: new Date().toISOString()
            });
            currentUserData = { username, email };
            usersCache[userCredential.user.uid] = currentUserData;
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        closeAuthModalFn();
    } catch (error) {
        console.error('Auth error:', error.code, error.message);
        authError.textContent = getErrorMessage(error.code, error.message);
        authError.classList.remove('hidden');
    } finally {
        authSubmit.disabled = false;
    }
}

async function handleAccountUpdate(e) {
    e.preventDefault();
    const username = accountUsername.value.trim();

    if (!username) {
        accountError.textContent = 'Username is required.';
        accountError.classList.remove('hidden');
        return;
    }

    accountError.classList.add('hidden');
    accountSuccess.classList.add('hidden');

    try {
        // Use setDoc with merge to create doc if it doesn't exist
        await setDoc(doc(db, 'users', currentUser.uid), {
            username,
            email: currentUser.email,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        if (!currentUserData) currentUserData = {};
        currentUserData.username = username;
        usersCache[currentUser.uid] = currentUserData;
        accountSuccess.classList.remove('hidden');
        updateAuthUI(currentUser);
    } catch (error) {
        console.error('Error updating username:', error);
        accountError.textContent = 'Failed to update username.';
        accountError.classList.remove('hidden');
    }
}

function getErrorMessage(code, message) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/operation-not-allowed':
            return 'Email/Password sign-in is not enabled. Enable it in Firebase Console.';
        case 'auth/configuration-not-found':
            return 'Firebase Auth not configured. Check Firebase Console.';
        default:
            return message || 'An error occurred. Please try again.';
    }
}

async function handleSignOut() {
    try {
        await signOut(auth);
        closeAccountModalFn();
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Event listeners for auth
authForm.addEventListener('submit', handleAuth);
authSwitchBtn.addEventListener('click', toggleAuthMode);
closeModal.addEventListener('click', closeAuthModalFn);
loginToSubmit.addEventListener('click', openAuthModal);
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModalFn();
});

// Event listeners for account
accountForm.addEventListener('submit', handleAccountUpdate);
closeAccountModal.addEventListener('click', closeAccountModalFn);
signOutBtn.addEventListener('click', handleSignOut);
accountModal.addEventListener('click', (e) => {
    if (e.target === accountModal) closeAccountModalFn();
});

// Submit new request
requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        openAuthModal();
        return;
    }

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const category = categoryInput.value;
    const requestType = requestTypeInput ? requestTypeInput.value : 'feature';

    if (!title || !description) return;

    const submitBtn = requestForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        await addDoc(collection(db, 'requests'), {
            title,
            description,
            category,
            type: requestType,
            status: 'pending',
            votes: 0,
            upvoters: [],
            downvoters: [],
            createdAt: new Date().toISOString(),
            userId: currentUser.uid,
            username: currentUserData?.username || currentUser.email
        });

        titleInput.value = '';
        descriptionInput.value = '';
        categoryInput.value = '';
        if (requestTypeInput) requestTypeInput.value = 'feature';
    } catch (error) {
        console.error('Error adding request:', error);
        alert('Failed to submit request. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
});

// Vote on a request (direction: 1 for upvote, -1 for downvote)
async function vote(requestId, direction) {
    if (!currentUser) {
        openAuthModal();
        return;
    }

    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    const upvoters = request.upvoters || [];
    const downvoters = request.downvoters || [];
    const userId = currentUser.uid;

    const hasUpvoted = upvoters.includes(userId);
    const hasDownvoted = downvoters.includes(userId);

    const requestRef = doc(db, 'requests', requestId);
    let voteChange = 0;
    const updates = {};

    if (direction === 1) {
        // Upvote
        if (hasUpvoted) {
            // Remove upvote
            updates.upvoters = arrayRemove(userId);
            voteChange = -1;
        } else {
            // Add upvote
            updates.upvoters = arrayUnion(userId);
            voteChange = 1;
            if (hasDownvoted) {
                // Remove downvote
                updates.downvoters = arrayRemove(userId);
                voteChange = 2;
            }
        }
    } else {
        // Downvote
        if (hasDownvoted) {
            // Remove downvote
            updates.downvoters = arrayRemove(userId);
            voteChange = 1;
        } else {
            // Add downvote
            updates.downvoters = arrayUnion(userId);
            voteChange = -1;
            if (hasUpvoted) {
                // Remove upvote
                updates.upvoters = arrayRemove(userId);
                voteChange = -2;
            }
        }
    }

    try {
        // Calculate new vote count
        const newVotes = (request.votes || 0) + voteChange;
        updates.votes = newVotes;
        await updateDoc(requestRef, updates);
    } catch (error) {
        console.error('Error voting:', error);
    }
}

// Update request status (admin only)
async function updateStatus(requestId, status) {
    if (!isAdmin()) return;
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, { status });
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Delete request (admin only)
async function deleteRequest(requestId) {
    if (!isAdmin()) return;
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
        await deleteDoc(doc(db, 'requests', requestId));
    } catch (error) {
        console.error('Error deleting request:', error);
    }
}

// Sort requests
function sortRequests(requests) {
    const sorted = [...requests];
    if (currentSort === 'votes') {
        sorted.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else {
        sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return sorted;
}

// Render requests
function renderRequests(requests) {
    // Filter by status
    let filtered = currentFilter === 'all'
        ? requests
        : requests.filter(r => r.status === currentFilter);

    // Filter by category
    if (currentCategory !== 'all') {
        filtered = filtered.filter(r => (r.category || '') === currentCategory);
    }

    // Filter by type
    if (currentType !== 'all') {
        filtered = filtered.filter(r => (r.type || 'feature') === currentType);
    }

    const sorted = sortRequests(filtered);

    if (sorted.length === 0) {
        requestsList.innerHTML = '<p class="empty-state">No requests found.</p>';
        return;
    }

    const adminControls = isAdmin();
    const userId = currentUser?.uid;

    requestsList.innerHTML = sorted.map(request => {
        const upvoters = request.upvoters || [];
        const downvoters = request.downvoters || [];
        const hasUpvoted = userId && upvoters.includes(userId);
        const hasDownvoted = userId && downvoters.includes(userId);
        const voteCount = request.votes || 0;
        const categoryName = CATEGORIES[request.category || ''] || 'Uncategorized';
        const categoryClass = request.category || 'uncategorized';
        const requestType = request.type || 'feature';
        const typeName = REQUEST_TYPES[requestType] || 'Feature';

        return `
        <div class="request-card" data-id="${request.id}">
            <div class="vote-section">
                <button class="vote-btn upvote ${hasUpvoted ? 'active' : ''}" onclick="window.handleVote('${request.id}', 1)">&#9650;</button>
                <span class="vote-count ${voteCount > 0 ? 'positive' : voteCount < 0 ? 'negative' : ''}">${voteCount}</span>
                <button class="vote-btn downvote ${hasDownvoted ? 'active' : ''}" onclick="window.handleVote('${request.id}', -1)">&#9660;</button>
            </div>
            <div class="request-content">
                <div class="request-header">
                    <h3 class="request-title">${escapeHtml(request.title)}</h3>
                    <span class="type-badge type-${requestType}">${typeName}</span>
                    <span class="category-badge category-${categoryClass}">${categoryName}</span>
                </div>
                <p class="request-description">${escapeHtml(request.description)}</p>
                <div class="request-meta">
                    <span class="status-badge status-${request.status}">${formatStatus(request.status)}</span>
                    <span>${formatDate(request.createdAt)}</span>
                    ${request.username ? `<span class="request-author">by ${escapeHtml(request.username)}</span>` : ''}
                </div>
                ${adminControls ? `
                <div class="admin-controls">
                    <select onchange="window.handleStatusChange('${request.id}', this.value)">
                        <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="in-progress" ${request.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="rejected" ${request.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    </select>
                    <button class="delete-btn" onclick="window.handleDelete('${request.id}')">Delete</button>
                </div>
                ` : ''}
            </div>
        </div>
    `}).join('');
}

// Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatStatus(status) {
    return status.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Expose functions globally for onclick
window.handleVote = vote;
window.handleStatusChange = updateStatus;
window.handleDelete = deleteRequest;

// Filter buttons
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderRequests(allRequests);
    });
});

// Sort select
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderRequests(allRequests);
    });
}

// Category filter
if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        renderRequests(allRequests);
    });
}

// Type filter
if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
        currentType = e.target.value;
        renderRequests(allRequests);
    });
}

// Load and listen to requests
function loadRequests() {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        allRequests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderRequests(allRequests);
    }, (error) => {
        console.error('Error loading requests:', error);
        requestsList.innerHTML = '<p class="empty-state">Failed to load requests. Check Firebase configuration.</p>';
    });
}

// Initialize
loadRequests();
