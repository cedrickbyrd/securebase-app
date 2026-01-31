/**
 * Leads Controller
 * 
 * Handles HTTP requests for lead management operations.
 * Routes requests to the LeadsService and formats responses.
 * 
 * This controller would typically be integrated with Express.js, NestJS, or another
 * Node.js web framework.
 */

import { LeadsService } from './leads.service';
import { Lead, sampleLeads } from './leads.model';

/**
 * LeadsController
 * 
 * Exposes REST API endpoints for lead management:
 * - POST /leads - Create new lead
 * - GET /leads - List leads (with filters)
 * - GET /leads/:id - Get lead details
 * - PUT /leads/:id - Update lead
 * - DELETE /leads/:id - Archive lead
 */
export class LeadsController {
  /**
   * Create a new lead
   * 
   * POST /api/leads
   * 
   * Request body:
   * {
   *   "firstName": "John",
   *   "lastName": "Doe",
   *   "email": "john@example.com",
   *   "company": "Example Corp",
   *   "source": "website"
   * }
   * 
   * Response: 201 Created
   * {
   *   "success": true,
   *   "data": { ...lead },
   *   "message": "Lead created successfully"
   * }
   */
  static async createLead(req: any, res: any): Promise<void> {
    try {
      const leadData = req.body;
      
      // Validate required fields
      if (!leadData.email || !leadData.firstName || !leadData.lastName || !leadData.company) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: firstName, lastName, email, company'
        });
        return;
      }
      
      const newLead = await LeadsService.createLead(leadData);
      
      res.status(201).json({
        success: true,
        data: newLead,
        message: 'Lead created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create lead',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all leads with optional filtering
   * 
   * GET /api/leads?stage=qualified&minScore=60
   * 
   * Query parameters:
   * - stage: Filter by lifecycle stage
   * - source: Filter by lead source
   * - minScore: Minimum lead score
   * - assignedTo: Filter by assigned sales rep
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": [...leads],
   *   "count": 10
   * }
   */
  static async getLeads(req: any, res: any): Promise<void> {
    try {
      const { stage, source, minScore, assignedTo } = req.query;
      
      const filters: any = {};
      if (stage) filters.stage = stage;
      if (source) filters.source = source;
      if (minScore) filters.minScore = parseInt(minScore, 10);
      if (assignedTo) filters.assignedTo = assignedTo;
      
      const leads = await LeadsService.getLeads(filters);
      
      res.status(200).json({
        success: true,
        data: leads,
        count: leads.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve leads',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a single lead by ID
   * 
   * GET /api/leads/:id
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": { ...lead }
   * }
   */
  static async getLeadById(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      
      // TODO: Fetch from database
      const lead = sampleLeads.find(l => l.id === id);
      
      if (!lead) {
        res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        data: lead
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve lead',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update a lead
   * 
   * PUT /api/leads/:id
   * 
   * Request body: Partial lead data to update
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "data": { ...updatedLead },
   *   "message": "Lead updated successfully"
   * }
   */
  static async updateLead(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // TODO: Implement database update
      const lead = sampleLeads.find(l => l.id === id);
      
      if (!lead) {
        res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
        return;
      }
      
      Object.assign(lead, updates, { updatedAt: new Date() });
      
      res.status(200).json({
        success: true,
        data: lead,
        message: 'Lead updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update lead',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Archive (soft delete) a lead
   * 
   * DELETE /api/leads/:id
   * 
   * Response: 200 OK
   * {
   *   "success": true,
   *   "message": "Lead archived successfully"
   * }
   */
  static async archiveLead(req: any, res: any): Promise<void> {
    try {
      const { id } = req.params;
      
      // TODO: Implement soft delete in database
      const leadIndex = sampleLeads.findIndex(l => l.id === id);
      
      if (leadIndex === -1) {
        res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
        return;
      }
      
      // In a real implementation, we would set an 'archived' flag
      // rather than deleting the record
      sampleLeads.splice(leadIndex, 1);
      
      res.status(200).json({
        success: true,
        message: 'Lead archived successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to archive lead',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Example Express.js route setup:
 * 
 * import express from 'express';
 * import { LeadsController } from './leads.controller';
 * 
 * const router = express.Router();
 * 
 * router.post('/leads', LeadsController.createLead);
 * router.get('/leads', LeadsController.getLeads);
 * router.get('/leads/:id', LeadsController.getLeadById);
 * router.put('/leads/:id', LeadsController.updateLead);
 * router.delete('/leads/:id', LeadsController.archiveLead);
 * 
 * export default router;
 */
