import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { OntologyClass, PresetOntology, BrainstormMessage, BrainstormSuggestion } from '../types';
import { PRESET_ONTOLOGIES, COLOR_PALETTE } from '../data/presets';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  FolderDown,
  FolderUp,
  X,
  SlidersHorizontal,
  Bot,
  Send,
  Link,
  Globe,
  HelpCircle,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  Layers,
  BookOpen,
  MessageSquare,
  Loader2,
  ListPlus,
} from 'lucide-react';

interface OntologyManagerProps {
  ontology: OntologyClass[];
  setOntology: React.Dispatch<React.SetStateAction<OntologyClass[]>>;
  classCounts?: Record<string, number>;
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: 'editor' | 'brainstorm';
}

export const OntologyManager: React.FC<OntologyManagerProps> = ({
  ontology,
  setOntology,
  classCounts = {},
  isOpen = false,
  onClose,
  initialTab = 'editor',
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'brainstorm'>(initialTab);

  // --- Manual Editor State ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showPresetTab, setShowPresetTab] = useState(false);

  // --- Brainstorm with AI State ---
  const [referenceUrl, setReferenceUrl] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(new Set());

  const [messages, setMessages] = useState<BrainstormMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        "👋 Welcome to the **Taxonomy AI Brainstormer**!\n\nI can recommend precise visual grounding descriptions for **Amazon Bedrock** zero-shot object detection (Amazon Nova 2 Lite, Nova Pro, Nova Lite), help distinguish subtle visual differences, or suggest new classes for your domain.\n\nType your request below or attach a reference URL (e.g. Wikipedia article, medical atlas, or scientific documentation) to ground the recommendations.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'brainstorm') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  if (!isOpen && onClose) return null;

  // --- Manual Editor Handlers ---
  const handleAddClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName.trim()) return;

    const assignedColor = COLOR_PALETTE[ontology.length % COLOR_PALETTE.length];
    const newClass: OntologyClass = {
      id: `class-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newName.trim(),
      description: newDesc.trim() || `Class description for ${newName.trim()}`,
      color: assignedColor,
    };

    setOntology((prev) => [...prev, newClass]);
    setNewName('');
    setNewDesc('');
  };

  const handleStartEdit = (cls: OntologyClass) => {
    setEditingId(cls.id);
    setEditName(cls.name);
    setEditDesc(cls.description);
    setEditColor(cls.color);
  };

  const handleSaveEdit = (id: string) => {
    setOntology((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, name: editName.trim() || c.name, description: editDesc.trim(), color: editColor }
          : c
      )
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setOntology((prev) => prev.filter((c) => c.id !== id));
  };

  const handleLoadPreset = (preset: PresetOntology) => {
    const loadedClasses: OntologyClass[] = preset.classes.map((c, index) => ({
      id: `class-${Date.now()}-${index}`,
      name: c.name,
      description: c.description,
      color: c.color || COLOR_PALETTE[index % COLOR_PALETTE.length],
    }));
    setOntology(loadedClasses);
    setShowPresetTab(false);
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ontology, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `object_detection_taxonomy_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const validated: OntologyClass[] = parsed.map((item, idx) => ({
            id: item.id || `class-${Date.now()}-${idx}`,
            name: item.name || `Class ${idx + 1}`,
            description: item.description || '',
            color: item.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
          }));
          setOntology(validated);
        }
      } catch (err) {
        alert('Invalid JSON file format for ontology taxonomy.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Brainstorm with AI Handlers ---
  const handleSendMessage = async (promptOverride?: string) => {
    const textToSend = (promptOverride || chatInput).trim();
    if (!textToSend || isAiLoading) return;

    const userMessage: BrainstormMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      referenceUrlUsed: referenceUrl.trim() || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!promptOverride) {
      setChatInput('');
    }
    setIsAiLoading(true);

    try {
      // Build conversation payload for Gemini API
      const conversationHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/brainstorm-ontology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          currentOntology: ontology.map((c) => ({ name: c.name, description: c.description })),
          referenceUrl: referenceUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to get recommendations from AI Brainstormer.');
      }

      const assistantMessage: BrainstormMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'Here are my recommendations for your taxonomy.',
        suggestedClasses: data.suggestedClasses || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        referenceUrlUsed: referenceUrl.trim() || undefined,
        urlFetched: data.urlFetched,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Brainstorm AI error:', err);
      const errorMessage: BrainstormMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error communicating with AI Brainstormer**: ${err.message || 'Please check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApplySingleSuggestion = (suggestion: BrainstormSuggestion, messageId: string, idx: number) => {
    const key = `${messageId}-${idx}`;
    setOntology((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.name.trim().toLowerCase() === suggestion.name.trim().toLowerCase()
      );

      if (existingIdx >= 0) {
        // Update existing class description
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          description: suggestion.description,
        };
        return updated;
      } else {
        // Append new class
        const assignedColor = COLOR_PALETTE[prev.length % COLOR_PALETTE.length];
        const newCls: OntologyClass = {
          id: `class-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: suggestion.name.trim(),
          description: suggestion.description.trim(),
          color: assignedColor,
        };
        return [...prev, newCls];
      }
    });

    setAppliedSuggestionIds((prev) => new Set(prev).add(key));
  };

  const handleApplyAllSuggestions = (suggestions: BrainstormSuggestion[], messageId: string) => {
    suggestions.forEach((sug, idx) => {
      handleApplySingleSuggestion(sug, messageId, idx);
    });
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          "Chat reset. Ask for class recommendations, refine visual descriptions, or reference an external link.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setAppliedSuggestionIds(new Set());
  };

  const content = (
    <div className="flex flex-col h-full overflow-hidden text-slate-800 text-xs">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ff5411] flex items-center justify-center text-white shadow-xs">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900">Taxonomy & Label Configuration</h3>
              <span className="text-[11px] bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                {ontology.length} active classes
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure object detection labels & visual descriptions grounding Amazon Bedrock
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-slate-200 bg-white px-6 gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-colors ${
            activeTab === 'editor'
              ? 'border-[#ff5411] text-[#ff5411]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Classes & Editor</span>
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-mono text-slate-600">
            {ontology.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('brainstorm')}
          className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs font-bold transition-colors ${
            activeTab === 'brainstorm'
              ? 'border-[#ff5411] text-[#ff5411]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Brainstorm with AI</span>
          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
            Assistant
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'editor' ? (
        /* --- TAB 1: MANUAL & PRESET EDITOR --- */
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPresetTab(!showPresetTab)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors text-xs"
              >
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span>{showPresetTab ? 'Hide Presets' : 'Choose Domain Preset'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer font-medium text-xs">
                <FolderUp className="w-4 h-4" />
                <span>Import JSON</span>
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs"
              >
                <FolderDown className="w-4 h-4" />
                <span>Export Taxonomy</span>
              </button>
            </div>
          </div>

          {/* Presets List Drawer */}
          {showPresetTab && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pre-configured Domain Taxonomies
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_ONTOLOGIES.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset)}
                    className="p-3 bg-white border border-slate-200 hover:border-[#ff5411] hover:bg-[#fff5f2]/40 rounded-lg cursor-pointer transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs">{preset.title}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                        {preset.classes.length} classes
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{preset.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Class Input Form */}
          <form onSubmit={handleAddClass} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Add New Label Class
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Class Name (e.g., Hard Hat, Papular Rash)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#ff5411]"
              />
              <input
                type="text"
                placeholder="Visual Description (helps Amazon Bedrock spatial grounding)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="sm:col-span-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#ff5411]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newName.trim()}
                className="flex items-center gap-1.5 bg-[#ff5411] hover:bg-[#e0480b] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Class</span>
              </button>
            </div>
          </form>

          {/* Existing Classes List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Configured Classes ({ontology.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Descriptions are sent directly to Amazon Bedrock for zero-shot localization
              </span>
            </div>

            <div className="space-y-2">
              {ontology.map((cls) => {
                const isEditing = editingId === cls.id;
                const instances = classCounts[cls.name] || 0;

                if (isEditing) {
                  return (
                    <div key={cls.id} className="p-3.5 bg-white border-2 border-[#ff5411] rounded-xl space-y-2.5 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-8 h-8 rounded border-0 cursor-pointer p-0 shrink-0"
                        />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                        />
                      </div>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2.5 text-xs focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cls.id)}
                          className="flex items-center gap-1.5 bg-[#ff5411] text-white px-3.5 py-1.5 rounded text-xs font-semibold"
                        >
                          <Check className="w-4 h-4" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={cls.id}
                    className="p-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cls.color }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{cls.name}</span>
                          {instances > 0 && (
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                              {instances} detections
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{cls.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cls)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                        title="Edit Class"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cls.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Delete Class"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* --- TAB 2: BRAINSTORM WITH AI --- */
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top Bar: External Reference Link + Reset */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
            {/* Reference URL Input */}
            <div className="flex-1 max-w-2xl">
              <div className="relative flex items-center">
                <Globe className="w-4 h-4 text-blue-500 absolute left-3 pointer-events-none" />
                <input
                  type="url"
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  placeholder="Optional reference URL (e.g. Wikipedia article, clinical atlas, or documentation)..."
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#ff5411] transition-all"
                />
                {referenceUrl && (
                  <button
                    type="button"
                    onClick={() => setReferenceUrl('')}
                    className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                    title="Clear URL"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Reset Action */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Chat</span>
              </button>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/40">
            {messages.map((message) => {
              const isUser = message.role === 'user';

              return (
                <div
                  key={message.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#ff5411] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs shadow-xs space-y-3 ${
                      isUser
                        ? 'bg-slate-900 text-white rounded-tr-xs'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {/* Role & Timestamp */}
                    <div className="flex items-center justify-between gap-4 text-[11px] opacity-70">
                      <span className="font-bold">
                        {isUser ? 'You' : 'Bedrock Taxonomy Specialist'}
                      </span>
                      <span>{message.timestamp}</span>
                    </div>

                    {/* Grounding Info if URL attached */}
                    {!isUser && message.referenceUrlUsed && (
                      <div className="flex items-center gap-2 text-[11px] bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg font-medium">
                        <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">
                          Grounded on: {message.referenceUrlUsed}
                          {message.urlFetched ? ' (Verified content extracted ✓)' : ''}
                        </span>
                      </div>
                    )}

                    {/* Message Body (Markdown rendered) */}
                    <div className={`prose prose-sm max-w-none text-xs leading-relaxed space-y-2 ${isUser ? 'text-white' : 'text-slate-800'}`}>
                      <Markdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-xs">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 space-y-1.5 my-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1.5 my-2">{children}</ol>,
                          li: ({ children }) => <li className="text-xs leading-relaxed">{children}</li>,
                          strong: ({ children }) => (
                            <strong className={`font-bold ${isUser ? 'text-white font-extrabold' : 'text-slate-950'}`}>
                              {children}
                            </strong>
                          ),
                          h1: ({ children }) => <h4 className="font-bold text-sm mt-3 mb-1.5">{children}</h4>,
                          h2: ({ children }) => <h5 className="font-bold text-xs mt-2.5 mb-1">{children}</h5>,
                          h3: ({ children }) => <h6 className="font-bold text-xs mt-2 mb-1">{children}</h6>,
                          code: ({ children }) => (
                            <code className={`px-1.5 py-0.5 rounded font-mono text-[11px] ${isUser ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-800'}`}>
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {message.content}
                      </Markdown>
                    </div>

                    {/* Suggested Classes Recommendations Cards */}
                    {message.suggestedClasses && message.suggestedClasses.length > 0 && (
                      <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <ListPlus className="w-4 h-4 text-slate-600" />
                            <span>Recommended Classes & Descriptions ({message.suggestedClasses.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleApplyAllSuggestions(message.suggestedClasses!, message.id)}
                            className="flex items-center gap-1.5 bg-[#ff5411] hover:bg-[#e0480b] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Apply All to Taxonomy</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {message.suggestedClasses.map((sug, idx) => {
                            const isApplied = appliedSuggestionIds.has(`${message.id}-${idx}`);
                            const alreadyExists = ontology.some(
                              (c) => c.name.trim().toLowerCase() === sug.name.trim().toLowerCase()
                            );

                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded-xl border text-xs transition-all ${
                                  isApplied
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
                                    : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 text-slate-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 text-xs">
                                        {sug.name}
                                      </span>
                                      {alreadyExists && (
                                        <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                                          in taxonomy
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                      {sug.description}
                                    </p>
                                    {sug.rationale && (
                                      <p className="text-[11px] text-slate-400 italic">
                                        💡 Visual cue: {sug.rationale}
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleApplySingleSuggestion(sug, message.id, idx)}
                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                      isApplied
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : alreadyExists
                                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                                        : 'bg-[#ff5411] hover:bg-[#e0480b] text-white shadow-xs'
                                    }`}
                                  >
                                    {isApplied ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Applied!</span>
                                      </>
                                    ) : alreadyExists ? (
                                      <>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                        <span>Update Desc</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ Add Class</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isAiLoading && (
              <div className="flex gap-3.5 justify-start items-center text-slate-500 text-xs">
                <div className="w-8 h-8 rounded-xl bg-[#ff5411] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-600 flex items-center gap-2.5 shadow-xs">
                  <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                  <span className="text-xs font-medium">
                    Analyzing visual grounding descriptors for Amazon Bedrock...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2.5"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask AI to recommend descriptions, suggest classes, or distinguish visual features..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#ff5411] focus:bg-white transition-all"
                disabled={isAiLoading}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isAiLoading}
                className="flex items-center gap-2 bg-[#ff5411] hover:bg-[#e0480b] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>
            {activeTab === 'editor'
              ? 'Changes to taxonomy immediately apply to the active annotation workflow.'
              : 'Add recommended classes to update your active project ontology.'}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-[#ff5411] text-white rounded-lg hover:bg-[#e0480b] shadow-xs transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[90vh] md:h-[88vh] overflow-hidden flex flex-col shadow-2xl transition-all">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden h-[820px] flex flex-col">
      {content}
    </div>
  );
};
