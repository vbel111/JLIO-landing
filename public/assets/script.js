import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration - replace with your config
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
const db = getFirestore(app);


// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
let username = 'Someone';
let userId = null;
let usernameParam = null;

// Priority 1: Check query parameter ?user=username (from Vercel rewrite)
usernameParam = urlParams.get('user');

// Priority 2: Check for direct userId query params
if (!usernameParam) {
  userId = urlParams.get('uid') || urlParams.get('userId');
}

// Priority 3: Extract from URL path as fallback (legacy support)
// Only use this if we don't have a query param
if (!usernameParam && !userId) {
  const pathparts = window.location.pathname.split('/ask/');
  const pathValue = pathparts[1] ? decodeURIComponent(pathparts[1]) : null;
  
  // Assume path values are usernames (legacy behavior)
  if (pathValue) {
    usernameParam = pathValue;
  }
}

const customQuestionId = urlParams.get('qid') || urlParams.get('customQuestionId');
const customQuestionText = urlParams.get('qt') || urlParams.get('customQuestionText');

// Profile UI elements
const profileHeader = document.getElementById('profileHeader');
const userAvatar = document.getElementById('userAvatar');
const profileUsername = document.getElementById('profileUsername');
const profileLoading = document.getElementById('profileLoading');

async function fetchAndDisplayProfile() {
	profileLoading.style.display = 'block';
	
	try {
		let userDoc = null;
		
		// If we have a username parameter, look up user by username
		if (usernameParam && !userId) {
			console.log('Looking up user by username:', usernameParam);
			const usersRef = collection(db, 'users');
			// Try exact match first (case-sensitive)
			let q = query(usersRef, where('username', '==', usernameParam));
			let querySnapshot = await getDocs(q);
			
			// If not found, try lowercase
			if (querySnapshot.empty) {
				console.log('Trying lowercase username:', usernameParam.toLowerCase());
				q = query(usersRef, where('username', '==', usernameParam.toLowerCase()));
				querySnapshot = await getDocs(q);
			}
			
			if (!querySnapshot.empty) {
				userDoc = querySnapshot.docs[0];
				userId = userDoc.id; // Set userId for form submission
				console.log('Found user:', userId);
			} else {
				console.log('User not found with username:', usernameParam);
			}
		} 
		// Otherwise look up by userId directly
		else if (userId) {
			console.log('Looking up user by ID:', userId);
			const userRef = doc(db, 'users', userId);
			const userSnap = await getDoc(userRef);
			if (userSnap.exists()) {
				userDoc = userSnap;
			}
		}
		
		// Display profile if found
		if (userDoc && userDoc.exists()) {
			const data = userDoc.data();
			username = data.username || 'Someone';
			profileUsername.textContent = `@${username}`;
			if (data.avatar) {
				userAvatar.src = data.avatar;
			} else {
				userAvatar.src = '/assets/images/logo.png';
			}
			// Show/hide accepting questions
			if (data.isAcceptingQuestions === false) {
				document.getElementById('questionForm').style.display = 'none';
				document.getElementById('errorMessage').style.display = 'block';
				document.getElementById('errorMessage').textContent = '❌ This user is not accepting questions.';
			} else {
				// Ensure form is visible when user is found and accepting questions
				document.getElementById('questionForm').style.display = 'flex';
				document.getElementById('errorMessage').style.display = 'none';
			}
		} else {
			console.log('No user document found');
			profileUsername.textContent = '@unknown';
			userAvatar.src = '/assets/images/logo.png';
			document.getElementById('questionForm').style.display = 'none';
			document.getElementById('errorMessage').style.display = 'block';
			document.getElementById('errorMessage').textContent = '❌ User not found.';
		}
	} catch (e) {
		console.error('Error loading profile:', e);
		profileUsername.textContent = '@unknown';
		userAvatar.src = '/assets/images/logo.png';
		document.getElementById('questionForm').style.display = 'none';
		document.getElementById('errorMessage').style.display = 'block';
		document.getElementById('errorMessage').textContent = '❌ Error loading user profile.';
	} finally {
		profileLoading.style.display = 'none';
	}
}

fetchAndDisplayProfile();

// Pre-fill or display custom question if provided
async function maybeLoadCustomQuestion() {
	let text = customQuestionText || '';

	// If we have only an ID, try to fetch the text from Firestore
	if (customQuestionId && !text) {
		try {
			const cqRef = doc(db, 'customQuestions', customQuestionId);
			const cqSnap = await getDoc(cqRef);
			if (cqSnap.exists()) {
				const data = cqSnap.data();
				text = data && data.text ? data.text : '';
			}
		} catch (err) {
			console.warn('Failed to load custom question text:', err);
		}
	}

	if (text) {
		// Show the banner and populate it (do NOT auto-fill the textarea value)
		const banner = document.getElementById('customQuestionBanner');
		const bannerText = document.getElementById('customQuestionText');
		if (banner && bannerText) {
			bannerText.textContent = text;
			banner.style.display = 'block';
		}

		// Use the custom question as the input placeholder so users still type their own response
		questionInput.placeholder = text;
		updateCharCounter();
	}
}

maybeLoadCustomQuestion();

// Character counter
const questionInput = document.getElementById('questionText');
const charCounter = document.getElementById('charCounter');

function updateCharCounter() {
	const length = questionInput.value.length;
	charCounter.textContent = `${length}/500`;
    
	if (length > 450) {
		charCounter.classList.add('error');
		charCounter.classList.remove('warning');
	} else if (length > 400) {
		charCounter.classList.add('warning');
		charCounter.classList.remove('error');
	} else {
		charCounter.classList.remove('warning', 'error');
	}
}

questionInput.addEventListener('input', updateCharCounter);

// Random question generator
const exampleQuestions = [
	"What's a secret you've never told anyone?",
	"What's your biggest fear?",
	"If you could change one thing about your past, what would it be?",
	"What's the most embarrassing thing that's ever happened to you?",
	"Who do you have a crush on right now?",
	"What's something you're insecure about?",
	"What's the last lie you told?",
	"What's your most unpopular opinion?",
	"What do you think people say about you behind your back?",
	"What's something you're proud of but never talk about?",
	"What's your biggest regret?",
	"If you could be completely honest with someone, who would it be and what would you say?",
	"What's a habit you wish you could break?",
	"What's the weirdest thing you've ever done when you were alone?",
	"What's something you judge people for?",
	"What's your guilty pleasure?",
	"If you could restart your life, what would you do differently?",
	"What's a personality trait you wish you had?",
	"What do you worry about most?",
	"What's the nicest thing someone has ever done for you?",
	"What makes you feel most alive?",
	"What's your favorite childhood memory?",
	"If you could have dinner with anyone dead or alive, who would it be?",
	"What's something you want to learn but haven't yet?",
	"What would your perfect day look like?"
];

const exampleQuestionEl = document.getElementById('exampleQuestion');
const exampleTextEl = document.getElementById('exampleText');

function getRandomQuestion() {
	const randomIndex = Math.floor(Math.random() * exampleQuestions.length);
	return exampleQuestions[randomIndex];
}

exampleQuestionEl.addEventListener('click', () => {
	const newQuestion = getRandomQuestion();
	exampleTextEl.textContent = newQuestion;
	questionInput.value = newQuestion;
	updateCharCounter();
	questionInput.focus();
});

exampleQuestionEl.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		const newQuestion = getRandomQuestion();
		exampleTextEl.textContent = newQuestion;
		questionInput.value = newQuestion;
		updateCharCounter();
		questionInput.focus();
	}
});

// 🔍 Enhanced device fingerprinting and metadata capture
function captureDeviceMetadata() {
	const ua = navigator.userAgent;
	
	// Extract browser
	let browser = 'Unknown';
	if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
		browser = 'Chrome';
	} else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
		browser = 'Safari';
	} else if (/Firefox/i.test(ua)) {
		browser = 'Firefox';
	} else if (/Edg/i.test(ua)) {
		browser = 'Edge';
	} else if (/Opera|OPR/i.test(ua)) {
		browser = 'Opera';
	}

	// Extract OS
	let os = 'Unknown';
	if (/iPhone|iPad|iPod/i.test(ua)) {
		const match = ua.match(/OS (\d+)_(\d+)/);
		os = match ? `iOS ${match[1]}.${match[2]}` : 'iOS';
	} else if (/Android/i.test(ua)) {
		const match = ua.match(/Android (\d+\.?\d*)/);
		os = match ? `Android ${match[1]}` : 'Android';
	} else if (/Windows/i.test(ua)) {
		os = 'Windows';
	} else if (/Mac OS X/i.test(ua)) {
		const match = ua.match(/Mac OS X (\d+_\d+)/);
		os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
	} else if (/Linux/i.test(ua)) {
		os = 'Linux';
	}

	// Extract device model (best effort - UA doesn't contain exact iPhone model)
	let deviceModel = 'Desktop/Laptop';
	if (/iPhone/i.test(ua)) {
		// iPhones don't expose exact model in UA, try to detect by screen size
		const width = window.screen.width;
		const height = window.screen.height;
		const ratio = window.devicePixelRatio || 1;
		
		// iPhone model detection based on screen dimensions
		if (width === 430 || height === 932) deviceModel = 'iPhone 15 Pro Max';
		else if (width === 393 || height === 852) deviceModel = 'iPhone 15 Pro';
		else if (width === 390 || height === 844) deviceModel = 'iPhone 15';
		else if (width === 428 || height === 926) deviceModel = 'iPhone 14 Pro Max';
		else if (width === 414 || height === 896) deviceModel = 'iPhone 11 Pro Max';
		else if (width === 375 || height === 812) deviceModel = 'iPhone X/XS/11 Pro';
		else deviceModel = 'iPhone'; // Fallback for unknown models
	} else if (/iPad/i.test(ua)) {
		// Try to detect iPad model by screen size
		const width = window.screen.width;
		const height = window.screen.height;
		
		if (width === 1024 && height === 1366) deviceModel = 'iPad Pro 12.9"';
		else if (width === 834 && height === 1194) deviceModel = 'iPad Pro 11"';
		else if (width === 820 && height === 1180) deviceModel = 'iPad Air';
		else if (width === 810 && height === 1080) deviceModel = 'iPad 10th gen';
		else if (width === 768 && height === 1024) deviceModel = 'iPad';
		else deviceModel = 'iPad'; // Generic fallback
	} else if (/Android/i.test(ua)) {
		// Extract Android device model from UA - most Android UAs have format: "...; MODEL Build/..."
		let modelMatch = ua.match(/;\s*([^;)]+)\s+Build/i);
		
		if (modelMatch && modelMatch[1]) {
			let model = modelMatch[1].trim();
			
			// Clean up and format model names
			// Samsung devices (SM- prefix)
			if (model.startsWith('SM-')) {
				// Map common Samsung models
				if (model.includes('S23')) deviceModel = 'Samsung Galaxy S23';
				else if (model.includes('S22')) deviceModel = 'Samsung Galaxy S22';
				else if (model.includes('S21')) deviceModel = 'Samsung Galaxy S21';
				else if (model.includes('S20')) deviceModel = 'Samsung Galaxy S20';
				else if (model.includes('A54')) deviceModel = 'Samsung Galaxy A54';
				else if (model.includes('A53')) deviceModel = 'Samsung Galaxy A53';
				else if (model.includes('A34')) deviceModel = 'Samsung Galaxy A34';
				else if (model.includes('A14')) deviceModel = 'Samsung Galaxy A14';
				else if (model.includes('Z Fold')) deviceModel = 'Samsung Galaxy Z Fold';
				else if (model.includes('Z Flip')) deviceModel = 'Samsung Galaxy Z Flip';
				else deviceModel = 'Samsung ' + model; // Keep full model code
			}
			// Google Pixel devices
			else if (model.includes('Pixel')) {
				if (model.includes('Pixel 8 Pro')) deviceModel = 'Google Pixel 8 Pro';
				else if (model.includes('Pixel 8')) deviceModel = 'Google Pixel 8';
				else if (model.includes('Pixel 7 Pro')) deviceModel = 'Google Pixel 7 Pro';
				else if (model.includes('Pixel 7')) deviceModel = 'Google Pixel 7';
				else if (model.includes('Pixel 6')) deviceModel = 'Google Pixel 6';
				else deviceModel = 'Google ' + model;
			}
			// Xiaomi/Redmi devices
			else if (/Redmi|Mi |Poco/i.test(model)) {
				deviceModel = 'Xiaomi ' + model;
			}
			// OnePlus devices
			else if (/OnePlus/i.test(model)) {
				deviceModel = model;
			}
			// Oppo devices
			else if (/OPPO|CPH/i.test(model)) {
				deviceModel = 'Oppo ' + model.replace('CPH', '');
			}
			// Vivo devices
			else if (/vivo|V\d+/i.test(model)) {
				deviceModel = 'Vivo ' + model;
			}
			// Realme devices
			else if (/RMX|realme/i.test(model)) {
				deviceModel = 'Realme ' + model.replace('RMX', '');
			}
			// Huawei devices
			else if (/Huawei|HUAWEI|Honor/i.test(model)) {
				deviceModel = model;
			}
			// Generic Android - use the extracted model
			else {
				deviceModel = model;
			}
		} 
		// Fallback patterns if Build pattern didn't match
		else if (/SM-/i.test(ua)) {
			deviceModel = 'Samsung Galaxy';
		} else if (/Pixel/i.test(ua)) {
			deviceModel = 'Google Pixel';
		} else {
			deviceModel = 'Android Device';
		}
	} else if (/Mac/i.test(ua) && !/iPhone|iPad/i.test(ua)) {
		deviceModel = 'Mac';
	} else if (/Windows/i.test(ua)) {
		deviceModel = 'Windows PC';
	} else if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
		deviceModel = 'Linux PC';
	}

	// Time of day
	const hour = new Date().getHours();
	let timeOfDay = 'afternoon';
	if (hour >= 5 && hour < 12) timeOfDay = 'morning';
	else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
	else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
	else timeOfDay = 'night';

	return {
		browser,
		os,
		deviceModel,
		timeOfDay
	};
}

// 🌍 Fetch IP geolocation data
async function getIpGeolocation() {
	try {
		const response = await fetch('https://ipapi.co/json/');
		if (!response.ok) throw new Error('Geolocation API failed');
		const data = await response.json();
		
		return {
			city: data.city || 'Unknown',
			country: data.country_name || 'Unknown',
			region: data.region || 'Unknown',
			ip: data.ip || 'Unknown'
		};
	} catch (error) {
		console.warn('Failed to get geolocation:', error);
		return {
			city: 'Unknown',
			country: 'Unknown',
			region: 'Unknown',
			ip: 'Unknown'
		};
	}
}

// Form submission
document.getElementById('questionForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	const questionText = questionInput.value.trim();
	if (!questionText) return;

	// Show loading state
	document.getElementById('loading')?.style && (document.getElementById('loading').style.display = 'block');
	document.getElementById('questionForm').style.display = 'none';
	document.getElementById('errorMessage').style.display = 'none';

	try {
		// Fetch recipient profile again to ensure up-to-date info
		const userRef = doc(db, 'users', userId);
		const userSnap = await getDoc(userRef);
		if (!userSnap.exists() || userSnap.data().isAcceptingQuestions === false) {
			throw new Error('Recipient not accepting questions');
		}

		// 🔍 Capture comprehensive metadata
		const deviceInfo = captureDeviceMetadata();
		const geoData = await getIpGeolocation();

		// Submit question to Firestore (sync with app logic)
		await addDoc(collection(db, 'questions'), {
			text: questionText,
			recipientId: userId,
			recipientUsername: username,
			isAnonymous: true,
			senderId: null,
			senderUsername: null,
			isCustom: !!customQuestionText,
			customQuestionId: customQuestionId || null,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
			status: 'pending',
			source: 'web',
			metadata: {
				userAgent: navigator.userAgent,
				ipAddress: geoData.ip,
				location: {
					city: geoData.city,
					country: geoData.country,
					region: geoData.region
				},
				device: {
					browser: deviceInfo.browser,
					os: deviceInfo.os,
					deviceModel: deviceInfo.deviceModel
				},
				sentAt: serverTimestamp(),
				timeOfDay: deviceInfo.timeOfDay
			},
			views: 0,
			reportCount: 0,
			isReported: false
		});

		// Show success message
		document.getElementById('loading')?.style && (document.getElementById('loading').style.display = 'none');
		document.getElementById('successMessage').style.display = 'block';
		// Reset form
		questionInput.value = '';
		updateCharCounter();
	} catch (error) {
		console.error('Error submitting question:', error);
		document.getElementById('loading')?.style && (document.getElementById('loading').style.display = 'none');
		document.getElementById('questionForm').style.display = 'block';
		document.getElementById('errorMessage').style.display = 'block';
		document.getElementById('errorMessage').textContent = '❌ Unable to send question. This user may not be accepting questions.';
	}
});

// Handle missing user ID
if (!userId) {
	document.getElementById('questionForm').style.display = 'none';
	document.getElementById('errorMessage').style.display = 'block';
	document.getElementById('errorMessage').textContent = '❌ Invalid link. Please make sure you have the correct URL.';
}
