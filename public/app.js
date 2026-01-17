import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    query,
    orderBy,
    onSnapshot,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase configuration - Replace with your own config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const requestForm = document.getElementById('request-form');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const requestsList = document.getElementById('requests-list');
const filterButtons = document.querySelectorAll('.filter-btn');

let currentFilter = 'all';

// Submit new request
requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();

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
            createdAt: new Date().toISOString()
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
