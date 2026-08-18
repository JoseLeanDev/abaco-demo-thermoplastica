import { useState, useRef, useEffect } from 'react';
import { chatWithAgents } from '../../services/cfoApi';

export default function AgentChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy abaco. ¿En qué puedo ayudarte hoy?',
      agent: 'abaco Core'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      console.log('[AgentChat] Sending message:', userMessage);
      const response = await chatWithAgents(userMessage);
      console.log('[AgentChat] Response:', response);
      
      if (response.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.response.content,
          agent: response.response.agent,
          type: response.response.type
        }]);
      } else {
        throw new Error(response.error || 'Error desconocido del servidor');
      }
    } catch (error) {
      console.error('[AgentChat] Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message}. Verifica que el backend esté corriendo.`,
        type: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getAgentEmoji = (agentName) => {
    const emojis = {
      'abaco Core': '🤖',
      'Caja': '💰',
      'Análisis': '📊',
      'Cobranza': '📋',
      'Contabilidad': '📅',
      'Orchestrator': '🎛️'
    };
    return emojis[agentName] || '🤖';
  };

  const getTypeColor = (type) => {
    const colors = {
      'error': 'bg-red-100 text-red-800 border-red-200',
      'alert': 'bg-orange-100 text-orange-800 border-orange-200',
      'success': 'bg-green-100 text-green-800 border-green-200',
      'analysis': 'bg-blue-100 text-blue-800 border-blue-200',
      'advisory': 'bg-purple-100 text-purple-800 border-purple-200',
      'welcome': 'bg-gradient-to-r from-blue-100 to-purple-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 ${
          isOpen ? 'bg-red-500 hover:bg-red-600 rotate-45' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="font-semibold">abaco Assistant</h3>
                  <p className="text-xs text-blue-100">Multi-Agent System</p>
                </div>
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white' : getTypeColor(msg.type)} rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line shadow-sm`}>
                  {msg.role === 'assistant' && msg.agent && (
                    <div className="flex items-center gap-1 mb-1 opacity-70 text-xs">
                      <span>{getAgentEmoji(msg.agent)}</span>
                      <span className="font-medium">{msg.agent}</span>
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3 text-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-gray-500 text-xs">Los agentes están analizando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 bg-white border-t border-gray-100 flex gap-2 overflow-x-auto">
            {['¿Cuál es mi runway?', 'KPIs financieros', 'Obligaciones SAT', 'CxC por cobrar'].map((quick) => (
              <button
                key={quick}
                onClick={() => {
                  setInput(quick);
                }}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full whitespace-nowrap transition-colors"
              >
                {quick}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta a tus agentes CFO..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
