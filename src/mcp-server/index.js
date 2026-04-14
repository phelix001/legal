#!/usr/bin/env node

/**
 * /legal — MCP server for engaging real attorneys through Soluciones Legales Ya.
 *
 * PRIVILEGE ARCHITECTURE:
 *   This MCP is a metadata orchestrator. It never transmits message content,
 *   matter details, uploaded documents, or any other privileged information
 *   through tool calls. Privileged content flows directly between the user's
 *   browser and the Soluciones backend via short-lived authenticated URLs
 *   (see the open_composer tool).
 *
 *   This architecture:
 *     • Preserves attorney-client privilege (Claude is not a third party to the
 *       privileged communication).
 *     • Prevents Anthropic's systems from retaining privileged content.
 *     • Blocks prompt injection via attorney messages (content never re-enters
 *       the model context).
 *     • Complies with "secreto profesional" rules across ES, MX, CO, AR, CL,
 *       PE, DO — all civil-law jurisdictions with strict attorney secrecy.
 *
 * Tools exposed (7):
 *   Discovery (no auth):
 *     • search_providers — find attorneys/listings by country, practice area, language
 *     • check_jurisdiction — required licenses, authorities, cross-border rules
 *     • get_mandatory_disclosures — regulatory disclosures to present verbatim
 *   Engagement (auth required):
 *     • request_quote — create engagement shell from a listing
 *     • open_composer — short-lived URL to the secure browser thread
 *     • get_engagements — metadata-only engagement list/detail
 *     • update_engagement — accept / decline / cancel / open_dispute
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

import { ApiClient } from './api-client.js';
import { registerSearchTools } from '../tools/search.js';
import { registerJurisdictionTools } from '../tools/jurisdiction.js';
import { registerEngagementTools } from '../tools/engage.js';
import { registerManagementTools } from '../tools/manage.js';

const VERSION = '0.1.0';

function loadConfig() {
  const configPath = join(homedir(), '.legal', 'config.json');
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (e) {
    process.stderr.write(`Warning: failed to parse ${configPath}: ${e.message}\n`);
    return {};
  }
}

async function main() {
  const config = loadConfig();

  // Auth is optional at startup — discovery tools work without it.
  // Engagement tools will throw NOT_AUTHENTICATED if called unauthenticated.
  const token = process.env.LEGAL_API_KEY || config.accessToken || null;
  const baseUrl = process.env.LEGAL_API_URL || config.apiUrl || undefined;

  const client = new ApiClient(token, baseUrl);

  const server = new McpServer({
    name: 'legal',
    version: VERSION,
  });

  registerSearchTools(server, client);
  registerJurisdictionTools(server, client);
  registerEngagementTools(server, client);
  registerManagementTools(server, client);

  // Initialization prompt surfaced to Claude when the /legal skill starts.
  server.prompt(
    'legal',
    'Engage a real attorney through Soluciones Legales Ya. Find lawyers across Spain, Mexico, Colombia, Argentina, Chile, Peru, and the Dominican Republic. Claude never sees message content — attorney-client privilege is preserved by design.',
    {},
    () => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: 'I need legal help. Find the right attorney and set up a secure engagement. Remember: never ask me to describe the matter in detail here — route me to the secure browser composer for anything confidential.',
        },
      }],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[legal-mcp] failed to start: ${err?.stack || err}\n`);
  process.exit(1);
});
