// Login Form Handler
const API_BASE_URL = 'http://localhost:8000/api';

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const errorMessage = document.getElementById('error-message');

    // Hide previous error message
    errorMessage.style.display = 'none';

    // Get form data
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validate inputs
    if (!email || !password) {
        errorMessage.textContent = 'Please enter both email and password';
        errorMessage.style.display = 'block';
        return;
    }

    try {
        // Send login request
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Login successful
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('isLoggedIn', 'true');

            // Redirect to menu page
            window.location.href = 'index.html';
        } else {
            // Login failed
            errorMessage.textContent = data.error || 'Login failed. Please check your credentials.';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'Network error. Please check your connection and try again.';
        errorMessage.style.display = 'block';
    }
});

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        // User is already logged in, redirect to menu
        window.location.href = 'index.html';
    }
});
