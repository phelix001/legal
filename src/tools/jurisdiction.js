/**
 * Jurisdiction tools: check_jurisdiction, get_mandatory_disclosures
 *
 * Expose the Soluciones country-rules engine to AIs: what licenses are required,
 * what authorities are accepted, what disclosures must be presented.
 */

import { CountryCode, PracticeArea, ServiceType, toolResponse } from './shared.js';

export function registerJurisdictionTools(server, client) {
  server.tool(
    'check_jurisdiction',
    [
      'Check the legal requirements for offering a service in a specific country.',
      'Returns which license types are required, which authorities are accepted',
      '(e.g., Ilustre Colegio de Abogados de Madrid), whether cross-border remote',
      'service is allowed, and any prohibitions. Call this BEFORE searching for',
      'providers so you can explain to the user what credentials they should',
      'look for.',
    ].join(' '),
    {
      country: CountryCode.describe('Country ISO-2 code: ES, MX, CO, AR, CL, PE, DO'),
      practice_area: PracticeArea.optional().describe('Filter to a specific practice area'),
      service_type: ServiceType.optional().describe('Filter to a specific service type'),
    },
    toolResponse(async ({ country, practice_area, service_type }) => {
      return client.getJurisdiction(country, {
        practice_area,
        service_type,
      });
    })
  );

  server.tool(
    'get_mandatory_disclosures',
    [
      'Get the regulatory disclosures that MUST be presented to the user verbatim',
      'before they engage an attorney in a given jurisdiction and practice area.',
      'Disclosures are returned in the jurisdiction\'s official language (Spanish',
      'for all supported countries). Present them exactly as returned — do not',
      'translate, summarize, or paraphrase. If the user speaks English, you may',
      'add a brief English summary AFTER the Spanish original, but the Spanish',
      'text is the legally binding version.',
    ].join(' '),
    {
      country: CountryCode.describe('Country ISO-2 code'),
      practice_area: PracticeArea.describe('Practice area'),
    },
    toolResponse(async ({ country, practice_area }) => {
      return client.getDisclosures(country, practice_area);
    })
  );
}
