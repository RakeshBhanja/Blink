import React, { useState } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import { Plus, MessageSquare, Shield, LogOut, MessageCircle, Hash, Users, X } from 'lucide-react';

export const Sidebar = ({ 
  rooms, 
  activeRoom, 
  setActiveRoom, 
  view, 
  setView, 
  onRoomCreated,
  onlineUsers,
  className = ''
}) => {
  const { user, logout, token } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [modalError, setModalError] = useState('');

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setModalError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRoomName.trim(), is_direct_message: false })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create channel');
      
      onRoomCreated(data);
      setActiveRoom(data);
      setNewRoomName('');
      setShowCreateModal(false);
    } catch (err) {
      setModalError(err.message);
    }
  };

  const handleOpenDmModal = async () => {
    setShowDmModal(true);
    setLoadingUsers(true);
    setModalError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data);
      } else {
        throw new Error('Failed to fetch user list');
      }
    } catch (err) {
      setModalError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartDm = async (targetUser) => {
    setModalError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_direct_message: true,
          participant_ids: [targetUser.id]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create conversation');

      // Adjust room name on client side
      const dmRoom = {
        ...data,
        name: targetUser.username
      };

      onRoomCreated(dmRoom);
      setActiveRoom(dmRoom);
      setShowDmModal(false);
      setView('chat'); // Switch view back to chat in case we were in admin view
    } catch (err) {
      setModalError(err.message);
    }
  };

  // Group rooms into Channels vs DMs
  const channels = rooms.filter(r => !r.is_direct_message);
  const dms = rooms.filter(r => r.is_direct_message);

  return (
    <aside className={`sidebar glass-panel ${className}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo-container">
          <img src={logoImg} alt="Blink Logo" className="sidebar-logo" />
          <span className="sidebar-title">Blink</span>
        </div>
        <div className="sidebar-actions">
          {user && user.role === 'ADMIN' && (
            <button 
              className={`sidebar-icon-btn ${view === 'admin' ? 'active' : ''}`}
              title="Admin Portal"
              onClick={() => setView(view === 'admin' ? 'chat' : 'admin')}
              style={{ color: view === 'admin' ? 'var(--accent-cyan)' : '' }}
            >
              <Shield size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Sidebar Channels Section */}
      <div className="sidebar-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span className="sidebar-section-title">Channels</span>
          <button className="sidebar-icon-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
          </button>
        </div>

        {channels.map(room => (
          <div 
            key={room.id}
            className={`sidebar-item ${view === 'chat' && activeRoom?.id === room.id ? 'active' : ''}`}
            onClick={() => {
              setView('chat');
              setActiveRoom(room);
            }}
          >
            <Hash size={18} style={{ color: 'var(--text-secondary)' }} />
            <div className="sidebar-item-info">
              <div className="sidebar-item-name">{room.name}</div>
            </div>
          </div>
        ))}

        {/* Sidebar DMs Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '8px' }}>
          <span className="sidebar-section-title">Direct Messages</span>
          <button className="sidebar-icon-btn" onClick={handleOpenDmModal}>
            <Plus size={16} />
          </button>
        </div>

        {dms.map(room => {
          // Find the member who is NOT the current user
          const otherMember = room.users?.find(u => u.id !== user?.id);
          const otherUserId = otherMember?.id;
          const isOnline = onlineUsers.has(otherUserId);

          return (
            <div 
              key={room.id}
              className={`sidebar-item ${view === 'chat' && activeRoom?.id === room.id ? 'active' : ''}`}
              onClick={() => {
                setView('chat');
                setActiveRoom(room);
              }}
            >
              <div className="avatar-wrapper">
                <img 
                  src={otherMember?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${room.name}`} 
                  alt={room.name} 
                  className="avatar" 
                />
                <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
              </div>
              <div className="sidebar-item-info">
                <div className="sidebar-item-name">{room.name}</div>
                <div className="sidebar-item-sub">{isOnline ? 'Active Now' : 'Offline'}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Profile at bottom */}
      {user && (
        <div className="sidebar-profile">
          <div className="avatar-wrapper">
            <img src={user.avatar_url} alt={user.username} className="avatar" />
            <div className="status-dot" />
          </div>
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{user.username}</div>
            <div className="sidebar-profile-role">{user.role}</div>
          </div>
          <button className="sidebar-icon-btn" title="Logout" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="glass-panel modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Channel</h3>
              <button className="sidebar-icon-btn" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            {modalError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{modalError}</p>}
            <form onSubmit={handleCreateRoom}>
              <div style={{ marginBottom: '20px' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. general-discussions"
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create Channel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Message User Picker Modal */}
      {showDmModal && (
        <div className="modal-overlay" onClick={() => setShowDmModal(false)}>
          <div className="glass-panel modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Start Conversation</h3>
              <button className="sidebar-icon-btn" onClick={() => setShowDmModal(false)}>
                <X size={20} />
              </button>
            </div>
            {modalError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{modalError}</p>}
            
            {loadingUsers ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading members...</p>
            ) : availableUsers.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No other approved members found.</p>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {availableUsers.map(u => {
                  const isOnline = onlineUsers.has(u.id);
                  return (
                    <div 
                      key={u.id}
                      className="user-item-row"
                      onClick={() => handleStartDm(u)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar-wrapper">
                          <img src={u.avatar_url} alt={u.username} className="avatar" style={{ width: '36px', height: '36px' }} />
                          <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
                        </div>
                        <span style={{ fontWeight: '500' }}>{u.username}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: isOnline ? 'var(--status-approved)' : 'var(--text-muted)' }}>
                        {isOnline ? 'online' : 'offline'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowDmModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
