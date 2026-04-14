#!/usr/bin/env node

/**
 * legal — CLI installer for the /legal MCP server.
 *
 * Commands:
 *   install [TOKEN]  Browser auth (or direct token) + install skill + register MCP
 *   uninstall        Remove skill, MCP registration, config
 *   configure        Change API URL or re-authenticate
 *   status           Show installation state
 *   serve            Run the MCP server (called by Claude Code via stdio — not by users)
 *   help             Show this help
 */

import { execSync, spawn } from 'child_process';
import { createServer } from 'http';
import {
  readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, unlinkSync,
  chmodSync,
} from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'));

const SKILL_SOURCE = join(packageRoot, 'skills', 'legal.md');
const MCP_SERVER_PATH = join(packageRoot, 'src', 'mcp-server', 'index.js');
const CONFIG_DIR = join(homedir(), '.legal');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const SKILL_DIR = join(homedir(), '.claude', 'skills');
const SKILL_INSTALL_PATH = join(SKILL_DIR, 'legal.md');

const DEFAULT_API = process.env.LEGAL_API_URL || 'https://solucioneslegalesya.com';

const commands = {
  install: installCmd,
  uninstall: uninstallCmd,
  configure: configureCmd,
  status: statusCmd,
  serve: serveCmd,
  help: helpCmd,
  '--help': helpCmd,
  '-h': helpCmd,
  '--version': versionCmd,
  '-v': versionCmd,
};

const command = process.argv[2] || 'help';
const handler = commands[command];

if (!handler) {
  console.error(`Unknown command: ${command}\n`);
  helpCmd();
  process.exit(1);
}

Promise.resolve(handler()).catch((err) => {
  console.error(`\n  Error: ${err?.message || err}\n`);
  process.exit(1);
});

// ---- Commands ----

async function installCmd() {
  const apiUrl = loadConfig().apiUrl || DEFAULT_API;

  banner('Install /legal');
  printPrivilegeNotice();

  // Allow direct token via CLI for CI / headless use
  let auth = null;
  const directToken = process.argv[3];

  if (directToken) {
    if (!directToken.startsWith('slk_live_') && !directToken.startsWith('slk_test_')) {
      console.error('\n  Error: token must start with slk_live_ or slk_test_');
      process.exit(1);
    }
    auth = { accessToken: directToken, apiUrl };
  } else {
    console.log(`  Authenticating via ${apiUrl} ...\n`);
    try {
      auth = await startAuthFlow(apiUrl);
    } catch (err) {
      console.error(`\n  Authentication failed: ${err.message}`);
      console.error('  You can also run: npx legal install <SLK_LIVE_TOKEN>\n');
      process.exit(1);
    }
  }

  // Save config
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const config = {
    ...loadConfig(),
    apiUrl: auth.apiUrl || apiUrl,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    email: auth.email,
    authenticatedAt: new Date().toISOString(),
    version: pkg.version,
  };
  saveConfig(config);

  if (auth.email) {
    console.log(`  Authenticated as ${auth.email}\n`);
  } else {
    console.log('  Token saved.\n');
  }

  // 1. Install skill
  console.log('  [1/2] Installing /legal skill...');
  mkdirSync(SKILL_DIR, { recursive: true });
  copyFileSync(SKILL_SOURCE, SKILL_INSTALL_PATH);
  console.log(`        -> ${SKILL_INSTALL_PATH}`);

  // 2. Register MCP server with Claude Code
  console.log('  [2/2] Registering MCP server with Claude Code...');
  const registered = tryClaudeMcp('add', ['legal', '--', 'node', MCP_SERVER_PATH]);
  if (registered.ok) {
    console.log('        -> MCP server registered as "legal"');
  } else {
    console.error('        -> Could not register with `claude mcp add`.');
    console.error('           Is Claude Code installed and on PATH?');
    console.error('           You can register manually later with:');
    console.error(`           claude mcp add legal -- node ${MCP_SERVER_PATH}\n`);
  }

  console.log('\n  Done. Open a new Claude Code session and run /legal.\n');
  console.log('  Remember: Claude never sees your messages with the attorney.');
  console.log('  All substantive communication happens in your browser.\n');
}

async function uninstallCmd() {
  banner('Uninstall /legal');

  if (existsSync(SKILL_INSTALL_PATH)) {
    unlinkSync(SKILL_INSTALL_PATH);
    console.log('  [1/3] Removed /legal skill');
  } else {
    console.log('  [1/3] Skill not installed');
  }

  const removed = tryClaudeMcp('remove', ['legal']);
  if (removed.ok) {
    console.log('  [2/3] Removed MCP server registration');
  } else {
    console.log('  [2/3] MCP server not registered (or Claude Code unavailable)');
  }

  if (existsSync(CONFIG_PATH)) {
    unlinkSync(CONFIG_PATH);
    console.log('  [3/3] Removed local configuration');
  } else {
    console.log('  [3/3] No configuration found');
  }

  console.log('\n  Uninstalled.\n');
}

async function configureCmd() {
  banner('Configure /legal');

  const config = loadConfig();
  const currentUrl = config.apiUrl || DEFAULT_API;

  // Simple flags: --api-url=<url>, --reauth
  const args = process.argv.slice(3);
  let newUrl = currentUrl;
  let reauth = false;

  for (const arg of args) {
    if (arg.startsWith('--api-url=')) newUrl = arg.slice('--api-url='.length);
    else if (arg === '--reauth') reauth = true;
  }

  config.apiUrl = newUrl;
  saveConfig(config);
  console.log(`  API URL: ${newUrl}`);

  if (reauth) {
    console.log('\n  Re-authenticating...\n');
    const auth = await startAuthFlow(newUrl);
    const next = { ...loadConfig(), ...auth, authenticatedAt: new Date().toISOString() };
    saveConfig(next);
    console.log(`\n  Authenticated as ${auth.email || '(no email)'}\n`);
  }
}

async function statusCmd() {
  banner('Status');

  console.log(`  Package:    ${pkg.name}@${pkg.version}`);
  console.log(`  Skill:      ${existsSync(SKILL_INSTALL_PATH) ? 'installed' : 'not installed'}`);

  const config = loadConfig();
  console.log(`  API URL:    ${config.apiUrl || DEFAULT_API}`);

  if (config.accessToken) {
    console.log(`  Auth:       ${config.email || 'authenticated'}`);
    const prefix = config.accessToken.slice(0, 12);
    console.log(`  Token:      ${prefix}...`);
    console.log(`  Since:      ${config.authenticatedAt || 'unknown'}`);
  } else {
    console.log('  Auth:       not authenticated');
  }

  const listed = tryClaudeMcp('list', []);
  if (listed.ok) {
    const registered = String(listed.output).includes('legal');
    console.log(`  MCP:        ${registered ? 'registered with Claude Code' : 'not registered'}`);
  } else {
    console.log('  MCP:        unable to check (claude CLI not available)');
  }

  console.log('');
}

async function serveCmd() {
  // Exec-replace this process with the MCP server so stdio passes through cleanly.
  const child = spawn(process.execPath, [MCP_SERVER_PATH], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

function helpCmd() {
  console.log(`
  legal — Engage real attorneys from Claude Code and any MCP-compatible AI.

  Privilege-preserving by design: Claude never sees message content or matter
  details. All substantive communication flows directly between your browser
  and the attorney via short-lived secure URLs.

  Usage:
    npx legal install              Sign in via browser, install skill, register MCP
    npx legal install <TOKEN>      Install with an existing slk_live_... token
    npx legal uninstall            Remove skill, MCP registration, and local config
    npx legal configure [--api-url=URL] [--reauth]
                                   Change the API endpoint or re-authenticate
    npx legal status               Show installation state
    npx legal serve                Run the MCP server (used by Claude Code; not for humans)
    npx legal help                 Show this help
    npx legal --version            Print version

  After install, open a new Claude Code session and run /legal.

  Docs: https://github.com/phelix001/legal
`);
}

async function versionCmd() {
  console.log(pkg.version);
}

// ---- Auth flow (browser magic-link callback) ----

function startAuthFlow(apiUrl) {
  return new Promise((resolvePromise, rejectPromise) => {
    const state = randomBytes(16).toString('hex');
    let settled = false;

    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/cb') {
        const accessToken = url.searchParams.get('access_token') || url.searchParams.get('token');
        const refreshToken = url.searchParams.get('refresh_token');
        const returnedState = url.searchParams.get('state');
        const email = url.searchParams.get('email');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(resultPage(false, error));
          finish(new Error(error));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(resultPage(false, 'State mismatch — possible CSRF. Try again.'));
          finish(new Error('State mismatch'));
          return;
        }

        if (!accessToken) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(resultPage(false, 'Missing access token in callback.'));
          finish(new Error('Missing access token'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(resultPage(true));

        finish(null, { accessToken, refreshToken, email, apiUrl });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    function finish(err, value) {
      if (settled) return;
      settled = true;
      server.close();
      if (err) rejectPromise(err);
      else resolvePromise(value);
    }

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const callbackUrl = `http://localhost:${port}/cb`;
      const authUrl = `${apiUrl}/api/mcp/auth/signup?callback=${encodeURIComponent(callbackUrl)}&state=${state}&client=legal-mcp`;

      console.log(`  Opening browser for sign-in...\n`);
      console.log(`  If it doesn't open, visit:`);
      console.log(`  ${authUrl}\n`);

      try {
        const openCmd = process.platform === 'darwin' ? 'open'
          : process.platform === 'win32' ? 'start ""'
          : 'xdg-open';
        execSync(`${openCmd} "${authUrl}"`, { stdio: 'ignore' });
      } catch {
        // User has URL printed above
      }

      console.log('  Waiting for authentication (5-minute timeout)...');

      setTimeout(() => finish(new Error('Authorization timed out')), 5 * 60 * 1000);
    });

    server.on('error', (err) => finish(err));
  });
}

function resultPage(success, error) {
  const common = `
    body { font-family: -apple-system, system-ui, sans-serif;
           display: flex; justify-content: center; align-items: center;
           min-height: 100vh; margin: 0; background: #0a0a0a; color: #e5e5e5; }
    .card { text-align: center; max-width: 440px; padding: 48px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { color: #888; line-height: 1.5; }
    .muted { font-size: 13px; color: #666; margin-top: 24px; }
  `;
  if (success) {
    return `<!DOCTYPE html><html><head><title>legal</title><style>${common} .icon{color:#22c55e;}</style></head>
<body><div class="card">
  <div class="icon">&#10003;</div>
  <h1>Connected</h1>
  <p>You can close this tab and return to your terminal.</p>
  <p class="muted">Privilege note: Claude never sees the content of your messages with your attorney. All privileged communication happens in this browser.</p>
</div></body></html>`;
  }
  return `<!DOCTYPE html><html><head><title>legal</title><style>${common} .icon{color:#ef4444;}</style></head>
<body><div class="card">
  <div class="icon">&#10007;</div>
  <h1>Something went wrong</h1>
  <p>${escapeHtml(error || 'Unknown error')}. Close this tab and try again.</p>
</div></body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---- Config helpers ----

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  config.version = pkg.version;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  try { chmodSync(CONFIG_PATH, 0o600); } catch {}
}

// ---- Claude CLI helpers ----

function tryClaudeMcp(subcommand, args) {
  try {
    const output = execSync(
      ['claude', 'mcp', subcommand, ...args].map((a) => /\s/.test(a) ? JSON.stringify(a) : a).join(' '),
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf-8' }
    );
    return { ok: true, output };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// ---- UI helpers ----

function banner(title) {
  console.log(`\n  ${title} — ${pkg.name}@${pkg.version}\n`);
}

function printPrivilegeNotice() {
  console.log(`  Privilege-preserving architecture:`);
  console.log(`    • Claude never sees the content of your messages with your attorney.`);
  console.log(`    • All substantive legal communication happens in your browser,`);
  console.log(`      via short-lived secure URLs that bypass the AI entirely.`);
  console.log(`    • Attorney-client privilege ("secreto profesional") is preserved`);
  console.log(`      by design across all supported jurisdictions.\n`);
}
