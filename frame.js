(() => {
    const DIV_CLASSNAME = "pixgrabber_holder";
    const PREVIEW_IMAGE_LIMIT = 8;
    const DEFAULT_DRAWER_HEIGHT = 340;
    const MIN_DRAWER_HEIGHT = 220;
    const MINIMIZED_HEIGHT = 52;
    const UI_STATE_KEY = "pickerUiState";
    const NOTICE_HIDE_MS = 3200;
    const THUMBNAIL_SIZES = new Set(["small", "medium", "large"]);

    let currentHostname = "";
    let currentPageUrl = "";
    let savedPageUrl = "";
    let minimized = false;
    let lastExpandedHeight = DEFAULT_DRAWER_HEIGHT;
    let lastScrollTop = 0;
    let expandedGroupIndexes = new Set();
    let scrollSaveTimer = null;
    let noticeTimer = null;
    let thumbnailSize = "medium";

    function hostPatterns(hostname) {
        return [
            `https://${hostname}/*`,
            `http://${hostname}/*`
        ];
    }

    function postToParent(type, extra = {}) {
        window.parent.postMessage(
            {
                source: "pixgrabber-frame",
                type: type,
                ...extra
            },
            "*"
        );
    }

    function setAutoStatus(text, isError = false) {
        const status = document.getElementById("pixgrabber_auto_status");
        if (!status) {
            return;
        }

        status.textContent = text;
        status.classList.toggle("error", isError);
    }

    function setFooterStatus(text, state = "") {
        const status = document.getElementById("pixgrabber_status");
        if (!status) {
            return;
        }

        status.textContent = text;
        status.classList.toggle("success", state === "success");
        status.classList.toggle("error", state === "error");
    }

    function applyThumbnailSize(size, save = true) {
        thumbnailSize = THUMBNAIL_SIZES.has(size) ? size : "medium";
        document.body.dataset.thumbnailSize = thumbnailSize;

        for (const button of document.querySelectorAll(".pixgrabber_size_button")) {
            const active = button.dataset.size === thumbnailSize;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        }

        if (save) {
            saveUiState(false);
        }
    }

    function onThumbnailSizeClick(event) {
        const size = event.currentTarget.dataset.size;
        if (!THUMBNAIL_SIZES.has(size)) {
            return;
        }

        applyThumbnailSize(size);
        setFooterStatus(
            `Thumbnail size: ${size.charAt(0).toUpperCase() + size.slice(1)}.`
        );
    }

    function clearNotice() {
        const notice = document.getElementById("pixgrabber_notice");
        if (!notice) {
            return;
        }

        if (noticeTimer !== null) {
            window.clearTimeout(noticeTimer);
            noticeTimer = null;
        }

        notice.hidden = true;
        notice.classList.remove("success", "error", "info");
    }

    function showNotice(state, title, message, autoHide = false) {
        const notice = document.getElementById("pixgrabber_notice");
        const icon = document.getElementById("pixgrabber_notice_icon");
        const titleNode = document.getElementById("pixgrabber_notice_title");
        const messageNode = document.getElementById("pixgrabber_notice_message");

        if (!notice || !icon || !titleNode || !messageNode) {
            return;
        }

        if (noticeTimer !== null) {
            window.clearTimeout(noticeTimer);
            noticeTimer = null;
        }

        notice.classList.remove("success", "error", "info");
        notice.classList.add(state || "info");

        if (state === "success") {
            icon.textContent = "✓";
        } else if (state === "error") {
            icon.textContent = "!";
        } else {
            icon.textContent = "i";
        }

        titleNode.textContent = title;
        messageNode.textContent = message;
        notice.hidden = false;

        if (autoHide) {
            noticeTimer = window.setTimeout(clearNotice, NOTICE_HIDE_MS);
        }
    }

    function renderViewState(state, title, message, actionLabel = "") {
        const view = document.getElementById("pixgrabber_view");
        if (!view) {
            return;
        }

        view.replaceChildren();

        const card = document.createElement("div");
        card.className = `pixgrabber_state_card ${state}`;

        const icon = document.createElement("div");
        icon.className = `pixgrabber_state_icon ${state}`;
        icon.setAttribute("aria-hidden", "true");

        if (state === "loading") {
            const spinner = document.createElement("span");
            spinner.className = "pixgrabber_spinner";
            icon.appendChild(spinner);
        } else if (state === "empty") {
            icon.textContent = "○";
        } else {
            icon.textContent = "!";
        }

        const titleNode = document.createElement("div");
        titleNode.className = "pixgrabber_state_title";
        titleNode.textContent = title;

        const messageNode = document.createElement("div");
        messageNode.className = "pixgrabber_state_message";
        messageNode.textContent = message;

        card.append(icon, titleNode, messageNode);

        if (actionLabel) {
            const action = document.createElement("button");
            action.className = "pixgrabber_state_action";
            action.type = "button";
            action.textContent = actionLabel;
            action.addEventListener("click", requestGroups);
            card.appendChild(action);
        }

        view.appendChild(card);
    }


    function setConnectionStatus(state) {
        const indicator = document.getElementById("pixgrabber_connection");
        const text = document.getElementById("pixgrabber_connection_text");
        if (!indicator || !text) {
            return;
        }

        indicator.classList.toggle("connected", state === "connected");
        indicator.classList.toggle("disconnected", state === "disconnected");

        if (state === "connected") {
            text.textContent = "PixGrabber connected";
        } else if (state === "disconnected") {
            text.textContent = "PixGrabber not running";
        } else {
            text.textContent = "Checking PixGrabber…";
        }
    }

    async function checkPixGrabberStatus() {
        setConnectionStatus("checking");

        try {
            const response = await chrome.runtime.sendMessage({
                type: "get-pixgrabber-status"
            });

            const running = Boolean(
                response &&
                response.ok &&
                response.running
            );

            setConnectionStatus(running ? "connected" : "disconnected");
            return running;
        } catch (error) {
            setConnectionStatus("disconnected");
            return false;
        }
    }

    function updateAutoState(hostname) {
        const checkbox = document.getElementById("pixgrabber_auto");
        const siteLabel = document.getElementById("pixgrabber_site");

        if (!checkbox || !siteLabel) {
            return;
        }

        currentHostname = hostname || "";
        siteLabel.textContent = currentHostname || "this site";
        checkbox.disabled = !currentHostname;

        if (!currentHostname) {
            checkbox.checked = false;
            return;
        }

        chrome.runtime.sendMessage(
            {
                type: "get-auto-site-state",
                hostname: currentHostname
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    checkbox.checked = false;
                    return;
                }

                checkbox.checked = Boolean(
                    response && response.ok && response.enabled
                );
            }
        );
    }

    async function onAutoChanged(event) {
        const checkbox = event.currentTarget;

        if (!currentHostname) {
            checkbox.checked = false;
            return;
        }

        checkbox.disabled = true;
        setAutoStatus("");

        try {
            if (checkbox.checked) {
                const granted = await chrome.permissions.request({
                    origins: hostPatterns(currentHostname)
                });

                if (!granted) {
                    checkbox.checked = false;
                    setAutoStatus("Chrome permission was not granted.", true);
                    return;
                }
            }

            const response = await chrome.runtime.sendMessage({
                type: "set-auto-site",
                hostname: currentHostname,
                enabled: checkbox.checked
            });

            if (!response || !response.ok) {
                checkbox.checked = false;
                setAutoStatus(
                    response && response.error
                        ? response.error
                        : "Unable to change automatic loading.",
                    true
                );
                return;
            }

            setAutoStatus(
                checkbox.checked
                    ? "PixGrabber will open automatically on this site."
                    : "Automatic loading disabled for this site."
            );
        } catch (error) {
            checkbox.checked = false;
            setAutoStatus(
                error && error.message ? error.message : String(error),
                true
            );
        } finally {
            checkbox.disabled = false;
        }
    }

    function setGroupSelected(div, selected) {
        div.dataset.selected = selected ? "true" : "false";

        const checkbox = div.querySelector(".pixgrabber_group_check");
        if (checkbox) {
            checkbox.setAttribute("aria-checked", selected ? "true" : "false");
        }
    }

    function updateSelectionSummary() {
        let selectedGroups = 0;
        let selectedImages = 0;

        for (const div of document.getElementsByClassName(DIV_CLASSNAME)) {
            if (div.dataset.selected !== "true") {
                continue;
            }

            selectedGroups += 1;
            selectedImages += div.getElementsByTagName("a").length;
        }

        const groupWord = selectedGroups === 1 ? "group" : "groups";
        const imageWord = selectedImages === 1 ? "image" : "images";
        const summary = document.getElementById("pixgrabber_summary");
        const minimizedSummary = document.getElementById("pixgrabber_minimized_summary");
        const submit = document.getElementById("pixgrabber_submit");

        if (summary) {
            summary.textContent =
                `${selectedGroups} ${groupWord} · ${selectedImages} ${imageWord} selected`;
        }

        if (minimizedSummary) {
            minimizedSummary.textContent =
                `${selectedGroups} ${groupWord} · ${selectedImages} ${imageWord}`;
        }

        if (submit) {
            submit.disabled = selectedImages === 0;
        }
    }

    function onDivClick(event) {
        const div = event.currentTarget;
        const selected = div.dataset.selected === "true";
        setGroupSelected(div, !selected);
        updateSelectionSummary();
        setFooterStatus("Selection updated.");
    }

    function getSelected() {
        const selected = [];

        // Keep the current DOM traversal order. Hidden preview thumbnails stay
        // in the DOM, so every selected image is submitted in webpage order.
        for (const div of document.getElementsByClassName(DIV_CLASSNAME)) {
            if (div.dataset.selected !== "true") {
                continue;
            }

            for (const anchor of div.getElementsByTagName("a")) {
                const image = anchor.firstElementChild;
                if (image && image.tagName === "IMG") {
                    selected.push({
                        href: anchor.href,
                        src: image.src
                    });
                }
            }
        }

        return selected;
    }

    async function onSubmitButton() {
        const selected = getSelected();
        if (selected.length === 0) {
            return;
        }

        const running = await checkPixGrabberStatus();
        if (!running) {
            showNotice(
                "error",
                "PixGrabber isn’t running",
                "Start the desktop app, then click Send to PixGrabber again."
            );
            setFooterStatus(
                "PixGrabber isn't running. Start the desktop app, then try again.",
                "error"
            );
            return;
        }

        const submit = document.getElementById("pixgrabber_submit");
        if (submit) {
            submit.disabled = true;
            submit.textContent = "Sending…";
        }

        setFooterStatus("Sending selected images to PixGrabber…");

        postToParent("submit", {links: selected});
    }

    function requestGroups() {
        clearNotice();
        renderViewState(
            "loading",
            "Scanning page…",
            "Looking for linked thumbnail groups in page order."
        );
        setFooterStatus("Scanning this page for thumbnail groups…");
        postToParent("request-groups");
    }

    function onRefreshButton() {
        if (!minimized) {
            lastScrollTop = Math.max(window.scrollY, 0);
        }
        requestGroups();
    }

    async function onCloseButton() {
        if (!minimized) {
            lastScrollTop = Math.max(window.scrollY, 0);
        }
        await saveUiState();
        postToParent("close-picker");
    }

    function onSelectAll() {
        for (const div of document.getElementsByClassName(DIV_CLASSNAME)) {
            setGroupSelected(div, true);
        }
        updateSelectionSummary();
        setFooterStatus("All groups selected.");
    }

    function onClear() {
        for (const div of document.getElementsByClassName(DIV_CLASSNAME)) {
            setGroupSelected(div, false);
        }
        updateSelectionSummary();
        setFooterStatus("Selection cleared.");
    }

    function setGroupExpanded(div, expanded) {
        div.dataset.expanded = expanded ? "true" : "false";

        const strip = div.querySelector(".pixgrabber_thumb_strip");
        const button = div.querySelector(".pixgrabber_expand_button");
        if (!strip || !button) {
            return;
        }

        const anchors = Array.from(strip.getElementsByTagName("a"));
        anchors.forEach((anchor, index) => {
            anchor.classList.toggle(
                "pixgrabber_thumb_hidden",
                !expanded && index >= PREVIEW_IMAGE_LIMIT
            );
        });

        const hiddenCount = Math.max(anchors.length - PREVIEW_IMAGE_LIMIT, 0);
        button.textContent = expanded
            ? "Collapse"
            : `+${hiddenCount} more`;
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    function onExpandButton(event) {
        event.preventDefault();
        event.stopPropagation();

        const div = event.currentTarget.closest(`.${DIV_CLASSNAME}`);
        if (!div) {
            return;
        }

        const expanded = div.dataset.expanded === "true";
        const nextExpanded = !expanded;
        setGroupExpanded(div, nextExpanded);

        const groupIndex = Number(div.dataset.groupIndex);
        if (Number.isInteger(groupIndex) && groupIndex >= 0) {
            if (nextExpanded) {
                expandedGroupIndexes.add(groupIndex);
            } else {
                expandedGroupIndexes.delete(groupIndex);
            }
            saveUiState();
        }
    }

    function renderGroups(json) {
        const view = document.getElementById("pixgrabber_view");
        if (!view) {
            return;
        }

        view.replaceChildren();
        updateAutoState(json.hostname);
        preparePageState(json.url);

        const groups = Array.isArray(json.links) ? json.links : [];

        if (groups.length === 0) {
            renderViewState(
                "empty",
                "No image groups found",
                "PixGrabber couldn't find any linked thumbnail groups on this page.",
                "Scan again"
            );
            expandedGroupIndexes.clear();
            saveUiState(false);
            updateSelectionSummary();
            setFooterStatus("No thumbnail groups found.");
            restoreScrollPosition();
            return;
        }

        clearNotice();

        groups.forEach((group, index) => {
            const div = document.createElement("section");
            const shouldExpand = expandedGroupIndexes.has(index);

            div.className = DIV_CLASSNAME;
            div.dataset.selected = "false";
            div.dataset.groupIndex = String(index);
            div.dataset.expanded = shouldExpand ? "true" : "false";

            const header = document.createElement("div");
            header.className = "pixgrabber_group_header";

            const check = document.createElement("span");
            check.className = "pixgrabber_group_check";
            check.textContent = "✓";
            check.setAttribute("role", "checkbox");
            check.setAttribute("aria-checked", "false");
            check.setAttribute("aria-label", `Select group ${index + 1}`);

            const title = document.createElement("span");
            title.className = "pixgrabber_group_title";
            title.textContent = `Group ${index + 1}`;

            const meta = document.createElement("span");
            meta.className = "pixgrabber_group_meta";
            const count = Array.isArray(group) ? group.length : 0;
            meta.textContent = `· ${count} ${count === 1 ? "image" : "images"}`;

            const spacer = document.createElement("span");
            spacer.className = "pixgrabber_group_header_spacer";

            const orderHint = document.createElement("span");
            orderHint.className = "pixgrabber_order_hint";
            orderHint.textContent = "In page order";

            header.append(check, title, meta, spacer, orderHint);

            if (count > PREVIEW_IMAGE_LIMIT) {
                const expand = document.createElement("button");
                expand.className = "pixgrabber_expand_button";
                expand.type = "button";
                expand.textContent = shouldExpand
                    ? "Collapse"
                    : `+${count - PREVIEW_IMAGE_LIMIT} more`;
                expand.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
                expand.addEventListener("click", onExpandButton);
                header.appendChild(expand);
            }

            div.appendChild(header);

            const strip = document.createElement("div");
            strip.className = "pixgrabber_thumb_strip";

            group.forEach((tags, imageIndex) => {
                const anchor = document.createElement("a");
                const image = document.createElement("img");

                anchor.href = tags.href;
                if (!shouldExpand && imageIndex >= PREVIEW_IMAGE_LIMIT) {
                    anchor.classList.add("pixgrabber_thumb_hidden");
                }

                image.src = tags.src;
                image.alt = "";
                image.loading = "lazy";
                anchor.appendChild(image);
                anchor.addEventListener("click", (event) => event.preventDefault());
                strip.appendChild(anchor);
            });

            div.appendChild(strip);
            div.addEventListener("click", onDivClick, false);
            view.appendChild(div);
        });

        updateSelectionSummary();
        setFooterStatus(
            `${groups.length} ${groups.length === 1 ? "group" : "groups"} found. Select the groups you want to download.`
        );
        restoreScrollPosition();
    }

    function handleSubmitResult(message) {
        const submit = document.getElementById("pixgrabber_submit");

        if (submit) {
            submit.textContent = "Send to PixGrabber";
        }

        updateSelectionSummary();

        if (message.ok) {
            showNotice(
                "success",
                "Sent to PixGrabber",
                "Selected images were handed to the desktop app.",
                true
            );
            setFooterStatus("Sent to PixGrabber ✓", "success");
            return;
        }

        const errorMessage = message.error
            ? message.error
            : "Unable to connect to PixGrabber.";

        showNotice(
            "error",
            "Couldn’t send to PixGrabber",
            errorMessage
        );
        setFooterStatus(`Unable to send: ${errorMessage}`, "error");
        checkPixGrabberStatus();
    }

    function updateMinimizeUi() {
        const button = document.getElementById("pixgrabber_minimize");

        document.body.classList.toggle("pixgrabber_minimized", minimized);

        if (button) {
            button.textContent = minimized ? "□" : "−";
            button.title = minimized ? "Restore PixGrabber" : "Minimise PixGrabber";
            button.setAttribute(
                "aria-label",
                minimized ? "Restore PixGrabber" : "Minimise PixGrabber"
            );
        }
    }

    async function saveUiState(captureScroll = true) {
        try {
            if (captureScroll && !minimized) {
                lastScrollTop = Math.max(window.scrollY, 0);
            }

            if (currentPageUrl) {
                savedPageUrl = currentPageUrl;
            }

            await chrome.storage.local.set({
                [UI_STATE_KEY]: {
                    height: Math.round(lastExpandedHeight),
                    minimized: minimized,
                    scrollTop: Math.round(lastScrollTop),
                    pageUrl: savedPageUrl,
                    expandedGroups: Array.from(expandedGroupIndexes).sort((a, b) => a - b),
                    thumbnailSize: thumbnailSize
                }
            });
        } catch (error) {
            console.warn("Could not save PixGrabber drawer state:", error);
        }
    }

    async function restoreUiState() {
        try {
            const stored = await chrome.storage.local.get(UI_STATE_KEY);
            const state = stored[UI_STATE_KEY];

            if (state && typeof state === "object") {
                const savedHeight = Number(state.height);

                if (Number.isFinite(savedHeight) && savedHeight >= MIN_DRAWER_HEIGHT) {
                    lastExpandedHeight = Math.round(savedHeight);
                }

                minimized = Boolean(state.minimized);

                const savedScrollTop = Number(state.scrollTop);
                if (Number.isFinite(savedScrollTop) && savedScrollTop >= 0) {
                    lastScrollTop = Math.round(savedScrollTop);
                }

                savedPageUrl =
                    typeof state.pageUrl === "string"
                        ? state.pageUrl
                        : "";

                expandedGroupIndexes = new Set(
                    Array.isArray(state.expandedGroups)
                        ? state.expandedGroups.filter(
                            (index) => Number.isInteger(index) && index >= 0
                        )
                        : []
                );

                if (THUMBNAIL_SIZES.has(state.thumbnailSize)) {
                    thumbnailSize = state.thumbnailSize;
                }
            }
        } catch (error) {
            console.warn("Could not restore PixGrabber drawer state:", error);
        }

        applyThumbnailSize(thumbnailSize, false);
        updateMinimizeUi();
        postToParent("resize-picker", {
            height: minimized ? MINIMIZED_HEIGHT : lastExpandedHeight
        });
    }

    function preparePageState(pageUrl) {
        currentPageUrl = typeof pageUrl === "string" ? pageUrl : "";

        if (!currentPageUrl || currentPageUrl !== savedPageUrl) {
            lastScrollTop = 0;
            expandedGroupIndexes.clear();
            savedPageUrl = currentPageUrl;
            saveUiState(false);
        }
    }

    function restoreScrollPosition() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!minimized) {
                    window.scrollTo(0, lastScrollTop);
                }
            });
        });
    }

    function setupScrollPersistence() {
        window.addEventListener(
            "scroll",
            () => {
                if (minimized) {
                    return;
                }

                lastScrollTop = Math.max(window.scrollY, 0);

                if (scrollSaveTimer !== null) {
                    clearTimeout(scrollSaveTimer);
                }

                scrollSaveTimer = setTimeout(() => {
                    scrollSaveTimer = null;
                    saveUiState();
                }, 150);
            },
            {passive: true}
        );

        window.addEventListener("pagehide", () => {
            if (!minimized) {
                lastScrollTop = Math.max(window.scrollY, 0);
            }
            saveUiState();
        });
    }

    function setMinimized(nextMinimized) {
        if (nextMinimized && !minimized) {
            lastScrollTop = Math.max(window.scrollY, 0);
        }

        minimized = nextMinimized;

        if (minimized) {
            lastExpandedHeight = Math.max(window.innerHeight, MIN_DRAWER_HEIGHT);
        }

        updateMinimizeUi();

        postToParent("resize-picker", {
            height: minimized ? MINIMIZED_HEIGHT : lastExpandedHeight
        });

        if (!minimized) {
            requestAnimationFrame(() => {
                window.scrollTo(0, lastScrollTop);
            });
        }

        saveUiState();
    }

    function onMinimizeButton() {
        setMinimized(!minimized);
    }

    function setupResizeHandle() {
        const handle = document.getElementById("pixgrabber_resize_handle");
        if (!handle) {
            return;
        }

        handle.addEventListener("pointerdown", (event) => {
            if (minimized) {
                return;
            }

            event.preventDefault();
            handle.setPointerCapture(event.pointerId);

            const startY = event.screenY;
            const startHeight = window.innerHeight;

            const onMove = (moveEvent) => {
                const delta = startY - moveEvent.screenY;
                const height = Math.max(MIN_DRAWER_HEIGHT, startHeight + delta);
                lastExpandedHeight = height;
                postToParent("resize-picker", {height: height});
            };

            const onUp = (upEvent) => {
                try {
                    handle.releasePointerCapture(upEvent.pointerId);
                } catch (error) {
                    // Pointer capture may already be released.
                }

                handle.removeEventListener("pointermove", onMove);
                handle.removeEventListener("pointerup", onUp);
                handle.removeEventListener("pointercancel", onUp);
                saveUiState();
            };

            handle.addEventListener("pointermove", onMove);
            handle.addEventListener("pointerup", onUp);
            handle.addEventListener("pointercancel", onUp);
        });
    }

    window.addEventListener("message", (event) => {
        if (event.source !== window.parent) {
            return;
        }

        const message = event.data;
        if (!message || message.source !== "pixgrabber-content") {
            return;
        }

        if (message.type === "groups") {
            renderGroups(message);
            return;
        }

        if (message.type === "submit-result") {
            handleSubmitResult(message);
        }
    });

    document.getElementById("pixgrabber_auto")
        .addEventListener("change", onAutoChanged);

    document.getElementById("pixgrabber_submit")
        .addEventListener("click", onSubmitButton);

    document.getElementById("pixgrabber_refresh")
        .addEventListener("click", onRefreshButton);

    document.getElementById("pixgrabber_close")
        .addEventListener("click", onCloseButton);

    document.getElementById("pixgrabber_minimize")
        .addEventListener("click", onMinimizeButton);

    document.getElementById("pixgrabber_select_all")
        .addEventListener("click", onSelectAll);

    document.getElementById("pixgrabber_clear")
        .addEventListener("click", onClear);

    document.getElementById("pixgrabber_notice_close")
        .addEventListener("click", clearNotice);

    for (const button of document.querySelectorAll(".pixgrabber_size_button")) {
        button.addEventListener("click", onThumbnailSizeClick);
    }

    const versionLabel = document.getElementById("pixgrabber_version");
    if (versionLabel) {
        versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
    }

    setupResizeHandle();
    setupScrollPersistence();
    checkPixGrabberStatus();
    restoreUiState().finally(() => {
        requestGroups();
    });
})();
