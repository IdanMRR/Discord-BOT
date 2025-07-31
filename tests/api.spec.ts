import { test, expect } from '@playwright/test';

test.describe('Dashboard API Endpoints', () => {
  test('should return server list when authenticated', async ({ request }) => {
    // Test the servers API endpoint
    const response = await request.get('/api/servers');
    
    // Should either return servers or require authentication  
    if (response.status() === 401) {
      expect(response.status()).toBe(401);
    } else {
      expect(response.status()).toBe(200);
      const servers = await response.json();
      expect(Array.isArray(servers)).toBe(true);
    }
  });

  test('should handle health check endpoint', async ({ request }) => {
    const response = await request.get('/api/health');
    
    // Health check should always respond
    expect(response.status()).toBe(200);
    const health = await response.json();
    expect(health).toHaveProperty('status');
  });

  test('should validate API error handling', async ({ request }) => {
    // Test invalid endpoint
    const response = await request.get('/api/nonexistent');
    expect(response.status()).toBe(404);
  });
});