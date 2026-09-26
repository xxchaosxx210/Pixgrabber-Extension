const PIXGRABBER_ENDPOINT = "http://localhost:5000/set-html";
const PIXGRABBER_STATUS_ENDPOINT = "http://localhost:5000/status";
const AUTO_SITES_KEY = "autoSites";
const AUTO_SCRIPT_PREFIX = "pixgrabber_auto_";

function encodePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function normalizeSiteKey(siteKey) {
    const value = String(siteKey || "").trim().toLowerCase();
    if (value === "file://" || value === "file") {
        return "file://";
    }
    return value;
}

function sitePatterns(siteKey) {
    const key = normalizeSiteKey(siteKey);

    if (key === "file://") {
        return ["file:///*"];
    }

    return [
        `https://${key}/*`,
        `http://${key}/*`
    ];
}

function hashSiteKey(siteKey) {
    let hash = 2166136261;
    for (const char of normalizeSiteKey(siteKey)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

function autoScriptId(siteKey) {
    return `${AUTO_SCRIPT_PREFIX}${hashSiteKey(siteKey)}`;
}

async function getAutoSites() {
    const stored = await chrome.storage.local.get(AUTO_SITES_KEY);
    const sites = Array.isArray(stored[AUTO_SITES_KEY])
        ? stored[AUTO_SITES_KEY]
        : [];
    return sites.map(normalizeSiteKey).filter(Boolean);
}

async function setAutoSites(sites) {
    const unique = [...new Set(sites.map(normalizeSiteKey).filter(Boolean))];
    await chrome.storage.local.set({[AUTO_SITES_KEY]: unique});
    return unique;
}

async function isAutoSite(siteKey) {
    const key = normalizeSiteKey(siteKey);
    if (!key) {
        return false;
    }
    const sites = await getAutoSites();
    return sites.includes(key);
}

async function registerAutoSite(siteKey) {
    const key = normalizeSiteKey(siteKey);
    if (!key) {
        throw new Error("Invalid site");
    }

    if (key === "file://") {
        const fileAccessAllowed = await chrome.extension.isAllowedFileSchemeAccess();
        if (!fileAccessAllowed) {
            throw new Error(
                "Enable 'Allow access to file URLs' in Chrome extension details first"
            );
        }
    }

    const patterns = sitePatterns(key);
    const hasPermission = await chrome.permissions.contains({origins: patterns});
    if (!hasPermission) {
        throw new Error(
            key === "file://"
                ? "Chrome has not granted access to local files"
                : "Chrome has not granted access to this site"
        );
    }

    const id = autoScriptId(key);

    try {
        await chrome.scripting.unregisterContentScripts({ids: [id]});
    } catch (error) {
        // The script may not exist yet.
    }

    await chrome.scripting.registerContentScripts([{
        id: id,
        matches: patterns,
        js: ["content.js"],
        css: ["frame.css"],
        runAt: "document_idle",
        persistAcrossSessions: true
    }]);

    const sites = await getAutoSites();
    if (!sites.includes(key)) {
        sites.push(key);
        await setAutoSites(sites);
    }
}

async function unregisterAutoSite(siteKey) {
    const key = normalizeSiteKey(siteKey);
    if (!key) {
        return;
    }

    const id = autoScriptId(key);

    try {
        await chrome.scripting.unregisterContentScripts({ids: [id]});
    } catch (error) {
        // Already unregistered.
    }

    const sites = await getAutoSites();
    await setAutoSites(sites.filter((site) => site !== key));

    // Keep the user's global local-file access setting intact when Auto is disabled.
    // Chrome controls file:// access with its own "Allow access to file URLs" toggle.
    if (key !== "file://") {
        try {
            await chrome.permissions.remove({origins: sitePatterns(key)});
        } catch (error) {
            console.warn("Could not remove site permission:", error);
        }
    }
}

async function syncAutoSites() {
    const sites = await getAutoSites();

    for (const siteKey of sites) {
        try {
            const patterns = sitePatterns(siteKey);
            const permitted = await chrome.permissions.contains({
                origins: patterns
            });

            const fileAccessAllowed =
                siteKey !== "file://" ||
                await chrome.extension.isAllowedFileSchemeAccess();

            if (permitted && fileAccessAllowed) {
                await registerAutoSite(siteKey);
            } else {
                await unregisterAutoSite(siteKey);
            }
        } catch (error) {
            console.warn(`Unable to restore automatic site ${siteKey}:`, error);
        }
    }
}

async function getPixGrabberStatus() {
    try {
        const response = await fetch(PIXGRABBER_STATUS_ENDPOINT, {
            method: "GET",
            cache: "no-store"
        });

        if (!response.ok) {
            return {
                ok: false,
                running: false,
                error: `PixGrabber returned HTTP ${response.status}`
            };
        }

        const data = await response.json();
        const running = Boolean(
            data &&
            data.status === "ok" &&
            data.app === "PixGrabber"
        );

        return {
            ok: running,
            running: running,
            error: running ? "" : "Unexpected response from localhost:5000"
        };
    } catch (error) {
        return {
            ok: false,
            running: false,
            error: error && error.message ? error.message : String(error)
        };
    }
}

async function sendToPixGrabber(payload) {
    const response = await fetch(PIXGRABBER_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=UTF-8"
        },
        body: encodePayload(payload)
    });

    if (!response.ok) {
        throw new Error(`PixGrabber returned HTTP ${response.status}`);
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) {
        return;
    }

    try {
        await chrome.scripting.insertCSS({
            target: {tabId: tab.id},
            files: ["frame.css"]
        });

        await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            files: ["content.js"]
        });

        await chrome.tabs.sendMessage(tab.id, {type: "toggle-picker"});
    } catch (error) {
        console.warn("PixGrabber cannot run on this page:", error);
    }
});

chrome.runtime.onInstalled.addListener(() => {
    syncAutoSites();
});

chrome.runtime.onStartup.addListener(() => {
    syncAutoSites();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) {
        return false;
    }

    if (message.type === "get-pixgrabber-status") {
        getPixGrabberStatus()
            .then((status) => sendResponse(status))
            .catch((error) => sendResponse({
                ok: false,
                running: false,
                error: error && error.message ? error.message : String(error)
            }));
        return true;
    }

    if (message.type === "submit-to-pixgrabber") {
        sendToPixGrabber(message.payload)
            .then(() => sendResponse({ok: true}))
            .catch((error) => {
                console.error("Unable to connect to PixGrabber:", error);
                sendResponse({
                    ok: false,
                    error: error && error.message ? error.message : String(error)
                });
            });
        return true;
    }

    if (message.type === "get-auto-site-state") {
        isAutoSite(message.siteKey || message.hostname)
            .then((enabled) => sendResponse({ok: true, enabled: enabled}))
            .catch((error) => sendResponse({
                ok: false,
                enabled: false,
                error: error && error.message ? error.message : String(error)
            }));
        return true;
    }

    if (message.type === "set-auto-site") {
        const siteKey = message.siteKey || message.hostname;
        const operation = message.enabled
            ? registerAutoSite(siteKey)
            : unregisterAutoSite(siteKey);

        operation
            .then(() => sendResponse({ok: true, enabled: Boolean(message.enabled)}))
            .catch((error) => sendResponse({
                ok: false,
                enabled: false,
                error: error && error.message ? error.message : String(error)
            }));
        return true;
    }

    return false;
});
