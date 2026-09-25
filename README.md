# PixGrabber Chrome Extension

A Chrome helper for the [wxPixGrabber](https://github.com/xxchaosxx210/wxPixGrabber) desktop application.

The extension lets you open a thumbnail picker on the current page, select groups of linked thumbnails, and send those links directly to PixGrabber running on your computer.

## Requirements

- Google Chrome with Manifest V3 support
- PixGrabber running locally
- PixGrabber's helper server available at `http://localhost:5000`

## Install for testing

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this extension folder.
5. Pin **PixGrabber Helper** from Chrome's Extensions menu if you want quick access.

## Use

1. Start PixGrabber.
2. Open a webpage containing linked thumbnails.
3. Click the **PixGrabber Helper** toolbar button.
4. Select one or more thumbnail groups.
5. Click **Submit**.

The extension sends only the selected link data, page title, and page URL to the PixGrabber application on `localhost:5000`.

## Manifest V3

Version 0.2 migrates the original Manifest V2 extension to Manifest V3:

- `browser_action` -> `action`
- background page -> extension service worker
- deprecated tab CSS injection -> `chrome.scripting`
- page access is granted only when the toolbar action is used via `activeTab`
- localhost communication is performed by the extension service worker


## Automatic sites

Open the PixGrabber picker manually on a site and use **Open automatically on this site**.

When enabled, Chrome asks for access to that specific host and PixGrabber registers its helper for that host. Future visits to the same host open the picker automatically.

Untick the checkbox to disable automatic loading for that host and remove the optional host permission.
