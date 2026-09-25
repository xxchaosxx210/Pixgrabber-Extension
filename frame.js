(() => {
    const DIV_CLASSNAME = "pixgrabber_holder";
    const OVERLAY_CLASSNAME = "pixgrabber_overlay";

    const STYLE_SELECTED_ON = "10px solid #0033cc";
    const STYLE_SELECTED_OFF = "10px solid #324d88";

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

    function onDivClick(event) {
        const div = event.currentTarget;
        const selected = div.dataset.selected === "true";
        div.dataset.selected = selected ? "false" : "true";
        div.style.border = selected ? STYLE_SELECTED_OFF : STYLE_SELECTED_ON;

        const overlay = div.getElementsByClassName(OVERLAY_CLASSNAME)[0];
        if (overlay) {
            overlay.style.display = selected ? "none" : "block";
        }
    }

    function getSelected() {
        const selected = [];

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
        window.parent.postMessage(
            {
                source: "pixgrabber-frame",
                type: "submit",
                links: getSelected()
            },
            "*"
        );
    }

    function renderGroups(json) {
        const existing = document.getElementById("pixgrabber_view");
        if (existing) {
            existing.remove();
        }

        updateAutoState(json.hostname);

        const view = document.createElement("div");
        view.id = "pixgrabber_view";
        document.body.appendChild(view);

        const groups = Array.isArray(json.links) ? json.links : [];

        if (groups.length === 0) {
            const empty = document.createElement("p");
            empty.className = "pixgrabber_empty";
            empty.textContent = "No thumbnail groups found on this page.";
            view.appendChild(empty);
        }

        for (const group of groups) {
            const div = document.createElement("div");
            div.className = DIV_CLASSNAME;
            div.style.border = STYLE_SELECTED_OFF;
            div.dataset.selected = "false";

            for (const tags of group) {
                const anchor = document.createElement("a");
                const image = document.createElement("img");

                anchor.href = tags.href;
                image.src = tags.src;
                image.alt = "";
                anchor.appendChild(image);
                anchor.addEventListener("click", (event) => event.preventDefault());
                div.appendChild(anchor);
            }

            const overlay = document.createElement("div");
            overlay.className = OVERLAY_CLASSNAME;
            div.appendChild(overlay);

            div.addEventListener("click", onDivClick, false);
            view.appendChild(div);
        }
    }

    window.addEventListener("message", (event) => {
        if (event.source !== window.parent) {
            return;
        }

        const message = event.data;
        if (
            !message ||
            message.source !== "pixgrabber-content" ||
            message.type !== "groups"
        ) {
            return;
        }

        renderGroups(message);
    });

    document.getElementById("pixgrabber_auto")
        .addEventListener("change", onAutoChanged);

    document.getElementById("pixgrabber_submit")
        .addEventListener("click", onSubmitButton);

    window.parent.postMessage(
        {
            source: "pixgrabber-frame",
            type: "request-groups"
        },
        "*"
    );
})();
