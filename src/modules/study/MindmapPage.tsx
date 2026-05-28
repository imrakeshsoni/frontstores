// [study] [all tenants]
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronRight, Network, ChevronDown, Edit2, Check, X } from 'lucide-react';
import { useAppStore } from '@/app/store/app.store';
import { listMindmaps, createMindmap, saveMindmapTree, deleteMindmap, StudyMindmap } from '@/lib/db/study';

interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
  expanded?: boolean;
}

function genId() { return Math.random().toString(36).slice(2, 9); }

function addChild(tree: MindNode, parentId: string, text: string): MindNode {
  if (tree.id === parentId) return { ...tree, children: [...tree.children, { id: genId(), text, children: [], expanded: true }], expanded: true };
  return { ...tree, children: tree.children.map(c => addChild(c, parentId, text)) };
}

function removeNode(tree: MindNode, nodeId: string): MindNode {
  return { ...tree, children: tree.children.filter(c => c.id !== nodeId).map(c => removeNode(c, nodeId)) };
}

function renameNode(tree: MindNode, nodeId: string, text: string): MindNode {
  if (tree.id === nodeId) return { ...tree, text };
  return { ...tree, children: tree.children.map(c => renameNode(c, nodeId, text)) };
}

function toggleNode(tree: MindNode, nodeId: string): MindNode {
  if (tree.id === nodeId) return { ...tree, expanded: !tree.expanded };
  return { ...tree, children: tree.children.map(c => toggleNode(c, nodeId)) };
}

const DEPTH_COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#d97706', '#db2777', '#dc2626'];

function NodeView({ node, depth, onAdd, onRemove, onRename, onToggle, isRoot }: {
  node: MindNode; depth: number; isRoot: boolean;
  onAdd: (parentId: string, text: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, text: string) => void;
  onToggle: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(node.text);
  const [addingChild, setAddingChild] = useState(false);
  const [childText, setChildText] = useState('');
  const color = DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
  const expanded = node.expanded !== false;

  const commitEdit = () => { if (editText.trim()) onRename(node.id, editText.trim()); setEditing(false); };
  const commitAdd = () => { if (childText.trim()) { onAdd(node.id, childText.trim()); setChildText(''); setAddingChild(false); } };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 group" style={{ paddingLeft: depth > 0 ? 4 : 0 }}>
        {/* Connector line */}
        {depth > 0 && <div className="w-5 h-px flex-shrink-0" style={{ background: color, opacity: 0.4 }} />}
        {/* Toggle */}
        {node.children.length > 0 && (
          <button onClick={() => onToggle(node.id)} className="flex-shrink-0" style={{ color }}>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
        {node.children.length === 0 && <div className="w-3.5 flex-shrink-0" />}

        {/* Node pill */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 flex-shrink-0 max-w-xs"
          style={{ background: depth === 0 ? color : `${color}18`, border: `2px solid ${color}`, color: depth === 0 ? '#fff' : color }}>
          {editing ? (
            <div className="flex items-center gap-1">
              <input value={editText} onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                className="bg-transparent outline-none text-sm font-semibold w-32" autoFocus />
              <button onClick={commitEdit}><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditing(false)}><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <span className="text-sm font-semibold" onDoubleClick={() => { setEditing(true); setEditText(node.text); }}>{node.text}</span>
          )}
        </div>

        {/* Actions — show on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setAddingChild(true)}
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: color }} title="Add child">
            <Plus className="h-3 w-3" />
          </button>
          <button onClick={() => { setEditing(true); setEditText(node.text); }}
            className="h-6 w-6 rounded-full flex items-center justify-center"
            style={{ background: `${color}20`, color }} title="Rename">
            <Edit2 className="h-3 w-3" />
          </button>
          {!isRoot && (
            <button onClick={() => onRemove(node.id)}
              className="h-6 w-6 rounded-full flex items-center justify-center bg-red-100 text-red-500"
              title="Delete">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Add child input */}
      {addingChild && (
        <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: depth > 0 ? 40 : 28 }}>
          <input value={childText} onChange={e => setChildText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAddingChild(false); }}
            placeholder="New topic…" autoFocus
            className="rounded-full px-3 py-1 text-sm border outline-none"
            style={{ borderColor: color, color: 'var(--text-primary)', background: 'var(--surface)' }} />
          <button onClick={commitAdd} className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: color }}>Add</button>
          <button onClick={() => setAddingChild(false)} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Cancel</button>
        </div>
      )}

      {/* Children */}
      {expanded && node.children.length > 0 && (
        <div className="mt-2 space-y-2" style={{ paddingLeft: depth === 0 ? 24 : 28, borderLeft: `2px solid ${color}30`, marginLeft: depth === 0 ? 20 : 24 }}>
          {node.children.map(child => (
            <NodeView key={child.id} node={child} depth={depth + 1} isRoot={false}
              onAdd={onAdd} onRemove={onRemove} onRename={onRename} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MindmapPage() {
  const tenantId = useAppStore((s) => s.config?.tenant_id ?? '');
  const qc = useQueryClient();
  const [activeMap, setActiveMap] = useState<StudyMindmap | null>(null);
  const [tree, setTree] = useState<MindNode | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');

  const { data: maps = [] } = useQuery({ queryKey: ['study-mindmaps', tenantId], queryFn: () => listMindmaps(tenantId), enabled: !!tenantId });

  const createMutation = useMutation({
    mutationFn: () => createMindmap(tenantId, newTitle.trim(), newSubject.trim() || null),
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ['study-mindmaps'] });
      const updated = await listMindmaps(tenantId);
      const map = updated.find(m => m.id === id);
      if (map) { setActiveMap(map); setTree(JSON.parse(map.tree_json)); }
      setShowNew(false); setNewTitle(''); setNewSubject('');
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => saveMindmapTree(tenantId, activeMap!.id, JSON.stringify(tree), tree?.text ?? activeMap!.title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-mindmaps'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMindmap(tenantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-mindmaps'] }); setActiveMap(null); setTree(null); },
  });

  const mutateTree = useCallback((fn: (t: MindNode) => MindNode) => {
    setTree(prev => { if (!prev) return prev; const next = fn(prev); return next; });
  }, []);

  // Auto-save 1s after change
  const handleTreeChange = (fn: (t: MindNode) => MindNode) => {
    mutateTree(fn);
    setTimeout(() => saveMutation.mutate(), 800);
  };

  if (activeMap && tree) return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--surface-border)' }}>
        <button onClick={() => { setActiveMap(null); setTree(null); }} className="text-sm flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
          ← All Maps
        </button>
        <h1 className="font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{activeMap.title}</h1>
        {activeMap.subject && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{activeMap.subject}</span>}
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Double-click a node to rename · Hover for options</span>
        <button onClick={() => deleteMutation.mutate(activeMap.id)}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8">
        <NodeView node={tree} depth={0} isRoot
          onAdd={(pid, text) => handleTreeChange(t => addChild(t, pid, text))}
          onRemove={(id) => handleTreeChange(t => removeNode(t, id))}
          onRename={(id, text) => handleTreeChange(t => renameNode(t, id, text))}
          onToggle={(id) => mutateTree(t => toggleNode(t, id))} />
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#ede9fe' }}>
            <Network className="h-5 w-5" style={{ color: '#7c3aed' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mind Maps</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Visual topic trees for any subject</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--accent)' }}>
          <Plus className="h-4 w-4" /> New Map
        </button>
      </div>

      {maps.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '2px dashed var(--surface-border)' }}>
          <p className="text-4xl">🧠</p>
          <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No mind maps yet</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Create a visual tree of topics to organize your knowledge</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {maps.map(map => (
          <button key={map.id} onClick={() => { setActiveMap(map); setTree(JSON.parse(map.tree_json)); }}
            className="rounded-2xl p-5 text-left flex items-center gap-4 hover:shadow-md transition-shadow"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-border)' }}>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl" style={{ background: '#ede9fe' }}>🧠</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{map.title}</p>
              {map.subject && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{map.subject}</p>}
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {(() => { try { const t: MindNode = JSON.parse(map.tree_json); return `${t.children.length} branches`; } catch { return ''; } })()}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg)' }}>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>New Mind Map</h2>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Root topic (e.g. Photosynthesis)"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Subject (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--surface-border)', color: 'var(--text-primary)' }} />
            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm border" style={{ borderColor: 'var(--surface-border)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!newTitle.trim() || createMutation.isPending}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
