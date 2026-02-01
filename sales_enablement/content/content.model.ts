/**
 * Content Model
 * 
 * Defines the Content data schema for sales collateral and marketing materials.
 * Tracks content metadata, versioning, analytics, and access permissions.
 */

export interface Content {
  id: string;
  title: string;
  description: string;
  type: 'case_study' | 'presentation' | 'whitepaper' | 'video' | 'datasheet' | 'template' | 'other';
  
  // File information
  fileUrl: string;
  fileName: string;
  fileSize: number; // in bytes
  mimeType: string;
  
  // Versioning
  version: string;
  versionHistory?: ContentVersion[];
  
  // Organization
  tags: string[];
  category: string;
  industry?: string; // Target industry
  
  // Status and permissions
  status: 'draft' | 'review' | 'published' | 'archived';
  visibility: 'public' | 'internal' | 'restricted';
  createdBy: string;
  lastModifiedBy: string;
  
  // Analytics
  viewCount: number;
  downloadCount: number;
  shareCount: number;
  averageViewDuration?: number; // in seconds, for videos
  
  // Effectiveness metrics
  leadsGenerated?: number; // Leads attributed to this content
  conversionsInfluenced?: number; // Deals where this content was shared
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface ContentVersion {
  version: string;
  fileUrl: string;
  changedBy: string;
  changedAt: Date;
  changeNotes: string;
}

/**
 * Sample Content Data
 * 
 * These samples demonstrate different content types commonly used in sales:
 * 1. Healthcare case study (high-performing content)
 * 2. Product presentation deck
 * 3. Compliance whitepaper
 */
export const sampleContent: Content[] = [
  {
    id: 'content-001',
    title: 'HealthCare Corp Case Study: HIPAA Compliance Success',
    description: 'How HealthCare Corp achieved HIPAA compliance in 30 days using SecureBase PaaS, reducing audit preparation time by 80% and saving $200K annually.',
    type: 'case_study',
    
    fileUrl: 'https://cdn.securebase.io/content/healthcare-corp-case-study-v2.pdf',
    fileName: 'healthcare-corp-case-study-v2.pdf',
    fileSize: 2457600, // 2.4 MB
    mimeType: 'application/pdf',
    
    version: '2.0',
    versionHistory: [
      {
        version: '1.0',
        fileUrl: 'https://cdn.securebase.io/content/healthcare-corp-case-study-v1.pdf',
        changedBy: 'marketing-team',
        changedAt: new Date('2025-11-15'),
        changeNotes: 'Initial version with preliminary results',
      },
      {
        version: '2.0',
        fileUrl: 'https://cdn.securebase.io/content/healthcare-corp-case-study-v2.pdf',
        changedBy: 'marketing-team',
        changedAt: new Date('2026-01-10'),
        changeNotes: 'Updated with full year results and ROI analysis',
      },
    ],
    
    tags: ['hipaa', 'compliance', 'healthcare', 'case-study', 'roi'],
    category: 'Customer Success',
    industry: 'Healthcare',
    
    status: 'published',
    visibility: 'public',
    createdBy: 'user-marketing-sarah',
    lastModifiedBy: 'user-marketing-sarah',
    
    viewCount: 847,
    downloadCount: 312,
    shareCount: 156,
    
    leadsGenerated: 23,
    conversionsInfluenced: 7,
    
    createdAt: new Date('2025-11-15'),
    updatedAt: new Date('2026-01-10'),
    publishedAt: new Date('2025-11-20'),
  },
  {
    id: 'content-002',
    title: 'SecureBase PaaS - Product Overview Deck',
    description: 'Comprehensive 25-slide presentation covering SecureBase features, architecture, compliance tiers, pricing, and competitive advantages. Perfect for initial prospect meetings.',
    type: 'presentation',
    
    fileUrl: 'https://cdn.securebase.io/content/product-overview-q1-2026.pptx',
    fileName: 'securebase-product-overview-q1-2026.pptx',
    fileSize: 15728640, // 15 MB
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    version: '3.2',
    versionHistory: [
      {
        version: '3.1',
        fileUrl: 'https://cdn.securebase.io/content/product-overview-q4-2025.pptx',
        changedBy: 'user-sales-john',
        changedAt: new Date('2025-12-01'),
        changeNotes: 'Q4 2025 updates with new pricing',
      },
      {
        version: '3.2',
        fileUrl: 'https://cdn.securebase.io/content/product-overview-q1-2026.pptx',
        changedBy: 'user-sales-john',
        changedAt: new Date('2026-01-05'),
        changeNotes: 'Added Phase 4 features and customer testimonials',
      },
    ],
    
    tags: ['product', 'overview', 'presentation', 'sales-deck', 'demo'],
    category: 'Product Marketing',
    
    status: 'published',
    visibility: 'internal',
    createdBy: 'user-sales-john',
    lastModifiedBy: 'user-sales-john',
    
    viewCount: 1243,
    downloadCount: 456,
    shareCount: 289,
    
    leadsGenerated: 45,
    conversionsInfluenced: 18,
    
    createdAt: new Date('2025-09-01'),
    updatedAt: new Date('2026-01-05'),
    publishedAt: new Date('2025-09-05'),
  },
  {
    id: 'content-003',
    title: 'Multi-Tenant Security Architecture Whitepaper',
    description: 'Technical deep-dive into SecureBase\'s multi-tenant isolation, encryption, and compliance automation. Covers HIPAA, SOC2, FedRAMP, and custom security controls.',
    type: 'whitepaper',
    
    fileUrl: 'https://cdn.securebase.io/content/security-architecture-whitepaper.pdf',
    fileName: 'securebase-security-architecture-whitepaper.pdf',
    fileSize: 4194304, // 4 MB
    mimeType: 'application/pdf',
    
    version: '1.3',
    
    tags: ['security', 'architecture', 'technical', 'compliance', 'whitepaper', 'multi-tenant'],
    category: 'Technical Documentation',
    
    status: 'published',
    visibility: 'public',
    createdBy: 'user-engineering-alice',
    lastModifiedBy: 'user-security-bob',
    
    viewCount: 623,
    downloadCount: 401,
    shareCount: 89,
    
    leadsGenerated: 31,
    conversionsInfluenced: 12,
    
    createdAt: new Date('2025-08-20'),
    updatedAt: new Date('2025-12-15'),
    publishedAt: new Date('2025-09-01'),
  },
];

/**
 * Helper function to get content by ID
 */
export function getContentById(id: string): Content | undefined {
  return sampleContent.find(content => content.id === id);
}

/**
 * Helper function to get content by type
 */
export function getContentByType(type: Content['type']): Content[] {
  return sampleContent.filter(content => content.type === type);
}

/**
 * Helper function to get most viewed content
 */
export function getMostViewedContent(limit: number = 5): Content[] {
  return [...sampleContent]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
}

/**
 * Helper function to get content by tag
 */
export function getContentByTag(tag: string): Content[] {
  return sampleContent.filter(content => 
    content.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
}
