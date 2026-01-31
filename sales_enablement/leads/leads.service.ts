/**
 * Leads Service
 * 
 * Contains business logic for lead management, including lead creation, qualification,
 * scoring, and lifecycle management.
 * 
 * This service layer sits between the controller (HTTP handling) and the model (data schema),
 * implementing core business rules and data validation.
 */

import { Lead, sampleLeads } from './leads.model';

/**
 * LeadsService
 * 
 * Provides methods for:
 * - Creating and updating leads
 * - Lead qualification and scoring
 * - Activity tracking
 * - Lead assignment and routing
 */
export class LeadsService {
  /**
   * Create a new lead
   * 
   * @param leadData - Partial lead data from input
   * @returns Promise<Lead> - The created lead with generated ID and timestamps
   * 
   * Example:
   * ```typescript
   * const newLead = await LeadsService.createLead({
   *   firstName: 'Alice',
   *   lastName: 'Brown',
   *   email: 'alice@example.com',
   *   company: 'Example Inc',
   *   source: 'website'
   * });
   * ```
   */
  static async createLead(leadData: Partial<Lead>): Promise<Lead> {
    // TODO: Implement database insertion
    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      firstName: leadData.firstName || '',
      lastName: leadData.lastName || '',
      email: leadData.email || '',
      company: leadData.company || '',
      score: 0,
      stage: 'new',
      source: leadData.source || 'other',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...leadData,
    };
    
    return newLead;
  }

  /**
   * Calculate lead score based on engagement and qualification criteria
   * 
   * Scoring factors:
   * - Has budget: +20 points
   * - Decision maker: +15 points
   * - Clear need defined: +10 points
   * - Short timeline (<3 months): +15 points
   * - Recent activity: +10 points
   * - Company size/industry match: +10 points
   * 
   * @param lead - Lead to score
   * @returns number - Score between 0-100
   */
  static calculateLeadScore(lead: Lead): number {
    let score = 0;
    
    // Budget scoring
    if (lead.budget && lead.budget > 100000) score += 20;
    else if (lead.budget && lead.budget > 50000) score += 15;
    else if (lead.budget) score += 10;
    
    // Authority scoring
    if (lead.authority === 'decision_maker') score += 15;
    else if (lead.authority === 'influencer') score += 10;
    
    // Need scoring
    if (lead.need && lead.need.length > 20) score += 10;
    
    // Timeline scoring
    if (lead.timeline?.includes('Q1') || lead.timeline?.includes('Q2')) score += 15;
    else if (lead.timeline) score += 5;
    
    // Recent activity
    if (lead.lastContactDate) {
      const daysSinceContact = Math.floor(
        (Date.now() - lead.lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceContact < 7) score += 10;
      else if (daysSinceContact < 30) score += 5;
    }
    
    // Industry match
    const highValueIndustries = ['Healthcare', 'Financial Services', 'Government'];
    if (lead.industry && highValueIndustries.includes(lead.industry)) {
      score += 10;
    }
    
    return Math.min(score, 100);
  }

  /**
   * Get all leads with optional filtering
   * 
   * @param filters - Optional filter criteria
   * @returns Promise<Lead[]> - Filtered list of leads
   */
  static async getLeads(filters?: {
    stage?: Lead['stage'];
    source?: Lead['source'];
    minScore?: number;
    assignedTo?: string;
  }): Promise<Lead[]> {
    // TODO: Implement database query with filters
    let leads = [...sampleLeads];
    
    if (filters?.stage) {
      leads = leads.filter(lead => lead.stage === filters.stage);
    }
    if (filters?.source) {
      leads = leads.filter(lead => lead.source === filters.source);
    }
    if (filters?.minScore !== undefined) {
      leads = leads.filter(lead => lead.score >= filters.minScore);
    }
    if (filters?.assignedTo) {
      leads = leads.filter(lead => lead.assignedTo === filters.assignedTo);
    }
    
    return leads;
  }

  /**
   * Update lead stage and automatically update timestamps
   * 
   * @param leadId - ID of the lead to update
   * @param newStage - New lifecycle stage
   * @returns Promise<Lead> - Updated lead
   */
  static async updateLeadStage(leadId: string, newStage: Lead['stage']): Promise<Lead | null> {
    // TODO: Implement database update
    const lead = sampleLeads.find(l => l.id === leadId);
    if (!lead) return null;
    
    lead.stage = newStage;
    lead.updatedAt = new Date();
    
    return lead;
  }

  /**
   * Assign lead to a sales representative
   * 
   * Assignment logic can be based on:
   * - Territory (geographic region)
   * - Industry specialization
   * - Round-robin distribution
   * - Lead score thresholds
   * 
   * @param leadId - ID of the lead
   * @param salesRepId - ID of the sales rep
   * @returns Promise<Lead> - Updated lead
   */
  static async assignLead(leadId: string, salesRepId: string): Promise<Lead | null> {
    // TODO: Implement assignment logic and database update
    const lead = sampleLeads.find(l => l.id === leadId);
    if (!lead) return null;
    
    lead.assignedTo = salesRepId;
    lead.updatedAt = new Date();
    
    return lead;
  }
}

/**
 * Example usage:
 * 
 * // Get high-value leads in proposal stage
 * const hotLeads = await LeadsService.getLeads({
 *   stage: 'proposal',
 *   minScore: 70
 * });
 * 
 * // Calculate score for a lead
 * const score = LeadsService.calculateLeadScore(sampleLeads[0]);
 * console.log(`Lead score: ${score}`);
 */
