// =============================================================================
// SHARED API CLIENT & AUTH HELPERS (api.js)
// Loaded on every page. Provides:
//   Auth    – stores the JWT/username in localStorage (login state)
//   request – generic fetch wrapper (adds JWT header, parses JSON, throws on error)
//   API     – one method per backend endpoint
//   escapeHtml / showError – small shared UI helpers
// =============================================================================
const API_BASE = "https://coffee-compass.net/api";
const TOKEN_KEY = "cc_token";
const USER_KEY = "cc_username";
const EXPIRES_KEY = "cc_expires";

// Keeps the user logged in across page reloads/tabs by storing the JWT,
// username and expiry timestamp in localStorage.
const Auth = {
    save(token, username, expiresAt) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, username);
        localStorage.setItem(EXPIRES_KEY, String(expiresAt));
    },
    clear() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(EXPIRES_KEY);
    },
    token() { return localStorage.getItem(TOKEN_KEY); },
    username() { return localStorage.getItem(USER_KEY); },
    // Side effect: also clears storage if the token has already expired.
    isLoggedIn() {
        const t = this.token();
        const exp = parseInt(localStorage.getItem(EXPIRES_KEY) || "0", 10);
        if (!t) return false;
        if (Date.now() >= exp) {
            this.clear();
            return false;
        }
        return true;
    },
    requireLogin() {
        if (!this.isLoggedIn()) {
            window.location.href = "login.html";
        }
    }
};

// Generic fetch wrapper used by every API call below. Attaches the JWT
// (if logged in), sends/parses JSON, and throws an Error for non-2xx responses
// so callers can just use try/catch.
async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = Auth.token();
    if (token) headers["Authorization"] = "Bearer " + token;

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);

    // Token expired or invalid: log the user out and bounce to login,
    // unless this request *is* the login/register call itself.
    if (res.status === 401) {
        Auth.clear();
        if (!path.startsWith("/auth/")) {
            window.location.href = "login.html";
        }
    }

    let data = null;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
    } else if (res.status !== 204) {
        data = await res.text().catch(() => null);
    }

    if (!res.ok) {
        const msg = (data && (data.message || data.error)) || res.statusText || "Request failed";
        throw new Error(msg);
    }
    return data;
}

// One method per backend endpoint — thin wrappers around request().
const API = {
    register(username, password) {
        return request("POST", "/auth/register", { username, password });
    },
    login(username, password) {
        return request("POST", "/auth/login", { username, password });
    },

    // Query params (roastLevel, origin, search) are kept for direct API consumers.
    // The frontend passes no params and filters the full catalogue client-side.
    listCoffees(params = {}) {
        const qs = new URLSearchParams();
        if (params.roastLevel) qs.set("roastLevel", params.roastLevel);
        if (params.origin) qs.set("origin", params.origin);
        if (params.search) qs.set("search", params.search);
        const q = qs.toString();
        return request("GET", "/coffees" + (q ? "?" + q : ""));
    },
    getCoffee(id) {
        return request("GET", "/coffees/" + encodeURIComponent(id));
    },
    getBrew(id) {
        return request("GET", "/coffees/" + encodeURIComponent(id) + "/brew");
    },

    listFavorites() {
        return request("GET", "/favorites");
    },
    addFavorite(fav) {
        return request("POST", "/favorites", fav);
    },
    updateFavorite(id, fav) {
        return request("PUT", "/favorites/" + id, fav);
    },
    patchFavorite(id, partial) {
        return request("PATCH", "/favorites/" + id, partial);
    },
    deleteFavorite(id) {
        return request("DELETE", "/favorites/" + id);
    },

    getRatings() {
        return request("GET", "/ratings");
    },
    setRating(coffeeId, rating) {
        return request("POST", "/ratings/" + encodeURIComponent(coffeeId), { rating });
    },
    quizQuestions() {
        return request("GET", "/quiz/questions");
    },
    match(answers) {
        return request("POST", "/match", answers);
    }
};

// ── Shared UI helpers ─────────────────────────────────────────────────────────
// escapeHtml: prevents user-entered text (coffee names, notes, etc.) from being
// interpreted as HTML when inserted via innerHTML.
function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showError(container, message) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
}

