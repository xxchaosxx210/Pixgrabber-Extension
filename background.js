const PIXGRABBER_ENDPOINT = "http://localhost:5000/set-html";

function encodePayload(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "submit-to-pixgrabber") {
        return false;
    }

    sendToPixGrabber(message.payload)
        .then(() => sendResponse({ok: true}))
        .catch((error) => {
            console.error("Unable to connect to PixGrabber:", error);
            sendResponse({
                ok: false,
                error: error && error.message ? error.message : String(error)
            });
        });

    // Keep the message channel open while the localhost request completes.
    return true;
});
