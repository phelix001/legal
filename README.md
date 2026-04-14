# legal

**Engage real attorneys from Claude Code and any MCP-compatible AI.**

`legal` is a public [Model Context Protocol](https://modelcontextprotocol.io) server and `/legal` Claude Code skill that connects AI assistants to [Soluciones Legales Ya](https://solucioneslegalesya.com) — a licensed legal-services marketplace across Spain, Mexico, Colombia, Argentina, Chile, Peru, and the Dominican Republic.

Tell Claude what kind of legal matter you have. It finds a qualified attorney in the right jurisdiction, explains mandatory disclosures, sets up the engagement, and hands you a secure browser link to the conversation.

## Quick start

```bash
npx legal install         # browser auth + install skill + register MCP
# open a new Claude Code session
/legal
```

Full setup instructions including Claude Desktop, Cursor, and other clients → [Setup](#setup).

## Attorney-client privilege is preserved by design

Communications between a client and their attorney are legally privileged only if they stay confidential. A third party who learns the content generally waives the privilege. **Claude is a third party.** This MCP is built so Claude never becomes one:

- **Claude never sees your messages.** The substantive legal conversation happens in your browser, via a short-lived secure URL, direct to the attorney.
- **Claude never sees your matter details.** The `request_quote` tool takes a listing ID — not a description. You describe your situation in the browser, where it is protected.
- **Claude never sees uploaded documents, evidence, or payment details.**
- **Claude does see metadata:** who you hired, what state the engagement is in, pricing, timestamps, and a count of unread messages. That is enough for Claude to orchestrate without learning anything privileged.

This architecture also means Anthropic's systems never retain privileged content, and a malicious message from an attorney cannot reach Claude's context to manipulate it.

The seven supported jurisdictions all enforce civil-law "secreto profesional" — attorneys can face criminal penalties for breach. The infrastructure must protect them as well as you.

## Setup

### Requirements

- Node.js 20 or later
- One of: [Claude Code](https://claude.com/claude-code), Claude Desktop, Cursor, or any MCP-compatible AI client
- A Soluciones account (created during install via browser magic-link)

### Claude Code — one-command install

This is the easiest path. It authenticates you, installs the `/legal` skill, and registers the MCP server all in one step.

```bash
npx legal install
```

What happens:

1. A browser window opens to Soluciones Legales Ya for sign-in (magic-link email).
2. On success, your credentials are saved to `~/.legal/config.json` with mode `0600` (readable only by you).
3. The `/legal` skill is copied to `~/.claude/skills/legal.md`.
4. The MCP server is registered with Claude Code via `claude mcp add legal`.

Then open **a new Claude Code session** (important — existing sessions won't see the new skill) and run:

```
/legal
```

Claude will open with a privilege disclosure and start helping you find the right attorney.

### Verify the install

```bash
npx legal status
```

You should see:

```
  Package:    legal@x.y.z
  Skill:      installed
  API URL:    https://solucioneslegalesya.com
  Auth:       you@example.com
  Token:      slk_live_abc...
  MCP:        registered with Claude Code
```

### Claude Desktop

Claude Desktop does not auto-pick-up Claude Code's MCP registration. Add the server manually to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "legal": {
      "command": "npx",
      "args": ["-y", "legal", "serve"]
    }
  }
}
```

Then authenticate separately (the MCP server reads `~/.legal/config.json`):

```bash
npx legal install
```

Restart Claude Desktop. The `legal` tools will appear in the tool list.

The `/legal` skill does NOT install into Claude Desktop (Desktop doesn't support skills). You'll need to prompt the conversation yourself — the tools are still available, just without the pre-canned system prompt. Paste the contents of `skills/legal.md` into your system prompt or the first message to get equivalent behavior.

### Cursor, Windsurf, Zed, and other MCP clients

Any client that supports [stdio MCP transport](https://modelcontextprotocol.io/docs/concepts/transports) can use this server. The pattern is the same as Claude Desktop:

```json
{
  "mcpServers": {
    "legal": {
      "command": "npx",
      "args": ["-y", "legal", "serve"]
    }
  }
}
```

Authenticate via `npx legal install` first (the MCP reads the shared config).

### Non-interactive / CI install

If you already have an access token (from the Soluciones dashboard):

```bash
npx legal install slk_live_XXXXXXXXXXXX
```

Or pass it via environment variable (skips the config file):

```bash
LEGAL_API_KEY=slk_live_XXXXXXXXXXXX npx legal serve
```

### Uninstall

```bash
npx legal uninstall
```

Removes the skill, MCP registration, and local config. Your Soluciones account is untouched.

## Usage

Once `/legal` is installed, in Claude Code:

```
/legal
```

Example conversation (English — works in Spanish too):

> **You:** I need to review a commercial lease in Mexico City.
>
> **Claude:** *(opens with privilege disclosure)* Got it. What jurisdiction is the lease under — Mexico, or somewhere else?
>
> **You:** Mexico.
>
> **Claude:** *(calls `check_jurisdiction` and `search_providers`)* In Mexico, real-estate/contract review requires a Barra-licensed attorney. Here are three options in Mexico City: [...]. Which would you like to engage?
>
> **You:** The first one.
>
> **Claude:** *(presents mandatory disclosures verbatim, awaits acceptance, calls `request_quote`, then `open_composer`)*
> Engagement created with García & Asociados. **Open this link to enter the details of your lease:** https://solucioneslegalesya.com/engagements/eng_.../access?token=...
> This link expires in 5 minutes and works once. I won't see what you write there — that's by design.

## Tools exposed

| Tool | Purpose |
|------|---------|
| `search_providers` | Find attorneys by jurisdiction, practice area, language |
| `check_jurisdiction` | Required licenses, authorities, cross-border rules |
| `get_mandatory_disclosures` | Regulatory disclosures to present verbatim |
| `request_quote` | Create engagement shell from a listing (no matter details) |
| `open_composer` | Short-lived secure URL to the browser thread |
| `get_engagements` | Metadata-only engagement list / detail |
| `update_engagement` | Accept, decline, cancel, or open dispute |

None of these tools accept or return privileged content.

## Commands

```bash
npx legal install              # Browser auth + install
npx legal install <TOKEN>      # Install with a specific access token
npx legal uninstall            # Remove skill, MCP registration, config
npx legal configure --api-url=https://example.com [--reauth]
npx legal status               # Show installation state
npx legal help
npx legal --version
```

## Configuration

`~/.legal/config.json`:

```json
{
  "apiUrl": "https://solucioneslegalesya.com",
  "accessToken": "slk_live_...",
  "refreshToken": "slkr_...",
  "email": "you@example.com",
  "version": "0.1.0"
}
```

Environment overrides:

- `LEGAL_API_URL` — override the API base URL
- `LEGAL_API_KEY` — override the access token (bypasses config file)

## Jurisdictions supported

Spain (ES), Mexico (MX), Colombia (CO), Argentina (AR), Chile (CL), Peru (PE), Dominican Republic (DO).

## Practice areas

Corporate, tax, employment, family, immigration, real estate, intellectual property, litigation, criminal, estate planning, contract, compliance, notary, translation.

## Service types

Consultation, document drafting, document review, filing support, translation, notarization, custom quote, retainer.

## Development

```bash
git clone https://github.com/secondarydao/legal
cd legal
npm install

# Run tests (against in-memory mock server)
npm test

# Start mock server for manual testing
npm run test-server

# Run the MCP server directly
LEGAL_API_URL=http://127.0.0.1:4455 LEGAL_API_KEY=slk_test_mock1234567890abcdef npm start
```

### Privilege-boundary test

The critical test in `test/tools.test.js` verifies that **no response from any `/api/mcp/*` endpoint leaks privileged fields** (`messages`, `body`, `matterDescription`, `intakeData`, `documents`, `evidence`, etc.). This test must pass before publishing.

## What is and isn't legal advice

This tool is a marketplace connector. It helps you find a licensed attorney. It does not provide legal advice. Your attorney does.

## License

MIT. See [LICENSE](./LICENSE).

## Links

- [Soluciones Legales Ya](https://solucioneslegalesya.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Claude Code](https://claude.com/claude-code)
- [Issues](https://github.com/secondarydao/legal/issues)
