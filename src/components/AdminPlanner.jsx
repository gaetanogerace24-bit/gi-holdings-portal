import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const DEFAULT_COLUMNS = [
  { id: "vacant", label: "Vacant", color: "#dc2626", bg: "#fef2f2" },
  { id: "under_construction", label: "Under Construction", color: "#d97706", bg: "#fffbeb" },
  { id: "inspection", label: "Inspection", color: "#2563eb", bg: "#eff6ff" },
  { id: "occupied", label: "Occupied", color: "#d97706", bg: "#fffbeb" },
  { id: "vacant_renter_found", label: "Vacant / Renter Found", color: "#16a34a", bg: "#f0f9f4" },
];

export default function AdminPlanner({ tenants = [] }) {
  const [properties, setProperties] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [dragCardId, setDragCardId] = useState(null);
  const [overColId, setOverColId] = useState(null);
  const [colDragReady, setColDragReady] = useState(null); // col id that's been double-clicked
  const [dragColId, setDragColId] = useState(null);
  const [overColReorder, setOverColReorder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  useEffect(() => { load(); }, []);

  // Click anywhere to cancel col drag ready state
  useEffect(() => {
    const cancel = () => { if (!dragColId) setColDragReady(null); };
    window.addEventListener("click", cancel);
    return () => window.removeEventListener("click", cancel);
  }, [dragColId]);

  const load = async () => {
    const [{ data: propData }, { data: settingsData }] = await Promise.all([
      supabase.from("properties").select("*").neq("status", "archived").order("created_at", { ascending: true }),
      supabase.from("settings").select("*").eq("key", "planner_columns").single(),
    ]);
    setProperties(propData || []);
    if (settingsData?.value && Array.isArray(settingsData.value) && settingsData.value.length > 0) {
      setColumns(settingsData.value);
    }
    setLoading(false);
  };

  const saveColumns = async (newCols) => {
    setColumns(newCols);
    await supabase.from("settings").update({ value: newCols, updated_at: new Date().toISOString() }).eq("key", "planner_columns");
  };

  const deleteColumn = async (colId) => {
    const affected = properties.filter(p => p.planner_stage === colId);
    if (affected.length > 0) {
      const ids = affected.map(p => p.id);
      setProperties(prev => prev.map(p => ids.includes(p.id) ? { ...p, planner_stage: null } : p));
      await supabase.from("properties").update({ planner_stage: null }).in("id", ids);
    }
    saveColumns(columns.filter(c => c.id !== colId));
  };

  const getTenant = (prop) => tenants.find(t => t.id === prop.tenant_id) || null;

  const moveCard = async (propId, newStage) => {
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, planner_stage: newStage } : p));
    await supabase.from("properties").update({ planner_stage: newStage }).eq("id", propId);
  };

  const reorderColumns = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const newCols = [...columns];
    const fromIdx = newCols.findIndex(c => c.id === fromId);
    const toIdx = newCols.findIndex(c => c.id === toId);
    const [moved] = newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, moved);
    saveColumns(newCols);
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    const id = newColName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#65a30d"];
    const bgs = ["#f5f3ff", "#ecfeff", "#fdf2f8", "#fff7ed", "#f7fee7"];
    saveColumns([...columns, { id, label: newColName.trim(), color: colors[columns.length % 5], bg: bgs[columns.length % 5] }]);
    setNewColName(""); setAddingCol(false);
  };

  const unassigned = properties.filter(p => !p.planner_stage);

  if (loading) return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>🗂 Property Planner</h1>
      <div style={{ color: "#9ca3af", marginTop: 8 }}>Loading...</div>
    </div>
  );

  const CardItem = ({ prop }) => {
    const t = getTenant(prop);
    return (
      <div
        draggable
        onDragStart={e => {
          e.stopPropagation();
          setDragCardId(prop.id);
          setDragColId(null);
          setColDragReady(null);
          e.dataTransfer.setData("cardId", prop.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => { setDragCardId(null); setOverColId(null); }}
        style={{
          background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb",
          padding: "12px 14px", cursor: "grab",
          opacity: dragCardId === prop.id ? 0.4 : 1,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          userSelect: "none", marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, pointerEvents: "none" }}>🏠 {prop.address}</div>
        {t ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, pointerEvents: "none" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
              {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{t.name}</span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, pointerEvents: "none" }}>No tenant</div>
        )}
        <select
          value={prop.planner_stage || ""}
          onChange={e => moveCard(prop.id, e.target.value || null)}
          onMouseDown={e => e.stopPropagation()}
          style={{ marginTop: 10, width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #e5e7eb", fontSize: 11, color: "#6b7280", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", background: "#f9fafb" }}
        >
          <option value="">— Unassigned —</option>
          {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
    );
  };

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>🗂 Property Planner</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Drag cards to move · Double-click column header to reorder</div>
        </div>
        <button onClick={() => setAddingCol(true)} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          + Add column
        </button>
      </div>

      {addingCol && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
          <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") setAddingCol(false); }}
            placeholder="Column name..."
            style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid #1b3d2a", fontFamily: "'DM Sans', sans-serif", fontSize: 14, width: 220, outline: "none" }} />
          <button onClick={addColumn} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add</button>
          <button onClick={() => { setAddingCol(false); setNewColName(""); }} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div
            onDragOver={e => { e.preventDefault(); if (!dragColId) setOverColId("unassigned"); }}
            onDragLeave={() => setOverColId(null)}
            onDrop={e => {
              e.preventDefault();
              const cardId = e.dataTransfer.getData("cardId");
              if (cardId) moveCard(cardId, null);
              setOverColId(null); setDragCardId(null);
            }}
            style={{ minWidth: 260, maxWidth: 260, flexShrink: 0, borderRadius: 14, background: overColId === "unassigned" ? "#f5f3ff" : "#f9fafb", border: `2px solid ${overColId === "unassigned" ? "#7c3aed" : "#e5e7eb"}`, transition: "all 0.15s" }}
          >
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#9ca3af" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>Unassigned</span>
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 20, padding: "2px 9px" }}>{unassigned.length}</span>
              </div>
            </div>
            <div style={{ padding: "10px 10px", minHeight: 80 }}>
              {unassigned.map(prop => <CardItem key={prop.id} prop={prop} />)}
            </div>
          </div>
        )}

        {/* Regular columns */}
        {columns.map(col => {
          const cards = properties.filter(p => p.planner_stage === col.id);
          const isCardOver = overColId === col.id && dragCardId;
          const isColReorderOver = overColReorder === col.id && dragColId && dragColId !== col.id;
          const isThisColDragging = dragColId === col.id;
          const isReady = colDragReady === col.id;

          return (
            <div
              key={col.id}
              draggable={isReady || isThisColDragging}
              onDragStart={e => {
                if (!isReady) { e.preventDefault(); return; }
                e.stopPropagation();
                setDragColId(col.id);
                setDragCardId(null);
                e.dataTransfer.setData("colId", col.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => { setDragColId(null); setOverColReorder(null); setColDragReady(null); }}
              onDragOver={e => {
                e.preventDefault();
                if (dragColId && dragColId !== col.id) setOverColReorder(col.id);
                else if (dragCardId) setOverColId(col.id);
              }}
              onDragLeave={() => { setOverColId(null); setOverColReorder(null); }}
              onDrop={e => {
                e.preventDefault();
                const cardId = e.dataTransfer.getData("cardId");
                const colId = e.dataTransfer.getData("colId");
                if (cardId) { moveCard(cardId, col.id); setDragCardId(null); }
                if (colId && colId !== col.id) reorderColumns(colId, col.id);
                setOverColId(null); setOverColReorder(null);
                setDragCardId(null); setDragColId(null);
              }}
              style={{
                minWidth: 260, maxWidth: 260, flexShrink: 0, borderRadius: 14,
                background: isCardOver ? col.bg : "#f9fafb",
                border: isColReorderOver ? `2px dashed ${col.color}` : `2px solid ${isCardOver ? col.color : isReady ? col.color : "#e5e7eb"}`,
                transition: "all 0.15s",
                opacity: isThisColDragging ? 0.4 : 1,
              }}
            >
              {/* Column header — double click to enable dragging */}
              <div
                onDoubleClick={e => { e.stopPropagation(); setColDragReady(col.id); setDragCardId(null); }}
                style={{
                  padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb",
                  cursor: isReady ? "grab" : "default",
                  userSelect: "none",
                  background: isReady ? col.bg : "transparent",
                  borderRadius: "12px 12px 0 0",
                }}
                title="Double-click to drag column"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{col.label}</span>
                    {isReady && <span style={{ fontSize: 10, color: col.color, fontWeight: 600 }}>grab & drag →</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.color}`, borderRadius: 20, padding: "2px 9px" }}>{cards.length}</span>
                    <button onClick={e => { e.stopPropagation(); deleteColumn(col.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", fontFamily: "'DM Sans', sans-serif" }}
                      onMouseOver={e => e.currentTarget.style.color = "#dc2626"}
                      onMouseOut={e => e.currentTarget.style.color = "#d1d5db"}
                    >✕</button>
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 10px", minHeight: 80 }}>
                {cards.map(prop => <CardItem key={prop.id} prop={prop} />)}
                {cards.length === 0 && <div style={{ textAlign: "center", padding: "20px 10px", color: "#d1d5db", fontSize: 12 }}>Drop cards here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
