# SecureBase Testing Suite
## Phase 4: Testing & Quality Assurance

This directory contains comprehensive automated tests for the SecureBase PaaS platform.

## Test Structure

```
tests/
├── integration/        # Integration tests (API, Database, Services)
├── e2e/               # End-to-end tests (Full user workflows)
├── performance/        # Performance and load tests
├── security/          # Security and penetration tests
└── accessibility/     # Accessibility compliance tests (WCAG AA)
```

## Running Tests

### Frontend Tests (React Portal)
```bash
cd phase3a-portal
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
npm run test:ui          # Run with UI
```

### Backend Tests (Python Lambda)
```bash
cd phase2-backend/functions
python -m pytest test_*.py -v
python -m pytest --cov=. --cov-report=html
```

### Integration Tests
```bash
cd tests/integration
export API_BASE_URL=https://api.securebase.dev
export TEST_API_KEY=your-test-key
python -m unittest discover -v
```

### E2E Tests
```bash
cd tests/e2e
npm run test:e2e
```

### Performance Tests
```bash
cd tests/performance
python test_load.py
```

### Security Tests
```bash
cd tests/security
python test_security.py
```

## Test Coverage Goals

- **Unit Tests**: >90% code coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: All critical user workflows
- **Performance**: <2s page load, <200ms API response
- **Security**: OWASP Top 10 compliance
- **Accessibility**: WCAG AA compliance

## CI/CD Integration

Tests are automatically run on:
- Every pull request
- Before deployment to staging
- Before deployment to production

## Test Data

Test data is located in:
- `phase2-backend/database/test-data/` - Database seed data
- `phase2-backend/functions/test-events/` - Lambda test events
- `tests/fixtures/` - Shared test fixtures

## Environment Variables

Required environment variables for testing:

```bash
# API Testing
export API_BASE_URL=https://api.securebase.dev
export TEST_API_KEY=sk_test_...
export TEST_CUSTOMER_ID=customer-test-123

# Database Testing
export DB_HOST=securebase-dev.cluster-xxx.us-east-1.rds.amazonaws.com
export DB_NAME=securebase
export DB_USER=test_user
export DB_PASSWORD=test-password

# Portal Testing
export VITE_API_BASE_URL=https://api.securebase.dev
export VITE_ENVIRONMENT=test
```

## Success Criteria

All tests must pass before production deployment:
- ✅ >90% unit test coverage
- ✅ All integration tests passing
- ✅ All E2E tests passing
- ✅ No critical security vulnerabilities
- ✅ WCAG AA accessibility compliance
- ✅ Performance benchmarks met

## Contributing

When adding new features:
1. Write unit tests first (TDD)
2. Add integration tests for API changes
3. Update E2E tests for UI changes
4. Run full test suite before committing
5. Ensure coverage doesn't decrease

## Documentation

- [Testing Strategy](../docs/TESTING_STRATEGY.md)
- [Test Plan](../docs/TEST_PLAN.md)
- [QA Checklist](../PRE_GOLIVE_TESTING_CHECKLIST.md)
