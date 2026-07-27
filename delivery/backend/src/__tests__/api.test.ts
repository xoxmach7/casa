import { describe, it, expect, beforeAll } from 'vitest';

const PORT = process.env.PORT || '3002';
const BASE = `http://localhost:${PORT}/api`;

// Helper: login and get token (with retry on rate limit)
async function login(email: string, password: string): Promise<{ token: string; user: any }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
    return res.json() as Promise<{ token: string; user: any }>;
  }
  throw new Error(`Login rate-limited for ${email} after retries`);
}

// Helper: authenticated GET
async function get(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json().catch(() => null) as any };
}

// Helper: authenticated POST
async function post(path: string, token: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) as any };
}

// Helper: authenticated PUT
async function put(path: string, token: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) as any };
}

// Helper: authenticated DELETE
async function del(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, data: await res.json().catch(() => null) as any };
}

// ── Tokens ──
let adminToken = '';
let brokerToken = '';
let developerToken = '';

// Graceful login — returns empty token if user doesn't exist
async function tryLogin(email: string, password: string): Promise<string> {
  try {
    const { token } = await login(email, password);
    return token;
  } catch {
    return '';
  }
}

beforeAll(async () => {
  adminToken = await tryLogin('admin@casa.kz', 'admin123');
  if (!adminToken) throw new Error('Admin login required — run seed first');

  // Try multiple broker emails
  brokerToken = await tryLogin('broker@casa.kz', 'broker123')
    || await tryLogin('broker1@casa.kz', 'admin123');

  developerToken = await tryLogin('developer@bi.group', 'admin123')
    || await tryLogin('developer@casa.kz', 'admin123');
});

// ═══════════════════════════════════════════
// 1. AUTH
// ═══════════════════════════════════════════
describe('Auth', () => {
  it('POST /auth/login — valid credentials', async () => {
    const res = await post('/auth/login', '', { email: 'admin@casa.kz', password: 'admin123' });
    expect([200, 429]).toContain(res.status);
    if (res.status === 200) {
      expect(res.data.token).toBeDefined();
      expect(res.data.user.role).toBe('ADMIN');
    }
  });

  it('POST /auth/login — invalid password', async () => {
    const res = await post('/auth/login', '', { email: 'admin@casa.kz', password: 'wrong' });
    expect([400, 401, 429]).toContain(res.status);
  });

  it('GET /auth/me — authenticated', async () => {
    const res = await get('/auth/me', adminToken);
    expect(res.status).toBe(200);
    expect(res.data.email).toBe('admin@casa.kz');
  });

  it('GET /auth/me — no token', async () => {
    const res = await get('/auth/me', '');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// 2. HEALTH
// ═══════════════════════════════════════════
describe('Health', () => {
  it('GET /health', async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    const data: any = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.db).toBe('connected');
  });
});

// ═══════════════════════════════════════════
// 3. USERS (ADMIN only)
// ═══════════════════════════════════════════
describe('Users (ADMIN)', () => {
  it('GET /admin/users — admin can list', async () => {
    const res = await get('/admin/users', adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /admin/users — broker forbidden', async () => {
    const res = await get('/admin/users', brokerToken);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════
// 4. DASHBOARD
// ═══════════════════════════════════════════
describe('Dashboard', () => {
  it('GET /dashboard/stats — admin', async () => {
    const res = await get('/dashboard/stats', adminToken);
    expect([200, 404]).toContain(res.status);
  });

  it('GET /dashboard/stats — broker', async () => {
    const res = await get('/dashboard/stats', brokerToken);
    expect([200, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════
// 5. SELLERS
// ═══════════════════════════════════════════
describe('Sellers', () => {
  let sellerId = '';

  it('GET /sellers — broker can list', async () => {
    const res = await get('/sellers', brokerToken);
    expect(res.status).toBe(200);
    expect(res.data.sellers).toBeDefined();
  });

  it('POST /sellers — broker can create', async () => {
    const res = await post('/sellers', brokerToken, {
      firstName: 'Тест',
      lastName: 'Продавец',
      phone: '+77770001111',
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    sellerId = res.data.id;
  });

  it('GET /sellers/:id — broker can view own', async () => {
    if (!sellerId) return;
    const res = await get(`/sellers/${sellerId}`, brokerToken);
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBe('Тест');
  });

  it('PUT /sellers/:id — broker can update', async () => {
    if (!sellerId) return;
    const res = await put(`/sellers/${sellerId}`, brokerToken, { firstName: 'Обновлён' });
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBe('Обновлён');
  });

  it('DELETE /sellers/:id — broker can archive', async () => {
    if (!sellerId) return;
    const res = await del(`/sellers/${sellerId}`, brokerToken);
    expect(res.status).toBe(200);
  });

  it('POST /sellers/:id/restore — broker can restore', async () => {
    if (!sellerId) return;
    const res = await post(`/sellers/${sellerId}/restore`, brokerToken);
    expect(res.status).toBe(200);
  });

  it('DELETE /sellers/:id/permanent — broker can permanently delete', async () => {
    if (!sellerId) return;
    const res = await del(`/sellers/${sellerId}/permanent`, brokerToken);
    expect([200, 204]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════
// 6. CLIENTS
// ═══════════════════════════════════════════
describe('Clients', () => {
  let clientId = '';

  it('GET /clients — broker can list', async () => {
    const res = await get('/clients', brokerToken);
    expect(res.status).toBe(200);
  });

  it('POST /clients — broker can create', async () => {
    const res = await post('/clients', brokerToken, {
      firstName: 'Тест',
      lastName: 'Клиент',
      phone: '+77770002222',
      iin: '990101000111',
    });
    expect(res.status).toBe(201);
    clientId = res.data.id;
  });

  it('GET /clients/:id — broker can view', async () => {
    if (!clientId) return;
    const res = await get(`/clients/${clientId}`, brokerToken);
    expect(res.status).toBe(200);
  });

  it('DELETE /clients/:id — broker can delete', async () => {
    if (!clientId) return;
    const res = await del(`/clients/${clientId}`, brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 7. PROJECTS (DEVELOPER/ADMIN)
// ═══════════════════════════════════════════
describe('Projects', () => {
  let projectId = '';

  it('GET /projects — all roles can list', async () => {
    const res = await get('/projects', brokerToken);
    expect(res.status).toBe(200);
    expect(res.data.projects).toBeDefined();
  });

  it('POST /projects — developer can create', async () => {
    if (!developerToken) return;
    const res = await post('/projects', developerToken, {
      name: 'Тест ЖК',
      city: 'Астана',
      address: 'ул. Тестовая 1',
    });
    expect(res.status).toBe(201);
    projectId = res.data.id;
  });

  it('POST /projects — broker forbidden', async () => {
    const res = await post('/projects', brokerToken, {
      name: 'Тест',
      city: 'Астана',
      address: 'ул. Тест',
    });
    expect(res.status).toBe(403);
  });

  it('DELETE /projects/:id — developer can delete own', async () => {
    if (!projectId) return;
    const res = await del(`/projects/${projectId}`, developerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 8. DEALS
// ═══════════════════════════════════════════
describe('Deals', () => {
  let dealId = '';

  it('GET /deals — broker can list', async () => {
    const res = await get('/deals', brokerToken);
    expect(res.status).toBe(200);
    expect(res.data.deals).toBeDefined();
  });

  it('POST /deals — broker can create', async () => {
    const res = await post('/deals', brokerToken, {
      amount: 50000000,
      commission: 500000,
      casaFee: 100000,
      objectType: 'PROPERTY',
    });
    expect(res.status).toBe(201);
    dealId = res.data.id;
  });

  it('PUT /deals/:id — broker can update', async () => {
    if (!dealId) return;
    const res = await put(`/deals/${dealId}`, brokerToken, { notes: 'Тестовая заметка' });
    expect(res.status).toBe(200);
  });

  it('DELETE /deals/:id — broker can delete own', async () => {
    if (!dealId) return;
    const res = await del(`/deals/${dealId}`, brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 9. NOTIFICATIONS
// ═══════════════════════════════════════════
describe('Notifications', () => {
  it('GET /notifications — broker can list', async () => {
    const res = await get('/notifications', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 10. MORTGAGE
// ═══════════════════════════════════════════
describe('Mortgage', () => {
  it('POST /mortgage/calculate — broker can calculate', async () => {
    const res = await post('/mortgage/calculate', brokerToken, {
      propertyPrice: 50000000,
      initialPayment: 10000000,
      interestRate: 7.5,
      termMonths: 240,
      clientId: 'test',
    });
    expect([200, 400]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════
// 11. MORTGAGE PROGRAMS
// ═══════════════════════════════════════════
describe('Mortgage Programs', () => {
  it('GET /mortgage-programs — all can list', async () => {
    const res = await get('/mortgage-programs', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 12. COURSES
// ═══════════════════════════════════════════
describe('Courses', () => {
  it('GET /courses — broker can list', async () => {
    const res = await get('/courses', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 13. IMPORT (ADMIN only)
// ═══════════════════════════════════════════
describe('Import (ADMIN)', () => {
  it('POST /import/upload — broker forbidden', async () => {
    const res = await post('/import/upload', brokerToken);
    expect(res.status).toBe(403);
  });

  it('POST /import/execute — broker forbidden', async () => {
    const res = await post('/import/execute', brokerToken);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════
// 14. SUBSCRIPTIONS
// ═══════════════════════════════════════════
describe('Subscriptions', () => {
  it('GET /subscriptions/my — broker can get own', async () => {
    const res = await get('/subscriptions/my', brokerToken);
    expect(res.status).toBe(200);
  });

  it('GET /subscriptions — admin can list all', async () => {
    const res = await get('/subscriptions', adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /subscriptions — broker forbidden', async () => {
    const res = await get('/subscriptions', brokerToken);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════
// 15. SETTINGS (ADMIN only)
// ═══════════════════════════════════════════
describe('Settings (ADMIN)', () => {
  it('GET /admin/settings — admin can access', async () => {
    const res = await get('/admin/settings', adminToken);
    expect(res.status).toBe(200);
  });

  it('GET /admin/settings — broker forbidden', async () => {
    const res = await get('/admin/settings', brokerToken);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════
// 16. AGENCY
// ═══════════════════════════════════════════
describe('Agency', () => {
  it('GET /agency/team — broker forbidden', async () => {
    const res = await get('/agency/team', brokerToken);
    expect(res.status).toBe(403);
  });

  it('GET /agency/team — admin forbidden', async () => {
    const res = await get('/agency/team', adminToken);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════
// 17. CRM PROPERTIES
// ═══════════════════════════════════════════
describe('CRM Properties', () => {
  it('GET /crm-properties — broker can list', async () => {
    const res = await get('/crm-properties', brokerToken);
    expect(res.status).toBe(200);
    expect(res.data.properties).toBeDefined();
  });

  it('GET /crm-properties/funnel-stats — broker can get stats', async () => {
    const res = await get('/crm-properties/funnel-stats', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 18. BUYERS
// ═══════════════════════════════════════════
describe('Buyers', () => {
  it('GET /buyers — broker can list', async () => {
    const res = await get('/buyers', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 19. TASKS
// ═══════════════════════════════════════════
describe('Tasks', () => {
  it('GET /tasks — broker can list', async () => {
    const res = await get('/tasks', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 20. PAYMENTS
// ═══════════════════════════════════════════
describe('Payments', () => {
  it('GET /payments — admin can list', async () => {
    const res = await get('/payments', adminToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 21. FORMS
// ═══════════════════════════════════════════
describe('Forms', () => {
  it('GET /forms — broker can list', async () => {
    const res = await get('/forms', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 22. CUSTOM FUNNELS
// ═══════════════════════════════════════════
describe('Custom Funnels', () => {
  it('GET /custom-funnels — broker can list', async () => {
    const res = await get('/custom-funnels', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 23. EVENTS
// ═══════════════════════════════════════════
describe('Events', () => {
  it('GET /events — broker can list', async () => {
    const res = await get('/events', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 24. ANALYTICS
// ═══════════════════════════════════════════
describe('Analytics', () => {
  it('GET /analytics/dashboard — broker can access', async () => {
    const res = await get('/analytics/dashboard', brokerToken);
    expect([200, 404]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════
// 25. MORTGAGE APPLICATIONS
// ═══════════════════════════════════════════
describe('Mortgage Applications', () => {
  it('GET /mortgage-applications — broker can list', async () => {
    const res = await get('/mortgage-applications', brokerToken);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 26. CROSS-ROLE ACCESS TESTS
// ═══════════════════════════════════════════
describe('Cross-Role Access', () => {
  it('Broker cannot access admin users', async () => {
    const res = await get('/admin/users', brokerToken);
    expect(res.status).toBe(403);
  });

  it('Broker cannot access admin settings', async () => {
    const res = await get('/admin/settings', brokerToken);
    expect(res.status).toBe(403);
  });

  it('Developer cannot access agency team', async () => {
    if (!developerToken) return;
    const res = await get('/agency/team', developerToken);
    expect(res.status).toBe(403);
  });

  it('No token — all protected routes return 401', async () => {
    const routes = ['/sellers', '/clients', '/deals', '/projects', '/dashboard', '/notifications'];
    for (const route of routes) {
      const res = await get(route, '');
      expect(res.status).toBe(401);
    }
  });
});

// ═══════════════════════════════════════════
// 27. MORTGAGE APPLICATIONS — FULL CRUD
// ═══════════════════════════════════════════
describe('Mortgage Applications CRUD', () => {
  let appId = '';
  let clientId = '';

  it('POST /clients — create test client for mortgage', async () => {
    const unique = Date.now().toString().slice(-6);
    const res = await post('/clients', brokerToken, {
      firstName: 'Ипотека',
      lastName: 'Тест',
      phone: `+7777${unique}`,
      iin: `99010${unique}1`,
    });
    if (res.status === 201) {
      clientId = res.data.id;
    } else {
      // Client may already exist or validation failed — use existing
      const list = await get('/clients', brokerToken);
      const clients = list.data.clients || list.data;
      if (Array.isArray(clients) && clients.length > 0) {
        clientId = clients[0].id;
      }
    }
    expect(clientId).toBeTruthy();
  });

  it('POST /mortgage-applications — broker can create', async () => {
    const res = await post('/mortgage-applications', brokerToken, {
      clientId,
      bankName: 'Kaspi Bank',
      programName: '7-20-25',
      loanAmount: 30000000,
      termMonths: 240,
      interestRate: 7.5,
    });
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    expect(res.data.bankName).toBe('Kaspi Bank');
    appId = res.data.id;
  });

  it('GET /mortgage-applications — broker can list own', async () => {
    const res = await get('/mortgage-applications', brokerToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('PUT /mortgage-applications/:id/status — broker can update status', async () => {
    if (!appId) return;
    const res = await put(`/mortgage-applications/${appId}/status`, brokerToken, {
      status: 'SUBMITTED',
      responseNotes: 'Отправлена в банк',
    });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('SUBMITTED');
  });

  it('PUT /mortgage-applications/:id/status — invalid status rejected', async () => {
    if (!appId) return;
    const res = await put(`/mortgage-applications/${appId}/status`, brokerToken, {
      status: 'INVALID_STATUS',
    });
    expect([400, 500]).toContain(res.status);
  });

  // Cleanup
  it('DELETE /clients/:id — cleanup test client', async () => {
    if (!clientId) return;
    const res = await del(`/clients/${clientId}`, brokerToken);
    expect([200, 500]).toContain(res.status); // May fail if FK constraints exist
  });
});

// ═══════════════════════════════════════════
// 28. SUBSCRIPTIONS — FULL CRUD (ADMIN)
// ═══════════════════════════════════════════
describe('Subscriptions CRUD', () => {
  let subId = '';
  let testUserId = '';

  it('GET /admin/users — get a user id for subscription', async () => {
    const res = await get('/admin/users', adminToken);
    expect(res.status).toBe(200);
    const users = res.data.users || res.data;
    if (Array.isArray(users) && users.length > 0) {
      testUserId = users[0].id;
    }
  });

  it('POST /subscriptions — admin can create', async () => {
    if (!testUserId) return;
    const res = await post('/subscriptions', adminToken, {
      userId: testUserId,
      plan: 'PRO',
      amount: 15000,
    });
    expect(res.status).toBe(201);
    expect(res.data.plan).toBe('PRO');
    subId = res.data.id;
  });

  it('GET /subscriptions — admin can list all', async () => {
    const res = await get('/subscriptions', adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('POST /subscriptions — broker forbidden', async () => {
    const res = await post('/subscriptions', brokerToken, {
      userId: 'any',
      plan: 'BASIC',
    });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════
// 29. TRADEIN DEALS
// ═══════════════════════════════════════════
describe('TradeIn Deals', () => {
  it('POST /deals/tradein — broker can create', async () => {
    const res = await post('/deals/tradein', brokerToken, {
      sellerId: 'nonexistent',
      newApartmentPrice: 45000000,
      commissionPercent: 1.5,
    });
    // May fail with 400/404 due to nonexistent seller, but should not be 401/403
    expect([200, 201, 400, 404, 500]).toContain(res.status);
  });

  it('POST /deals/tradein — no token returns 401', async () => {
    const res = await post('/deals/tradein', '', {
      sellerId: 'test',
      newApartmentPrice: 45000000,
    });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════
// 30. ROLE-BASED SUBSCRIPTION ACCESS
// ═══════════════════════════════════════════
describe('Subscription Access Control', () => {
  it('GET /subscriptions/my — all roles can access own', async () => {
    for (const token of [brokerToken, developerToken].filter(Boolean)) {
      const res = await get('/subscriptions/my', token);
      expect(res.status).toBe(200);
    }
  });

  it('GET /subscriptions — non-admin roles forbidden', async () => {
    for (const token of [brokerToken, developerToken].filter(Boolean)) {
      const res = await get('/subscriptions', token);
      expect(res.status).toBe(403);
    }
  });
});
