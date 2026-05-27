import ComplianceTrend from '../components/ComplianceTrend';

export default {
  title: 'Compliance/ComplianceTrend',
  component: ComplianceTrend,
};

export const Default = {};

export const Empty = {
  parameters: {
    fetchScenario: 'compliance-empty',
  },
};

export const Error = {
  parameters: {
    fetchScenario: 'compliance-error',
  },
};
