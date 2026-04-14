/**
 * Engagement tools: request_quote, open_composer
 *
 * PRIVILEGE BOUNDARY: These tools never accept or return message bodies or
 * matter details. `request_quote` only takes a listing ID. `open_composer`
 * returns a short-lived URL the user opens in their browser to exchange
 * privileged content directly with the attorney.
 */

import { z } from 'zod';
import { Locale, toolResponse } from './shared.js';

export function registerEngagementTools(server, client) {
  server.tool(
    'request_quote',
    [
      'Create a new engagement shell with an attorney based on a listing the user',
      'has chosen. This ONLY establishes the engagement — no matter details are',
      'passed through this tool. Immediately after calling this, call',
      '`open_composer` with the returned engagement_id and give the user the URL',
      'so they can enter the specifics of their matter directly into the secure',
      'browser composer. You (the AI) must never ask the user to describe their',
      'matter to you.',
    ].join(' '),
    {
      listing_id: z.string().min(1).describe('The listing the user chose (from search_providers)'),
      locale: Locale.optional().describe('Language for the engagement: "es" or "en". Defaults to "es".'),
    },
    toolResponse(async ({ listing_id, locale }) => {
      return client.createEngagement({ listingId: listing_id, locale });
    })
  );

  server.tool(
    'open_composer',
    [
      'Generate a short-lived (5-minute), single-use URL that opens the secure',
      'engagement thread in the user\'s browser. The user reads messages from the',
      'attorney and writes their own replies there — the content never passes',
      'through the AI. Call this whenever the user wants to send a message,',
      'attach a document, or read a reply. Give them the URL and tell them you',
      'cannot see what they write there (this is by design — it preserves',
      'attorney-client privilege).',
    ].join(' '),
    {
      engagement_id: z.string().min(1).describe('The engagement ID returned by request_quote or get_engagements'),
    },
    toolResponse(async ({ engagement_id }) => {
      return client.createAccessUrl(engagement_id, 'composer');
    })
  );
}
