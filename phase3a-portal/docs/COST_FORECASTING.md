# Cost Forecasting Component

## Overview

The **Cost Forecasting Component** is a sophisticated feature within the SecureBase Phase 3a Portal that uses historical AWS cost data combined with advanced time-series analysis and machine learning to predict future costs with configurable confidence intervals.

## Features

### 1. **Intelligent Cost Prediction**
- Analyzes 12+ months of historical cost data
- Applies time-series forecasting algorithms
- Detects and accounts for seasonal patterns
- Identifies anomalies and unusual cost spikes
- Generates forecasts with adjustable confidence levels (65%, 80%, 95%)

### 2. **Flexible Forecast Periods**
- **3 months**: Short-term planning and quick adjustments
- **6 months**: Medium-term budgeting
- **12 months**: Annual planning
- **24 months**: Long-term strategic planning

### 3. **Service-Level Breakdown**
- Forecasted costs by AWS service (EC2, RDS, S3, Lambda, etc.)
- Visualizations showing cost distribution
- Month-by-month detailed tables with:
  - Individual service costs
  - Percentage contribution to total
  - Trend indicators

### 4. **Budget Alerts & Controls**
- Set monthly budget limits
- Automatic alerts when spending reaches 80% of budget
- Real-time notifications for budget overruns
- Alert configuration management

### 5. **Anomaly Detection**
- Identifies unusual cost patterns
- Explains potential reasons for anomalies
- Flags events like:
  - Holiday traffic spikes
  - Unexpected resource provisioning
  - Cost optimization opportunities
  - Billing adjustments

### 6. **Export & Reporting**
- Export forecasts as:
  - **PDF**: Formatted reports suitable for presentations and archives
  - **CSV**: Data for spreadsheet analysis
  - **JSON**: Machine-readable format for integrations
- Download historical cost data
- Generate compliance-ready reports

### 7. **Confidence Levels**
- **Low (65% CI)**: Conservative estimates with wider range
- **Medium (80% CI)**: Balanced predictions (default)
- **High (95% CI)**: Optimistic estimates with narrow range

## Component Architecture

### File Structure
```
phase3a-portal/
├── src/
│   ├── components/
│   │   └── Forecasting.jsx          # Main forecasting component
│   ├── services/
│   │   └── apiService.js            # API integration methods
│   ├── utils/
│   │   └── formatters.js            # Currency, date, percentage formatters
│   └── App.jsx                      # Router integration
└── docs/
    └── COST_FORECASTING.md          # This file
```

### Key Dependencies
- **React 19.2.0**: UI framework with hooks
- **Recharts**: Charting library for visualizations
- **Lucide React**: Icon library for UI elements
- **Tailwind CSS v4**: Utility-first CSS framework
- **Axios**: HTTP client for API calls

## Usage

### Basic Integration

The Forecasting component is already integrated into the app router at `/forecast`:

```jsx
import { Forecasting } from './components/Forecasting';

// In your routing configuration:
<Route
  path="/forecast"
  element={
    <ProtectedRoute>
      <Forecasting />
    </ProtectedRoute>
  }
/>
```

### Accessing the Component

1. Navigate to the **Cost Forecast** link in the main navigation menu
2. Select your desired forecast period (3, 6, 12, or 24 months)
3. Choose confidence level (Low, Medium, High)
4. Review the forecast charts and breakdowns
5. Set budget alerts as needed
6. Export reports as required

## API Integration

### Cost Forecasting Endpoints

The component communicates with the backend through the following API methods in `apiService.js`:

#### Generate Cost Forecast
```javascript
await apiService.generateCostForecast({
  months: 12,              // Number of months to forecast
  confidence_level: 'medium' // 'low' | 'medium' | 'high'
})
```

#### Get Cost Optimization Recommendations
```javascript
await apiService.getCostOptimizationRecommendations({
  service_type: 'ec2',   // Optional: filter by service
  priority: 'high'       // Optional: filter by priority
})
```

#### Get Resource Utilization
```javascript
await apiService.getResourceUtilization({
  timeframe: '30days'    // Optional: timeframe for analysis
})
```

#### Set Budget Alert
```javascript
await apiService.setBudgetAlert({
  monthly_limit: 5000,   // Monthly budget in dollars
  alert_threshold: 0.8   // Alert at 80% of budget
})
```

#### Get Budget Alerts
```javascript
await apiService.getBudgetAlerts()
```

#### Export Cost Forecast
```javascript
await apiService.exportCostForecast('pdf') // 'pdf' | 'csv' | 'json'
```

## Data Visualization

### 1. **Cost Forecast Chart**
- **Type**: Area chart with confidence bounds
- **Data Series**:
  - Forecast value (primary line)
  - Upper bound (95th percentile)
  - Lower bound (5th percentile)
- **Interactivity**: Hover tooltips show exact values

### 2. **Service Breakdown**
- **Bar Chart**: Projected costs by service
- **Table**: Detailed breakdown with percentages
- **Sorting**: Click column headers to sort

### 3. **Key Metrics Cards**
- Total projected cost for forecast period
- Average monthly cost
- Trend indicator (↑ Increasing, ↓ Decreasing, → Stable)
- Number of detected anomalies

### 4. **Anomalies Alert**
- Highlights unusual patterns
- Provides contextual explanations
- Shows deviation percentage from trend

## Configuration & Customization

### Budget Alert Settings
```javascript
{
  monthly_limit: 5000,           // Dollar limit
  alert_threshold: 0.8,          // Alert at 80% of limit
  notification_channels: ['email', 'in-app'],
  escalation_contacts: [...]
}
```

### Forecast Accuracy Metrics
- **Accuracy Score**: 0-1 scale (higher is better)
  - 0.87+ : Excellent (historical data patterns are consistent)
  - 0.75-0.87: Good (reliable predictions)
  - Below 0.75: Fair (use with caution, consider recent changes)

### Supported Services
- **Compute**: EC2, Lambda, Batch, ECS, EKS
- **Database**: RDS, DynamoDB, Redshift, ElastiCache
- **Storage**: S3, EBS, Glacier, FSx
- **Networking**: CloudFront, ALB, NLB
- **Analytics**: Athena, Kinesis, EMR
- **Other**: CloudWatch, Config, Organizations

## Performance Considerations

### Data Processing
- Historical analysis: Up to 36 months
- Forecast generation: < 5 seconds for typical datasets
- API response time: ~2-3 seconds

### Optimization Tips
1. **Caching**: Forecasts are cached for 24 hours
2. **Batch Operations**: Group multiple exports
3. **Filtering**: Use service filters to reduce data volume
4. **Pagination**: Large datasets are paginated (100 items/page)

## Security

### Data Protection
- All API calls use authenticated Bearer tokens
- Sensitive cost data is encrypted in transit (HTTPS)
- Session tokens are stored securely in localStorage
- Automatic logout on 401 Unauthorized responses

### Role-Based Access
- Cost forecasting available to all authenticated users
- Budget alert management per organization
- Compliance reports require compliance_viewer role

## Troubleshooting

### Common Issues

#### 1. **"No data available for forecast"**
- **Cause**: Less than 30 days of cost history
- **Solution**: Wait for sufficient historical data or contact support

#### 2. **"Accuracy below expected levels"**
- **Cause**: Recent infrastructure changes or significant cost spikes
- **Solution**: Use forecast with caution; check for recent changes

#### 3. **Budget alerts not triggering**
- **Cause**: Incorrect threshold configuration
- **Solution**: Verify monthly_limit and alert_threshold values

#### 4. **Export fails with network error**
- **Cause**: Browser cache or connection issue
- **Solution**: Clear cache and retry; check internet connection

### Debug Mode
Enable debug logging:
```javascript
// In browser console
localStorage.setItem('DEBUG_FORECAST', 'true')
```

## Best Practices

### 1. **Regular Monitoring**
- Check forecasts weekly
- Set up budget alerts for all environments
- Review anomalies for optimization opportunities

### 2. **Alert Configuration**
- Set threshold at 80% for proactive notification
- Configure escalation for multiple stakeholders
- Use low confidence level for conservative budgeting

### 3. **Export & Archival**
- Export monthly forecasts for audit trails
- Archive critical forecast reports
- Include forecasts in budget reviews

### 4. **Analysis & Action**
- Compare actual vs. forecast monthly
- Investigate anomalies immediately
- Act on optimization recommendations
- Adjust future budgets based on trends

## Advanced Features

### Scenario Analysis (Future)
- "What-if" cost modeling
- Impact analysis for infrastructure changes
- Cost optimization simulations

### Integration with CI/CD (Future)
- Automatic cost gates in deployment pipelines
- Cost-based auto-scaling recommendations
- Infrastructure-as-Code cost estimation

### ML Model Updates (Future)
- Custom ML models per organization
- Incorporation of external cost factors
- Advanced seasonality detection

## Support & Documentation

### Related Documentation
- [API Service Documentation](../docs/API_SERVICE.md)
- [Formatters Utility Documentation](../docs/FORMATTERS.md)
- [Cost Optimization Guide](./COST_OPTIMIZATION.md)

### Getting Help
- Email: support@securebase.dev
- Documentation: https://docs.securebase.dev
- Status: https://status.securebase.dev

## Version History

### v1.0.0 (Current)
- Initial release with core forecasting features
- Support for 3, 6, 12, 24-month forecasts
- Service-level cost breakdown
- Budget alerts and anomaly detection
- Export to PDF, CSV, JSON
- Confidence interval support

### Planned v1.1.0
- Enhanced anomaly detection
- Cost optimization recommendations
- Integration with AWS Cost Explorer
- Custom alert rules

### Planned v2.0.0
- Advanced ML models
- Scenario analysis
- Real-time cost alerts
- Integration with billing systems

## Contributing

To contribute improvements:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request with test coverage

## License

SecureBase Portal is proprietary software. All rights reserved.

---

**Last Updated**: 2024
**Maintained By**: SecureBase Team
