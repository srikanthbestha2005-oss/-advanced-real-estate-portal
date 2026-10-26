import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';

const MessagesPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  
  // Current user info to align messages correctly
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  // Extract email from JWT payload for basic identification
  useEffect(() => {
    const token = localStorage.getItem('access');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
      const jsonPayload = decodeURIComponent(atob(padded).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      setCurrentUserEmail(payload.email || '');
    } catch(e) {
      console.error(e);
    }
  }, [navigate]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('messaging/conversations/');
      setConversations(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load conversations.');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchMessages = async (id) => {
    try {
      const res = await api.get(`messaging/conversations/${id}/messages/`);
      setMessages(res.data);
      // Optional: re-fetch conversations to update unread counts
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (conversationId) {
      setLoadingMessages(true);
      fetchMessages(conversationId).finally(() => setLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  // Polling for new messages
  useEffect(() => {
    let interval;
    if (conversationId) {
      interval = setInterval(() => {
        fetchMessages(conversationId);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId) return;
    
    setSending(true);
    const content = newMessage.trim();
    setNewMessage(''); // optimistic clear
    
    try {
      const res = await api.post(`messaging/conversations/${conversationId}/messages/`, {
        content
      });
      setMessages([...messages, res.data]);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      fetchConversations();
    } catch (err) {
      console.error(err);
      setNewMessage(content); // restore on fail
      alert(err.response?.data?.detail || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };
  
  const getOtherParticipant = (conv) => {
    return conv.customer_email === currentUserEmail ? conv.owner_email : conv.customer_email;
  };

  const activeConversation = conversations.find(c => c.id === parseInt(conversationId));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />
      <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 h-[calc(100vh-64px)]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex h-full overflow-hidden">
        
        {/* LEFT PANEL - Conversations List */}
        <div className={`w-full md:w-1/3 flex flex-col border-r border-slate-200 ${conversationId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-900">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-8 text-center text-slate-500">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No conversations yet.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {conversations.map(conv => {
                  const isActive = parseInt(conversationId) === conv.id;
                  const otherUser = getOtherParticipant(conv);
                  return (
                    <li key={conv.id}>
                      <button
                        onClick={() => navigate(`/messages/${conv.id}`)}
                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start ${isActive ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                      >
                        <div className="h-12 w-12 rounded-lg bg-slate-200 overflow-hidden flex-shrink-0 mr-3">
                          {conv.property_image ? (
                            <img src={conv.property_image} alt="Property" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <h3 className="text-sm font-semibold text-slate-900 truncate pr-2">{conv.property_title}</h3>
                            {conv.unread_count > 0 && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate mb-1">{otherUser}</p>
                          <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                            {conv.last_message ? conv.last_message.content : 'No messages yet.'}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* RIGHT PANEL - Active Conversation */}
        <div className={`w-full md:w-2/3 flex flex-col bg-slate-50 ${!conversationId ? 'hidden md:flex' : 'flex'}`}>
          {!conversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <h2 className="text-xl font-medium text-slate-700">Select a conversation</h2>
              <p className="mt-2 text-sm">Choose a conversation from the list to start messaging.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              {activeConversation && (
                <div className="p-4 bg-white border-b border-slate-200 flex items-center shadow-sm z-10">
                  <button onClick={() => navigate('/messages')} className="mr-3 md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  <div className="h-10 w-10 rounded bg-slate-200 overflow-hidden flex-shrink-0 mr-3 hidden sm:block">
                     {activeConversation.property_image && <img src={activeConversation.property_image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 leading-tight">{activeConversation.property_title}</h2>
                    <p className="text-xs text-slate-500">with {getOtherParticipant(activeConversation)}</p>
                  </div>
                  <button onClick={() => navigate(`/properties/${activeConversation.property}`)} className="ml-auto text-sm text-blue-600 hover:text-blue-800 font-medium">
                    View Property
                  </button>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto">
                {loadingMessages ? (
                  <div className="flex justify-center py-8"><span className="text-slate-400">Loading messages...</span></div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <p>No messages yet. Send a message to start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, idx) => {
                      const isOwner = msg.sender === activeConversation?.owner;
                      const isCustomer = msg.sender === activeConversation?.customer;
                      const isMe = (activeConversation?.customer_email === currentUserEmail && isCustomer) || 
                                   (activeConversation?.owner_email === currentUserEmail && isOwner);

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                            <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 px-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-200">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 appearance-none border border-slate-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className={`rounded-full p-2 h-10 w-10 flex items-center justify-center text-white transition-colors ${
                      sending || !newMessage.trim() ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  </div>
);
};

export default MessagesPage;
