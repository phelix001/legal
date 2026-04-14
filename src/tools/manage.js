/**
 * Management tools: get_engagements, update_engagement
 *
 * PRIVILEGE BOUNDARY: get_engagements returns metadata only (state, timestamps,
 * pricing, counts of new messages) — never message bodies or matter details.
 * update_engagement transitions state (accept/decline/cancel/dispute); the
 * optional `reason` field must be short and non-privileged — any detailed
 * explanation belongs in the secure composer, not here.
 */

import { z } from 'zod';
import { ENGAGEMENT_ACTIONS, toolResponse } from './shared.js';

export function registerManagementTools(server, client) {
  server.tool(
    'get_engagements',
    [
      'Get metadata for the authenticated user\'s engagements. With no arguments,',
      'returns a list of all engagements. With `engagement_id`, returns detailed',
      'metadata for one engagement: state, state history, provider info, pricing,',
      'payment state, timestamps, and count of unread messages.',
      '',
      'Returns METADATA ONLY — never the bodies of messages or the details of the',
      'user\'s legal matter. To read or write actual messages, call',
      '`open_composer` to give the user a URL into the secure browser thread.',
    ].join(' '),
    {
      engagement_id: z.string().optional().describe('If provided, returns detail for this engagement. Otherwise returns the list.'),
    },
    toolResponse(async ({ engagement_id }) => {
      if (engagement_id) {
        return client.getEngagement(engagement_id);
      }
      return client.listEngagements();
    })
  );

  server.tool(
    'update_engagement',
    [
      'Transition an engagement\'s state. Available actions:',
      '• accept_quote — buyer accepts the attorney\'s quote and proceeds to payment',
      '• decline_quote — buyer declines the quote; engagement ends',
      '• cancel — cancel an in-progress engagement (subject to cancellation policy)',
      '• open_dispute — open a formal dispute (triggers evidence collection flow',
      '  in the web UI; detailed evidence goes through the composer, not here)',
      '',
      'The optional `reason` field must be a short non-privileged label (e.g.,',
      '"out of budget", "quality issue"). Detailed reasoning goes in the secure',
      'composer. If the user wants to explain in detail, call `open_composer`',
      'instead so they can write it safely.',
    ].join(' '),
    {
      engagement_id: z.string().min(1).describe('The engagement ID'),
      action: z.enum(ENGAGEMENT_ACTIONS).describe('The state transition to perform'),
      reason: z.string().max(200).optional().describe('Short non-privileged label (max 200 chars). Never include sensitive matter details.'),
    },
    toolResponse(async ({ engagement_id, action, reason }) => {
      return client.engagementAction(engagement_id, action, reason);
    })
  );
}
