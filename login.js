document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-message');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (username === 'محمد' && password === 'ehab2001') {
            // Success
            errorMsg.style.display = 'none';
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'dashboard.html';
        } else {
            // Error
            errorMsg.style.display = 'block';
        }
    });
});
