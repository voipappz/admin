/**
 * Shared CRUD Test Helpers
 * Simplified helpers for testing server-side API functionality
 */

export async function getAuthToken(page: any): Promise<string> {
  if (page.authTokens?.access) {
    return page.authTokens.access;
  }
  return await page.evaluate(() => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    return auth.access || localStorage.getItem('access_token') || '';
  });
}

export function getApiBaseUrl(): string {
  const url = process.env.VITE_API_BASE_URL;
  if (!url) throw new Error('VITE_API_BASE_URL required');
  return url;
}

export function buildFormData(data: Record<string, any>): string {
  const formData = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => formData.append(`${key}[]`, String(v)));
      } else {
        formData.append(key, String(value));
      }
    }
  });
  return formData.toString();
}

export interface CrudTestConfig {
  resource: string;
  route: string;
  createData: Record<string, any>;
  updateField: string;
  requiredFields?: string[];
}

/**
 * Run standardized CRUD tests for a resource
 */
export async function testList(page: any, resource: string) {
  const apiBaseUrl = getApiBaseUrl();
  const authToken = await getAuthToken(page);

  const response = await page.request.get(`${apiBaseUrl}/api/${resource}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  console.log(`${resource.toUpperCase()} LIST: ${response.status()}`);
  return response;
}

export async function testCreate(page: any, resource: string, data: Record<string, any>) {
  const apiBaseUrl = getApiBaseUrl();
  const authToken = await getAuthToken(page);

  const response = await page.request.post(`${apiBaseUrl}/api/${resource}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: buildFormData(data)
  });

  console.log(`${resource.toUpperCase()} CREATE: ${response.status()}`);
  return response;
}

export async function testUpdate(page: any, resource: string, uuid: string, data: Record<string, any>) {
  const apiBaseUrl = getApiBaseUrl();
  const authToken = await getAuthToken(page);

  const response = await page.request.patch(`${apiBaseUrl}/api/${resource}/${uuid}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: buildFormData(data)
  });

  console.log(`${resource.toUpperCase()} UPDATE: ${response.status()}`);
  return response;
}

export async function testDelete(page: any, resource: string, uuid: string) {
  const apiBaseUrl = getApiBaseUrl();
  const authToken = await getAuthToken(page);

  const response = await page.request.delete(`${apiBaseUrl}/api/${resource}/${uuid}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  console.log(`${resource.toUpperCase()} DELETE: ${response.status()}`);
  return response;
}

export async function testRead(page: any, resource: string, uuid: string) {
  const apiBaseUrl = getApiBaseUrl();
  const authToken = await getAuthToken(page);

  const response = await page.request.get(`${apiBaseUrl}/api/${resource}/${uuid}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  console.log(`${resource.toUpperCase()} READ: ${response.status()}`);
  return response;
}

export async function getFirstItem(page: any, resource: string): Promise<any | null> {
  const response = await testList(page, resource);
  if (!response.ok()) return null;

  const data = await response.json();
  const list = Array.isArray(data) ? data : data.data || [];
  return list.length > 0 ? list[0] : null;
}
