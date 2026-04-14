/**
 * Shared constants and helpers for tool modules.
 */

import { z } from 'zod';

// Countries served by Soluciones Legales Ya
export const COUNTRIES = ['ES', 'MX', 'CO', 'AR', 'CL', 'PE', 'DO'];

export const PRACTICE_AREAS = [
  'corporate', 'tax', 'employment', 'family', 'immigration', 'real_estate',
  'intellectual_property', 'litigation', 'criminal', 'estate_planning',
  'contract', 'compliance', 'notary', 'translation',
];

export const SERVICE_TYPES = [
  'consultation', 'document_drafting', 'document_review', 'filing_support',
  'translation', 'notarization', 'custom_quote', 'retainer',
];

export const LANGUAGES = ['es', 'en', 'pt', 'ca', 'gl', 'eu'];

export const ENGAGEMENT_ACTIONS = [
  'accept_quote', 'decline_quote', 'cancel', 'open_dispute',
];

// Zod schemas used across tools
export const CountryCode = z.enum(COUNTRIES);
export const PracticeArea = z.enum(PRACTICE_AREAS);
export const ServiceType = z.enum(SERVICE_TYPES);
export const Locale = z.enum(['es', 'en']);

/**
 * Wrap a tool handler to return MCP-formatted responses and catch errors.
 * Text is always returned as JSON-stringified content for consistency.
 */
export function toolResponse(handler) {
  return async (args, extra) => {
    try {
      const result = await handler(args, extra);
      if (result && typeof result === 'object' && result.content) {
        return result; // already MCP-formatted
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err?.message || String(err);
      const status = err?.status ? ` (${err.status})` : '';
      return {
        content: [{ type: 'text', text: `Error${status}: ${message}` }],
        isError: true,
      };
    }
  };
}
