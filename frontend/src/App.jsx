import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth, API_BASE_URL } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { ChatWindow } from './components/ChatWindow';
import { AdminPanel } from './components/AdminPanel';
import { AuthForm } from './components/AuthForm';

// Main Application Layout Component containing logic
const AppContent = () => {
  const { user, token, socket, isSocketConnected, refreshUser } = useAuth();
  
  // UI states
  const [view, setView] = useState('chat'); // 'chat' or 'admin'
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  
  // Real-time states
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});

  const changeActiveRoom = (room) => {
    setActiveRoom(room);
    setShowSidebarMobile(false);
  };

  const changeView = (newView) => {
    setView(newView);
    if (newView === 'admin') {
      setShowSidebarMobile(false);
    }
  };

  // Fetch rooms list
  const fetchRooms = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRooms(data);
        
        // Auto-select first room (General Chat) on initial load
        if (data.length > 0 && !activeRoom) {
          const general = data.find(r => r.name === 'General Chat') || data[0];
          setActiveRoom(general);
        }
      }
    } catch (err) {
      console.error('Failed to fetch rooms list:', err);
    }
  }, [token, activeRoom]);

  // Fetch message history for selected room
  const fetchMessages = useCallback(async (roomId) => {
    if (!token || !roomId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/rooms/${roomId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch message history:', err);
    }
  }, [token]);

  // Load rooms on mount / sign-in
  useEffect(() => {
    if (user && (user.role === 'ADMIN' || user.status === 'APPROVED')) {
      fetchRooms();
    }
  }, [user, fetchRooms]);

  // Load message history when active room changes or socket reconnects
  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom.id);
      
      // Clear typing indicator for this room
      setTypingUsers(prev => {
        const cleaned = { ...prev };
        Object.keys(cleaned).forEach(uid => {
          if (cleaned[uid].room_id === activeRoom.id) {
            delete cleaned[uid];
          }
        });
        return cleaned;
      });

      if (activeRoom.is_direct_message && socket && isSocketConnected) {
        socket.send(JSON.stringify({
          type: 'read_messages',
          room_id: activeRoom.id
        }));
      }
    } else {
      setMessages([]);
    }
  }, [activeRoom, fetchMessages, socket, isSocketConnected]);

  // Listen to WebSocket events
  useEffect(() => {
    if (!socket) return;

    const handleWSMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message') {
          // If message is in currently open room, append it to stream
          if (activeRoom && data.room_id === activeRoom.id) {
            setMessages(prev => [...prev, data]);
            
            // Send read receipt if it's a DM and sent by the other user
            if (activeRoom.is_direct_message && data.sender_id !== user?.id) {
              socket.send(JSON.stringify({
                type: 'read_messages',
                room_id: activeRoom.id
              }));
            }
          }
          
          // Re-fetch rooms list to update last messages / active chats order
          fetchRooms();
        } 
        
        else if (data.type === 'message_status') {
          // Update status of specific message
          if (activeRoom && data.room_id === activeRoom.id) {
            setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, status: data.status } : m));
          }
        }

        else if (data.type === 'messages_read') {
          // Update status of all messages in this room sent by current user to 'read'
          if (activeRoom && data.room_id === activeRoom.id) {
            setMessages(prev => prev.map(m => m.room_id === data.room_id && m.sender_id === user?.id ? { ...m, status: 'read' } : m));
          }
        }
        
        else if (data.type === 'typing') {
          setTypingUsers(prev => ({
            ...prev,
            [data.user_id]: {
              username: data.username,
              room_id: data.room_id,
              is_typing: data.is_typing
            }
          }));
        } 
        
        else if (data.type === 'user_status') {
          setOnlineUsers(prev => {
            const updated = new Set(prev);
            if (data.online) {
              updated.add(data.user_id);
            } else {
              updated.delete(data.user_id);
            }
            return updated;
          });
        }

        else if (data.type === 'account_status_change') {
          // Instantly sync frontend user object state (forces pending/denied overlay if revoked)
          refreshUser();
        }
      } catch (err) {
        console.error('WebSocket payload parsing error:', err);
      }
    };

    socket.addEventListener('message', handleWSMessage);

    return () => {
      socket.removeEventListener('message', handleWSMessage);
    };
  }, [socket, activeRoom, fetchRooms, refreshUser, user]);

  // Callback when user submits a message
  const handleSendMessage = (content, imageUrl) => {
    if (!socket || !activeRoom) return;
    
    socket.send(JSON.stringify({
      type: 'message',
      room_id: activeRoom.id,
      content,
      image_url: imageUrl
    }));
  };

  const handleRoomCreated = (newRoom) => {
    setRooms(prev => {
      // Prevent duplicates
      if (prev.some(r => r.id === newRoom.id)) return prev;
      return [newRoom, ...prev];
    });
  };

  // If loading user auth details
  const { loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)'
      }}>
        <div className="typing-dot" style={{ width: '12px', height: '12px', margin: '0 4px', animation: 'bounceDot 1s infinite' }}></div>
        <p style={{ marginTop: '16px', fontSize: '14px', fontWeight: '500' }}>Initializing Blink...</p>
      </div>
    );
  }

  // If not logged in, show authentication portal
  if (!user) {
    return <AuthForm />;
  }

  // Render dashboard layout
  return (
    <div className="app-shell">
      <Sidebar 
        rooms={rooms}
        activeRoom={activeRoom}
        setActiveRoom={changeActiveRoom}
        view={view}
        setView={changeView}
        onRoomCreated={handleRoomCreated}
        onlineUsers={onlineUsers}
        className={showSidebarMobile ? '' : 'hidden-mobile'}
      />
      
      {view === 'admin' ? (
        <AdminPanel 
          className={!showSidebarMobile ? '' : 'hidden-mobile'}
          onBack={() => setShowSidebarMobile(true)}
        />
      ) : (
        <ChatWindow 
          activeRoom={activeRoom}
          messages={messages}
          onSendMessage={handleSendMessage}
          typingUsers={typingUsers}
          className={!showSidebarMobile ? '' : 'hidden-mobile'}
          onBack={() => setShowSidebarMobile(true)}
        />
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
