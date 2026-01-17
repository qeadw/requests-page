import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    doc,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    increment
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
const closeModal = document.getElementById('close-modal');
const submitAuthPrompt = document.getElementById('submit-auth-prompt');
const loginToSubmit = document.getElementById('login-to-submit');

let currentFilter = 'all';
let isSignUpMode = false;
let currentUser = null;

// Auth state listener
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthUI(user);
});

function updateAuthUI(user) {
    if (user) {
        authStatus.innerHTML = `
            <span class="user-email">${user.email}</span>
            <button id="sign-out-btn" class="sign-out-btn">Sign Out</button>
        `;
        document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
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
}

function closeAuthModal() {
    authModal.classList.add('hidden');
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
        authTitle.textContent = 'Sign Up';
        authSubmit.textContent = 'Sign Up';
        authSwitchText.textContent = 'Already have an account?';
        authSwitchBtn.textContent = 'Sign In';
    } else {
        authTitle.textContent = 'Sign In';
        authSubmit.textContent = 'Sign In';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Sign Up';
    }
    authError.classList.add('hidden');
}

async function handleAuth(e) {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    authSubmit.disabled = true;
    authError.classList.add('hidden');

    try {
        if (isSignUpMode) {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        closeAuthModal();
    } catch (error) {
        console.error('Auth error:', error.code, error.message);
        authError.textContent = getErrorMessage(error.code, error.message);
        authError.classList.remove('hidden');
    } finally {
        authSubmit.disabled = false;
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
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Event listeners for auth
authForm.addEventListener('submit', handleAuth);
authSwitchBtn.addEventListener('click', toggleAuthMode);
closeModal.addEventListener('click', closeAuthModal);
loginToSubmit.addEventListener('click', openAuthModal);
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
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

    if (!title || !description) return;

    const submitBtn = requestForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        await addDoc(collection(db, 'requests'), {
            title,
            description,
            status: 'pending',
            votes: 0,
            createdAt: new Date().toISOString(),
            userId: currentUser.uid,
            userEmail: currentUser.email
        });

        titleInput.value = '';
        descriptionInput.value = '';
    } catch (error) {
        console.error('Error adding request:', error);
        alert('Failed to submit request. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Request';
    }
});

// Vote on a request
async function vote(requestId) {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            votes: increment(1)
        });
    } catch (error) {
        console.error('Error voting:', error);
    }
}

// Render requests
function renderRequests(requests) {
    const filtered = currentFilter === 'all'
        ? requests
        : requests.filter(r => r.status === currentFilter);

    if (filtered.length === 0) {
        requestsList.innerHTML = '<p class="empty-state">No requests found.</p>';
        return;
    }

    requestsList.innerHTML = filtered.map(request => `
        <div class="request-card" data-id="${request.id}">
            <div class="vote-section">
                <button class="vote-btn" onclick="window.handleVote('${request.id}')">^</button>
                <span class="vote-count">${request.votes}</span>
            </div>
            <div class="request-content">
                <h3 class="request-title">${escapeHtml(request.title)}</h3>
                <p class="request-description">${escapeHtml(request.description)}</p>
                <div class="request-meta">
                    <span class="status-badge status-${request.status}">${formatStatus(request.status)}</span>
                    <span>${formatDate(request.createdAt)}</span>
                    ${request.userEmail ? `<span class="request-author">by ${escapeHtml(request.userEmail)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
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

// Expose vote function globally for onclick
window.handleVote = vote;

// Filter buttons
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        loadRequests();
    });
});

// Load and listen to requests
function loadRequests() {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderRequests(requests);
    }, (error) => {
        console.error('Error loading requests:', error);
        requestsList.innerHTML = '<p class="empty-state">Failed to load requests. Check Firebase configuration.</p>';
    });
}

// Initialize
loadRequests();
