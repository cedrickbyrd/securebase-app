/**
 * Leads Model
 * 
 * Defines the Lead data schema and provides sample lead data for testing and demonstration.
 * 
 * A Lead represents a potential customer who has expressed interest in SecureBase PaaS.
 * The model tracks contact information, qualification criteria (BANT), engagement metrics,
 * and lifecycle stage.
 */

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company: string;
  jobTitle?: string;
  industry?: string;
  
  // BANT Qualification
  budget?: number; // Annual budget in USD
  authority?: 'decision_maker' | 'influencer' | 'end_user' | 'unknown';
  need?: string; // Business need or pain point
  timeline?: string; // Expected purchase timeframe
  
  // Lead Scoring
  score: number; // 0-100 engagement score
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  source: 'website' | 'referral' | 'conference' | 'cold_outreach' | 'partner' | 'other';
  
  // Engagement
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  notes?: string;
  
  // Metadata
  assignedTo?: string; // Sales rep ID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sample Lead Data
 * 
 * These sample leads demonstrate different scenarios:
 * 1. High-value enterprise lead (healthcare)
 * 2. Mid-market fintech lead in qualification stage
 * 3. Early-stage government prospect
 */
export const sampleLeads: Lead[] = [
  {
    id: 'lead-001',
    firstName: 'Dr. Sarah',
    lastName: 'Johnson',
    email: 'sjohnson@healthcarecorp.com',
    phone: '+1-555-0123',
    company: 'HealthCare Corp',
    jobTitle: 'Chief Information Security Officer',
    industry: 'Healthcare',
    
    // BANT - Highly qualified
    budget: 500000,
    authority: 'decision_maker',
    need: 'HIPAA-compliant cloud infrastructure with automated compliance reporting',
    timeline: 'Q1 2026',
    
    score: 92,
    stage: 'proposal',
    source: 'conference',
    
    lastContactDate: new Date('2026-01-28'),
    nextFollowUpDate: new Date('2026-02-03'),
    notes: 'Very interested in HIPAA tier. Requested custom demo with compliance team. Budget approved. Evaluating us vs. AWS Control Tower.',
    
    assignedTo: 'sales-rep-john-doe',
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-28'),
  },
  {
    id: 'lead-002',
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'mchen@fintechstartup.io',
    phone: '+1-555-0456',
    company: 'FinTech Startup Inc',
    jobTitle: 'VP of Engineering',
    industry: 'Financial Services',
    
    // BANT - Medium qualification
    budget: 150000,
    authority: 'influencer',
    need: 'SOC2-compliant multi-tenant infrastructure for rapid scaling',
    timeline: 'Q2 2026',
    
    score: 68,
    stage: 'qualified',
    source: 'website',
    
    lastContactDate: new Date('2026-01-25'),
    nextFollowUpDate: new Date('2026-02-05'),
    notes: 'Completed initial demo. Interested in SOC2 compliance features. Needs CFO approval for budget. Technical evaluation in progress.',
    
    assignedTo: 'sales-rep-jane-smith',
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-25'),
  },
  {
    id: 'lead-003',
    firstName: 'Robert',
    lastName: 'Williams',
    email: 'robert.williams@govagency.gov',
    phone: '+1-555-0789',
    company: 'Federal Agency XYZ',
    jobTitle: 'IT Director',
    industry: 'Government',
    
    // BANT - Early stage
    budget: undefined, // Budget not yet disclosed
    authority: 'influencer',
    need: 'FedRAMP-compliant cloud platform for modernization initiative',
    timeline: 'FY 2027',
    
    score: 45,
    stage: 'contacted',
    source: 'referral',
    
    lastContactDate: new Date('2026-01-30'),
    nextFollowUpDate: new Date('2026-02-10'),
    notes: 'Initial discovery call completed. Long sales cycle expected. Requires FedRAMP authorization. Building relationship with procurement team.',
    
    assignedTo: 'sales-rep-john-doe',
    createdAt: new Date('2026-01-29'),
    updatedAt: new Date('2026-01-30'),
  },
];

/**
 * Helper function to get a lead by ID
 */
export function getLeadById(id: string): Lead | undefined {
  return sampleLeads.find(lead => lead.id === id);
}

/**
 * Helper function to get leads by stage
 */
export function getLeadsByStage(stage: Lead['stage']): Lead[] {
  return sampleLeads.filter(lead => lead.stage === stage);
}

/**
 * Helper function to calculate average lead score
 */
export function getAverageLeadScore(): number {
  const total = sampleLeads.reduce((sum, lead) => sum + lead.score, 0);
  return total / sampleLeads.length;
}
