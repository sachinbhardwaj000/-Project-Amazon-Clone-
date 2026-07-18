const form = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const showPassword = document.getElementById('showPassword');
const message = document.getElementById('message');

showPassword.addEventListener('change', () => {
  passwordInput.type = showPassword.checked ? 'text' : 'password';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    message.textContent = 'Please enter both email and password.';
    message.className = 'message';
    return;
  }

  message.textContent = `Welcome back, ${email}!`;
  message.className = 'message success';
  form.reset();
});
