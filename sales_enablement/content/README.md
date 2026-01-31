# Content Submodule

## Purpose

The Content submodule provides a centralized repository for all sales collateral, presentations, case studies, whitepapers, and marketing materials. It enables content versioning, access tracking, and analytics to measure content effectiveness.

## Features

- **Content Library**: Organized repository of all sales materials
- **Version Control**: Track changes and maintain content history
- **Access Tracking**: Monitor who viewed which content and when
- **Effectiveness Analytics**: Measure content engagement and conversion impact
- **Smart Recommendations**: Suggest relevant content based on lead profile
- **Collaborative Editing**: Multi-user content creation with approval workflows

## Content Types

- **Case Studies**: Customer success stories and testimonials
- **Presentations**: Sales decks and demo materials
- **Whitepapers**: Technical documentation and thought leadership
- **Videos**: Product demos, customer testimonials, training
- **Datasheets**: Product specifications and feature comparisons
- **Templates**: Proposal templates, contract templates

## Data Model

The Content model includes:
- Title, description, and content type
- Version history and metadata
- Tags and categories for organization
- Access permissions and sharing settings
- Analytics: views, downloads, shares
- Associated leads and opportunities

## API Endpoints

- `POST /api/content` - Upload new content
- `GET /api/content` - List all content (with filters)
- `GET /api/content/:id` - Get content details
- `PUT /api/content/:id` - Update content metadata
- `DELETE /api/content/:id` - Archive content
- `GET /api/content/:id/analytics` - Get content performance metrics

## Usage Example

```typescript
import { ContentController } from './content.controller';
import { sampleContent } from './content.model';

// Get all case studies
const caseStudies = await ContentController.getContent({
  type: 'case_study'
});

// Track content access
await ContentController.trackAccess('content-001', 'lead-123');

// View sample data
console.log(sampleContent);
```

## Content Lifecycle

1. **Draft**: Content being created or edited
2. **Review**: Awaiting approval from marketing/legal
3. **Published**: Available for sales team use
4. **Archived**: Outdated content retained for reference

## Testing

Run content tests with:
```bash
npm test content.test.ts
```
