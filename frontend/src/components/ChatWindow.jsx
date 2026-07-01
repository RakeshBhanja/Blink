import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import { Send, Image, X, FileImage, Loader2, Sparkles } from 'lucide-react';

export const ChatWindow = ({ activeRoom, messages, onSendMessage, typingUsers }) => {
  const { user, token, socket } = useAuth();
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll messages to bottom on update or room change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Clean up input fields when switching chat rooms
  useEffect(() => {
    setInputText('');
    handleRemoveImage();
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [activeRoom]);

  // Handle keypress / typing notifications
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    
    if (!socket || !activeRoom) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.send(JSON.stringify({
        type: 'typing',
        room_id: activeRoom.id,
        is_typing: true
      }));
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.send(JSON.stringify({
        type: 'typing',
        room_id: activeRoom.id,
        is_typing: false
      }));
    }, 2000);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !imageFile) return;

    let finalImageUrl = null;
    
    // Upload image first if attached
    if (imageFile) {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', imageFile);

      try {
        const response = await fetch(`${API_BASE_URL}/api/chat/rooms/${activeRoom.id}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          finalImageUrl = data.file_url;
        } else {
          console.error('Image upload failed');
        }
      } catch (err) {
        console.error('Error uploading file:', err);
      } finally {
        setUploadingImage(false);
      }
    }

    // Emit message event via parent component
    onSendMessage(inputText.trim(), finalImageUrl);
    
    // Reset state
    setInputText('');
    handleRemoveImage();
    
    // Clear typing status
    if (isTyping && socket) {
      setIsTyping(false);
      socket.send(JSON.stringify({
        type: 'typing',
        room_id: activeRoom.id,
        is_typing: false
      }));
    }
  };

  // Helper to format timestamps nicely
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Render empty state
  if (!activeRoom) {
    return (
      <div className="chat-window glass-panel">
        <div className="chat-empty">
          <img src={logoImg} className="chat-empty-logo" alt="Blink" />
          <h2 style={{ fontFamily: 'var(--font-heading)', color: '#fff', marginBottom: '8px', fontSize: '24px' }}>Welcome to Blink</h2>
          <p style={{ maxWidth: '320px', fontSize: '14px', lineHeight: '1.5' }}>
            Select a channel or start a direct message with members to begin chatting instantly.
          </p>
        </div>
      </div>
    );
  }

  // Find other typing users in this room (excluding current user)
  const otherTypingUsers = Object.entries(typingUsers)
    .filter(([uid, typingState]) => typingState.room_id === activeRoom.id && typingState.is_typing && parseInt(uid) !== user?.id)
    .map(([uid, typingState]) => typingState.username);

  return (
    <div className="chat-window glass-panel">
      {/* Chat Header */}
      <header className="chat-header">
        <div className="chat-header-info">
          <div>
            <h2 className="chat-header-name">{activeRoom.name}</h2>
            <div className="chat-header-status">
              {activeRoom.is_direct_message ? 'Direct Message' : 'Public Room'}
            </div>
          </div>
        </div>
      </header>

      {/* Messages Feed */}
      <div className="chat-messages">
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          
          return (
            <div key={msg.id || Math.random()} className={`msg-row ${isOwn ? 'outgoing' : 'incoming'}`}>
              <div className="msg-bubble">
                {!isOwn && <div className="msg-sender">{msg.sender_name}</div>}
                
                {msg.content && <div className="msg-text">{msg.content}</div>}
                
                {msg.image_url && (
                  <img 
                    src={`${API_BASE_URL}${msg.image_url}`} 
                    className="msg-img" 
                    alt="shared" 
                    onError={(e) => {
                      // Fallback if image isn't loaded yet
                      e.target.style.opacity = 0.5;
                    }}
                  />
                )}
                
                <div className="msg-time">{formatTime(msg.created_at)}</div>
              </div>
            </div>
          );
        })}
        
        {/* Real-time Typing Indicator */}
        {otherTypingUsers.length > 0 && (
          <div className="typing-container">
            <span style={{ marginRight: '6px' }}>
              {otherTypingUsers.join(', ')} {otherTypingUsers.length === 1 ? 'is' : 'are'} typing
            </span>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="chat-input-bar">
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          {/* File Upload Preview Panel */}
          {imagePreview && (
            <div className="file-preview">
              <img src={imagePreview} className="file-preview-img" alt="Upload Preview" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: '600' }}>Ready to send</span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Image attachment</span>
              </div>
              <button 
                type="button" 
                className="sidebar-icon-btn" 
                onClick={handleRemoveImage}
                style={{ padding: '4px', background: 'rgba(255,255,255,0.05)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Attachment Button */}
          <button 
            type="button" 
            className="sidebar-icon-btn" 
            title="Attach Image"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}
          >
            {uploadingImage ? <Loader2 className="animate-spin" size={20} /> : <Image size={20} />}
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageSelect} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />

          <div className="chat-input-wrapper">
            <input 
              type="text" 
              className="input-field" 
              placeholder={uploadingImage ? 'Uploading image...' : `Message ${activeRoom.name}`}
              value={inputText}
              onChange={handleInputChange}
              disabled={uploadingImage}
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ height: '46px', width: '46px', padding: '0', borderRadius: '12px' }}
            disabled={(!inputText.trim() && !imageFile) || uploadingImage}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
