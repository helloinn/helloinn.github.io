import { signInWithPi } from './pi-auth.js';

const button = document.getElementById('login-pi-btn');
const status = document.getElementById('login-status');
const messages = {
    ar: { loading: 'جارٍ تسجيل الدخول عبر Pi...', success: 'تم تسجيل الدخول عبر Pi:', error: 'تعذر تسجيل الدخول. افتح التطبيق في متصفح Pi وحاول مرة أخرى.' },
    fr: { loading: 'Connexion via Pi…', success: 'Connecté via Pi :', error: 'Connexion impossible. Ouvrez cette application dans Pi Browser et réessayez.' },
    en: { loading: 'Signing in with Pi…', success: 'Signed in with Pi:', error: 'Unable to sign in. Open this app in Pi Browser and try again.' },
};
button.addEventListener('click', async () => {
    const text = messages[document.documentElement.lang] || messages.en;
    button.disabled = true;
    status.textContent = text.loading;
    status.style.color = '#FFCC00';
    try {
        const user = await signInWithPi();
        status.textContent = `${text.success} ${user.username}`;
        status.style.color = '#4CAF50';
        document.getElementById('pi-session-status').textContent = status.textContent;
    } catch {
        status.textContent = text.error;
        status.style.color = '#ff4d4d';
    } finally {
        button.disabled = false;
    }
});
