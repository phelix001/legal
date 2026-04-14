/**
 * Discovery tool: search_providers
 *
 * Searches attorneys and listings by country, practice area, language, or
 * looks up a specific provider/listing by ID. Returns public marketplace data
 * only — no privileged content.
 */

import { z } from 'zod';
import {
  CountryCode, PracticeArea, ServiceType, LANGUAGES, toolResponse,
} from './shared.js';

export function registerSearchTools(server, client) {
  server.tool(
    'search_providers',
    [
      'Search attorneys and legal service listings across Spain, Mexico, Colombia,',
      'Argentina, Chile, Peru, and the Dominican Republic. Filter by jurisdiction,',
      'practice area category, service type, and language. Returns public listing',
      'data only (credentials, ratings, pricing) — never privileged matter details.',
      '',
      'Provide `listing_id` or `provider_id` to fetch a specific record. Otherwise',
      'returns a paginated list. Pass ONLY the category of the matter (e.g.,',
      'immigration, corporate) — never include specific facts about the user\'s',
      'case, as this tool is for discovery only.',
    ].join(' '),
    {
      listing_id: z.string().optional().describe('Fetch a specific listing by ID'),
      provider_id: z.string().optional().describe('Fetch a specific provider by ID'),
      query: z.string().max(200).optional().describe('Free-text keyword search over listing titles and provider names. Never include personal or matter-specific details.'),
      country: CountryCode.optional().describe('Jurisdiction ISO-2 code: ES, MX, CO, AR, CL, PE, DO'),
      practice_area: PracticeArea.optional().describe('Legal practice category (never matter details)'),
      service_type: ServiceType.optional().describe('Type of service offered'),
      language: z.enum(LANGUAGES).optional().describe('Language the provider speaks'),
      page: z.number().int().min(1).max(100).optional().describe('Page number (1-indexed)'),
      limit: z.number().int().min(1).max(50).optional().describe('Results per page (max 50)'),
    },
    toolResponse(async (args) => {
      if (args.listing_id) {
        return client.getListing(args.listing_id);
      }
      if (args.provider_id) {
        return client.getProvider(args.provider_id);
      }
      // Translate to API query params
      return client.searchProviders({
        q: args.query,
        country: args.country,
        practice_area: args.practice_area,
        service_type: args.service_type,
        language: args.language,
        page: args.page,
        limit: args.limit,
      });
    })
  );
}
