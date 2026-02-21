// src/components/EvidenceTable.js
import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Typography, Spin, Alert } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import moment from 'moment'; // For date formatting

const { Paragraph } = Typography;

function EvidenceTable({ pilotId }) {
  const [evidenceData, setEvidenceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentProof, setCurrentProof] = useState({});

  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        setLoading(true);
        setError(null);
        // Replace with your actual API endpoint to fetch evidence for a given pilotId
        // This would call your Lambda API Gateway endpoint
        const response = await fetch(`/api/evidence?pilotId=${pilotId}`); 
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Assuming data is an array of objects like:
        // { id: 'uuid', controlId: 'CC6.7', resourceId: 'bucket-name-1', status: 'COMPLIANT', timestamp: 'ISO_DATE', rawProof: '{...}' }
        setEvidenceData(data);
      } catch (e) {
        console.error("Failed to fetch evidence:", e);
        setError("Failed to load compliance evidence. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
    // Potentially refetch every X minutes for "live" view or on a button click
    const interval = setInterval(fetchEvidence, 300000); // Refetch every 5 minutes
    return () => clearInterval(interval); // Cleanup on unmount
  }, [pilotId]); // Rerun if pilotId changes

  const handleViewProof = (proof) => {
    setCurrentProof(JSON.parse(proof)); // Assuming proof is a JSON string
    setIsModalVisible(true);
  };

  const columns = [
    {
      title: 'Control ID',
      dataIndex: 'controlId',
      key: 'controlId',
      filters: [
        // Example filters, replace with actual control IDs
        { text: 'CC6.7 (S3 Encryption)', value: 'CC6.7' },
        { text: 'CC6.1 (MFA)', value: 'CC6.1' },
      ],
      onFilter: (value, record) => record.controlId.indexOf(value) === 0,
      sorter: (a, b) => a.controlId.localeCompare(b.controlId),
    },
    {
      title: 'Resource',
      dataIndex: 'resourceId',
      key: 'resourceId',
      sorter: (a, b) => a.resourceId.localeCompare(b.resourceId),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag
          icon={status === 'COMPLIANT' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={status === 'COMPLIANT' ? 'green' : 'red'}
        >
          {status.replace('_', ' ')}
        </Tag>
      ),
      filters: [
        { text: 'Compliant', value: 'COMPLIANT' },
        { text: 'Non-Compliant', value: 'NON_COMPLIANT' },
      ],
      onFilter: (value, record) => record.status.indexOf(value) === 0,
    },
    {
      title: 'Last Checked',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => moment(timestamp).fromNow(), // e.g., "5 minutes ago"
      sorter: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    },
    {
      title: 'Proof',
      key: 'proof',
      render: (_, record) => (
        <Button size="small" onClick={() => handleViewProof(record.rawProof)}>
          View JSON
        </Button>
      ),
    },
  ];

  if (loading) {
    return <Spin tip="Loading evidence..." />;
  }

  if (error) {
    return <Alert message="Error" description={error} type="error" showIcon />;
  }

  return (
    <>
      <Table 
        columns={columns} 
        dataSource={evidenceData} 
        rowKey="id" 
        pagination={{ pageSize: 10 }} // Add pagination
        title={() => (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>Compliance Evidence Dashboard</Typography.Title>
            <Button icon={<SyncOutlined />} onClick={() => fetchEvidence()} disabled={loading}>
              Refresh
            </Button>
          </div>
        )}
      />
      <Modal
        title="Raw Evidence Snapshot"
        visible={isModalVisible}
        onOk={() => setIsModalVisible(false)}
        onCancel={() => setIsModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Close
          </Button>,
        ]}
      >
        <Paragraph code copyable>
          <pre>{JSON.stringify(currentProof, null, 2)}</pre>
        </Paragraph>
      </Modal>
    </>
  );
}

export default EvidenceTable;
