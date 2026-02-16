import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/server';
import { db } from '@/db/client';
import { regionTable } from '@/db/schema';
import { generateToken } from '@/middleware/auth.middleware';

describe('Region API E2E Tests', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create auth tokens for testing
    authToken = generateToken({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      role: 'user',
    });

    adminToken = generateToken({
      userId: '223e4567-e89b-12d3-a456-426614174001',
      email: 'admin@example.com',
      role: 'admin',
    });
  });

  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(regionTable);
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(regionTable);
  });

  describe('GET /api/mobile/v1/regions', () => {
    it('should get all regions without auth (public)', async () => {
      // Create test data
      await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Region 1' });

      await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Region 2' });

      // Get all
      const response = await request(app)
        .get('/api/mobile/v1/regions')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should support pagination', async () => {
      // Create 15 items
      for (let i = 1; i <= 15; i++) {
        await request(app)
          .post('/api/mobile/v1/regions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `Region ${i}` });
      }

      // Get page 1
      const page1 = await request(app)
        .get('/api/mobile/v1/regions?page=1&limit=10')
        .expect(200);

      expect(page1.body.data).toHaveLength(10);
      expect(page1.body.pagination.hasNext).toBe(true);

      // Get page 2
      const page2 = await request(app)
        .get('/api/mobile/v1/regions?page=2&limit=10')
        .expect(200);

      expect(page2.body.data).toHaveLength(5);
      expect(page2.body.pagination.hasPrev).toBe(true);
    });
  });

  describe('GET /api/mobile/v1/regions/:id', () => {
    it('should get region by id with auth', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Get Test' });

      const id = createResponse.body.id;

      // Get
      const response = await request(app)
        .get(`/api/mobile/v1/regions/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(id);
      expect(response.body.name).toBe('Get Test');
    });

    it('should return 404 for non-existent region', async () => {
      const response = await request(app)
        .get('/api/mobile/v1/regions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.status).toBe('error');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/mobile/v1/regions/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  describe('POST /api/mobile/v1/regions', () => {
    it('should create new region with auth', async () => {
      const response = await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Region',
        })
        .expect(200);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Test Region');
      expect(response.body.status).toBe('pending');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Invalid: empty name
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .post('/api/mobile/v1/regions')
        .send({ name: 'Test' })
        .expect(401);
    });

    it('should apply rate limiting', async () => {
      // Make 11 requests (limit is 10)
      for (let i = 0; i < 11; i++) {
        const response = await request(app)
          .post('/api/mobile/v1/regions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ name: `Test ${i}` });

        if (i < 10) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
          expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
        }
      }
    }, 30000); // Increase timeout for rate limit test
  });

  describe('PUT /api/mobile/v1/regions/:id', () => {
    it('should update region with auth', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Original' });

      const id = createResponse.body.id;

      // Update
      const response = await request(app)
        .put(`/api/mobile/v1/regions/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(200);

      expect(response.body.name).toBe('Updated');
    });

    it('should return 404 for non-existent region', async () => {
      await request(app)
        .put('/api/mobile/v1/regions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/mobile/v1/regions/:id', () => {
    it('should delete region with admin role', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'To Delete' });

      const id = createResponse.body.id;

      // Delete
      const response = await request(app)
        .delete(`/api/mobile/v1/regions/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toBe('Region deleted successfully');

      // Verify deletion
      await request(app)
        .get(`/api/mobile/v1/regions/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 for non-admin user', async () => {
      const createResponse = await request(app)
        .post('/api/mobile/v1/regions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'To Delete' });

      const id = createResponse.body.id;

      await request(app)
        .delete(`/api/mobile/v1/regions/${id}`)
        .set('Authorization', `Bearer ${authToken}`) // Regular user, not admin
        .expect(403);
    });
  });
});
