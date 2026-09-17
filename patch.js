#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const targetDir = process.argv[2] || (fs.existsSync('./telegram-tt') ? './telegram-tt' : '.');

console.log(`==> Настройка динамического домена и антифишинговой прокладки В СЕТИ`);
console.log(`==> Рабочая папка: ${targetDir}`);

// 1. Удаление папки dist
const dist = path.join(targetDir, 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
  console.log('==> [1/9] Папка dist удалена');
}

// 2. Инъекция захардкоженных API_ID и API_HASH в src/config.ts
const configPath = path.join(targetDir, 'src/config.ts');
const tgid = '1025907';
const tghash = '452b0359b988148995f22ff0f4229750';
if (fs.existsSync(configPath)) {
  let configCode = fs.readFileSync(configPath, 'utf8');

  configCode = configCode.replace(
    /export const TELEGRAM_API_ID\s*=\s*[^;]+;/,
    `export const TELEGRAM_API_ID = ${tgid};`
  );
  configCode = configCode.replace(
    /export const TELEGRAM_API_HASH\s*=\s*[^;]+;/,
    `export const TELEGRAM_API_HASH = '${tghash}';`
  );

  // Динамические ссылки на домен через location в runtime
  configCode = configCode.replace(
    /export const PRODUCTION_HOSTNAME\s*=\s*[^;]+;/,
    `export const PRODUCTION_HOSTNAME = typeof location !== 'undefined' ? location.hostname : '';`
  );
  configCode = configCode.replace(
    /export const PRODUCTION_URL\s*=\s*[^;]+;/,
    `export const PRODUCTION_URL = typeof location !== 'undefined' ? \`\${location.origin}/a\` : '/a';`
  );
  configCode = configCode.replace(
    /export const WEB_VERSION_BASE\s*=\s*[^;]+;/,
    `export const WEB_VERSION_BASE = typeof location !== 'undefined' ? \`\${location.origin}/\` : '/';`
  );

  fs.writeFileSync(configPath, configCode, 'utf8');
  console.log('==> [2/9] src/config.ts настроен на динамический домен');
}

// 3. Настройка vite.config.ts (заголовок по умолчанию, CSP wss/ws/unsafe-inline)
const viteConfigPath = path.join(targetDir, 'vite.config.ts');
if (fs.existsSync(viteConfigPath)) {
  let viteCode = fs.readFileSync(viteConfigPath, 'utf8');
  viteCode = viteCode.replace(
    /const telegramApiId\s*=\s*env\.TELEGRAM_API_ID\s*\|\|\s*'[^']*';/,
    `const telegramApiId = env.TELEGRAM_API_ID || '${tgid}';`
  );
  viteCode = viteCode.replace(
    /const telegramApiHash\s*=\s*env\.TELEGRAM_API_HASH\s*\|\|\s*'[^']*';/,
    `const telegramApiHash = env.TELEGRAM_API_HASH || '${tghash}';`
  );
  viteCode = viteCode.replace(
    /const telegramApiId\s*=\s*env\.TELEGRAM_API_ID\s*\|\|\s*'';/,
    `const telegramApiId = env.TELEGRAM_API_ID || '${tgid}';`
  );
  viteCode = viteCode.replace(
    /const telegramApiHash\s*=\s*env\.TELEGRAM_API_HASH\s*\|\|\s*'';/,
    `const telegramApiHash = env.TELEGRAM_API_HASH || '${tghash}';`
  );

  // Заголовок по умолчанию для неофициального клиента
  viteCode = viteCode.replace(
    /const defaultAppTitle\s*=\s*`Telegram\$\{[^}]*\}\`;/,
    `const defaultAppTitle = 'Неофициальный клиент Telegram со встроенным прокси';`
  );

  // Разрешаем подключение к любому домену в CSP (wss: ws:) и inline скрипты для прокладки
  viteCode = viteCode.replace(
    /connect-src 'self' [^;]+;/,
    `connect-src 'self' wss: ws: blob: http: https: \${appEnv === 'development' ? 'ipc:' : ''};`
  );
  viteCode = viteCode.replace(
    /script-src 'self' 'wasm-unsafe-eval'/,
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`
  );

  fs.writeFileSync(viteConfigPath, viteCode, 'utf8');
  console.log('==> [3/9] vite.config.ts настроен на антифишинговый заголовок и CSP');
}

// 4. Патчинг PromisedWebSockets.ts (Динамическое формирование WebSocket URL по текущему хосту)
const wsFile = path.join(targetDir, 'src/lib/gramjs/extensions/PromisedWebSockets.ts');
if (fs.existsSync(wsFile)) {
  let wsCode = fs.readFileSync(wsFile, 'utf8');
  const newWsMethod = `getWebSocketLink(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    const apiws = \`/apiws\${isTestServer ? "_test" : ""}\${isPremium ? "_premium" : ""}\`;
    if (ip.includes("?") || ip.startsWith("/")) {
      const [hostAndPath, query] = ip.split("?");
      const currentHost = typeof location !== "undefined" ? location.host : "";
      const host = hostAndPath.startsWith("/") ? \`\${currentHost}\${hostAndPath}\` : (hostAndPath || \`\${currentHost}/wss\`);
      const proto = typeof location !== "undefined" && location.protocol === "http:" ? "ws:" : "wss:";
      return \`\${proto}//\${host}\${apiws}?\${query}\`;
    }
    return \`wss://\${ip}:\${port}\${apiws}\`;
  }`;

  wsCode = wsCode.replace(/getWebSocketLink\([^)]*\)\s*\{[\s\S]*?\n  \}/, newWsMethod);
  fs.writeFileSync(wsFile, wsCode, 'utf8');
  console.log('==> [4/9] PromisedWebSockets.ts успешно настроен на динамический хост');
}

// 5. Патчинг HttpStream.ts (Динамическое формирование HTTP Stream URL по текущему хосту)
const httpStreamFile = path.join(targetDir, 'src/lib/gramjs/extensions/HttpStream.ts');
if (fs.existsSync(httpStreamFile)) {
  let httpCode = fs.readFileSync(httpStreamFile, 'utf8');
  const newHttpUrlMethod = `static getURL(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    const apiw = \`/apiw1\${isTestServer ? "_test" : ""}\${isPremium ? "_premium" : ""}\`;
    if (ip.includes("?") || ip.startsWith("/")) {
      const [hostAndPath, query] = ip.split("?");
      const currentHost = typeof location !== "undefined" ? location.host : "";
      const host = hostAndPath.startsWith("/") ? \`\${currentHost}\${hostAndPath}\` : (hostAndPath || \`\${currentHost}/wss\`);
      const proto = typeof location !== "undefined" && location.protocol === "http:" ? "http:" : "https:";
      return \`\${proto}//\${host}\${apiw}?\${query}\`;
    }
    return \`https://\${ip}:\${port}\${apiw}\`;
  }`;

  httpCode = httpCode.replace(/static getURL\([^)]*\)\s*\{[\s\S]*?\n  \}/, newHttpUrlMethod);
  fs.writeFileSync(httpStreamFile, httpCode, 'utf8');
  console.log('==> [5/9] HttpStream.ts успешно настроен на динамический хост');
}

// 6. Патчинг Utils.ts для переноса DC в query-параметры (/wss?backend=zwsN)
const utilsFile = path.join(targetDir, 'src/lib/gramjs/Utils.ts');
if (fs.existsSync(utilsFile)) {
  let utilsCode = fs.readFileSync(utilsFile, 'utf8');
  utilsCode = utilsCode.replace(
    /ipAddress:\s*`[^`]*zws(\d)(\$\{downloadDC\s*\?\s*'-1'\s*:\s*''\})[^`]*`/g,
    `ipAddress: \`/wss?backend=zws$1$2\``
  );
  fs.writeFileSync(utilsFile, utilsCode, 'utf8');
  console.log('==> [6/9] Utils.ts настроен на относительный путь /wss?backend=zwsN');
}

// 7. Относительный редирект в redirect.js
const redirectFile = path.join(targetDir, 'public/redirect.js');
if (fs.existsSync(redirectFile)) {
  let redirectCode = fs.readFileSync(redirectFile, 'utf8');
  redirectCode = redirectCode.replace(/window\.location\.href\s*=\s*[^;]+;/, `window.location.href = './a';`);
  fs.writeFileSync(redirectFile, redirectCode, 'utf8');
  console.log('==> [7/9] public/redirect.js настроен на относительный редирект ./a');
}

// 8. Отключение принудительного переключения на версию K из поисковых систем
const permanentWebVersionFile = path.join(targetDir, 'src/util/permanentWebVersion.ts');
if (fs.existsSync(permanentWebVersionFile)) {
  let pCode = fs.readFileSync(permanentWebVersionFile, 'utf8');
  pCode = pCode.replace(/switchPermanentWebVersion\('K'\);/g, `setPermanentWebVersion('Z');`);
  fs.writeFileSync(permanentWebVersionFile, pCode, 'utf8');
  console.log('==> [8/9] permanentWebVersion.ts отключен редирект поисковиков на версию K');
}

// 9. Инъекция антифишинговой прокладки (Nordic Cyber Guard) и мета-тегов в index.html
const indexHtmlFile = path.join(targetDir, 'index.html');
if (fs.existsSync(indexHtmlFile)) {
  let htmlCode = fs.readFileSync(indexHtmlFile, 'utf8');

  // Мета-теги антифишинга
  const appTitle = 'Неофициальный клиент Telegram со встроенным прокси';
  const appDesc = 'Неофициальный клиент Telegram со встроенным прокси. Независимый веб-сервис, не связанный с Telegram FZ-LLC. Прямое сквозное MTProto шифрование.';

  htmlCode = htmlCode.replace(/<title>[\s\S]*?<\/title>/, `<title>${appTitle}</title>`);
  htmlCode = htmlCode.replace(/<meta name="robots"[^>]*>\s*/g, '');
  htmlCode = htmlCode.replace(/<meta name="title"[^>]*>/, `<meta name="title" content="${appTitle}">\n  <meta name="robots" content="index, follow">`);
  htmlCode = htmlCode.replace(/<meta name="description"[\s\S]*?>/, `<meta name="description" content="${appDesc}">`);
  htmlCode = htmlCode.replace(/<meta property="og:title"[\s\S]*?>/, `<meta property="og:title" content="${appTitle}">`);
  htmlCode = htmlCode.replace(/<meta property="og:description"[\s\S]*?>/, `<meta property="og:description" content="${appDesc}">`);
  htmlCode = htmlCode.replace(/<meta property="twitter:title"[\s\S]*?>/, `<meta property="twitter:title" content="${appTitle}">`);
  htmlCode = htmlCode.replace(/<meta property="twitter:description"[\s\S]*?>/, `<meta property="twitter:description" content="${appDesc}">`);

  // Очистка предыдущих инъекций при повторном запуске
  htmlCode = htmlCode.replace(/<!-- V-SETI Anti-Phishing Interstitial Preload: START -->[\s\S]*?<!-- V-SETI Anti-Phishing Interstitial Preload: END -->\s*/g, '');
  htmlCode = htmlCode.replace(/<!-- V-SETI Anti-Phishing Interstitial Layer: START -->[\s\S]*?<!-- V-SETI Anti-Phishing Interstitial Layer: END -->\s*/g, '');
  htmlCode = htmlCode.replace(/<!-- V-SETI Anti-Phishing Interstitial Preload -->[\s\S]*?<\/style>\s*/g, '');
  htmlCode = htmlCode.replace(/<!-- V-SETI Anti-Phishing Interstitial Layer -->[\s\S]*?<\/div>\s*(?=<noscript>)/g, '');

  const headInjection = `<!-- V-SETI Anti-Phishing Interstitial Preload: START -->
  <script>
    (function() {
      try {
        if (localStorage.getItem('vseti_interstitial_accepted') === 'true') {
          document.documentElement.classList.add('vseti-interstitial-passed');
        }
      } catch (e) {}
    })();
  </script>
  <style>
    html.vseti-interstitial-passed #vseti-interstitial {
      display: none !important;
    }
    #vseti-interstitial {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      overflow-y: auto;
      z-index: 9999999;
      background-color: #070a10;
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }
    #vseti-interstitial * { box-sizing: border-box; margin: 0; padding: 0; }
    #vseti-interstitial .d2-header {
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding: 24px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1120px;
      width: 100%;
      margin: 0 auto;
    }
    #vseti-interstitial .d2-logo { display: flex; align-items: center; gap: 14px; }
    #vseti-interstitial .d2-shield-icon {
      width: 36px; height: 36px;
      background: #141c2b;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: #38bdf8;
    }
    #vseti-interstitial .d2-brand-name {
      font-size: 1.05rem; font-weight: 800;
      letter-spacing: -0.03em; text-transform: uppercase;
    }
    #vseti-interstitial .d2-main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 60px 40px;
      max-width: 1120px;
      width: 100%;
      margin: 0 auto;
    }
    #vseti-interstitial .d2-card-box {
      background: #0e141f;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 56px 48px;
      max-width: 720px;
      width: 100%;
      box-shadow: 0 32px 64px rgba(0, 0, 0, 0.6);
    }
    #vseti-interstitial .d2-eyebrow {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.75rem; text-transform: uppercase;
      letter-spacing: 0.14em; color: #38bdf8;
      margin-bottom: 20px; display: inline-flex; align-items: center; gap: 8px;
    }
    #vseti-interstitial h1 {
      font-size: 2.5rem; font-weight: 800;
      line-height: 1.15; letter-spacing: -0.03em; margin-bottom: 20px;
    }
    #vseti-interstitial .cyan-tint { color: #38bdf8; }
    #vseti-interstitial .d2-desc {
      font-size: 1.05rem; line-height: 1.6;
      color: #94a3b8; margin-bottom: 36px;
    }
    #vseti-interstitial .d2-actions {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
    }
    #vseti-interstitial .d2-btn-shield {
      background: #ffffff; color: #070a10;
      font-weight: 700; font-size: 0.95rem;
      padding: 14px 30px; border: none; border-radius: 10px;
      cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
      text-decoration: none; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #vseti-interstitial .d2-btn-shield:hover {
      background: #f1f5f9; transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(56, 189, 248, 0.25);
    }
    #vseti-interstitial .d2-btn-secondary {
      border: 1px solid rgba(255,255,255,0.16);
      padding: 13px 22px; border-radius: 10px;
      font-weight: 600; font-size: 0.9rem; color: #ffffff;
      background: transparent; text-decoration: none; cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px;
      transition: all 0.2s ease;
    }
    #vseti-interstitial .d2-btn-secondary:hover {
      background: #141c2b; border-color: #38bdf8;
    }
    #vseti-interstitial .d2-footer {
      border-top: 1px solid rgba(255,255,255,0.08);
      padding: 20px 40px; max-width: 1120px; width: 100%; margin: 0 auto;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.8rem; color: #94a3b8; flex-wrap: wrap; gap: 16px;
    }
    #vseti-interstitial .d2-footer a { color: #38bdf8; text-decoration: none; }
    #vseti-interstitial .d2-footer a:hover { text-decoration: underline; }
    @media (max-width: 768px) {
      #vseti-interstitial .d2-header, #vseti-interstitial .d2-main,
      #vseti-interstitial .d2-footer {
        padding-left: 20px; padding-right: 20px;
      }
      #vseti-interstitial .d2-card-box { padding: 36px 24px; }
      #vseti-interstitial h1 { font-size: 1.9rem; }
      #vseti-interstitial .d2-desc { font-size: 0.95rem; }
    }
  </style>
  <!-- V-SETI Anti-Phishing Interstitial Preload: END -->`;

  const bodyMarkup = `<!-- V-SETI Anti-Phishing Interstitial Layer: START -->
  <div id="vseti-interstitial">
    <header>
      <nav class="d2-header" aria-label="Security Gateway Navigation">
        <div class="d2-logo">
          <div class="d2-shield-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <circle cx="12" cy="11" r="3"/>
            </svg>
          </div>
          <div class="d2-brand-name">
            В СЕТИ <span style="color: #38bdf8;">PROXY</span>
          </div>
        </div>

        <div>
          <a href="https://t.me/v_seti_vpn?direct" target="_blank" rel="noopener noreferrer" class="d2-btn-secondary" style="padding: 8px 16px; font-size: 0.8rem;">
            Поддержка
          </a>
        </div>
      </nav>
    </header>

    <main class="d2-main">
      <div class="d2-card-box">
        <h1>
          Неофициальный клиент Telegram <span class="cyan-tint">со встроенным прокси</span>
        </h1>

        <p class="d2-desc">
          Независимый веб-клиент со встроенным прокси для прямого подключения к Telegram по протоколу MTProto. Сервис не связан с Telegram FZ-LLC и не сохраняет данные вашей учетной записи.
        </p>

        <div class="d2-actions">
          <button id="vseti-proceed-btn" class="d2-btn-shield">
            <span>Запустить клиент</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>

          <a href="https://t.me/v_seti_vpn?direct" target="_blank" rel="noopener noreferrer" class="d2-btn-secondary">
            Поддержка
          </a>
        </div>
      </div>
    </main>

    <footer class="d2-footer">
      <div>
        Telegram является зарегистрированным товарным знаком Telegram FZ-LLC. Сервис не аффилирован с Telegram FZ-LLC.
      </div>
      <div>
        <a href="https://t.me/v_seti_vpn?direct" target="_blank" rel="noopener noreferrer">Поддержка проекта В СЕТИ</a>
      </div>
    </footer>

    <script>
      (function() {
        var overlay = document.getElementById('vseti-interstitial');
        if (!overlay) return;

        if (document.documentElement.classList.contains('vseti-interstitial-passed')) {
          overlay.remove();
          return;
        }

        var btn = document.getElementById('vseti-proceed-btn');
        if (btn) {
          btn.addEventListener('click', function() {
            try {
              localStorage.setItem('vseti_interstitial_accepted', 'true');
            } catch (e) {}
            overlay.style.transition = 'opacity 0.25s ease-out';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            setTimeout(function() {
              overlay.remove();
              document.documentElement.classList.add('vseti-interstitial-passed');
            }, 250);
          });
        }
      })();
    </script>
  </div>
  <!-- V-SETI Anti-Phishing Interstitial Layer: END -->`;

  // Вставляем preload script и стили перед </head>
  htmlCode = htmlCode.replace('</head>', `${headInjection}\n</head>`);

  // Вставляем саму прокладку сразу после <body id="root">
  htmlCode = htmlCode.replace('<body id="root">', `<body id="root">\n  ${bodyMarkup}`);

  fs.writeFileSync(indexHtmlFile, htmlCode, 'utf8');
  console.log('==> [9/9] index.html успешно оснащен антифишинговой прокладкой Nordic Cyber Guard');
}

console.log('==> Патчинг успешно завершен!');
