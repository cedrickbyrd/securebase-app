/**
 * Leads Unit Tests
 * 
 * Comprehensive test suite for the leads submodule including:
 * - Model validation and sample data
 * - Service business logic
 * - Controller HTTP handling
 * - Lead scoring algorithm
 */

import { Lead, sampleLeads, getLeadById, getLeadsByStage, getAverageLeadScore } from '../leads.model';
import { LeadsService } from '../leads.service';
import { LeadsController } from '../leads.controller';

describe('Leads Model', () => {
  test('should have valid sample leads', () => {
    expect(sampleLeads).toBeDefined();
    expect(sampleLeads.length).toBeGreaterThan(0);
    
    sampleLeads.forEach(lead => {
      expect(lead.id).toBeDefined();
      expect(lead.email).toContain('@');
      expect(lead.company).toBeDefined();
      expect(lead.score).toBeGreaterThanOrEqual(0);
      expect(lead.score).toBeLessThanOrEqual(100);
    });
  });

  test('should retrieve lead by ID', () => {
    const lead = getLeadById('lead-001');
    expect(lead).toBeDefined();
    expect(lead?.firstName).toBe('Dr. Sarah');
    expect(lead?.company).toBe('HealthCare Corp');
  });

  test('should filter leads by stage', () => {
    const proposalLeads = getLeadsByStage('proposal');
    expect(proposalLeads.length).toBeGreaterThan(0);
    proposalLeads.forEach(lead => {
      expect(lead.stage).toBe('proposal');
    });
  });

  test('should calculate average lead score', () => {
    const avgScore = getAverageLeadScore();
    expect(avgScore).toBeGreaterThan(0);
    expect(avgScore).toBeLessThanOrEqual(100);
  });
});

describe('Leads Service', () => {
  test('should create a new lead', async () => {
    const leadData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      company: 'Test Corp',
      source: 'website' as const,
    };

    const newLead = await LeadsService.createLead(leadData);
    
    expect(newLead).toBeDefined();
    expect(newLead.id).toBeDefined();
    expect(newLead.firstName).toBe('Test');
    expect(newLead.email).toBe('test@example.com');
    expect(newLead.stage).toBe('new');
  });

  test('should calculate lead score correctly', () => {
    // High-value lead with all criteria met
    const highValueLead = sampleLeads.find(l => l.id === 'lead-001');
    expect(highValueLead).toBeDefined();
    
    if (highValueLead) {
      const score = LeadsService.calculateLeadScore(highValueLead);
      expect(score).toBeGreaterThan(70); // Should be high score
    }
  });

  test('should filter leads by criteria', async () => {
    const qualifiedLeads = await LeadsService.getLeads({
      stage: 'qualified',
    });
    
    qualifiedLeads.forEach(lead => {
      expect(lead.stage).toBe('qualified');
    });
  });

  test('should filter leads by minimum score', async () => {
    const highScoreLeads = await LeadsService.getLeads({
      minScore: 60,
    });
    
    highScoreLeads.forEach(lead => {
      expect(lead.score).toBeGreaterThanOrEqual(60);
    });
  });

  test('should update lead stage', async () => {
    const lead = await LeadsService.updateLeadStage('lead-001', 'negotiation');
    expect(lead).toBeDefined();
    expect(lead?.stage).toBe('negotiation');
  });

  test('should assign lead to sales rep', async () => {
    const lead = await LeadsService.assignLead('lead-002', 'rep-123');
    expect(lead).toBeDefined();
    expect(lead?.assignedTo).toBe('rep-123');
  });
});

describe('Leads Controller', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('should handle create lead request', async () => {
    mockReq.body = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      company: 'Example Inc',
      source: 'website',
    };

    await LeadsController.createLead(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          email: 'jane@example.com',
        }),
      })
    );
  });

  test('should validate required fields', async () => {
    mockReq.body = {
      firstName: 'Jane',
      // Missing required fields
    };

    await LeadsController.createLead(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Missing required fields'),
      })
    );
  });

  test('should retrieve all leads', async () => {
    await LeadsController.getLeads(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        count: expect.any(Number),
      })
    );
  });

  test('should retrieve lead by ID', async () => {
    mockReq.params.id = 'lead-001';

    await LeadsController.getLeadById(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'lead-001',
        }),
      })
    );
  });

  test('should return 404 for non-existent lead', async () => {
    mockReq.params.id = 'non-existent-id';

    await LeadsController.getLeadById(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Lead not found',
      })
    );
  });
});

/**
 * Test Coverage Summary:
 * - Model: Data structure validation, helper functions
 * - Service: Business logic, lead scoring, filtering
 * - Controller: HTTP handling, request validation, response formatting
 * 
 * To run these tests:
 * npm test leads.test.ts
 * 
 * For coverage report:
 * npm test -- --coverage leads.test.ts
 */
