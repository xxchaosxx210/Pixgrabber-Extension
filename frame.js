(() => {
    const DIV_CLASSNAME = "pixgrabber_holder";
    const OVERLAY_CLASSNAME = "pixgrabber_overlay";

    const STYLE_SELECTED_ON = "10px solid #0033cc";
    const STYLE_SELECTED_OFF = "10px solid #324d88";

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

        const submit = document.createElement("button");
        submit.type = "button";
        submit.className = "pixgrabber_submit";
        submit.textContent = "Submit";
        submit.addEventListener("click", onSubmitButton);
        document.body.appendChild(submit);
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

    window.parent.postMessage(
        {
            source: "pixgrabber-frame",
            type: "request-groups"
        },
        "*"
    );
})();
