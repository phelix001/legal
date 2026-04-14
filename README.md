# legal

**Engage real attorneys from Claude Code and any MCP-compatible AI.**

`legal` is a public [Model Context Protocol](https://modelcontextprotocol.io) server and `/legal` Claude Code skill that connects AI assistants to [Soluciones Legales Ya](https://solucioneslegalesya.com) — a licensed legal-services marketplace across Spain, Mexico, Colombia, Argentina, Chile, Peru, and the Dominican Republic.

Tell Claude what kind of legal matter you have. It finds a qualified attorney in the right jurisdiction, explains mandatory disclosures, creates the engagement, and hands you a secure browser link to the attorney. **Claude never sees the content of your conversation with your attorney** — that's the point.

---

## Install in 60 seconds (Claude Code)

Follow these four steps in order. Don't skip any.

### Step 1 — Make sure you have the prerequisites

```bash
node --version          # must print v20.x or higher
claude --version        # must print a version (Claude Code CLI installed)
```

If `node` is missing → install Node.js 20+ from [nodejs.org](https://nodejs.org/).
If `claude` is missing → install Claude Code from [claude.com/claude-code](https://claude.com/claude-code).

### Step 2 — Create a Soluciones account

You need an account **before** you install. Sign up here:

**[https://solucioneslegalesya.com/es/signup](https://solucioneslegalesya.com/es/signup)**

Remember the email + password — the installer's browser flow will ask you to log in with them.

### Step 3 — Run the installer

In any terminal:

```bash
npx @legalsolutions/legal install
```

What happens next:

1. The installer prints a privilege notice, then **opens your browser** to Soluciones Legales Ya.
2. You log in with the account you created in Step 2.
3. The browser redirects to `localhost:<random-port>/cb` and shows a green **Connected** card. Close that tab.
4. Back in the terminal, you'll see:
   ```
   Authenticated as you@example.com
   [1/2] Installing /legal skill...
          -> /home/you/.claude/skills/legal.md
   [2/2] Registering MCP server with Claude Code...
          -> MCP server registered as "legal"
   Done. Open a new Claude Code session and run /legal.
   ```

**If step [2/2] says "Could not register with `claude mcp add`"**, jump to [Troubleshooting → MCP registration failed](#mcp-registration-failed) below. Do not skip this — without registration, `/legal` will not work.

### Step 4 — Open a NEW Claude Code session

This is critical. Existing sessions do not pick up newly-installed skills or MCP servers. You must:

1. **Exit your current Claude Code session** (Ctrl+D, or type `/exit`).
2. Start fresh: `claude`
3. Type `/legal` and press Enter.

Claude will open with a privilege disclosure and start helping you find an attorney.

---

## Verify the install

Run in any terminal:

```bash
npx @legalsolutions/legal status
```

A fully-working install shows:

```
  Package:    legal@0.1.0
  Skill:      installed
  API URL:    https://solucioneslegalesya.com
  Auth:       you@example.com
  Token:      slk_live_abc...
  MCP:        registered with Claude Code
```

All five lines matter. If any say "not installed" / "not authenticated" / "not registered", see [Troubleshooting](#troubleshooting).

---

## Troubleshooting

### "npm error could not determine executable to run"

You ran `npx legal install` — the bare name `legal` is a different (unrelated) package on npm. Always use the scoped name:

```bash
npx @legalsolutions/legal install
```

### Browser opens but shows "localhost sent an invalid response"

You have an old version of the Soluciones backend. Re-run the install — the call to `solucioneslegalesya.com/api/mcp/auth/signup` should redirect you to `https://solucioneslegalesya.com/es/login?callbackUrl=...`, not `https://localhost:3000/...`. If you're seeing the localhost redirect, ping support.

### Browser window opens but "waiting for authentication" never finishes

1. Make sure you actually logged in (clicked **Sign in** on the Soluciones page).
2. Make sure you weren't in a private / incognito window that blocks localhost callbacks.
3. Make sure no firewall is blocking the random local port the installer picked.
4. Check your terminal for the URL it printed — you can paste that into your browser manually if the auto-open failed.

### MCP registration failed

Terminal message:

```
[2/2] Registering MCP server with Claude Code...
       -> Could not register with `claude mcp add`.
          Is Claude Code installed and on PATH?
```

This means the installer couldn't find the `claude` CLI. Two ways to fix it:

**Option A — register manually** (recommended):

```bash
# Find where npx stored the package:
npx @legalsolutions/legal --version      # triggers the cache download
ls ~/.npm/_npx/*/node_modules/@legalsolutions/legal/src/mcp-server/index.js | head -1
# Then register with the path it prints:
claude mcp add legal -- node <paste-path-here>
```

**Option B — install the package globally**, which keeps a stable path:

```bash
npm install -g @legalsolutions/legal
claude mcp add legal -- node "$(npm root -g)/@legalsolutions/legal/src/mcp-server/index.js"
legal status
```

Verify:

```bash
claude mcp list | grep legal
```

### `/legal` isn't recognized in Claude Code

You skipped Step 4. Claude Code loads skills and MCP servers at session start. Exit (`Ctrl+D` or `/exit`) and start a new session with `claude`.

Also confirm the skill file exists:

```bash
ls -la ~/.claude/skills/legal.md
```

If it's missing, the skill install step failed — re-run `npx @legalsolutions/legal install` and watch for errors.

### Claude asks "Allow legal - search_providers?" on every call

This is normal on first use. Claude Code asks before invoking any new MCP tool. Choose **"Yes, and don't ask again for legal - `<toolname>` commands in `<directory>`"** — that whitelists the tool permanently for that directory.

To skip these prompts entirely (dev-only — trusts every tool):

```bash
claude --dangerously-skip-permissions
```

### "Authorization timed out"

The installer waits five minutes for the browser flow. If you missed the window, just run it again:

```bash
npx @legalsolutions/legal install
```

### I already have an access token from the dashboard

Skip the browser flow:

```bash
npx @legalsolutions/legal install slk_live_XXXXXXXXXXXX
```

---

## Install on other MCP clients

### Claude Desktop

Claude Desktop does not share Claude Code's MCP registry. After running `npx @legalsolutions/legal install` (to authenticate), add this block to Claude Desktop's config:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "legal": {
      "command": "npx",
      "args": ["-y", "@legalsolutions/legal", "serve"]
    }
  }
}
```

Restart Claude Desktop completely (Quit → reopen, not just close-window). The `legal` tools will appear in the tool menu.

Claude Desktop does not support skills, so the `/legal` slash command is unavailable there. You'll need to paste the privilege disclosure yourself or copy [`skills/legal.md`](./skills/legal.md) into your system prompt.

### Cursor

1. `npx @legalsolutions/legal install` (to authenticate)
2. Add to `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "legal": {
         "command": "npx",
         "args": ["-y", "@legalsolutions/legal", "serve"]
       }
     }
   }
   ```
3. Restart Cursor.

### Windsurf, Zed, Continue, Raycast, and other MCP clients

Any client that speaks stdio MCP works. The pattern is always:

1. Authenticate once: `npx @legalsolutions/legal install`
2. Point your client config at `npx -y @legalsolutions/legal serve`.
3. Restart the client.

The MCP server reads its token from `~/.legal/config.json`, so authentication is shared across all clients on the same machine.

### Headless / CI

```bash
npx @legalsolutions/legal install slk_live_XXXXXXXXXXXX
# or, skip the config file entirely:
LEGAL_API_KEY=slk_live_XXXXXXXXXXXX npx @legalsolutions/legal serve
```

---

## Uninstall

```bash
npx @legalsolutions/legal uninstall
```

Removes the skill file, MCP registration, and `~/.legal/config.json`. Your Soluciones account is untouched.

---

## Attorney-client privilege is preserved by design

Communications between a client and their attorney are legally privileged only if they stay confidential. A third party who learns the content generally waives the privilege. **Claude is a third party.** This MCP is built so Claude never becomes one:

- **Claude never sees your messages to the attorney.** The substantive conversation happens in your browser, via a short-lived secure URL.
- **Claude never sees your matter details.** `request_quote` takes a listing ID — not a description. You describe your situation in the browser.
- **Claude never sees documents, evidence, or payment details.**
- **Claude does see metadata:** which attorney you hired, the engagement state, pricing, timestamps, unread-message counts. That is enough to orchestrate without learning anything privileged.

This architecture also means Anthropic's systems never retain privileged content, and a malicious message from an attorney cannot reach Claude's context to manipulate it.

The seven supported jurisdictions all enforce civil-law *secreto profesional* — attorneys can face criminal penalties for breach. The infrastructure must protect them as well as you.

---

## Tools exposed

| Tool | Purpose |
|------|---------|
| `search_providers` | Find attorneys by jurisdiction, practice area, language |
| `check_jurisdiction` | Required licenses, authorities, cross-border rules |
| `get_mandatory_disclosures` | Regulatory disclosures (presented verbatim by the skill) |
| `request_quote` | Create an engagement shell from a listing (no matter details) |
| `open_composer` | Short-lived secure URL to the browser thread |
| `get_engagements` | Metadata-only engagement list / detail |
| `update_engagement` | Accept, decline, cancel, or open a dispute |

None of these tools accept or return privileged content.

---

## Commands

```bash
npx @legalsolutions/legal install          # Browser auth + install skill + register MCP
npx @legalsolutions/legal install <TOKEN>  # Install with a specific access token
npx @legalsolutions/legal uninstall        # Remove skill, MCP registration, config
npx @legalsolutions/legal configure --api-url=https://example.com [--reauth]
npx @legalsolutions/legal status           # Show installation state
npx @legalsolutions/legal serve            # Run the MCP server (called by Claude via stdio — not by humans)
npx @legalsolutions/legal help
npx @legalsolutions/legal --version
```

---

## Configuration

`~/.legal/config.json` (created by `install`):

```json
{
  "apiUrl": "https://solucioneslegalesya.com",
  "accessToken": "slk_live_...",
  "refreshToken": "slkr_live_...",
  "email": "you@example.com",
  "version": "0.1.0"
}
```

The file is created with mode `0600` (readable only by your Unix user) and the directory with mode `0700`.

Environment overrides:

- `LEGAL_API_URL` — override the API base URL
- `LEGAL_API_KEY` — override the access token (bypasses the config file)

---

## Jurisdictions

Spain (ES), Mexico (MX), Colombia (CO), Argentina (AR), Chile (CL), Peru (PE), Dominican Republic (DO).

## Practice areas

Corporate, tax, employment, family, immigration, real estate, intellectual property, litigation, criminal, estate planning, contract, compliance, notary, translation.

## Service types

Consultation, document drafting, document review, filing support, translation, notarization, custom quote, retainer.

---

## Development

```bash
git clone https://github.com/phelix001/legal
cd legal
npm install

# Tests against the in-repo mock server
npm test

# Live tests against production API
LEGAL_API_URL=https://solucioneslegalesya.com npm run test:live

# Run the MCP server directly, pointed at a mock server:
npm run test-server &
LEGAL_API_URL=http://127.0.0.1:4455 LEGAL_API_KEY=slk_test_mock1234567890abcdef npm start
```

### Privilege-boundary test

The critical test in `test/tools.test.js` verifies that **no response from any `/api/mcp/*` endpoint leaks privileged fields** (`messages`, `body`, `matterDescription`, `intakeData`, `documents`, `evidence`, etc.). This test must pass before any release is tagged.

---

## What this tool is, and isn't

This is a marketplace connector. It helps you find and hire a licensed attorney. It does not provide legal advice. Your attorney does.

## License

MIT. See [LICENSE](./LICENSE).

## Links

- [Soluciones Legales Ya](https://solucioneslegalesya.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Code](https://claude.com/claude-code)
- [Issues](https://github.com/phelix001/legal/issues)
