#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const domain = process.argv[2] || process.env.DOMAIN || 'tg.vseti.top';
const targetDir = process.argv[3] || (fs.existsSync('./telegram-tt') ? './telegram-tt' : '.');

console.log(`==> Целевой домен: ${domain}`);
console.log(`==> Рабочая папка: ${targetDir}`);

// 1. Удаление папки dist
const dist = path.join(targetDir, 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
  console.log('==> [1/5] Папка dist удалена');
}

// 2. Патчинг PromisedWebSockets.ts (WebSocket транспорт /apiws)
const wsFile = path.join(targetDir, 'src/lib/gramjs/extensions/PromisedWebSockets.ts');
if (fs.existsSync(wsFile)) {
  let wsCode = fs.readFileSync(wsFile, 'utf8');
  const newWsMethod = `getWebSocketLink(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    const apiws = \`/apiws\${isTestServer ? "_test" : ""}\${isPremium ? "_premium" : ""}\`;
    if (ip.includes("?")) {
      const [hostAndPath, query] = ip.split("?");
      return \`wss://\${hostAndPath}\${apiws}?\${query}\`;
    }
    return \`wss://\${ip}:\${port}\${apiws}\`;
  }`;

  wsCode = wsCode.replace(/getWebSocketLink\([^)]*\)\s*\{[\s\S]*?\n  \}/, newWsMethod);
  fs.writeFileSync(wsFile, wsCode, 'utf8');
  console.log('==> [2/5] PromisedWebSockets.ts успешно пропатчен (/apiws)');
}

// 3. Патчинг HttpStream.ts (HTTP fallback транспорт /apiw1)
const httpStreamFile = path.join(targetDir, 'src/lib/gramjs/extensions/HttpStream.ts');
if (fs.existsSync(httpStreamFile)) {
  let httpCode = fs.readFileSync(httpStreamFile, 'utf8');
  const newHttpUrlMethod = `static getURL(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    const apiw = \`/apiw1\${isTestServer ? "_test" : ""}\${isPremium ? "_premium" : ""}\`;
    if (ip.includes("?")) {
      const [hostAndPath, query] = ip.split("?");
      return \`https://\${hostAndPath}\${apiw}?\${query}\`;
    }
    return \`https://\${ip}:\${port}\${apiw}\`;
  }`;

  httpCode = httpCode.replace(/static getURL\([^)]*\)\s*\{[\s\S]*?\n  \}/, newHttpUrlMethod);
  fs.writeFileSync(httpStreamFile, httpCode, 'utf8');
  console.log('==> [3/5] HttpStream.ts успешно пропатчен (/apiw1)');
}

// 4. Патчинг Utils.ts для переноса DC в query-параметры (/wss?backend=zwsN)
const utilsFile = path.join(targetDir, 'src/lib/gramjs/Utils.ts');
if (fs.existsSync(utilsFile)) {
  let utilsCode = fs.readFileSync(utilsFile, 'utf8');
  utilsCode = utilsCode.replace(
    /ipAddress:\s*`zws(\d)(\$\{downloadDC\s*\?\s*'-1'\s*:\s*''\})\.[^`]*`/g,
    `ipAddress: \`${domain}/wss?backend=zws$1$2\``
  );
  fs.writeFileSync(utilsFile, utilsCode, 'utf8');
  console.log('==> [4/5] Utils.ts успешно пропатчен');
}

// 5. Рекурсивная замена web.telegram.org -> domain во всех текстовых файлах
const ignored = new Set(['.git', 'node_modules', 'dist', '.cache']);
function replaceInDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !ignored.has(entry.name)) {
      replaceInDir(full);
    } else if (entry.isFile()) {
      try {
        let content = fs.readFileSync(full, 'utf8');
        if (content.includes('web.telegram.org')) {
          content = content.replaceAll('web.telegram.org', domain);
          fs.writeFileSync(full, content, 'utf8');
        }
      } catch {}
    }
  }
}
replaceInDir(targetDir);
console.log(`==> [5/5] Замена web.telegram.org на ${domain} завершена`);

console.log('==> Патчинг успешно завершен!');
