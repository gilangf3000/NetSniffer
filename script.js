!(function () {
  if (window.__LOGGER_UI__) return;
  window.__LOGGER_UI__ = true;

  const faLink = document.createElement('link');
  faLink.rel = 'stylesheet';
  faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
  document.head.appendChild(faLink);

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  document.head.appendChild(fontLink);

  const logs = [];
  let reqId = 0;

  function getCookies() {
    return document.cookie.split('; ').reduce((acc, cur) => {
      const [k, v] = cur.split('=');
      if (k) acc[k] = v;
      return acc;
    }, {});
  }

  function getStorage(storage) {
    let data = {};
    for (let i = 0; i < storage.length; i++) {
      let key = storage.key(i);
      data[key] = storage.getItem(key);
    }
    return data;
  }

  function getCookiesForCurl() {
    return document.cookie.split('; ').map(cookie => cookie.trim()).join('; ');
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const reqInfo = args[0];
    const reqInit = args[1] || {};

    let urlStr = typeof reqInfo === 'string' ? reqInfo : (reqInfo instanceof URL ? reqInfo.toString() : reqInfo.url);
    let url = urlStr;
    try { url = new URL(urlStr, window.location.origin).href; } catch(e) {}
    let method = reqInit.method || (reqInfo instanceof Request ? reqInfo.method : "GET");
    let headers = reqInit.headers || (reqInfo instanceof Request ? reqInfo.headers : {});
    let body = reqInit.body;

    const currentReqId = ++reqId;
    const startTime = Date.now();

    const logObj = {
      id: currentReqId,
      type: "fetch",
      url: url,
      method: method.toUpperCase(),
      headers: headers,
      body: body,
      time: startTime
    };

    logs.push(logObj);
    updateUI();

    try {
      const response = await origFetch.apply(this, args);
      logObj.status = response.status;
      logObj.statusText = response.statusText;
      logObj.responseTime = Date.now() - startTime;
      updateUI();
      return response;
    } catch (error) {
      logObj.error = error.message;
      updateUI();
      throw error;
    }
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._reqId = ++reqId;
    try {
      this._url = new URL(url, window.location.origin).href;
    } catch(e) {
      this._url = url;
    }
    this._method = method.toUpperCase();
    this._headers = {};
    this._startTime = Date.now();
    return origOpen.apply(this, arguments);
  };

  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
    this._headers[header] = value;
    return origSetHeader.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const logObj = {
      id: this._reqId,
      type: "xhr",
      url: this._url,
      method: this._method,
      headers: this._headers,
      body: body,
      time: this._startTime
    };

    logs.push(logObj);
    updateUI();

    this.addEventListener('loadend', () => {
      logObj.status = this.status;
      logObj.statusText = this.statusText;
      logObj.responseTime = Date.now() - this._startTime;
      updateUI();
    });

    return origSend.apply(this, arguments);
  };

  function objToHeaders(headers) {
    let res = {};
    if (!headers) return res;
    if (headers instanceof Headers) {
      headers.forEach((value, key) => { res[key] = value; });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => { res[key] = value; });
    } else {
      res = { ...headers };
    }
    return res;
  }

  function generateCurl(log, includeCookies = true) {
    let url = log.url;

    // URL is already absolute from the interceptors

    let curl = `curl -X ${log.method} '${url}'`;

    const headObj = objToHeaders(log.headers);

    // Add headers in a more readable format
    for (let k in headObj) {
      if (k.toLowerCase() === 'cookie' && !includeCookies) continue;
      curl += ` \\\n  -H '${k}: ${headObj[k]}'`;
    }

    // Add cookies if not already in headers
    if (includeCookies) {
      const cookieStr = getCookiesForCurl();
      if (cookieStr && !Object.keys(headObj).some(k => k.toLowerCase() === 'cookie')) {
        curl += ` \\\n  -H 'Cookie: ${cookieStr}'`;
      }
    }

    // Handle request body
    if (log.body) {
      let bodyData = log.body;

      // Try to parse JSON body for better formatting
      if (typeof bodyData === 'string') {
        try {
          const parsed = JSON.parse(bodyData);
          bodyData = JSON.stringify(parsed, null, 2);
          curl += ` \\\n  -H 'Content-Type: application/json'`;
          curl += ` \\\n  -d '${bodyData.replace(/'/g, "'\\''")}'`;
        } catch {
          // Not JSON, use as is
          if (bodyData.startsWith('{') || bodyData.startsWith('[')) {
            curl += ` \\\n  -H 'Content-Type: application/json'`;
          }
          curl += ` \\\n  --data-raw '${bodyData.replace(/'/g, "'\\''")}'`;
        }
      } else if (bodyData instanceof FormData) {
        curl += ` \\\n  -F '${JSON.stringify([...bodyData])}'`;
      } else if (typeof bodyData === 'object') {
        try {
          const jsonStr = JSON.stringify(bodyData, null, 2);
          curl += ` \\\n  -H 'Content-Type: application/json'`;
          curl += ` \\\n  -d '${jsonStr.replace(/'/g, "'\\''")}'`;
        } catch (e) { }
      }
    }

    return curl;
  }

  function copyToClipboard(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: 'Inter', monospace;
      font-size: 12px;
      z-index: 10000000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    notification.innerHTML = `<i class="fas fa-check-circle"></i> Copied!`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 1500);
  }

  const style = document.createElement('style');
  style.textContent = `
    #logbox::-webkit-scrollbar { display: none; }
    .request-item { transition: background 0.1s; }
    .request-item:hover { background: #1e293b; }
    button { transition: opacity 0.1s; }
    button:hover { opacity: 0.8; }
    .curl-preview {
      background: #0f172a;
      border: 1px solid #2d3a4f;
      border-radius: 6px;
      padding: 8px;
      margin-top: 5px;
      font-size: 10px;
      color: #fbbf24;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 5vw;
    width: 90vw;
    max-width: 460px;
    height: 80vh;
    max-height: 600px;
    background: #0f172a;
    color: #e2e8f0;
    z-index: 9999999;
    font-size: 12px;
    font-family: 'Inter', monospace;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #2d3a4f;
  `;

  panel.innerHTML = `
    <div id="drag-header" style="padding: 14px 16px; background: #1a2634; color: #60a5fa; font-weight: 600; cursor: move; user-select: none; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2d3a4f;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="background: #ef4444; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <i class="fa-solid fa-bug" style="color: white; font-size: 14px;"></i>
        </div>
        <div>
          <span style="font-size: 14px; letter-spacing: 0.3px;">NET SNIFFER</span>
          <span style="font-size: 10px; color: #94a3b8; margin-left: 6px;">v2.0</span>
        </div>
      </div>
      <div style="display: flex; gap: 12px;">
        <i class="fas fa-minus" id="minimize-btn" style="cursor: pointer; color: #94a3b8; font-size: 14px;"></i>
        <i class="fas fa-times" id="close-btn" style="cursor: pointer; color: #ef4444; font-size: 14px;"></i>
      </div>
    </div>
    
    <div style="padding: 10px; background: #1a2634; border-bottom: 1px solid #2d3a4f; display: flex; gap: 6px; flex-wrap: wrap;">
      <button id="copyAllCookies" style="background: #0f172a; color: #fbbf24; border: 1px solid #fbbf24; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 5px;">
        <i class="fas fa-cookie"></i> Cookies
      </button>
      <button id="copyAllCurl" style="background: #0f172a; color: #34d399; border: 1px solid #34d399; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 5px;">
        <i class="fas fa-terminal"></i> All cURL
      </button>
      <button id="exportJson" style="background: #0f172a; color: #60a5fa; border: 1px solid #60a5fa; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 5px;">
        <i class="fas fa-file-export"></i> Export
      </button>
      <button id="refreshBtn" style="background: #0f172a; color: #c084fc; border: 1px solid #c084fc; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 5px; margin-left: auto;">
        <i class="fas fa-rotate-right"></i>
      </button>
    </div>
    
    <div style="padding: 8px 12px; background: #111c2d; border-bottom: 1px solid #2d3a4f; display: flex; gap: 16px; font-size: 11px; color: #94a3b8;">
      <span><i class="fas fa-chart-line" style="color: #60a5fa; width: 16px;"></i> <span id="totalRequests">0</span></span>
      <span><i class="fas fa-check-circle" style="color: #34d399; width: 16px;"></i> <span id="successRequests">0</span></span>
      <span><i class="fas fa-exclamation-circle" style="color: #f87171; width: 16px;"></i> <span id="failedRequests">0</span></span>
      <span><i class="fas fa-clock" style="color: #fbbf24; width: 16px;"></i> <span id="avgResponseTime">0ms</span></span>
    </div>
    
    <div id="logbox" style="flex: 1; overflow: auto; padding: 10px; background: #0b1320; scrollbar-width: none; -ms-overflow-style: none;"></div>
    
    <div style="display: flex; border-top: 1px solid #2d3a4f; background: #1a2634;">
      <button id="btnData" style="flex: 1; background: transparent; color: #34d399; border: none; padding: 12px; cursor: pointer; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <i class="fas fa-database"></i> FULL DATA
      </button>
      <button id="btnClear" style="flex: 1; background: transparent; color: #f87171; border: none; padding: 12px; cursor: pointer; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; border-left: 1px solid #2d3a4f;">
        <i class="fas fa-trash-can"></i> CLEAR
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  const logbox = panel.querySelector("#logbox");
  const totalSpan = panel.querySelector("#totalRequests");
  const successSpan = panel.querySelector("#successRequests");
  const failedSpan = panel.querySelector("#failedRequests");
  const avgSpan = panel.querySelector("#avgResponseTime");

  let minimized = false;

  function updateStats() {
    const total = logs.length;
    const success = logs.filter(l => l.status && l.status < 400).length;
    const failed = logs.filter(l => l.status && l.status >= 400).length;
    const avgTime = logs.filter(l => l.responseTime).reduce((acc, l) => acc + l.responseTime, 0) / (logs.filter(l => l.responseTime).length || 1);

    totalSpan.textContent = total;
    successSpan.textContent = success;
    failedSpan.textContent = failed;
    avgSpan.textContent = Math.round(avgTime) + 'ms';
  }

  function updateUI() {
    logbox.innerHTML = logs.slice(-50).map(l => {
      const statusColor = l.status ? (l.status < 400 ? '#34d399' : '#f87171') : '#94a3b8';
      const methodColor = l.method === 'GET' ? '#60a5fa' : l.method === 'POST' ? '#34d399' : l.method === 'PUT' ? '#fbbf24' : '#f87171';
      const isChatEndpoint = l.url.includes('/chat/') || l.url.includes('pow_challenge');

      return `<div class="request-item" style="margin-bottom: 8px; padding: 10px; border-radius: 8px; background: #111c2d; border: 1px solid #2d3a4f; ${isChatEndpoint ? 'border-left: 3px solid #fbbf24;' : ''}">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="background: ${methodColor}15; color: ${methodColor}; padding: 3px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">${l.method}</span>
            <span style="color: #94a3b8; font-size: 10px;">
              <i class="fas ${l.type === 'fetch' ? 'fa-globe' : 'fa-arrow-right-arrow-left'}" style="margin-right: 3px;"></i>${l.type}
            </span>
            ${isChatEndpoint ? '<span style="color: #fbbf24; font-size: 9px;"><i class="fas fa-comment"></i> chat</span>' : ''}
          </div>
          <div>
            <button class="list-copy-btn" data-id="${l.id}" style="background: none; color: #fbbf24; border: 1px solid #fbbf24; border-radius: 4px; cursor: pointer; font-size: 9px; padding: 3px 6px; margin-right: 4px;">
              <i class="fas fa-copy"></i>
            </button>
            <button class="list-detail-btn" data-id="${l.id}" style="background: none; color: #60a5fa; border: 1px solid #60a5fa; border-radius: 4px; cursor: pointer; font-size: 9px; padding: 3px 6px;">
              <i class="fas fa-magnifying-glass"></i>
            </button>
          </div>
        </div>
        <div style="color: #94a3b8; font-size: 10px; margin: 5px 0; word-break: break-all;">
          <i class="fas fa-link" style="margin-right: 4px; color: #60a5fa;"></i>${l.url.length > 60 ? l.url.substring(0, 60) + '...' : l.url}
        </div>
        <div style="display: flex; gap: 12px; margin-top: 5px; padding-top: 5px; border-top: 1px solid #2d3a4f; font-size: 9px;">
          <span style="color: ${statusColor};"><i class="fas fa-circle" style="font-size: 6px; margin-right: 4px;"></i>${l.status || 'pending'}</span>
          ${l.responseTime ? `<span style="color: #94a3b8;"><i class="fas fa-clock" style="margin-right: 4px;"></i>${l.responseTime}ms</span>` : ''}
        </div>
      </div>`;
    }).reverse().join("");

    logbox.scrollTop = 0;
    updateStats();
  }

  window.__LOGGER_COPY_CURL = function (id, includeCookies = true) {
    const log = logs.find(l => l.id === id);
    if (!log) return;
    const curlCmd = generateCurl(log, includeCookies);
    copyToClipboard(curlCmd);
  };

  window.__LOGGER_SHOW_DETAILS = function (id) {
    const log = logs.find(l => l.id === id);
    if (!log) return;

    let curlPreview = generateCurl(log, true);

    const w = window.open("", "_blank", "width=800,height=600");
    w.document.write(`
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          body { background: #0f172a; color: #e2e8f0; font-family: 'Inter', monospace; padding: 20px; margin: 0; }
          .container { max-width: 900px; margin: 0 auto; }
          h3 { color: #60a5fa; display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { color: #94a3b8; font-size: 11px; margin-bottom: 5px; text-transform: uppercase; }
          pre { background: #111c2d; padding: 15px; border-radius: 8px; border: 1px solid #2d3a4f; overflow: auto; font-size: 12px; margin: 0; }
          .curl-block { background: #0f172a; border: 1px solid #fbbf24; }
        </style>
      </head>
      <body>
        <div class="container">
          <h3><i class="fas fa-code"></i> Request Details #${log.id}</h3>
          
          <div class="section">
            <div class="section-title"><i class="fas fa-terminal" style="color: #fbbf24;"></i> cURL Command</div>
            <pre class="curl-block" style="color: #fbbf24;">${curlPreview}</pre>
          </div>
          
          <div class="section">
            <div class="section-title"><i class="fas fa-code"></i> JSON Data</div>
            <pre>${JSON.stringify({
      url: log.url,
      method: log.method,
      status: log.status,
      headers: objToHeaders(log.headers),
      body: log.body || null
    }, null, 2)}</pre>
          </div>
        </div>
      </body>
    `);
  };

  function addButtonListener(selector, handler) {
    const btn = panel.querySelector(selector);
    if (btn) btn.onclick = handler;
  }

  addButtonListener("#copyAllCookies", () => {
    const cookies = getCookies();
    const cookieString = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    copyToClipboard(`# Cookies captured at ${new Date().toISOString()}\n${cookieString}`);
  });

  addButtonListener("#copyAllCurl", () => {
    if (logs.length === 0) return;
    const allCurls = logs.map((log, i) => {
      const isChat = log.url.includes('/chat/') ? ' [CHAT]' : '';
      return `#${i + 1}${isChat} - ${log.method} ${log.url}\n${generateCurl(log, true)}`;
    }).join('\n\n');
    copyToClipboard(allCurls);
  });

  addButtonListener("#exportJson", () => {
    const data = {
      timestamp: new Date().toISOString(),
      stats: {
        total: logs.length,
        success: logs.filter(l => l.status && l.status < 400).length,
        failed: logs.filter(l => l.status && l.status >= 400).length
      },
      cookies: getCookies(),
      localStorage: getStorage(localStorage),
      sessionStorage: getStorage(sessionStorage),
      requests: logs.map(l => ({ ...l, headers: objToHeaders(l.headers) }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fetchradar-${Date.now()}.json`;
    a.click();
  });

  addButtonListener("#refreshBtn", () => updateUI());

  addButtonListener("#btnData", () => {
    const data = {
      timestamp: new Date().toISOString(),
      stats: {
        total: logs.length,
        success: logs.filter(l => l.status && l.status < 400).length,
        failed: logs.filter(l => l.status && l.status >= 400).length
      },
      cookies: getCookies(),
      localStorage: getStorage(localStorage),
      sessionStorage: getStorage(sessionStorage),
      requests: logs.map(l => ({ ...l, headers: objToHeaders(l.headers) }))
    };

    const w = window.open("", "_blank", "width=800,height=600");
    w.document.write(`
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          body { background: #0f172a; color: #34d399; font-family: 'Inter', monospace; padding: 20px; }
          h2 { color: #60a5fa; display: flex; gap: 10px; }
          pre { background: #111c2d; padding: 20px; border-radius: 8px; border: 1px solid #2d3a4f; overflow: auto; }
        </style>
      </head>
      <body>
        <h2><i class="fa-solid fa-bug"></i> NET SNIFFER - COMPLETE DATA</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
    `);
  });

  addButtonListener("#btnClear", () => {
    logs.length = 0;
    updateUI();
  });

  addButtonListener("#close-btn", () => {
    panel.remove();
    window.__LOGGER_UI__ = false;
  });

  addButtonListener("#minimize-btn", () => {
    minimized = !minimized;
    const elements = [
      panel.querySelector("#logbox"),
      panel.querySelector("div:nth-child(2)"),
      panel.querySelector("div:nth-child(3)"),
      panel.querySelector("div:last-child")
    ];

    elements.forEach(el => { if (el) el.style.display = minimized ? 'none' : ''; });

    panel.style.height = minimized ? 'auto' : '80vh';
    panel.querySelector("#minimize-btn").className = minimized ? 'fas fa-square' : 'fas fa-minus';
  });

  const header = panel.querySelector("#drag-header");
  let isDragging = false;
  let offsetX, offsetY;

  function handleDragStart(e) {
    if (e.target.closest('i')) return;
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    offsetX = clientX - panel.getBoundingClientRect().left;
    offsetY = clientY - panel.getBoundingClientRect().top;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    if(e.touches) document.body.style.overflow = 'hidden';
  }

  function handleDragMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    panel.style.left = (clientX - offsetX) + 'px';
    panel.style.top = (clientY - offsetY) + 'px';
  }

  function handleDragEnd() {
    isDragging = false;
    document.body.style.overflow = '';
  }

  header.addEventListener('mousedown', handleDragStart);
  header.addEventListener('touchstart', handleDragStart, { passive: true });

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('touchmove', handleDragMove, { passive: false });

  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchend', handleDragEnd);

  logbox.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = parseInt(btn.getAttribute('data-id'), 10);
    if (!id) return;
    if (btn.classList.contains('list-copy-btn')) {
      window.__LOGGER_COPY_CURL(id);
    } else if (btn.classList.contains('list-detail-btn')) {
      window.__LOGGER_SHOW_DETAILS(id);
    }
  });

  updateStats();
})();
