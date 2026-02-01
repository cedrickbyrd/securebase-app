/**
 * Content Controller
 * 
 * Handles HTTP requests for content management operations.
 * Routes requests to ContentService and formats responses.
 */

import { ContentService } from './content.service';
import { Content, sampleContent } from './content.model';

/**
 * ContentController
 * 
 * Exposes REST API endpoints for content management:
 * - POST /content - Upload new content
 * - GET /content - List content (with filters)
 * - GET /content/:id - Get content details
 * - PUT /content/:id - Update content metadata
 * - DELETE /content/:id - Archive content
 * - POST /content/:id/track - Track access/download/share
 * - GET /content/recommend/:leadId - Get recommended content for lead
 */
export class ContentController {
  /**
   * Upload new content
   * 
   * POST /api/content
   * 
   * Request body:
   * {
   *   "title": "New Case Study",
   *   "description": "Customer success story",
   *   "type": "case_study",
   *   "fileUrl": "https://...",
   *   "tags": ["success", "enterprise"]
   * }
   * 
   * Response: 201 Created
   * {
   *   "success": true,
   *   "data": { ...content },
   *   "message": "Content created successfully"
   * }
   */
  static async createContent(req: any, res: any): Promise<void> {
    try {
      const contentData = req.body;
      
      // Validate required fields
      if (!contentData.title || !contentData.type || !contentData.fileUrl) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: title, type, fileUrl'
        });
        return;
      }
      
      const newContent = await ContentService.createContent(contentData);
      
      res.status(201).json({
        success: true,
        data: newContent,
        message: 'Content created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get content with optional filtering
   * 
   * GET /api/content?type=case_study&status=published&tags=hipaa,compliance
   * 
   * Query parameters:
   * - type: Filter by content type
   * - status: Filter by status (draft, review, published, archived)
   * - tags: Comma-separated list of tags
   * - category: Filter by category
   * - industry: Filter by target industry
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": [...content],
   *   "count": 10
   * }
   */
  static async getContent(req: any, res: any): Promise<void> {
    try {
      const { type, status, tags, category, industry } = req.query;
      
      const filters: any = {};
      if (type) filters.type = type;
      if (status) filters.status = status;
      if (tags) filters.tags = tags.split(',');
      if (category) filters.category = category;
      if (industry) filters.industry = industry;
      
      const content = await ContentService.getContent(filters);
      
      res.status(200).json({
        success: true,
        data: content,
        count: content.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get content by ID
   * 
   * GET /api/content/:id
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": { ...content }
   * }
   */
  static async getContentById(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      
      // TODO: Fetch from database
      const content = sampleContent.find(c => c.id === id);
      
      if (!content) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: content
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve content',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Track content interaction
   * 
   * POST /api/content/:id/track
   * 
   * Request body:
   * {
   *   "action": "view" | "download" | "share",
   *   "userId": "user-123",
   *   "leadId": "lead-456" (optional, for share action)
   * }
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "Action tracked successfully"
   * }
   */
  static async trackInteraction(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      const { action, userId, leadId } = req.body;
      
      if (!action || !userId) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: action, userId'
        });
        return;
      }
      
      switch (action) {
        case 'view':
          await ContentService.trackAccess(id, userId, leadId);
          break;
        case 'download':
          await ContentService.trackDownload(id, userId);
          break;
        case 'share':
          if (!leadId) {
            res.status(400).json({
              success: false,
              error: 'leadId is required for share action'
            });
            return;
          }
          await ContentService.trackShare(id, userId, leadId);
          break;
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid action. Must be: view, download, or share'
          });
          return;
      }
      
      res.status(200).json({
        success: true,
        message: `${action} tracked successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to track interaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get recommended content for a lead
   * 
   * GET /api/content/recommend/:leadId?industry=Healthcare&stage=qualified
   * 
   * Query parameters:
   * - industry: Lead's industry
   * - stage: Lead's current stage
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": [...recommendedContent],
   *   "count": 5
   * }
   */
  static async recommendContent(req: any, res: any): Promise<void> {
    try {
      const { leadId } = req.params;
      const { industry, stage } = req.query;
      
      const recommendations = await ContentService.recommendContent(
        leadId,
        industry,
        stage
      );
      
      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get content analytics/ROI
   * 
   * GET /api/content/:id/analytics
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": {
   *     "leadsGenerated": 23,
   *     "conversionsInfluenced": 7,
   *     "viewToLeadRate": 2.7,
   *     "viewToConversionRate": 0.8
   *   }
   * }
   */
  static async getContentAnalytics(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      
      const analytics = await ContentService.calculateContentROI(id);
      
      if (!analytics) {
        res.status(404).json({
          success: false,
          error: 'Content not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Example Express.js route setup:
 * 
 * import express from 'express';
 * import { ContentController } from './content.controller';
 * 
 * const router = express.Router();
 * 
 * router.post('/content', ContentController.createContent);
 * router.get('/content', ContentController.getContent);
 * router.get('/content/:id', ContentController.getContentById);
 * router.post('/content/:id/track', ContentController.trackInteraction);
 * router.get('/content/recommend/:leadId', ContentController.recommendContent);
 * router.get('/content/:id/analytics', ContentController.getContentAnalytics);
 * 
 * export default router;
 */
