const PIXGRABBER_ENDPOINT = "http://localhost:5000/set-html";
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

function normalizeHost(hostname) {
    return String(hostname || "").trim().toLowerCase();
}

function hostPatterns(hostname) {
    const host = normalizeHost(hostname);
    return [
        `https://${host}/*`,
        `http://${host}/*`
    ];
}

function hashHost(hostname) {
    let hash = 2166136261;
    for (const char of hostname) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

function autoScriptId(hostname) {
    return `${AUTO_SCRIPT_PREFIX}${hashHost(normalizeHost(hostname))}`;
}

async function getAutoSites() {
    const stored = await chrome.storage.local.get(AUTO_SITES_KEY);
    const sites = Array.isArray(stored[AUTO_SITES_KEY])
        ? stored[AUTO_SITES_KEY]
        : [];
    return sites.map(normalizeHost).filter(Boolean);
}

async function setAutoSites(sites) {
    const unique = [...new Set(sites.map(normalizeHost).filter(Boolean))];
    await chrome.storage.local.set({[AUTO_SITES_KEY]: unique});
    return unique;
}

async function isAutoSite(hostname) {
    const host = normalizeHost(hostname);
    if (!host) {
        return false;
    }
    const sites = await getAutoSites();
    return sites.includes(host);
}

async function registerAutoSite(hostname) {
    const host = normalizeHost(hostname);
    if (!host) {
        throw new Error("Invalid site");
    }

    const patterns = hostPatterns(host);
    const hasPermission = await chrome.permissions.contains({origins: patterns});
    if (!hasPermission) {
        throw new Error("Chrome has not granted access to this site");
    }

    const id = autoScriptId(host);

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
    if (!sites.includes(host)) {
        sites.push(host);
        await setAutoSites(sites);
    }
}

async function unregisterAutoSite(hostname) {
    const host = normalizeHost(hostname);
    if (!host) {
        return;
    }

    const id = autoScriptId(host);

    try {
        await chrome.scripting.unregisterContentScripts({ids: [id]});
    } catch (error) {
        // Already unregistered.
    }

    const sites = await getAutoSites();
    await setAutoSites(sites.filter((site) => site !== host));

    try {
        await chrome.permissions.remove({origins: hostPatterns(host)});
    } catch (error) {
        console.warn("Could not remove site permission:", error);
    }
}

async function syncAutoSites() {
    const sites = await getAutoSites();

    for (const host of sites) {
        try {
            const permitted = await chrome.permissions.contains({
                origins: hostPatterns(host)
            });

            if (permitted) {
                await registerAutoSite(host);
            } else {
                await unregisterAutoSite(host);
            }
        } catch (error) {
            console.warn(`Unable to restore automatic site ${host}:`, error);
        }
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
        isAutoSite(message.hostname)
            .then((enabled) => sendResponse({ok: true, enabled: enabled}))
            .catch((error) => sendResponse({
                ok: false,
                enabled: false,
                error: error && error.message ? error.message : String(error)
            }));
        return true;
    }

    if (message.type === "set-auto-site") {
        const operation = message.enabled
            ? registerAutoSite(message.hostname)
            : unregisterAutoSite(message.hostname);

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
