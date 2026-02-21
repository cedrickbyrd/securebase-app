const columns = [
  { title: 'Control ID', dataIndex: 'controlId', key: 'controlId' }, // e.g., CC7.1
  { title: 'Asset', dataIndex: 'resourceName', key: 'asset' },      // e.g., prod-db-backups
  { title: 'Last Check', dataIndex: 'timestamp', key: 'time' },    // e.g., 2 hours ago
  { 
    title: 'Status', 
    dataIndex: 'status', 
    render: (status) => <Badge status={status === 'PASS' ? 'success' : 'error'} /> 
  },
  { title: 'Proof', render: () => <Button size="small">View JSON Snapshot</Button> }
];
