import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    doc,
    getDoc,
    getFirestore
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration (same as your app)
const firebaseConfig = {
  apiKey: "AIzaSyBgu6wGpsomoC9r44QC0aBWqUFjwk8yRZI",
  authDomain: "jlio-de9c4.firebaseapp.com",
  projectId: "jlio-de9c4",
  storageBucket: "jlio-de9c4.firebasestorage.app",
  messagingSenderId: "620411268963",
  appId: "1:620411268963:web:7038fb998374ea5c3f6d56"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Check if user is already authenticated and redirect to dashboard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Check if user has admin role
    const isAdmin = await checkAdminRole(user.uid);
    if (isAdmin) {
      window.location.href = './dashboard.html';
    } else {
      // Sign out non-admin users
      await signOut(auth);
      showError('You do not have admin privileges.');
    }
  }
});

// Check if user has admin role
async function checkAdminRole(uid) {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', uid));
    return adminDoc.exists() && adminDoc.data().role === 'admin';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

// DOM elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoader = loginBtn.querySelector('.btn-loader');

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

// Hide error message
function hideError() {
  errorMessage.style.display = 'none';
}

// Show loading state
function showLoading() {
  loginBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';
}

// Hide loading state
function hideLoading() {
  loginBtn.disabled = false;
  btnText.style.display = 'inline';
  btnLoader.style.display = 'none';
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }
  
  showLoading();
  
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check admin role
    const isAdmin = await checkAdminRole(user.uid);
    
    if (isAdmin) {
      // Redirect to dashboard
      window.location.href = './dashboard.html';
    } else {
      // Sign out and show error
      await signOut(auth);
      showError('You do not have admin privileges.');
    }
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle specific Firebase Auth errors
    let errorMsg = 'Login failed. Please try again.';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMsg = 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMsg = 'Incorrect password.';
        break;
      case 'auth/invalid-email':
        errorMsg = 'Invalid email address.';
        break;
      case 'auth/too-many-requests':
        errorMsg = 'Too many failed attempts. Please try again later.';
        break;
    }
    
    showError(errorMsg);
  } finally {
    hideLoading();
  }
});

// Allow Enter key to submit form
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !loginBtn.disabled) {
    loginForm.dispatchEvent(new Event('submit'));
  }
});

console.log('🔐 Admin authentication system loaded');