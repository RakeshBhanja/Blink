import React, { useState, useEffect } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import { Shield, Check, X, Trash2, Users, RefreshCw } from 'lucide-react';

export const AdminPanel = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to fetch user list');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStatus = async (userId, status, role = null) => {
    setActioningId(userId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId, status, role })
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to update user status');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this user? All their messages will be retained but associated with a deleted state.')) {
      return;
    }
    setActioningId(userId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete user');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="admin-view glass-panel">
      <header className="admin-header">
        <div className="admin-title">
          <Shield size={24} style={{ color: 'var(--accent-cyan)' }} />
          <span>Admin Portal</span>
          <span className="admin-badge">Authorization Controls</span>
        </div>
        <button 
          className="sidebar-icon-btn" 
          onClick={fetchUsers} 
          disabled={loading}
          title="Refresh User List"
          style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '10px' }}
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
        </button>
      </header>

      <div className="admin-content">
        {error && (
          <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {loading && users.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading members list...</p>
        ) : users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-secondary)' }}>
            <Users size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p>No other users have registered yet.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th className="admin-th">User Details</th>
                <th className="admin-th">Email</th>
                <th className="admin-th">Registered</th>
                <th className="admin-th">Role</th>
                <th className="admin-th">Status</th>
                <th className="admin-th" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="admin-tr">
                  <td className="admin-td">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={u.avatar_url} alt={u.username} className="avatar" style={{ width: '36px', height: '36px' }} />
                      <span style={{ fontWeight: '600' }}>{u.username}</span>
                    </div>
                  </td>
                  <td className="admin-td" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td className="admin-td" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{formatDate(u.created_at)}</td>
                  <td className="admin-td">
                    <span 
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: '700', 
                        color: u.role === 'ADMIN' ? 'var(--accent-cyan)' : 'var(--text-muted)' 
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="admin-td">
                    <span className={`badge ${u.status.toLowerCase()}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="admin-td" style={{ textAlign: 'right' }}>
                    <div className="admin-actions-cell" style={{ justifyContent: 'flex-end' }}>
                      {u.status !== 'APPROVED' && (
                        <button 
                          className="btn-action approve"
                          onClick={() => handleUpdateStatus(u.id, 'APPROVED')}
                          disabled={actioningId === u.id}
                        >
                          <Check size={14} style={{ marginRight: '4px', display: 'inline' }} />
                          Approve
                        </button>
                      )}
                      
                      {u.status !== 'REJECTED' && (
                        <button 
                          className="btn-action reject"
                          onClick={() => handleUpdateStatus(u.id, 'REJECTED')}
                          disabled={actioningId === u.id}
                        >
                          <X size={14} style={{ marginRight: '4px', display: 'inline' }} />
                          Reject
                        </button>
                      )}

                      <button
                        className="btn-action"
                        onClick={() => handleUpdateStatus(u.id, u.status, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                        disabled={actioningId === u.id}
                        title={u.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
                      >
                        Role
                      </button>

                      <button 
                        className="btn-action"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={actioningId === u.id}
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
