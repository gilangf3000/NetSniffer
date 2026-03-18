# 🐛 NET SNIFFER (v2.0)

![Version](https://img.shields.io/badge/version-2.0-blue.svg)
![Type](https://img.shields.io/badge/type-Bookmarklet-success.svg)
![Compatibility](https://img.shields.io/badge/compatibility-Desktop_&_Mobile_(Kiwi)-orange.svg)

**Net Sniffer** (formerly *Requests Guardian / Fetch Radar*) is a robust, lightweight, and modern JavaScript-based **Network Interceptor Bookmarklet**. It allows you to track, view, and export HTTP/HTTPS requests (both `fetch` and `XHR`) directly from any web page without needing full Developer Tools.

Designed to be highly responsive, it specifically supports mobile Chromium-based browsers like **Kiwi Browser**, enabling advanced traffic monitoring directly on your Android device.

---

## ✨ Features

- 🕵️ **Comprehensive Interception**: Silently catches all `fetch` and `XMLHttpRequest` traffic on the active page.
- 📱 **Mobile & Touch Friendly**: Fully responsive UI with touch-drag support for Kiwi Browser and other mobile platforms.
- 📋 **Advanced cURL Generator**: Easily copy any captured request as a ready-to-use full `curl` command, complete with headers, JSON payloads, form data, and cookies.
- 🧩 **Absolute URL Resolution**: Intelligently resolves relative API paths to absolute URLs to ensure exported commands do not break.
- 📊 **Detailed JSON Inspection**: Inspect HTTP methods, status codes, response times, headers, and bodies cleanly within the UI.
- 💾 **Data Export**: Export your entire session's captured traffic, including LocalStorage, SessionStorage, and Cookies into a clean `.json` file (`fetchradar-*.json`).

---

## ⚡ Quick Start (Installation)

Because Net Sniffer is built as a **Bookmarklet**, you don't need to install any heavy extensions. 

### Method 1: Standard Bookmarklet (PC or Mobile)
1. Minify the entire code inside `script.js` using a tool like [JSCompress](https://jscompress.com/).
2. Create a new Bookmark in your browser.
3. Name it **Net Sniffer**.
4. In the **URL / Address** field, type `javascript:` and immediately paste the minified code after it.
5. Save the bookmark. Click on it while browsing any page to initialize the tracker.

### Method 2: Remote Loader (Recommended for Mobile/Kiwi Browser)
If you frequently update the script, host `script.js` online (e.g., GitHub Gist or your own server) and use this loader in your bookmark to always fetch the latest version:
```javascript
javascript:(function(){var javascript:(function(){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/gh/gilangf3000/NetSniffer@main/script.js';document.body.appendChild(s);})();
```

---

## 🛠️ How to Use

1. Navigate to the website you wish to inspect.
2. Click the **Net Sniffer** bookmark.
3. A floating dark-themed panel will appear in the top right corner.
4. Perform actions on the website (scrolling, clicking, fetching APIs). The panel will populate with real-time requests.
5. **Drag** the header to move the panel around.
6. Click **Minimize** (`-`) to shrink the panel out of your way.
7. Click the **cURL icon** to instantly copy a request to your clipboard.

![Net Sniffer UI Preview](https://via.placeholder.com/600x400/0f172a/38bdf8?text=Net+Sniffer+UI+Preview) *(Replace with actual screenshot)*

---

## 👨‍💻 Technical Details & Code Structure

The script overrides the native `window.fetch` and `XMLHttpRequest.prototype` methods to capture incoming requests and arguments transparently. 

**Key Implementations:**
- **CSP Bypass**: Uses Event Delegation (`addEventListener` on the parent log box) to prevent standard Content Security Policy (CSP) inline-script blocks.
- **Header Normalization**: Safely converts `Headers` objects and array structures into literal format before serializing them into JSON or cURL.
- **Drag Events**: Utilizes `touchstart`, `touchmove`, and `touchend` with `getBoundingClientRect()` to calculate offsets for smooth mobile dragging.

---

## 📝 License
This project is open-source and free to be adapted into your own workflow for debugging, studying, and pentesting network calls.

**Disclaimer**: Use this script responsibly. Capturing and extracting requests containing sensitive authentication elements (Bearer tokens, Session IDs) implies you understand the risks of executing those commands in non-secured environments.
