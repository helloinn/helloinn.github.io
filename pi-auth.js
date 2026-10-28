let sessionToken = null;
let signInPromise = null;

export function signInWithPi(pi = window.Pi, request = fetch) {
    if (signInPromise) return signInPromise;
    signInPromise = (async () => {
        if (!pi) throw new Error('Open this app in Pi Browser to sign in.');
        await pi.init({ version: '2.0' });
        const { accessToken } = await pi.authenticate(['username'], onIncompletePaymentFound);
        if (!accessToken) throw new Error('Pi did not provide an access token. Please try again.');
        const response = await request('/api/auth/pi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Pi sign-in failed. Please try again.');
        if (!result.sessionToken || !result.user?.username) throw new Error('Invalid sign-in response.');
        sessionToken = result.sessionToken;
        return result.user;
    })().finally(() => { signInPromise = null; });
    return signInPromise;
}

function onIncompletePaymentFound() {
    // Username-only sign-in grants no payment permissions or payment rewards.
}

// API authorization uses only the app session issued after server verification.
export function authenticatedFetch(url, options = {}) {
    if (!sessionToken) throw new Error('Please sign in first.');
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) throw new Error('Invalid API origin.');
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${sessionToken}`);
    return fetch(target, { ...options, headers });
}
