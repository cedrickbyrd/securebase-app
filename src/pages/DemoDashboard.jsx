import ComplianceHealth from '../components/ui/ComplianceHealth';

const DemoDashboard = () => {
  return (
    <div className="min-h-screen bg-slate-950 p-10">
      <div className="max-w-md mx-auto">
        {/* Pass the target score - maybe fetch this from your demo state */}
        <ComplianceHealth targetScore={94} />
      </div>
    </div>
  );
};
