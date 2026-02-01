/**
 * Content Unit Tests
 * 
 * Test suite for the content submodule including:
 * - Model validation and sample data
 * - Service business logic (recommendations, ROI, versioning)
 * - Controller HTTP handling
 * - Analytics tracking
 */

import { Content, sampleContent, getContentById, getContentByType, getMostViewedContent, getContentByTag } from '../content.model';
import { ContentService } from '../content.service';
import { ContentController } from '../content.controller';

describe('Content Model', () => {
  test('should have valid sample content', () => {
    expect(sampleContent).toBeDefined();
    expect(sampleContent.length).toBeGreaterThan(0);
    
    sampleContent.forEach(content => {
      expect(content.id).toBeDefined();
      expect(content.title).toBeDefined();
      expect(content.fileUrl).toContain('http');
      expect(content.viewCount).toBeGreaterThanOrEqual(0);
    });
  });

  test('should retrieve content by ID', () => {
    const content = getContentById('content-001');
    expect(content).toBeDefined();
    expect(content?.title).toContain('HealthCare Corp');
    expect(content?.type).toBe('case_study');
  });

  test('should filter content by type', () => {
    const caseStudies = getContentByType('case_study');
    expect(caseStudies.length).toBeGreaterThan(0);
    caseStudies.forEach(content => {
      expect(content.type).toBe('case_study');
    });
  });

  test('should get most viewed content', () => {
    const mostViewed = getMostViewedContent(2);
    expect(mostViewed.length).toBeLessThanOrEqual(2);
    
    // Verify sorting by view count
    if (mostViewed.length === 2) {
      expect(mostViewed[0].viewCount).toBeGreaterThanOrEqual(mostViewed[1].viewCount);
    }
  });

  test('should filter content by tag', () => {
    const hipaaContent = getContentByTag('hipaa');
    expect(hipaaContent.length).toBeGreaterThan(0);
    hipaaContent.forEach(content => {
      expect(content.tags).toContain('hipaa');
    });
  });
});

describe('Content Service', () => {
  test('should create new content', async () => {
    const contentData = {
      title: 'Test Whitepaper',
      description: 'Test description',
      type: 'whitepaper' as const,
      fileUrl: 'https://example.com/test.pdf',
      fileName: 'test.pdf',
      tags: ['test', 'sample']
    };

    const newContent = await ContentService.createContent(contentData);
    
    expect(newContent).toBeDefined();
    expect(newContent.id).toBeDefined();
    expect(newContent.title).toBe('Test Whitepaper');
    expect(newContent.status).toBe('draft');
    expect(newContent.viewCount).toBe(0);
  });

  test('should filter content by criteria', async () => {
    const publishedContent = await ContentService.getContent({
      status: 'published'
    });
    
    publishedContent.forEach(content => {
      expect(content.status).toBe('published');
    });
  });

  test('should filter content by tags', async () => {
    const taggedContent = await ContentService.getContent({
      tags: ['compliance']
    });
    
    taggedContent.forEach(content => {
      expect(content.tags).toContain('compliance');
    });
  });

  test('should track content access', async () => {
    const content = sampleContent[0];
    const initialViews = content.viewCount;
    
    await ContentService.trackAccess(content.id, 'user-123');
    
    expect(content.viewCount).toBe(initialViews + 1);
  });

  test('should track content download', async () => {
    const content = sampleContent[0];
    const initialDownloads = content.downloadCount;
    
    await ContentService.trackDownload(content.id, 'user-123');
    
    expect(content.downloadCount).toBe(initialDownloads + 1);
  });

  test('should recommend content for a lead', async () => {
    const recommendations = await ContentService.recommendContent(
      'lead-001',
      'Healthcare',
      'qualified'
    );
    
    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(5);
    
    // Should prioritize healthcare content
    const healthcareContent = recommendations.filter(c => c.industry === 'Healthcare');
    expect(healthcareContent.length).toBeGreaterThan(0);
  });

  test('should calculate content ROI', async () => {
    const roi = await ContentService.calculateContentROI('content-001');
    
    expect(roi).toBeDefined();
    expect(roi?.leadsGenerated).toBeGreaterThanOrEqual(0);
    expect(roi?.conversionsInfluenced).toBeGreaterThanOrEqual(0);
    expect(roi?.viewToLeadRate).toBeGreaterThanOrEqual(0);
  });

  test('should create content version', async () => {
    const content = sampleContent[1];
    const oldVersion = content.version;
    
    const updated = await ContentService.createVersion(
      content.id,
      'https://example.com/v2.pdf',
      'Updated with Q1 data',
      'user-123'
    );
    
    expect(updated).toBeDefined();
    expect(updated?.version).not.toBe(oldVersion);
    expect(updated?.versionHistory).toBeDefined();
    expect(updated?.versionHistory!.length).toBeGreaterThan(0);
  });
});

describe('Content Controller', () => {
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

  test('should handle create content request', async () => {
    mockReq.body = {
      title: 'New Case Study',
      description: 'Customer success',
      type: 'case_study',
      fileUrl: 'https://example.com/file.pdf',
    };

    await ContentController.createContent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          title: 'New Case Study',
        }),
      })
    );
  });

  test('should validate required fields', async () => {
    mockReq.body = {
      title: 'Incomplete',
      // Missing type and fileUrl
    };

    await ContentController.createContent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Missing required fields'),
      })
    );
  });

  test('should retrieve all content', async () => {
    await ContentController.getContent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
        count: expect.any(Number),
      })
    );
  });

  test('should filter content by type', async () => {
    mockReq.query.type = 'case_study';

    await ContentController.getContent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  test('should track content interaction', async () => {
    mockReq.params.id = 'content-001';
    mockReq.body = {
      action: 'view',
      userId: 'user-123'
    };

    await ContentController.trackInteraction(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('tracked'),
      })
    );
  });

  test('should get content recommendations', async () => {
    mockReq.params.leadId = 'lead-001';
    mockReq.query.industry = 'Healthcare';
    mockReq.query.stage = 'qualified';

    await ContentController.recommendContent(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.any(Array),
      })
    );
  });

  test('should get content analytics', async () => {
    mockReq.params.id = 'content-001';

    await ContentController.getContentAnalytics(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          leadsGenerated: expect.any(Number),
          conversionsInfluenced: expect.any(Number),
        }),
      })
    );
  });

  test('should return 404 for non-existent content', async () => {
    mockReq.params.id = 'non-existent';

    await ContentController.getContentById(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
  });
});
