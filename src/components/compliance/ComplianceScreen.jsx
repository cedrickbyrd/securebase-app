import React from 'react';
import { Progress, Table, Tag } from 'antd';

export default function ComplianceScreen({ report, loading }) {
  if (loading) return <div className="p-12 text-center text-slate-500">Loading vault data...</div>;
  if (!report) return <div className="p-12 text-center text-red-500">No report data found.</div>;

  // FIX: Accessing the verified property names
  const score = report.score || 0;
  const metadata = report.audit_metadata || {};
  const controls = report.controls || [];

  const columns = [
    { title: 'Control ID', dataIndex: 'id', key: 'id', width: 120 },
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <Tag color={status === 'passed' ? 'green' : status === 'warning' ? 'orange' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col items-center">
          <div className="text-xs font-bold uppercase text-slate-400 mb-4">Readiness Score</div>
          <Progress type="dashboard" percent={score} strokeColor="#2563eb" />
        </div>
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-400 mb-4">Audit Metadata</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[10px] text-slate-400 uppercase">Framework</label><div className="font-bold">{metadata.standard}</div></div>
            <div><label className="block text-[10px] text-slate-400 uppercase">Status</label><div className="font-bold text-blue-600">{metadata.status}</div></div>
            <div><label className="block text-[10px] text-slate-400 uppercase">Run ID</label><div className="font-mono text-xs">{metadata.run_id}</div></div>
            <div><label className="block text-[10px] text-slate-400 uppercase">Generated</label><div className="text-xs text-slate-500">{new Date(metadata.generated_at).toLocaleString()}</div></div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table dataSource={controls} columns={columns} pagination={false} rowKey="id" />
      </div>
    </div>
  );
}
