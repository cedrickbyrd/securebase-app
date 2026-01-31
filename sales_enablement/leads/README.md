# Leads Submodule

## Purpose

The Leads submodule manages the complete lead lifecycle from initial capture through qualification and conversion. It provides tools for lead scoring, activity tracking, and funnel analytics.

## Features

- **Lead Capture**: Multiple ingestion points (web forms, API, manual entry)
- **Lead Qualification**: Automated scoring based on engagement and fit criteria
- **Activity Tracking**: Log all interactions, emails, calls, and meetings
- **Funnel Management**: Track leads through awareness → interest → decision → action
- **Assignment Rules**: Automatic lead routing based on territory, industry, or size

## Data Model

The Lead model includes:
- Contact information (name, email, phone, company)
- Qualification data (budget, authority, need, timeline - BANT)
- Lead source and campaign attribution
- Engagement score and lifecycle stage
- Activity history and notes

## API Endpoints

- `POST /api/leads` - Create new lead
- `GET /api/leads` - List all leads (with filters)
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead information
- `DELETE /api/leads/:id` - Archive lead
- `POST /api/leads/:id/activities` - Log new activity

## Usage Example

```typescript
import { LeadsController } from './leads.controller';
import { sampleLeads } from './leads.model';

// Create a new lead
const newLead = await LeadsController.createLead({
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  company: 'Acme Corp',
  source: 'website'
});

// Get sample data
console.log(sampleLeads);
```

## Testing

Run lead tests with:
```bash
npm test leads.test.ts
```
