#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const targetDir = process.argv[2] || (fs.existsSync('./telegram-tt') ? './telegram-tt' : '.');

console.log(`==> Настройка динамического домена (location.host / location.origin)`);
console.log(`==> Рабочая папка: ${targetDir}`);

// 1. Удаление папки dist
const dist = path.join(targetDir, 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
  console.log('==> [1/7] Папка dist удалена');
}

// 2. Инъекция захардкоженных API_ID и API_HASH в src/config.ts и vite.config.ts
const configPath = path.join(targetDir, 'src/config.ts');
const tgid = '1025907';
const tghash = '452b0359b988148995f22ff0f4229750';
if (fs.existsSync(configPath)) {
  let configCode = fs.readFileSync(configPath, 'utf8');

  // Hardcode credentials
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
  console.log('==> [2/7] src/config.ts настроен на динамический домен');
}

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

  // Разрешаем подключение к любому домену в CSP (wss: ws:)
  viteCode = viteCode.replace(
    /connect-src 'self' [^;]+;/,
    `connect-src 'self' wss: ws: blob: http: https: \${appEnv === 'development' ? 'ipc:' : ''};`
  );

  fs.writeFileSync(viteConfigPath, viteCode, 'utf8');
  console.log('==> [3/7] vite.config.ts настроен на универсальный CSP');
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
  console.log('==> [4/7] PromisedWebSockets.ts успешно настроен на динамический хост');
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
  console.log('==> [5/7] HttpStream.ts успешно настроен на динамический хост');
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
  console.log('==> [6/7] Utils.ts настроен на относительный путь /wss?backend=zwsN');
}

// 7. Относительный редирект в redirect.js
const redirectFile = path.join(targetDir, 'public/redirect.js');
if (fs.existsSync(redirectFile)) {
  let redirectCode = fs.readFileSync(redirectFile, 'utf8');
  redirectCode = redirectCode.replace(/window\.location\.href\s*=\s*[^;]+;/, `window.location.href = './a';`);
  fs.writeFileSync(redirectFile, redirectCode, 'utf8');
  console.log('==> [7/7] public/redirect.js настроен на относительный редирект ./a');
}

console.log('==> Патчинг успешно завершен!');
