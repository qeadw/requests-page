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
const ADMIN_EMAILS = ['averyopela1@gmail.com', 'lukehuffstetler80@gmail.com'];

// ============== AUTOMODERATION FILTER ==============
// Banned words and patterns (lowercase)
const BANNED_WORDS = [
    // Common profanity
    'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'piss', 'dick', 'cock', 'pussy',
    'bastard', 'whore', 'slut', 'cunt', 'fag', 'faggot', 'nigger', 'nigga', 'retard',
    'retarded', 'spic', 'kike', 'chink', 'gook', 'wetback', 'beaner', 'cracker',
    'honky', 'dyke', 'tranny', 'twat', 'wanker', 'bollocks', 'arse', 'arsehole',
    'asshole', 'bullshit', 'horseshit', 'motherfucker', 'fucker', 'dumbass', 'jackass',
    'dipshit', 'shithead', 'fuckhead', 'dickhead', 'prick', 'douche', 'douchebag',
    // Slurs and hate speech
    'nazi', 'hitler', 'kkk', 'klan',
    // Pregnancy-related
    'pregnant', 'pregnancy', 'abortion', 'miscarriage', 'fetus', 'embryo', 'conceive',
    'conception', 'prenatal', 'trimester', 'maternity', 'expecting', 'baby bump',
    'morning sickness', 'labor', 'delivery', 'childbirth', 'giving birth', 'due date',
    'ultrasound', 'obgyn', 'midwife', 'cesarean', 'c-section', 'epidural', 'contraction',
    // Additional offensive terms
    'rape', 'rapist', 'molest', 'pedophile', 'pedo', 'incest'
];

// Character substitutions for leetspeak detection
const CHAR_SUBSTITUTIONS = {
    '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
    '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '(': 'c', ')': 'c',
    '<': 'c', '>': 'c', '{': 'c', '}': 'c', '[': 'c', ']': 'c',
    'ä': 'a', 'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
    'ë': 'e', 'è': 'e', 'é': 'e', 'ê': 'e',
    'ï': 'i', 'ì': 'i', 'í': 'i', 'î': 'i',
    'ö': 'o', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
    'ü': 'u', 'ù': 'u', 'ú': 'u', 'û': 'u',
    'ñ': 'n', 'ç': 'c', 'ß': 'ss',
    '₀': 'o', '₁': 'i', '₂': 'z', '₃': 'e', '₄': 'a', '₅': 's', '₆': 'g', '₇': 't', '₈': 'b', '₉': 'g',
    '⁰': 'o', '¹': 'i', '²': 'z', '³': 'e', '⁴': 'a', '⁵': 's', '⁶': 'g', '⁷': 't', '⁸': 'b', '⁹': 'g'
};

// Normalize text to catch bypasses
function normalizeText(text) {
    if (!text) return { withSpaces: '', noSpaces: '' };

    // Convert to lowercase
    let normalized = text.toLowerCase();

    // Apply character substitutions
    for (const [char, replacement] of Object.entries(CHAR_SUBSTITUTIONS)) {
        normalized = normalized.split(char).join(replacement);
    }

    // Remove repeated characters (e.g., "fuuuuck" -> "fuck")
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    // Remove spaces between letters that might be used to bypass (e.g., "f u c k")
    normalized = normalized.replace(/\s+/g, ' ');

    // Also create a version with no spaces for detecting spaced-out words
    const noSpaces = normalized.replace(/\s/g, '');

    return { withSpaces: normalized, noSpaces };
}

// Check if text contains banned content
function containsBannedContent(text) {
    if (!text) return { blocked: false };

    const { withSpaces, noSpaces } = normalizeText(text);

    for (const word of BANNED_WORDS) {
        // Check with spaces (word boundaries)
        const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
        if (wordRegex.test(withSpaces)) {
            return { blocked: true, word: word };
        }

        // Check without spaces (catches "f u c k")
        if (noSpaces.includes(word)) {
            return { blocked: true, word: word };
        }

        // Check for partial matches in longer words (e.g., "fucking" contains "fuck")
        if (withSpaces.includes(word)) {
            return { blocked: true, word: word };
        }
    }

    return { blocked: false };
}

// Validate and sanitize user input
function validateContent(title, description) {
    const titleCheck = containsBannedContent(title);
    if (titleCheck.blocked) {
        return { valid: false, message: 'Your title contains inappropriate content. Please revise and try again.' };
    }

    const descCheck = containsBannedContent(description);
    if (descCheck.blocked) {
        return { valid: false, message: 'Your description contains inappropriate content. Please revise and try again.' };
    }

    return { valid: true };
}

function validateComment(text) {
    const check = containsBannedContent(text);
    if (check.blocked) {
        return { valid: false, message: 'Your comment contains inappropriate content. Please revise and try again.' };
    }
    return { valid: true };
}
// ============== END AUTOMODERATION FILTER ==============

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
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authHint = document.getElementById('auth-hint');
const closeModal = document.getElementById('close-modal');
const submitAuthPrompt = document.getElementById('submit-auth-prompt');
const loginToSubmit = document.getElementById('login-to-submit');

// Old fixed password for existing users who need to log in
const OLD_FIXED_PASSWORD = 'FeatureRequests2024!';
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
    'plant-life': 'Plant Life',
    'rank-roller': 'Rank Roller',
    'combo-surge': 'Combo Surge',
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

let currentFilter = 'pending';
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

// Get username for a user ID (with caching)
async function getUsername(userId) {
    const userData = await getUserData(userId);
    return userData?.username || userId.substring(0, 8) + '...';
}

// Get usernames for an array of user IDs
async function getUsernames(userIds) {
    const usernames = await Promise.all(userIds.map(id => getUsername(id)));
    return usernames;
}

// Show voters modal for admins
async function showVoters(requestId, type) {
    if (!isAdmin()) return;

    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    const voters = type === 'up' ? (request.upvoters || []) : (request.downvoters || []);
    if (voters.length === 0) {
        alert(`No ${type === 'up' ? 'upvoters' : 'downvoters'} yet.`);
        return;
    }

    const usernames = await getUsernames(voters);
    const title = type === 'up' ? 'Upvoters' : 'Downvoters';
    alert(`${title} (${usernames.length}):\n\n${usernames.join('\n')}`);
}

// Expose for onclick
window.showVoters = showVoters;

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
    // Show/hide user-specific filter buttons
    const userFilters = document.querySelectorAll('.user-filter');
    const adminFilters = document.querySelectorAll('.admin-filter');

    if (user) {
        const displayName = currentUserData?.username || user.email;
        authStatus.innerHTML = `
            <button id="account-btn" class="account-btn">${escapeHtml(displayName)}</button>
        `;
        document.getElementById('account-btn').addEventListener('click', openAccountModal);
        requestForm.classList.remove('hidden');
        submitAuthPrompt.classList.add('hidden');

        // Show user filters
        userFilters.forEach(btn => btn.classList.remove('hidden'));

        // Show admin filters if user is admin
        if (isAdmin()) {
            adminFilters.forEach(btn => btn.classList.remove('hidden'));
        } else {
            adminFilters.forEach(btn => btn.classList.add('hidden'));
        }
    } else {
        authStatus.innerHTML = `<button id="sign-in-btn" class="sign-in-btn">Sign In</button>`;
        document.getElementById('sign-in-btn').addEventListener('click', openAuthModal);
        requestForm.classList.add('hidden');
        submitAuthPrompt.classList.remove('hidden');

        // Hide user and admin filters
        userFilters.forEach(btn => btn.classList.add('hidden'));
        adminFilters.forEach(btn => btn.classList.add('hidden'));
    }
}

function openAuthModal() {
    authModal.classList.remove('hidden');
    authError.classList.add('hidden');
    authUsername.value = '';
    authPassword.value = '';
    // Show hint for existing users
    if (!isSignUpMode) {
        authHint.textContent = 'Existing users: use password "FeatureRequests2024!"';
        authHint.style.color = '#888';
    } else {
        authHint.textContent = '';
    }
}

function closeAuthModalFn() {
    authModal.classList.add('hidden');
    authPassword.value = '';
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
        authHint.textContent = '';
    } else {
        authTitle.textContent = 'Sign In';
        authSubmit.textContent = 'Sign In';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Sign Up';
        authHint.textContent = 'Existing users: use password "FeatureRequests2024!"';
        authHint.style.color = '#888';
    }
    authError.classList.add('hidden');
    authUsername.value = '';
    authPassword.value = '';
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
    const username = authUsername.value.trim();
    const password = authPassword.value;

    authError.classList.add('hidden');

    if (!username) {
        authError.textContent = 'Username is required.';
        authError.classList.remove('hidden');
        return;
    }

    if (!password) {
        authError.textContent = 'Password is required.';
        authError.classList.remove('hidden');
        return;
    }

    if (isSignUpMode && password.length < 6) {
        authError.textContent = 'Password must be at least 6 characters.';
        authError.classList.remove('hidden');
        return;
    }

    authSubmit.disabled = true;

    try {
        if (isSignUpMode) {
            // Check if username already exists
            const existingEmail = await findEmailByUsername(username);
            if (existingEmail) {
                authError.textContent = 'Username already taken. Please choose another.';
                authError.classList.remove('hidden');
                authSubmit.disabled = false;
                return;
            }

            // Generate email for this username
            const email = generatePlaceholderEmail(username);
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
            // Sign in mode - find email by username
            const foundEmail = await findEmailByUsername(username);
            if (!foundEmail) {
                authError.textContent = 'Username not found. Sign up to create an account.';
                authError.classList.remove('hidden');
                authSubmit.disabled = false;
                return;
            }
            await signInWithEmailAndPassword(auth, foundEmail, password);
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

    // Automoderation check
    const validation = validateContent(title, description);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

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
    const userId = currentUser?.uid;

    // Filter by status or special filters
    let filtered;
    if (currentFilter === 'all') {
        filtered = requests;
    } else if (currentFilter === 'my-requests') {
        // Show all requests by the current user (all statuses)
        filtered = userId ? requests.filter(r => r.userId === userId) : [];
    } else if (currentFilter === 'my-rejected') {
        // Show rejected requests by the current user
        filtered = userId ? requests.filter(r => r.userId === userId && r.status === 'rejected') : [];
    } else if (currentFilter === 'rejected') {
        // Admin view - show all rejected requests
        filtered = requests.filter(r => r.status === 'rejected');
    } else {
        // Standard status filter
        filtered = requests.filter(r => r.status === currentFilter);
    }

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
                ${adminControls ? `
                    <span class="admin-vote-info" onclick="window.showVoters('${request.id}', 'up')" title="Click to see upvoters">+${upvoters.length}</span>
                ` : ''}
                <span class="vote-count ${voteCount > 0 ? 'positive' : voteCount < 0 ? 'negative' : ''}">${voteCount}</span>
                ${adminControls ? `
                    <span class="admin-vote-info" onclick="window.showVoters('${request.id}', 'down')" title="Click to see downvoters">-${downvoters.length}</span>
                ` : ''}
                <button class="vote-btn downvote ${hasDownvoted ? 'active' : ''}" onclick="window.handleVote('${request.id}', -1)">&#9660;</button>
            </div>
            <div class="request-content">
                <div class="request-header">
                    <h3 class="request-title" id="request-title-${request.id}">${escapeHtml(request.title)}</h3>
                    <span class="type-badge type-${requestType}">${typeName}</span>
                    <span class="category-badge category-${categoryClass}">${categoryName}</span>
                    ${adminControls || (currentUser && request.userId === currentUser.uid) ? `
                        <button class="edit-request-btn" onclick="window.editRequest('${request.id}')">Edit</button>
                    ` : ''}
                </div>
                <p class="request-description" id="request-desc-${request.id}">${escapeHtml(request.description)}</p>
                ${request.editedAt ? '<span class="edited-indicator">(edited)</span>' : ''}
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
                <div class="comments-section">
                    <button class="toggle-comments-btn" onclick="window.toggleComments('${request.id}')">
                        Comments (${(request.comments || []).length})
                    </button>
                    <div class="comments-container hidden" id="comments-${request.id}">
                        <div class="comments-list">
                            ${(request.comments || []).map(comment => `
                                <div class="comment">
                                    <div class="comment-header">
                                        <span class="comment-author">${escapeHtml(comment.username || 'Anonymous')}</span>
                                        <span class="comment-date">${formatDate(comment.createdAt)}${comment.editedAt ? ' (edited)' : ''}</span>
                                        ${adminControls || (currentUser && comment.userId === currentUser.uid) ? `
                                            <button class="comment-edit-btn" onclick="window.editComment('${request.id}', '${comment.id}')">Edit</button>
                                            <button class="comment-delete-btn" onclick="window.deleteComment('${request.id}', '${comment.id}')">&times;</button>
                                        ` : ''}
                                    </div>
                                    <p class="comment-text" id="comment-text-${comment.id}">${escapeHtml(comment.text)}</p>
                                </div>
                            `).join('') || '<p class="no-comments">No comments yet.</p>'}
                        </div>
                        ${currentUser ? `
                            <form class="comment-form" onsubmit="window.addComment(event, '${request.id}')">
                                <input type="text" placeholder="Add a comment..." class="comment-input" required>
                                <button type="submit">Post</button>
                            </form>
                        ` : '<p class="comment-login-prompt">Sign in to comment</p>'}
                    </div>
                </div>
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

// Toggle comments visibility
function toggleComments(requestId) {
    const container = document.getElementById(`comments-${requestId}`);
    if (container) {
        container.classList.toggle('hidden');
    }
}

// Add a comment to a request
async function addComment(event, requestId) {
    event.preventDefault();
    if (!currentUser) {
        openAuthModal();
        return;
    }

    const form = event.target;
    const input = form.querySelector('.comment-input');
    const text = input.value.trim();

    if (!text) return;

    // Automoderation check for comments
    const validation = validateComment(text);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;

    try {
        const request = allRequests.find(r => r.id === requestId);
        if (!request) return;

        const newComment = {
            id: Date.now().toString(),
            text,
            userId: currentUser.uid,
            username: currentUserData?.username || currentUser.email,
            createdAt: new Date().toISOString()
        };

        const comments = [...(request.comments || []), newComment];

        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, { comments });

        input.value = '';
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Failed to add comment. Please try again.');
    } finally {
        submitBtn.disabled = false;
    }
}

// Delete a comment
async function deleteComment(requestId, commentId) {
    if (!currentUser) return;

    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    const comment = (request.comments || []).find(c => c.id === commentId);
    if (!comment) return;

    // Check permission: admin or comment owner
    if (!isAdmin() && comment.userId !== currentUser.uid) return;

    if (!confirm('Delete this comment?')) return;

    try {
        const comments = (request.comments || []).filter(c => c.id !== commentId);
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, { comments });
    } catch (error) {
        console.error('Error deleting comment:', error);
    }
}

// Edit a comment
async function editComment(requestId, commentId) {
    if (!currentUser) return;

    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    const comment = (request.comments || []).find(c => c.id === commentId);
    if (!comment) return;

    // Check permission: admin or comment owner
    if (!isAdmin() && comment.userId !== currentUser.uid) return;

    const newText = prompt('Edit comment:', comment.text);
    if (newText === null || newText.trim() === '' || newText === comment.text) return;

    // Automoderation check for edited comment
    const validation = validateComment(newText.trim());
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    try {
        const comments = (request.comments || []).map(c => {
            if (c.id === commentId) {
                return { ...c, text: newText.trim(), editedAt: new Date().toISOString() };
            }
            return c;
        });

        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, { comments });
    } catch (error) {
        console.error('Error editing comment:', error);
    }
}

// Edit a request
async function editRequest(requestId) {
    if (!currentUser) return;

    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;

    // Check permission: admin or request owner
    if (!isAdmin() && request.userId !== currentUser.uid) return;

    const newTitle = prompt('Edit title:', request.title);
    if (newTitle === null) return;

    const newDescription = prompt('Edit description:', request.description);
    if (newDescription === null) return;

    if (newTitle.trim() === '' || newDescription.trim() === '') {
        alert('Title and description cannot be empty.');
        return;
    }

    if (newTitle === request.title && newDescription === request.description) return;

    // Automoderation check for edited request
    const validation = validateContent(newTitle.trim(), newDescription.trim());
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            title: newTitle.trim(),
            description: newDescription.trim(),
            editedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error editing request:', error);
        alert('Failed to edit request. Please try again.');
    }
}

// Expose functions globally for onclick
window.handleVote = vote;
window.handleStatusChange = updateStatus;
window.handleDelete = deleteRequest;
window.toggleComments = toggleComments;
window.addComment = addComment;
window.deleteComment = deleteComment;
window.editComment = editComment;
window.editRequest = editRequest;

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

// Admin Forum State
let adminForumPosts = [];

// Create admin forum section
function createAdminForumUI() {
    if (!isAdmin()) return;

    // Remove existing if any
    const existing = document.getElementById('admin-forum-section');
    if (existing) existing.remove();

    // Create forum section
    const forumSection = document.createElement('section');
    forumSection.id = 'admin-forum-section';
    forumSection.className = 'admin-forum-section';
    forumSection.innerHTML = `
        <div class="admin-forum-header">
            <h2>Admin Forum</h2>
            <span class="admin-badge">Admin Only</span>
            <button class="admin-forum-clear-all-btn" onclick="window.clearAllAdminPosts()">Clear All</button>
        </div>
        <form class="admin-forum-form" id="admin-forum-form">
            <input type="text" id="admin-forum-title" placeholder="Post title..." required>
            <textarea id="admin-forum-content" placeholder="Write your post..." required></textarea>
            <button type="submit">Post</button>
        </form>
        <div class="admin-forum-posts" id="admin-forum-posts">
            <p class="admin-forum-empty">Loading posts...</p>
        </div>
    `;

    // Insert before the requests section
    const container = document.querySelector('.container');
    const requestsSection = document.querySelector('.requests-section');
    if (container && requestsSection) {
        container.insertBefore(forumSection, requestsSection);
    }

    // Add form listener
    document.getElementById('admin-forum-form').addEventListener('submit', handleAdminForumPost);

    // Load forum posts
    loadAdminForum();
}

function renderAdminForum() {
    const postsDiv = document.getElementById('admin-forum-posts');
    if (!postsDiv) return;

    if (adminForumPosts.length === 0) {
        postsDiv.innerHTML = '<p class="admin-forum-empty">No posts yet. Start the discussion!</p>';
        return;
    }

    postsDiv.innerHTML = adminForumPosts.map(post => `
        <div class="admin-forum-post" data-id="${post.id}">
            <div class="admin-forum-post-header">
                <h3 class="admin-forum-post-title">${escapeHtml(post.title)}</h3>
                <div class="admin-forum-post-meta">
                    <span class="admin-forum-post-author">${escapeHtml(post.username || 'Admin')}</span>
                    <span class="admin-forum-post-date">${formatDate(post.createdAt)}${post.editedAt ? ' (edited)' : ''}</span>
                    <button class="admin-forum-edit-btn" onclick="window.editAdminPost('${post.id}')">Edit</button>
                    <button class="admin-forum-delete-btn" onclick="window.deleteAdminPost('${post.id}')">&times;</button>
                </div>
            </div>
            <p class="admin-forum-post-content">${escapeHtml(post.content)}</p>
            <div class="admin-forum-replies">
                <button class="admin-forum-toggle-replies" onclick="window.toggleAdminReplies('${post.id}')">
                    Replies (${(post.replies || []).length})
                </button>
                <div class="admin-forum-replies-list hidden" id="replies-${post.id}">
                    ${(post.replies || []).map(reply => `
                        <div class="admin-forum-reply">
                            <div class="admin-forum-reply-header">
                                <span class="admin-forum-reply-author">${escapeHtml(reply.username || 'Admin')}</span>
                                <span class="admin-forum-reply-date">${formatDate(reply.createdAt)}</span>
                                <button class="admin-forum-reply-delete" onclick="window.deleteAdminReply('${post.id}', '${reply.id}')">&times;</button>
                            </div>
                            <p class="admin-forum-reply-text">${escapeHtml(reply.text)}</p>
                        </div>
                    `).join('') || '<p class="admin-forum-no-replies">No replies yet.</p>'}
                    <form class="admin-forum-reply-form" onsubmit="window.addAdminReply(event, '${post.id}')">
                        <input type="text" placeholder="Write a reply..." required>
                        <button type="submit">Reply</button>
                    </form>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAdminForumPost(event) {
    event.preventDefault();
    if (!isAdmin()) return;

    const titleInput = document.getElementById('admin-forum-title');
    const contentInput = document.getElementById('admin-forum-content');
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) return;

    const submitBtn = event.target.querySelector('button');
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, 'admin_forum'), {
            title,
            content,
            userId: currentUser.uid,
            username: currentUserData?.username || currentUser.email,
            replies: [],
            createdAt: new Date().toISOString()
        });
        titleInput.value = '';
        contentInput.value = '';
    } catch (error) {
        console.error('Error posting:', error);
        alert('Failed to post. Please try again.');
    } finally {
        submitBtn.disabled = false;
    }
}

function toggleAdminReplies(postId) {
    const repliesDiv = document.getElementById(`replies-${postId}`);
    if (repliesDiv) {
        repliesDiv.classList.toggle('hidden');
    }
}

async function addAdminReply(event, postId) {
    event.preventDefault();
    if (!isAdmin()) return;

    const form = event.target;
    const input = form.querySelector('input');
    const text = input.value.trim();

    if (!text) return;

    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;

    try {
        const post = adminForumPosts.find(p => p.id === postId);
        if (!post) return;

        const newReply = {
            id: Date.now().toString(),
            text,
            userId: currentUser.uid,
            username: currentUserData?.username || currentUser.email,
            createdAt: new Date().toISOString()
        };

        const replies = [...(post.replies || []), newReply];
        const postRef = doc(db, 'admin_forum', postId);
        await updateDoc(postRef, { replies });

        input.value = '';
    } catch (error) {
        console.error('Error adding reply:', error);
    } finally {
        submitBtn.disabled = false;
    }
}

async function deleteAdminPost(postId) {
    if (!isAdmin()) return;
    if (!confirm('Delete this post?')) return;

    try {
        await deleteDoc(doc(db, 'admin_forum', postId));
    } catch (error) {
        console.error('Error deleting post:', error);
    }
}

async function deleteAdminReply(postId, replyId) {
    if (!isAdmin()) return;
    if (!confirm('Delete this reply?')) return;

    try {
        const post = adminForumPosts.find(p => p.id === postId);
        if (!post) return;

        const replies = (post.replies || []).filter(r => r.id !== replyId);
        const postRef = doc(db, 'admin_forum', postId);
        await updateDoc(postRef, { replies });
    } catch (error) {
        console.error('Error deleting reply:', error);
    }
}

async function clearAllAdminPosts() {
    if (!isAdmin()) return;
    if (adminForumPosts.length === 0) {
        alert('No posts to clear!');
        return;
    }
    if (!confirm(`Are you sure you want to delete ALL ${adminForumPosts.length} posts? This cannot be undone!`)) return;
    if (!confirm('Are you REALLY sure? Type "yes" mentally and click OK to confirm.')) return;

    try {
        const deletePromises = adminForumPosts.map(post =>
            deleteDoc(doc(db, 'admin_forum', post.id))
        );
        await Promise.all(deletePromises);
        alert('All posts have been deleted.');
    } catch (error) {
        console.error('Error clearing posts:', error);
        alert('Failed to clear all posts. Some may have been deleted.');
    }
}

async function editAdminPost(postId) {
    if (!isAdmin()) return;

    const post = adminForumPosts.find(p => p.id === postId);
    if (!post) return;

    const newTitle = prompt('Edit title:', post.title);
    if (newTitle === null) return; // Cancelled

    const newContent = prompt('Edit content:', post.content);
    if (newContent === null) return; // Cancelled

    if (!newTitle.trim() || !newContent.trim()) {
        alert('Title and content cannot be empty!');
        return;
    }

    try {
        const postRef = doc(db, 'admin_forum', postId);
        await updateDoc(postRef, {
            title: newTitle.trim(),
            content: newContent.trim(),
            editedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error editing post:', error);
        alert('Failed to edit post. Please try again.');
    }
}

function loadAdminForum() {
    if (!isAdmin()) return;

    const q = query(collection(db, 'admin_forum'), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        adminForumPosts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderAdminForum();
    }, (error) => {
        console.error('Error loading admin forum:', error);
    });
}

// Expose for onclick
window.toggleAdminReplies = toggleAdminReplies;
window.addAdminReply = addAdminReply;
window.deleteAdminPost = deleteAdminPost;
window.deleteAdminReply = deleteAdminReply;
window.clearAllAdminPosts = clearAllAdminPosts;
window.editAdminPost = editAdminPost;

// ==================== Admin User Management ====================
let allUsers = [];
let userListSort = 'date-desc';
let userSearchQuery = '';

function createUserManagementUI() {
    if (!isAdmin()) return;

    const existing = document.getElementById('admin-users-section');
    if (existing) existing.remove();

    const usersSection = document.createElement('section');
    usersSection.id = 'admin-users-section';
    usersSection.className = 'admin-users-section';
    usersSection.innerHTML = `
        <div class="admin-users-header">
            <h2>User Management</h2>
            <span class="admin-badge">Admin Only</span>
        </div>
        <div class="admin-users-controls">
            <input type="text" id="user-search" placeholder="Search users..." class="user-search-input">
            <select id="user-sort" class="user-sort-select">
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="alpha-asc">A-Z</option>
                <option value="alpha-desc">Z-A</option>
                <option value="admins">Admins First</option>
            </select>
        </div>
        <div class="admin-users-count" id="users-count">Loading users...</div>
        <div class="admin-users-list" id="admin-users-list">
            <p class="admin-users-loading">Loading users...</p>
        </div>
    `;

    // Insert after admin forum section
    const container = document.querySelector('.container');
    const requestsSection = document.querySelector('.requests-section');
    const forumSection = document.getElementById('admin-forum-section');
    if (container && requestsSection) {
        container.insertBefore(usersSection, forumSection ? forumSection.nextSibling : requestsSection);
    }

    // Add event listeners
    document.getElementById('user-search').addEventListener('input', (e) => {
        userSearchQuery = e.target.value.toLowerCase();
        renderUserList();
    });

    document.getElementById('user-sort').addEventListener('change', (e) => {
        userListSort = e.target.value;
        renderUserList();
    });

    loadAllUsers();
}

async function loadAllUsers() {
    if (!isAdmin()) return;

    try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

        onSnapshot(q, (snapshot) => {
            allUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderUserList();
        }, (error) => {
            console.error('Error loading users:', error);
            const listDiv = document.getElementById('admin-users-list');
            if (listDiv) {
                listDiv.innerHTML = '<p class="admin-users-error">Error loading users</p>';
            }
        });
    } catch (error) {
        console.error('Error setting up users listener:', error);
    }
}

function renderUserList() {
    const listDiv = document.getElementById('admin-users-list');
    const countDiv = document.getElementById('users-count');
    if (!listDiv) return;

    let filteredUsers = [...allUsers];

    // Apply search filter
    if (userSearchQuery) {
        filteredUsers = filteredUsers.filter(user => {
            const username = (user.username || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return username.includes(userSearchQuery) || email.includes(userSearchQuery);
        });
    }

    // Apply sorting
    filteredUsers.sort((a, b) => {
        switch (userListSort) {
            case 'date-desc':
                return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
            case 'date-asc':
                return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
            case 'alpha-asc':
                return (a.username || '').localeCompare(b.username || '');
            case 'alpha-desc':
                return (b.username || '').localeCompare(a.username || '');
            case 'admins':
                const aAdmin = ADMIN_EMAILS.includes(a.email) ? 0 : 1;
                const bAdmin = ADMIN_EMAILS.includes(b.email) ? 0 : 1;
                if (aAdmin !== bAdmin) return aAdmin - bAdmin;
                return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
            default:
                return 0;
        }
    });

    // Update count
    if (countDiv) {
        countDiv.textContent = `${filteredUsers.length} of ${allUsers.length} users`;
    }

    if (filteredUsers.length === 0) {
        listDiv.innerHTML = '<p class="admin-users-empty">No users found</p>';
        return;
    }

    listDiv.innerHTML = filteredUsers.map(user => {
        const isUserAdmin = ADMIN_EMAILS.includes(user.email);
        const isBanned = user.banned === true;
        const joinDate = user.createdAt ? formatDate(user.createdAt) : 'Unknown';
        return `
            <div class="admin-user-item ${isUserAdmin ? 'is-admin' : ''} ${isBanned ? 'is-banned' : ''}">
                <div class="admin-user-info">
                    <span class="admin-user-name">${escapeHtml(user.username || 'No username')}</span>
                    ${isUserAdmin ? '<span class="admin-user-badge">Admin</span>' : ''}
                    ${isBanned ? '<span class="admin-user-badge banned">Banned</span>' : ''}
                </div>
                <div class="admin-user-details">
                    <span class="admin-user-email">${escapeHtml(user.email || 'No email')}</span>
                    <span class="admin-user-date">Joined: ${joinDate}</span>
                    ${!isUserAdmin ? `
                        <button class="ban-user-btn ${isBanned ? 'unban' : ''}" onclick="window.toggleBanUser('${user.id}', ${isBanned})">
                            ${isBanned ? 'Unban' : 'Ban'}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Ban/Unban user and archive their posts
async function toggleBanUser(userId, currentlyBanned) {
    if (!isAdmin()) return;

    const action = currentlyBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
        // Update user's banned status
        await updateDoc(doc(db, 'users', userId), {
            banned: !currentlyBanned
        });

        if (!currentlyBanned) {
            // Banning user - archive their posts
            const userPosts = allRequests.filter(r => r.userId === userId);
            for (const post of userPosts) {
                // Move to archives collection
                await setDoc(doc(db, 'archives', post.id), {
                    ...post,
                    archivedAt: new Date().toISOString(),
                    archivedReason: 'user_banned',
                    originalUserId: userId
                });
                // Delete from requests
                await deleteDoc(doc(db, 'requests', post.id));
            }
            alert(`User banned. ${userPosts.length} post(s) archived.`);
        } else {
            alert('User unbanned.');
        }
    } catch (error) {
        console.error('Error toggling ban:', error);
        alert('Failed to ' + action + ' user.');
    }
}

window.toggleBanUser = toggleBanUser;

// ==================== Admin Archives Section ====================
let archivedPosts = [];

function createArchivesUI() {
    if (!isAdmin()) return;

    const existing = document.getElementById('admin-archives-section');
    if (existing) existing.remove();

    const archivesSection = document.createElement('section');
    archivesSection.id = 'admin-archives-section';
    archivesSection.className = 'admin-archives-section';
    archivesSection.innerHTML = `
        <div class="admin-archives-header">
            <h2>Archives</h2>
            <span class="admin-badge">Admin Only</span>
        </div>
        <div class="admin-archives-list" id="admin-archives-list">
            <p class="admin-archives-loading">Loading archives...</p>
        </div>
    `;

    // Insert after user management section
    const container = document.querySelector('.container');
    const usersSection = document.getElementById('admin-users-section');
    const requestsSection = document.querySelector('.requests-section');
    if (container) {
        container.insertBefore(archivesSection, usersSection ? usersSection.nextSibling : requestsSection);
    }

    loadArchives();
}

function renderArchives() {
    const listDiv = document.getElementById('admin-archives-list');
    if (!listDiv) return;

    if (archivedPosts.length === 0) {
        listDiv.innerHTML = '<p class="admin-archives-empty">No archived posts.</p>';
        return;
    }

    listDiv.innerHTML = archivedPosts.map(post => `
        <div class="admin-archive-item">
            <div class="admin-archive-header">
                <h4 class="admin-archive-title">${escapeHtml(post.title)}</h4>
                <span class="admin-archive-reason">${post.archivedReason === 'user_banned' ? 'User Banned' : 'Archived'}</span>
            </div>
            <p class="admin-archive-desc">${escapeHtml(post.description)}</p>
            <div class="admin-archive-meta">
                <span>By: ${escapeHtml(post.username || 'Unknown')}</span>
                <span>Archived: ${formatDate(post.archivedAt)}</span>
            </div>
            <div class="admin-archive-actions">
                <button class="restore-btn" onclick="window.restorePost('${post.id}')">Restore</button>
                <button class="delete-btn" onclick="window.permanentDeletePost('${post.id}')">Delete Permanently</button>
            </div>
        </div>
    `).join('');
}

async function restorePost(postId) {
    if (!isAdmin()) return;
    if (!confirm('Restore this post?')) return;

    try {
        const archiveDoc = await getDoc(doc(db, 'archives', postId));
        if (!archiveDoc.exists()) return;

        const postData = archiveDoc.data();
        delete postData.archivedAt;
        delete postData.archivedReason;

        // Restore to requests
        await setDoc(doc(db, 'requests', postId), postData);
        // Remove from archives
        await deleteDoc(doc(db, 'archives', postId));

        alert('Post restored.');
    } catch (error) {
        console.error('Error restoring post:', error);
        alert('Failed to restore post.');
    }
}

async function permanentDeletePost(postId) {
    if (!isAdmin()) return;
    if (!confirm('Permanently delete this post? This cannot be undone.')) return;

    try {
        await deleteDoc(doc(db, 'archives', postId));
        alert('Post permanently deleted.');
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post.');
    }
}

window.restorePost = restorePost;
window.permanentDeletePost = permanentDeletePost;

function loadArchives() {
    if (!isAdmin()) return;

    const q = query(collection(db, 'archives'), orderBy('archivedAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        archivedPosts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderArchives();
    }, (error) => {
        console.error('Error loading archives:', error);
    });
}

// Update auth UI to include admin forum, user management, and archives
const originalUpdateAuthUI = updateAuthUI;
updateAuthUI = function(user) {
    originalUpdateAuthUI(user);
    if (user && isAdmin()) {
        setTimeout(createAdminForumUI, 100);
        setTimeout(createUserManagementUI, 150);
        setTimeout(createArchivesUI, 200);
    } else {
        // Remove admin sections if not admin
        const forum = document.getElementById('admin-forum-section');
        if (forum) forum.remove();
        const users = document.getElementById('admin-users-section');
        if (users) users.remove();
        const archives = document.getElementById('admin-archives-section');
        if (archives) archives.remove();
    }
};

// Initialize
loadRequests();
