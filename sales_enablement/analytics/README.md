# Analytics Submodule

## Purpose

The Analytics submodule provides comprehensive insights into sales performance, lead conversion, content effectiveness, and pipeline health. It enables data-driven decision making through dashboards, reports, and predictive analytics.

## Features

- **Sales Performance Tracking**: Monitor individual and team performance metrics
- **Lead Funnel Analytics**: Track conversion rates at each stage
- **Content Effectiveness**: Measure which materials drive engagement and conversions
- **Pipeline Forecasting**: Predict future revenue based on current pipeline
- **Custom Dashboards**: Build personalized views of key metrics
- **Automated Reporting**: Schedule and distribute performance reports

## Key Metrics

### Lead Metrics
- Lead volume by source
- Conversion rates by stage
- Average time in each stage
- Lead score distribution

### Sales Metrics
- Win/loss rates
- Average deal size
- Sales cycle length
- Revenue by tier/industry

### Content Metrics
- Most viewed/downloaded content
- Content engagement scores
- Content-to-lead attribution
- Content effectiveness by stage

## Data Model

Analytics events capture:
- Event type (page_view, lead_created, content_shared, etc.)
- User/lead ID
- Timestamp
- Associated entities (lead, content, opportunity)
- Custom properties

## API Endpoints

- `POST /api/analytics/track` - Track analytics event
- `GET /api/analytics/dashboard` - Get dashboard metrics
- `GET /api/analytics/leads` - Get lead analytics
- `GET /api/analytics/content` - Get content analytics
- `GET /api/analytics/forecast` - Get pipeline forecast
- `POST /api/analytics/report` - Generate custom report

## Usage Example

```typescript
import { AnalyticsController } from './analytics.controller';
import { sampleAnalyticsEvents } from './analytics.service';

// Track an event
await AnalyticsController.trackEvent({
  type: 'content_shared',
  userId: 'user-123',
  properties: {
    contentId: 'content-001',
    leadId: 'lead-456'
  }
});

// Get dashboard metrics
const metrics = await AnalyticsController.getDashboard();
```

## Integration

Analytics data is aggregated from:
- Leads module (funnel data)
- Content module (engagement data)
- CRM system (opportunity data)
- Marketing automation (campaign data)

## Testing

Run analytics tests with:
```bash
npm test analytics.test.ts
```
