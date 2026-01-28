# Analytics E2E Testing - Quick Start Guide

**Last Updated:** January 28, 2026  
**Status:** ✅ Ready

---

## 🚀 Run Tests in 30 Seconds

```bash
# 1. Make script executable
chmod +x run-analytics-e2e-tests.sh

# 2. Run all tests
./run-analytics-e2e-tests.sh dev

# Expected output: "All tests passed!"
```

---

## 📊 Test Results Location

```
test-results/
├── test_summary_YYYYMMDD_HHMMSS.txt    # Overall summary
├── unit_tests_YYYYMMDD_HHMMSS.log      # Detailed unit test logs
└── e2e_tests_YYYYMMDD_HHMMSS.log       # E2E test logs (if run)
```

---

## 🎯 What Gets Tested

### ✅ Local Tests (No AWS Required)
- Lambda function syntax validation
- Unit tests with mocked AWS services
- Terraform configuration validation (if Terraform installed)

### ✅ AWS Tests (Requires Deployment)
Set `RUN_E2E_TESTS=1` to enable:
- Lambda function invocation
- API endpoint validation
- DynamoDB table checks
- Performance benchmarks

---

## 🔧 Running Different Test Types

### Basic Tests (No AWS)
```bash
./run-analytics-e2e-tests.sh dev
```

### Full E2E Tests (With AWS)
```bash
# Requires: Deployed Analytics stack + AWS credentials
RUN_E2E_TESTS=1 ./run-analytics-e2e-tests.sh dev
```

### Unit Tests Only
```bash
cd tests/integration
pytest test_analytics_integration.py -v -p no:conftest
```

### Specific Test
```bash
pytest tests/integration/test_analytics_integration.py::test_get_usage_analytics_endpoint -v
```

---

## ✅ Success Criteria

Test suite PASSES when you see:

```
╔════════════════════════════════════════════════════════╗
║   Test Summary                                         ║
╚════════════════════════════════════════════════════════╝

Total Tests:    18
Passed:         18
Failed:         0

Success Rate:   100%

✓ All tests passed!
```

---

## 🐛 Troubleshooting

### "pytest not found"
```bash
pip install pytest pytest-mock boto3 requests
```

### "AWS credentials not configured"
```bash
aws configure
# Or for tests only:
export AWS_DEFAULT_REGION=us-east-1
```

### "No module named 'psycopg2'"
```bash
# Install OR run tests without conftest:
pytest tests/integration/test_analytics_integration.py -v -p no:conftest
```

---

## 📚 Full Documentation

For comprehensive testing guide, see:
- **[ANALYTICS_E2E_TESTING_GUIDE.md](./ANALYTICS_E2E_TESTING_GUIDE.md)** - Complete guide with all scenarios

---

## 🎯 Next Steps After Testing

1. ✅ Review test results in `test-results/` directory
2. ✅ Update `PHASE4_STATUS.md` to mark Analytics as tested
3. ✅ Deploy to staging: `bash scripts/deploy_analytics.sh staging`
4. ✅ Run E2E tests against staging
5. ✅ Deploy to production: `bash scripts/deploy_analytics.sh prod`
6. ✅ Monitor CloudWatch for 48 hours

---

**Quick Links:**
- Test Script: `./run-analytics-e2e-tests.sh`
- Test Results: `./test-results/`
- Full Guide: `./ANALYTICS_E2E_TESTING_GUIDE.md`
- Integration Tests: `./tests/integration/test_analytics_integration.py`
- E2E Tests: `./tests/e2e/test_analytics_e2e.py`
