(() => {
    const DIV_CLASSNAME = "pixgrabber_holder";

    let currentHostname = "";

    function hostPatterns(hostname) {
        return [
            `https://${hostname}/*`,
            `http://${hostname}/*`
        ];
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
        const submit = document.getElementById("pixgrabber_submit");

        if (summary) {
            summary.textContent =
                `${selectedGroups} ${groupWord} · ${selectedImages} ${imageWord} selected`;
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

        // Keep the current DOM traversal order. This deliberately preserves
        // group order and image order exactly as rendered from the webpage.
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

    function onSubmitButton() {
        const selected = getSelected();
        if (selected.length === 0) {
            return;
        }

        const submit = document.getElementById("pixgrabber_submit");
        if (submit) {
            submit.disabled = true;
            submit.textContent = "Sending…";
        }

        setFooterStatus("Sending selected images to PixGrabber…");

        window.parent.postMessage(
            {
                source: "pixgrabber-frame",
                type: "submit",
                links: selected
            },
            "*"
        );
    }

    function requestGroups() {
        setFooterStatus("Scanning this page for thumbnail groups…");
        window.parent.postMessage(
            {
                source: "pixgrabber-frame",
                type: "request-groups"
            },
            "*"
        );
    }

    function onRefreshButton() {
        requestGroups();
    }

    function onCloseButton() {
        window.parent.postMessage(
            {
                source: "pixgrabber-frame",
                type: "close-picker"
            },
            "*"
        );
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

    function renderGroups(json) {
        const view = document.getElementById("pixgrabber_view");
        if (!view) {
            return;
        }

        view.replaceChildren();
        updateAutoState(json.hostname);

        const groups = Array.isArray(json.links) ? json.links : [];

        if (groups.length === 0) {
            const empty = document.createElement("div");
            empty.className = "pixgrabber_empty";
            empty.textContent = "No thumbnail groups found on this page.";
            view.appendChild(empty);
            updateSelectionSummary();
            setFooterStatus("No thumbnail groups found.");
            return;
        }

        groups.forEach((group, index) => {
            const div = document.createElement("section");
            div.className = DIV_CLASSNAME;
            div.dataset.selected = "false";

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

            const orderHint = document.createElement("span");
            orderHint.className = "pixgrabber_order_hint";
            orderHint.textContent = "In page order";

            header.append(check, title, meta, orderHint);
            div.appendChild(header);

            const strip = document.createElement("div");
            strip.className = "pixgrabber_thumb_strip";

            for (const tags of group) {
                const anchor = document.createElement("a");
                const image = document.createElement("img");

                anchor.href = tags.href;
                image.src = tags.src;
                image.alt = "";
                image.loading = "lazy";
                anchor.appendChild(image);
                anchor.addEventListener("click", (event) => event.preventDefault());
                strip.appendChild(anchor);
            }

            div.appendChild(strip);
            div.addEventListener("click", onDivClick, false);
            view.appendChild(div);
        });

        updateSelectionSummary();
        setFooterStatus(
            `${groups.length} ${groups.length === 1 ? "group" : "groups"} found. Select the groups you want to download.`
        );
    }

    function handleSubmitResult(message) {
        const submit = document.getElementById("pixgrabber_submit");

        if (submit) {
            submit.textContent = "Send to PixGrabber";
        }

        updateSelectionSummary();

        if (message.ok) {
            setFooterStatus("Sent to PixGrabber ✓", "success");
            return;
        }

        setFooterStatus(
            message.error
                ? `Unable to send: ${message.error}`
                : "Unable to connect to PixGrabber.",
            "error"
        );
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

    document.getElementById("pixgrabber_select_all")
        .addEventListener("click", onSelectAll);

    document.getElementById("pixgrabber_clear")
        .addEventListener("click", onClear);

    requestGroups();
})();
