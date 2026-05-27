import ExportEvidence from '../components/ExportEvidence';

export default {
  title: 'Compliance/ExportEvidence',
  component: ExportEvidence,
};

export const Default = {};

export const WithSOC2Framework = {
  args: {
    framework: 'SOC2',
  },
};
