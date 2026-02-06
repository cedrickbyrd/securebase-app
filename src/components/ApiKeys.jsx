import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/apiService';

const ApiKeys = () => {
  const [apiKeys, setApiKeys] = useState([]);

  useEffect(() => {
    // Fetch API keys from the service
    const fetchApiKeys = async () => {
      const keys = await apiService.getApiKeys();
      setApiKeys(keys);
    };
    
    fetchApiKeys();
  }, []);

  const handleCreate = async () => {
    const newKey = await apiService.createApiKey();
    setApiKeys(prevKeys => [...prevKeys, newKey]);
  };

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
  };

  const handleRevoke = async (keyId) => {
    await apiService.revokeApiKey(keyId);
    setApiKeys(prevKeys => prevKeys.filter(key => key.id !== keyId));
  };

  return (
    <div className="sb-ApiKeys">
      <div className="sb-ApiKeys__header">
        <h1>API Keys</h1>
        <button onClick={handleCreate}>Create API Key</button>
      </div>
      <ul className="sb-ApiKeys__list">
        {apiKeys.map(key => (
          <li key={key.id} className="sb-ApiKeys__item">
            <span>{key.value}</span>
            <button onClick={() => handleCopy(key.value)}>Copy</button>
            <button onClick={() => handleRevoke(key.id)}>Revoke</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ApiKeys;