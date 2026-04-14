/**
 * Mock Soluciones API implementing all /api/mcp/* endpoints.
 * Used by E2E tests and for local MCP development.
 *
 * Deliberately implements the privilege boundary: responses contain only
 * metadata. No endpoint returns message bodies or matter details.
 */

import { createServer } from 'http';
import { randomBytes } from 'crypto';

const PORT = Number(process.env.MOCK_PORT) || 4455;
const VALID_TOKEN = process.env.MOCK_TOKEN || 'slk_test_mock1234567890abcdef';

// ---- Seed data ----

const PROVIDERS = [
  {
    id: 'prov_mx_garcia',
    displayName: 'García & Asociados',
    type: 'firm',
    locationCountry: 'MX',
    serviceCountries: ['MX'],
    languages: ['es', 'en'],
    rating: { average: 4.7, count: 38 },
    credentials: [
      { licenseType: 'attorney', authority: 'Barra Mexicana, Colegio de Abogados A.C.', jurisdictions: ['MX'], verifiedAt: '2025-08-14T00:00:00Z' },
    ],
  },
  {
    id: 'prov_es_martinez',
    displayName: 'Bufete Martínez',
    type: 'individual',
    locationCountry: 'ES',
    serviceCountries: ['ES'],
    languages: ['es'],
    rating: { average: 4.9, count: 112 },
    credentials: [
      { licenseType: 'attorney', authority: 'Ilustre Colegio de Abogados de Madrid', jurisdictions: ['ES'], verifiedAt: '2024-11-02T00:00:00Z' },
    ],
  },
  {
    id: 'prov_co_rivera',
    displayName: 'Rivera Legal',
    type: 'firm',
    locationCountry: 'CO',
    serviceCountries: ['CO'],
    languages: ['es', 'en'],
    rating: { average: 4.5, count: 21 },
    credentials: [
      { licenseType: 'attorney', authority: 'Consejo Superior de la Judicatura', jurisdictions: ['CO'], verifiedAt: '2026-01-09T00:00:00Z' },
    ],
  },
];

const LISTINGS = [
  {
    id: 'lst_mx_contract_drafting',
    providerId: 'prov_mx_garcia',
    providerDisplayName: 'García & Asociados',
    title: { es: 'Redacción de contratos mercantiles', en: 'Commercial contract drafting' },
    summary: { es: 'Redactamos contratos mercantiles adaptados a tu caso.', en: 'Commercial contract drafting tailored to your case.' },
    practiceArea: 'contract',
    serviceType: 'document_drafting',
    primaryJurisdiction: 'MX',
    priceType: 'starting_at',
    price: { amount: 8000, currency: 'MXN' },
    deliveryTimeHours: 72,
    state: 'published',
  },
  {
    id: 'lst_es_immigration_consult',
    providerId: 'prov_es_martinez',
    providerDisplayName: 'Bufete Martínez',
    title: { es: 'Consulta de extranjería', en: 'Immigration consultation' },
    summary: { es: 'Consulta inicial sobre trámites de extranjería en España.', en: 'Initial consultation on immigration matters in Spain.' },
    practiceArea: 'immigration',
    serviceType: 'consultation',
    primaryJurisdiction: 'ES',
    priceType: 'fixed',
    price: { amount: 120, currency: 'EUR' },
    deliveryTimeHours: 48,
    state: 'published',
  },
  {
    id: 'lst_co_corporate_review',
    providerId: 'prov_co_rivera',
    providerDisplayName: 'Rivera Legal',
    title: { es: 'Revisión societaria', en: 'Corporate document review' },
    summary: { es: 'Revisión de documentos societarios en Colombia.', en: 'Corporate document review for Colombian entities.' },
    practiceArea: 'corporate',
    serviceType: 'document_review',
    primaryJurisdiction: 'CO',
    priceType: 'hourly',
    price: { amount: 200000, currency: 'COP' },
    deliveryTimeHours: 24,
    state: 'published',
  },
];

const JURISDICTION_RULES = {
  ES: {
    country: 'ES',
    practiceArea: null,
    requiredLicenses: ['attorney'],
    acceptedAuthorities: ['Ilustre Colegio de Abogados de Madrid', 'Colegio de la Abogacía de Barcelona', 'Ilustre Colegio de Abogados de Valencia'],
    allowsCrossBorderRemote: true,
  },
  MX: {
    country: 'MX',
    practiceArea: null,
    requiredLicenses: ['attorney'],
    acceptedAuthorities: ['Barra Mexicana, Colegio de Abogados A.C.', 'Ilustre y Nacional Colegio de Abogados de México'],
    allowsCrossBorderRemote: false,
  },
  CO: {
    country: 'CO',
    practiceArea: null,
    requiredLicenses: ['attorney'],
    acceptedAuthorities: ['Consejo Superior de la Judicatura'],
    allowsCrossBorderRemote: true,
  },
  AR: { country: 'AR', practiceArea: null, requiredLicenses: ['attorney'], acceptedAuthorities: ['Colegio Público de Abogados de la Capital Federal'], allowsCrossBorderRemote: false },
  CL: { country: 'CL', practiceArea: null, requiredLicenses: ['attorney'], acceptedAuthorities: ['Colegio de Abogados de Chile'], allowsCrossBorderRemote: true },
  PE: { country: 'PE', practiceArea: null, requiredLicenses: ['attorney'], acceptedAuthorities: ['Colegio de Abogados de Lima'], allowsCrossBorderRemote: true },
  DO: { country: 'DO', practiceArea: null, requiredLicenses: ['attorney'], acceptedAuthorities: ['Colegio de Abogados de la República Dominicana'], allowsCrossBorderRemote: true },
};

const DISCLOSURES = {
  'MX:immigration': [
    'Este servicio es prestado por un abogado mexicano autorizado por la Barra Mexicana. Los honorarios son no reembolsables una vez iniciada la prestación del servicio, salvo acuerdo en contrario.',
    'El cliente reconoce que no se garantiza ningún resultado específico en procedimientos migratorios.',
  ],
  'ES:immigration': [
    'Servicio prestado por abogado colegiado en el Ilustre Colegio de Abogados de Madrid. Los honorarios profesionales se rigen por el Estatuto General de la Abogacía Española.',
    'El cliente tiene derecho a recibir un presupuesto previo y a solicitar factura detallada.',
  ],
  'CO:corporate': [
    'Servicio prestado por abogado inscrito ante el Consejo Superior de la Judicatura de Colombia. El ejercicio profesional se rige por el Decreto 196 de 1971 y la Ley 1123 de 2007.',
  ],
};

// In-memory engagement store (per mock process)
const engagements = new Map();

// ---- Server ----

export function startMockServer(port = PORT) {
  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (err) {
      sendJson(res, 500, { error: err?.message || 'Mock server error' });
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => resolvePromise(server));
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS / health
  if (method === 'GET' && path === '/health') return sendJson(res, 200, { ok: true });

  // Friendly root page (dev convenience)
  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(indexPage());
    return;
  }

  // All MCP endpoints
  if (!path.startsWith('/api/mcp/')) return sendJson(res, 404, { error: 'Not found' });

  const mcp = path.slice('/api/mcp'.length);

  // ---- Auth endpoints ----
  if (method === 'POST' && mcp === '/auth/refresh') {
    const body = await readJson(req);
    if (!body?.refreshToken) return sendJson(res, 400, { error: 'refreshToken required' });
    return sendJson(res, 200, {
      accessToken: VALID_TOKEN,
      refreshToken: body.refreshToken,
      expiresIn: 3600,
    });
  }

  // ---- Discovery (no auth) ----
  if (method === 'GET' && mcp === '/providers') {
    const q = url.searchParams;
    let results = PROVIDERS.filter((p) =>
      (!q.get('country') || p.serviceCountries.includes(q.get('country'))) &&
      (!q.get('language') || p.languages.includes(q.get('language')))
    );
    if (q.get('q')) {
      const needle = q.get('q').toLowerCase();
      results = results.filter((p) => p.displayName.toLowerCase().includes(needle));
    }
    return sendJson(res, 200, { providers: results, total: results.length });
  }

  const providerMatch = method === 'GET' && mcp.match(/^\/providers\/([^/]+)$/);
  if (providerMatch) {
    const p = PROVIDERS.find((x) => x.id === providerMatch[1]);
    if (!p) return sendJson(res, 404, { error: 'Provider not found' });
    return sendJson(res, 200, p);
  }

  if (method === 'GET' && mcp === '/listings') {
    const q = url.searchParams;
    let results = LISTINGS.filter((l) =>
      (!q.get('country') || l.primaryJurisdiction === q.get('country')) &&
      (!q.get('practice_area') || l.practiceArea === q.get('practice_area')) &&
      (!q.get('service_type') || l.serviceType === q.get('service_type'))
    );
    if (q.get('q')) {
      const needle = q.get('q').toLowerCase();
      results = results.filter((l) =>
        l.title.es.toLowerCase().includes(needle) ||
        l.title.en.toLowerCase().includes(needle)
      );
    }
    return sendJson(res, 200, { listings: results, total: results.length });
  }

  const listingMatch = method === 'GET' && mcp.match(/^\/listings\/([^/]+)$/);
  if (listingMatch) {
    const l = LISTINGS.find((x) => x.id === listingMatch[1]);
    if (!l) return sendJson(res, 404, { error: 'Listing not found' });
    return sendJson(res, 200, l);
  }

  const jurMatch = method === 'GET' && mcp.match(/^\/jurisdictions\/([A-Z]{2})$/);
  if (jurMatch) {
    const rule = JURISDICTION_RULES[jurMatch[1]];
    if (!rule) return sendJson(res, 404, { error: 'Unknown jurisdiction' });
    const pa = url.searchParams.get('practice_area');
    const st = url.searchParams.get('service_type');
    return sendJson(res, 200, {
      ...rule,
      practiceArea: pa || null,
      serviceType: st || null,
    });
  }

  if (method === 'GET' && mcp === '/disclosures') {
    const country = url.searchParams.get('country');
    const practiceArea = url.searchParams.get('practice_area');
    if (!country || !practiceArea) return sendJson(res, 400, { error: 'country and practice_area required' });
    const key = `${country}:${practiceArea}`;
    const texts = DISCLOSURES[key] || [
      'Servicio prestado por un profesional autorizado en la jurisdicción correspondiente. Honorarios y términos se rigen por la normativa local aplicable.',
    ];
    return sendJson(res, 200, { country, practiceArea, language: 'es', disclosures: texts });
  }

  // ---- Engagement endpoints (auth required) ----
  const auth = req.headers['authorization'] || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  const needsAuth = mcp.startsWith('/engagements');
  if (needsAuth && (!bearer || (bearer !== VALID_TOKEN && !bearer.startsWith('slk_test_')))) {
    return sendJson(res, 401, { error: 'Invalid or missing API key' });
  }

  if (method === 'POST' && mcp === '/engagements') {
    const body = await readJson(req);
    const listing = LISTINGS.find((l) => l.id === body.listing_id);
    if (!listing) return sendJson(res, 404, { error: 'Listing not found' });
    const id = `eng_${randomBytes(6).toString('hex')}`;
    const engagement = {
      id,
      listingId: listing.id,
      providerId: listing.providerId,
      providerDisplayName: listing.providerDisplayName,
      title: listing.title,
      state: 'awaiting_provider_response',
      locale: body.locale || 'es',
      jurisdiction: listing.primaryJurisdiction,
      practiceArea: listing.practiceArea,
      serviceType: listing.serviceType,
      paymentState: 'not_required',
      stateHistory: [{ to: 'awaiting_provider_response', at: new Date().toISOString() }],
      unreadMessages: 0,
      createdAt: new Date().toISOString(),
    };
    engagements.set(id, engagement);
    return sendJson(res, 201, {
      engagementId: id,
      state: engagement.state,
      provider: { id: listing.providerId, displayName: listing.providerDisplayName },
      access_url_hint: 'Call POST /api/mcp/engagements/:id/access-url to get a secure browser URL.',
    });
  }

  if (method === 'GET' && mcp === '/engagements') {
    const list = Array.from(engagements.values()).map(metadataOnly);
    return sendJson(res, 200, { engagements: list, total: list.length });
  }

  const engMatch = mcp.match(/^\/engagements\/([^/]+)$/);
  if (method === 'GET' && engMatch) {
    const e = engagements.get(engMatch[1]);
    if (!e) return sendJson(res, 404, { error: 'Engagement not found' });
    return sendJson(res, 200, metadataOnly(e));
  }

  const accessMatch = mcp.match(/^\/engagements\/([^/]+)\/access-url$/);
  if (method === 'POST' && accessMatch) {
    const e = engagements.get(accessMatch[1]);
    if (!e) return sendJson(res, 404, { error: 'Engagement not found' });
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return sendJson(res, 200, {
      url: `https://solucioneslegalesya.com/engagements/${e.id}/access?token=${token}`,
      expiresAt,
      singleUse: true,
    });
  }

  const actionMatch = mcp.match(/^\/engagements\/([^/]+)\/actions$/);
  if (method === 'POST' && actionMatch) {
    const e = engagements.get(actionMatch[1]);
    if (!e) return sendJson(res, 404, { error: 'Engagement not found' });
    const body = await readJson(req);
    const transitions = {
      accept_quote: 'accepted',
      decline_quote: 'canceled',
      cancel: 'canceled',
      open_dispute: 'disputed',
    };
    const newState = transitions[body.action];
    if (!newState) return sendJson(res, 400, { error: `Invalid action: ${body.action}` });
    e.state = newState;
    e.stateHistory.push({ to: newState, at: new Date().toISOString(), reason: body.reason });
    return sendJson(res, 200, { engagementId: e.id, state: e.state });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

/**
 * Privilege boundary enforcement: strip any fields that could contain
 * privileged content before responding. Defensive — nothing in the seed
 * should contain such fields, but this guarantees no leak.
 */
function metadataOnly(engagement) {
  const FORBIDDEN = ['messages', 'messageBodies', 'intakeData', 'matterDescription', 'documents', 'evidence'];
  const clean = {};
  for (const [k, v] of Object.entries(engagement)) {
    if (FORBIDDEN.includes(k)) continue;
    clean[k] = v;
  }
  return clean;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function indexPage() {
  const discovery = [
    ['GET', '/api/mcp/providers', 'Search providers (optional ?country=MX&language=en&q=...)'],
    ['GET', '/api/mcp/providers/prov_mx_garcia', 'Provider detail'],
    ['GET', '/api/mcp/providers/prov_es_martinez', 'Provider detail'],
    ['GET', '/api/mcp/providers/prov_co_rivera', 'Provider detail'],
    ['GET', '/api/mcp/listings', 'Search listings (optional ?country=&practice_area=&service_type=)'],
    ['GET', '/api/mcp/listings/lst_mx_contract_drafting', 'Listing detail (MX, contract drafting)'],
    ['GET', '/api/mcp/listings/lst_es_immigration_consult', 'Listing detail (ES, immigration consult)'],
    ['GET', '/api/mcp/listings/lst_co_corporate_review', 'Listing detail (CO, corporate review)'],
    ['GET', '/api/mcp/jurisdictions/ES', 'Spain jurisdiction rules'],
    ['GET', '/api/mcp/jurisdictions/MX', 'Mexico jurisdiction rules'],
    ['GET', '/api/mcp/jurisdictions/CO', 'Colombia jurisdiction rules'],
    ['GET', '/api/mcp/disclosures?country=MX&practice_area=immigration', 'Mandatory disclosures (MX immigration)'],
    ['GET', '/api/mcp/disclosures?country=ES&practice_area=immigration', 'Mandatory disclosures (ES immigration)'],
    ['GET', '/api/mcp/disclosures?country=CO&practice_area=corporate', 'Mandatory disclosures (CO corporate)'],
  ];

  const authed = [
    ['POST', '/api/mcp/engagements', 'Create engagement — body: {"listing_id":"lst_mx_contract_drafting","locale":"es"}'],
    ['GET', '/api/mcp/engagements', 'List engagements (metadata only)'],
    ['GET', '/api/mcp/engagements/:id', 'Engagement detail (metadata only)'],
    ['POST', '/api/mcp/engagements/:id/access-url', 'Short-lived URL for secure browser thread'],
    ['POST', '/api/mcp/engagements/:id/actions', 'Transition state — body: {"action":"accept_quote|decline_quote|cancel|open_dispute","reason":"..."}'],
    ['POST', '/api/mcp/auth/refresh', 'Refresh access token — body: {"refreshToken":"..."}'],
  ];

  const row = ([method, path, desc]) => {
    const isGet = method === 'GET';
    const link = isGet ? `<a href="${path}">${path}</a>` : `<span class="path">${path}</span>`;
    const cls = isGet ? 'get' : 'post';
    return `<tr><td class="method ${cls}">${method}</td><td>${link}</td><td class="desc">${desc}</td></tr>`;
  };

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>legal mock server</title>
<style>
  :root { color-scheme: dark; }
  body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
         background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 32px; max-width: 1100px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #888; margin-bottom: 24px; font-size: 13px; }
  .banner { background: #1a1a2e; border-left: 3px solid #a78bfa; padding: 12px 16px;
            margin: 16px 0 24px; border-radius: 4px; font-size: 13px; color: #cbd5e1; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;
       color: #a1a1aa; margin: 32px 0 8px; border-bottom: 1px solid #27272a; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 10px; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
  td.method { width: 60px; font-weight: 600; font-size: 11px; }
  td.method.get  { color: #22c55e; }
  td.method.post { color: #f59e0b; }
  td.desc { color: #71717a; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .path { color: #888; }
  code { background: #18181b; padding: 1px 6px; border-radius: 3px; font-size: 13px; }
  .token { color: #fbbf24; }
</style></head><body>
<h1>legal mock server</h1>
<p class="sub">In-memory mock of the Soluciones <code>/api/mcp/*</code> API. Used for local MCP development and E2E tests.</p>

<div class="banner">
  <strong>Privilege boundary:</strong> None of these endpoints return message bodies, matter descriptions, uploaded documents, or other privileged content. <code>open_composer</code> returns a short-lived URL for browser-only messaging — content never passes through the API.
</div>

<h2>Discovery (no auth)</h2>
<table><tbody>
${discovery.map(row).join('\n')}
</tbody></table>

<h2>Engagement (Bearer token required)</h2>
<p class="sub">Test token: <code class="token">slk_test_mock1234567890abcdef</code></p>
<table><tbody>
${authed.map(row).join('\n')}
</tbody></table>

<h2>Example curl</h2>
<pre style="background:#18181b;padding:12px;border-radius:4px;overflow-x:auto;color:#d4d4d8;">curl -X POST http://127.0.0.1:4455/api/mcp/engagements \\
  -H "Authorization: Bearer slk_test_mock1234567890abcdef" \\
  -H "Content-Type: application/json" \\
  -d '{"listing_id":"lst_mx_contract_drafting","locale":"es"}'</pre>
</body></html>`;
}

async function readJson(req) {
  return new Promise((resolvePromise, rejectPromise) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (!data) return resolvePromise({});
      try { resolvePromise(JSON.parse(data)); }
      catch (e) { rejectPromise(e); }
    });
    req.on('error', rejectPromise);
  });
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  startMockServer(PORT).then((server) => {
    console.log(`Mock /api/mcp server listening on http://127.0.0.1:${server.address().port}`);
    console.log(`Valid test token: ${VALID_TOKEN}`);
  });
}
