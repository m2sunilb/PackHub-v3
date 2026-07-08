import { ApiService } from './api.js';
import { AppController } from './app.js';

export const AuthModule = {
  init() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async e => {
      e.preventDefault();

      const usernameInput = document.getElementById('username');
      const fullnameInput = document.getElementById('fullname');
      const errorBox = document.getElementById('login-error');
      const errorText = document.getElementById('login-error-text');

      if (errorBox) errorBox.classList.add('hidden');

      const username = usernameInput.value.trim();
      const fullname = fullnameInput.value.trim();

      if (!username || !fullname) {
        if (errorBox && errorText) {
          errorText.innerText = 'Both fields are required.';
          errorBox.classList.remove('hidden');
        }
        return;
      }

      try {
        const user = await ApiService.login(username, fullname);
        AppController.loginSuccess(user);
      } catch (error) {
        if (errorBox && errorText) {
          errorText.innerText = error.message || 'Login failed. Please try again.';
          errorBox.classList.remove('hidden');
        }
      }
    });
  },
};
