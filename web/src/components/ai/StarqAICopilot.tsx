import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Package,
  FileSpreadsheet,
  CheckCircle2,
  Receipt,
  Wrench,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';

export const StarqAICopilot: React.FC = () => {
  const {
    isAICopilotOpen,
    setIsAICopilotOpen,
    aiInsights,
    triggerAIInsightAction,
    formatMVR,
    jobs,
    invoices,
    inventory,
    setIsCreatePOOpen,
    setActiveTab,
    setSelectedJobId
  } = useERP();

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<
    { sender: 'ai' | 'user'; text: string; action?: { label: string; onClick: () => void } }[]
  >([
    {
      sender: 'ai',
      text: 'Salaam! I am Starq AI, your Maldives business copilot for Ignition Ink. I monitor your garage cash flow, job profitability, MIRA GST deadlines, and spray booth inventory in real-time. How can I assist you today?'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  if (!isAICopilotOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const q = textToSend || chatInput;
    if (!q.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let responseText = '';
      let action: { label: string; onClick: () => void } | undefined = undefined;

      const lower = q.toLowerCase();
      if (lower.includes('overdue') || lower.includes('unpaid') || lower.includes('tma')) {
        responseText =
          'You currently have 1 overdue invoice (INV-2026-081) totaling MVR 42,700 from Trans Maldivian Transfers (Fleet). It is 13 days past the agreed net-30 terms. Would you like me to open the invoice to review payment slips or send a statement?';
        action = {
          label: 'View Overdue Invoice',
          onClick: () => {
            setActiveTab('invoices');
            setIsAICopilotOpen(false);
          }
        };
      } else if (lower.includes('stock') || lower.includes('clearcoat') || lower.includes('po') || lower.includes('reorder')) {
        responseText =
          'Critical stock alert: PPG 2K Clearcoat is down to 2 tins (min: 5) and Avery Satin Black Wrap is down to 1 roll (min: 3). With Job IGN-0234 and upcoming Prado respray, you risk bay idle time in 4 days. I can prepare a draft PO to ColorCraft Maldives for MVR 15,444.';
        action = {
          label: 'Open Pre-filled Purchase Order',
          onClick: () => {
            setActiveTab('purchasing');
            setIsCreatePOOpen(true);
            setIsAICopilotOpen(false);
          }
        };
      } else if (lower.includes('profit') || lower.includes('margin') || lower.includes('ign-0234')) {
        responseText =
          'Job IGN-0234 (Ahmed Rauf - Prado Repaint) quoted at MVR 48,500 has accrued MVR 9,970 in paint/clearcoat materials (+17.3% over estimate). However, due to solid labor efficiency, the job still maintains a 50.6% gross margin with MVR 24,530 net profit.';
        action = {
          label: 'Inspect IGN-0234 Profit Breakdown',
          onClick: () => {
            setActiveTab('jobs');
            setSelectedJobId('job-1');
            setIsAICopilotOpen(false);
          }
        };
      } else if (lower.includes('cash') || lower.includes('revenue') || lower.includes('today')) {
        responseText =
          'Today you logged MVR 38,500 in sales. Total month-to-date revenue stands at MVR 173,700 against MVR 88,400 expenses, generating MVR 85,300 net operating surplus in May.';
      } else {
        responseText = `Analyzed your request for "${q}". Everything is running smoothly across your 5 garage bays. 4 active jobs are on track for handover by Saturday, expecting MVR 38,500 cash collections upon customer collection.`;
      }

      setMessages((prev) => [...prev, { sender: 'ai', text: responseText, action }]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => setIsAICopilotOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Starq AI Copilot</h2>
                <Badge variant="info" size="sm">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-slate-500">Intelligent ERP Assistant for Ignition Ink</p>
            </div>
          </div>
          <button
            onClick={() => setIsAICopilotOpen(false)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Proactive Insights Banner */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Automated Business Intelligence
            </span>
            <span className="text-[11px] text-blue-600 font-medium">4 Key Insights</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {aiInsights.slice(0, 2).map((insight) => (
              <div
                key={insight.id}
                onClick={() => triggerAIInsightAction(insight)}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 cursor-pointer transition-all text-left group shadow-2xs"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="font-semibold text-blue-600">{insight.category}</span>
                  <span className="text-rose-600 font-medium">{insight.impact}</span>
                </div>
                <p className="text-xs font-bold text-slate-900 mt-1 line-clamp-1 group-hover:text-blue-600">
                  {insight.title}
                </p>
                <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                  {insight.actionButtonLabel} →
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tr-none shadow-xs'
                    : 'bg-slate-100 text-slate-800 border border-slate-200 rounded-tl-none'
                }`}
              >
                <p>{m.text}</p>
                {m.action && (
                  <button
                    onClick={m.action.onClick}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-[11px] shadow-xs hover:bg-blue-700 transition-colors"
                  >
                    <span>{m.action.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2.5 items-center text-slate-500">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce delay-200" />
                <span className="ml-1 text-slate-500">Analyzing ERP data...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggested Prompts */}
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              'Draft PO for low clearcoat',
              'Check overdue TMA invoices',
              'Analyze IGN-0234 margin',
              'Summarize May P&L'
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(p)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-[11px] text-slate-700 border border-slate-200 transition-colors shrink-0 shadow-2xs"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask Starq AI (e.g. 'Show margin on Prado repaint')..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => handleSendMessage()}
            className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
