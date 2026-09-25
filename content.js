(() => {
    // content.js can be injected manually or registered for an automatic site.
    // Install the listeners once per page, then let later injections return.
    if (globalThis.__PIXGRABBER_CONTENT_LOADED__) {
        return;
    }
    globalThis.__PIXGRABBER_CONTENT_LOADED__ = true;

    const ERROR_MESSAGE =
        "Unable to connect to PixGrabber. Make sure PixGrabber is running.";
    const ID_IFRAME = "pixgrabber-iframe";
    const EXTENSION_ORIGIN = new URL(chrome.runtime.getURL("/")).origin;

    function createThumbnailGroups() {
        const groups = [];
        let group = [];

        for (const anchor of document.getElementsByTagName("a")) {
            const firstChild = anchor.firstElementChild;

            if (firstChild && firstChild.tagName === "IMG") {
                group.push({
                    href: anchor.href,
                    src: firstChild.src
                });
            } else if (group.length > 0) {
                groups.push(group);
                group = [];
            }
        }

        if (group.length > 0) {
            groups.push(group);
        }

        return groups;
    }

    function openPicker() {
        if (document.getElementById(ID_IFRAME)) {
            return "already-open";
        }

        const iframe = document.createElement("iframe");
        iframe.className = "pixgrabber_frame";
        iframe.id = ID_IFRAME;
        iframe.title = "PixGrabber thumbnail picker";
        iframe.src = chrome.runtime.getURL("frame.html");

        const parent = document.body || document.documentElement;
        parent.insertBefore(iframe, parent.firstChild);

        return "created";
    }

    function togglePicker() {
        const existing = document.getElementById(ID_IFRAME);
        if (existing) {
            existing.remove();
            return "deleted";
        }

        return openPicker();
    }

    function sendPickerMessage(message) {
        const iframe = document.getElementById(ID_IFRAME);
        if (!iframe || !iframe.contentWindow) {
            return;
        }

        iframe.contentWindow.postMessage(
            {
                source: "pixgrabber-content",
                ...message
            },
            EXTENSION_ORIGIN
        );
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || message.type !== "toggle-picker") {
            return false;
        }

        sendResponse({status: togglePicker()});
        return false;
    });

    window.addEventListener("message", (event) => {
        const iframe = document.getElementById(ID_IFRAME);

        if (
            !iframe ||
            event.source !== iframe.contentWindow ||
            event.origin !== EXTENSION_ORIGIN
        ) {
            return;
        }

        const message = event.data;
        if (!message || message.source !== "pixgrabber-frame") {
            return;
        }

        if (message.type === "request-groups") {
            iframe.contentWindow.postMessage(
                {
                    source: "pixgrabber-content",
                    type: "groups",
                    links: createThumbnailGroups(),
                    title: document.title,
                    hostname: window.location.hostname
                },
                EXTENSION_ORIGIN
            );
            return;
        }

        if (message.type === "close-picker") {
            iframe.remove();
            return;
        }

        if (message.type === "submit") {
            const payload = {
                links: Array.isArray(message.links) ? message.links : [],
                title: document.title,
                url: window.location.href
            };

            chrome.runtime.sendMessage(
                {
                    type: "submit-to-pixgrabber",
                    payload: payload
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        sendPickerMessage({
                            type: "submit-result",
                            ok: false,
                            error: ERROR_MESSAGE
                        });
                        return;
                    }

                    if (!response || !response.ok) {
                        sendPickerMessage({
                            type: "submit-result",
                            ok: false,
                            error:
                                response && response.error
                                    ? response.error
                                    : ERROR_MESSAGE
                        });
                        return;
                    }

                    sendPickerMessage({
                        type: "submit-result",
                        ok: true
                    });
                }
            );
        }
    });

    chrome.runtime.sendMessage(
        {
            type: "get-auto-site-state",
            hostname: window.location.hostname
        },
        (response) => {
            if (chrome.runtime.lastError) {
                return;
            }

            if (response && response.ok && response.enabled) {
                openPicker();
            }
        }
    );
})();
