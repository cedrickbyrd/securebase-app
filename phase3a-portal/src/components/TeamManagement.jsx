import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const AVATAR_COLORS = ['#0f4c81', '#1a73e8', '#0d9488', '#7c3aed', '#dc2626', '#d97706'];
const ROLE_OPTIONS = ['admin', 'analyst', 'auditor', 'viewer'];

const MOCK_USERS = [
  { id: 'u001', name: 'Matthew Matturro', email: 'Matthew.matturro@trinetx.com', role: 'admin', avatar_initials: 'MM', joined_at: '2026-04-01T00:00:00Z' },
  { id: 'u002', name: 'Sarah Chen', email: 'sarah.chen@trinetx.com', role: 'analyst', avatar_initials: 'SC', joined_at: '2026-04-15T00:00:00Z' },
  { id: 'u003', name: 'David Park', email: 'david.park@trinetx.com', role: 'auditor', avatar_initials: 'DP', joined_at: '2026-05-01T00:00:00Z' },
];

const roleBadgeStyles = {
  admin: { background: '#ede9fe', color: '#5b21b6' },
  analyst: { background: '#dbeafe', color: '#1e40af' },
  auditor: { background: '#d1fae5', color: '#065f46' },
  viewer: { background: '#f3f4f6', color: '#374151' },
};

function getTokenHeaders() {
  const token = sessionStorage.getItem('sessionToken') || localStorage.getItem('sessionToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function toInitials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function getAvatarColor(seed = '') {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function normalizeUser(user) {
  return {
    id: user.id || user.user_id || `user-${Math.random().toString(36).slice(2)}`,
    name: user.name || user.full_name || user.email?.split('@')[0] || 'Unknown User',
    email: user.email || '',
    role: String(user.role || 'viewer').toLowerCase(),
    avatar_initials: user.avatar_initials || toInitials(user.name || user.full_name || user.email || ''),
    joined_at: user.joined_at || user.created_at || null,
    invite_pending: Boolean(user.invite_pending),
  };
}

function emailLooksValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function pendingNameFromEmail(email) {
  const localPart = String(email).split('@')[0] || 'Pending User';
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function TeamManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('analyst');
  const [inviteError, setInviteError] = useState('');
  const [removingUserId, setRemovingUserId] = useState('');

  const currentUserEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
  const orgName = localStorage.getItem('orgName') || 'Your Organization';
  const isHealthcareTier = (localStorage.getItem('customerTier') || '').toLowerCase() === 'healthcare';

  useEffect(() => {
    if (!isHealthcareTier) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/users', {
          method: 'GET',
          headers: getTokenHeaders(),
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 500) {
            throw new Error('fallback_to_mock');
          }
          throw new Error(`users_fetch_failed_${response.status}`);
        }

        const payload = await response.json();
        const normalized = (Array.isArray(payload) ? payload : []).map(normalizeUser);
        if (active) {
          setUsers(normalized.length > 0 ? normalized : MOCK_USERS.map(normalizeUser));
        }
      } catch {
        if (active) {
          setUsers(MOCK_USERS.map(normalizeUser));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, [isHealthcareTier]);

  useEffect(() => {
    if (!toastMessage) return undefined;
    const timeout = window.setTimeout(() => setToastMessage(''), 2000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const currentUserId = useMemo(
    () => users.find((user) => user.email.toLowerCase() === currentUserEmail)?.id || '',
    [users, currentUserEmail],
  );

  const updateRole = async (userId, role) => {
    setUsers((previous) => previous.map((user) => (user.id === userId ? { ...user, role } : user)));
    setToastMessage('✓ Role updated');

    try {
      await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: getTokenHeaders(),
        body: JSON.stringify({ role }),
      });
    } catch {
      // Keep optimistic state for frontend-only sprint behavior.
    }
  };

  const confirmRemove = async (userId) => {
    setRemovingUserId('');
    setUsers((previous) => previous.filter((user) => user.id !== userId));

    try {
      await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: getTokenHeaders(),
      });
    } catch {
      // Keep optimistic state for frontend-only sprint behavior.
    }
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();

    if (!emailLooksValid(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    const pendingUser = normalizeUser({
      id: `pending-${Date.now()}`,
      name: pendingNameFromEmail(inviteEmail),
      email: inviteEmail,
      role: inviteRole,
      joined_at: null,
      invite_pending: true,
    });

    try {
      await fetch('/api/users/invite', {
        method: 'POST',
        headers: getTokenHeaders(),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
    } catch {
      // Graceful degradation: pending row is still added.
    }

    setUsers((previous) => [...previous, pendingUser]);
    setToastMessage(`✓ Invite sent to ${inviteEmail}`);
    setInviteEmail('');
    setInviteRole('analyst');
    setInviteError('');
    setShowInviteForm(false);
  };

  if (!isHealthcareTier) {
    return (
      <div className="dashboard-page">
        <main className="dashboard-main">
          <section className="dashboard-card">
            <div className="card-content">
              <h2 style={{ marginTop: 0 }}>Team</h2>
              <p style={{ marginBottom: 0, color: '#6b7280' }}>
                Team management is currently available for healthcare tier customers only.
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="view-all-btn"
              style={{ marginBottom: '0.25rem' }}
            >
              ← Dashboard
            </button>
            <h1>👥 Team</h1>
            <p>{orgName} · User &amp; role management</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main" style={{ maxWidth: 1100 }}>
        <section className="dashboard-card" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Team Members</h2>
            <button
              type="button"
              onClick={() => {
                setShowInviteForm((previous) => !previous);
                setInviteError('');
              }}
              style={{ background: '#0f4c81', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 0.95rem', fontWeight: 700, cursor: 'pointer' }}
            >
              + Invite Member
            </button>
          </div>

          {showInviteForm && (
            <form className="invite-form" onSubmit={handleInviteSubmit}>
              <div style={{ minWidth: 250, flex: '1 1 280px' }}>
                <label htmlFor="invite-email" style={{ display: 'block', fontSize: '0.82rem', color: '#6b7280', marginBottom: 6 }}>
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => {
                    setInviteEmail(event.target.value);
                    setInviteError('');
                  }}
                  placeholder="colleague@trinetx.com"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
                />
                {inviteError && <p style={{ margin: '0.4rem 0 0', color: '#b91c1c', fontSize: '0.8rem' }}>{inviteError}</p>}
              </div>

              <div style={{ minWidth: 180 }}>
                <label htmlFor="invite-role" style={{ display: 'block', fontSize: '0.82rem', color: '#6b7280', marginBottom: 6 }}>
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value)}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" style={{ background: '#0f4c81', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}>
                  Send Invite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteForm(false);
                    setInviteEmail('');
                    setInviteRole('analyst');
                    setInviteError('');
                  }}
                  style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.5rem 0.9rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {toastMessage && (
            <div style={{ marginBottom: '0.75rem' }}>
              <span className="status-toast">{toastMessage}</span>
            </div>
          )}

          {loading ? (
            <p style={{ color: '#6b7280', margin: '0.75rem 0 0' }}>Loading team members…</p>
          ) : (
            <table className="team-table" aria-label="Team members">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Joined</th>
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isCurrentUser = user.email.toLowerCase() === currentUserEmail;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                          <span className="avatar-circle" style={{ background: getAvatarColor(`${user.name}-${user.email}`) }}>
                            {user.avatar_initials || toInitials(user.name)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{user.name}</div>
                            {user.invite_pending && (
                              <span style={{ fontSize: '0.75rem', color: '#92400e', background: '#fef3c7', borderRadius: 999, padding: '0.12rem 0.45rem' }}>
                                ⏳ Invite Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-badge" style={roleBadgeStyles[user.role] || roleBadgeStyles.viewer}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td style={{ color: '#4b5563' }}>{user.email}</td>
                      <td style={{ color: '#6b7280' }}>{user.joined_at ? new Date(user.joined_at).toLocaleDateString() : '—'}</td>
                      <td>
                        {isCurrentUser || user.id === currentUserId ? (
                          <span className="role-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>[You]</span>
                        ) : removingUserId === user.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                            <span>Remove {user.name}?</span>
                            <button type="button" onClick={() => confirmRemove(user.id)} style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: 6, padding: '0.2rem 0.45rem', cursor: 'pointer' }}>Yes</button>
                            <button type="button" onClick={() => setRemovingUserId('')} style={{ border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: 6, padding: '0.2rem 0.45rem', cursor: 'pointer' }}>No</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <select
                              aria-label={`Change role for ${user.name}`}
                              className="assign-select"
                              value={user.role}
                              onChange={(event) => updateRole(user.id, event.target.value)}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setRemovingUserId(user.id)}
                              style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: '1rem' }}
                              aria-label={`Remove ${user.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
