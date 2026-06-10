import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const DEFAULT_COLUMNS = [
  { id: "vacant", label: "Vacant", color: "#dc2626", bg: "#fef2f2" },
  { id: "under_construction", label: "Under Construction", color: "#d97706", bg: "#fffbeb" },
  { id: "inspection", label: "Inspection", color: "#2563eb", bg: "#eff6ff" },
  { id: "ready_to_rent", label: "Completed — Ready to Rent", color: "#16a34a", bg: "#f0f9f4" },
];

export default function AdminPlanner({ tenants = [], properties: propsProp }) {
  const [properties, setProperties] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [dragging, setDragging] = useState(null);         // card being dragged
  const [dragOver, setDragOver] = useState(null);         // column card is over
  const [draggingCol, setDraggingCol] = useState(null);   // column being dragged
  const [dragOverCol, setDragOverCol] = useState(null);   // column being hovered during col drag
  const [loading, setLoading] = useState(true);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");

  useEffect(() => { load(); }, []);

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
    const affectedProps = properties.filter(p => p.planner_stage === colId);
    if (affectedProps.length > 0) {
      const ids = affectedProps.map(p => p.id);
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

  // Card drag handlers
  const handleDragStart = (e, prop) => {
    setDragging(prop);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "card");
  };
  const handleDragOver = (e, colId) => {
    e.preventDefault();
    if (draggingCol) return; // don't interfere with column drag
    setDragOver(colId);
  };
  const handleDrop = (e, colId) => {
    e.preventDefault();
    if (dragging?.id && !draggingCol) {
      moveCard(dragging.id, colId === "unassigned" ? null : colId);
    }
    setDragging(null); setDragOver(null);
  };
  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  // Column drag handlers
  const handleColDragStart = (e, colId) => {
    setDraggingCol(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("type", "column");
  };
  const handleColDragOver = (e, colId) => {
    e.preventDefault();
    if (!draggingCol || draggingCol === colId) return;
    setDragOverCol(colId);
  };
  const handleColDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggingCol || draggingCol === targetColId) {
      setDraggingCol(null); setDragOverCol(null); return;
    }
    const newCols = [...columns];
    const fromIdx = newCols.findIndex(c => c.id === draggingCol);
    const toIdx = newCols.findIndex(c => c.id === targetColId);
    const [moved] = newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, moved);
    saveColumns(newCols);
    setDraggingCol(null); setDragOverCol(null);
  };
  const handleColDragEnd = () => { setDraggingCol(null); setDragOverCol(null); };

  const addColumn = () => {
    if (!newColName.trim()) return;
    const id = newColName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#65a30d"];
    const bgs = ["#f5f3ff", "#ecfeff", "#fdf2f8", "#fff7ed", "#f7fee7"];
    const idx = columns.length % colors.length;
    saveColumns([...columns, { id, label: newColName.trim(), color: colors[idx], bg: bgs[idx] }]);
    setNewColName(""); setAddingCol(false);
  };

  const unassigned = properties.filter(p => !p.planner_stage);
  const isOverUnassigned = dragOver === "unassigned";

  if (loading) {
    return (
      <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Planner</h1>
        <div style={{ color: "#9ca3af", fontSize: 14, marginTop: 8 }}>Loading...</div>
      </div>
    );
  }

  const CardItem = ({ prop }) => {
    const t = getTenant(prop);
    const isDragging = dragging?.id === prop.id;
    return (
      <div
        draggable
        onDragStart={e => handleDragStart(e, prop)}
        onDragEnd={handleDragEnd}
        style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 14px", cursor: "grab", opacity: isDragging ? 0.4 : 1, boxShadow: isDragging ? "none" : "0 1px 3px rgba(0,0,0,0.06)", userSelect: "none", marginBottom: 8 }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>🏠 {prop.address}</div>
        {t && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
              {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{t.name}</span>
          </div>
        )}
        {!t && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>No tenant</div>}
        <select
          value={prop.planner_stage || ""}
          onChange={e => moveCard(prop.id, e.target.value || null)}
          onClick={e => e.stopPropagation()}
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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>🗂 Property Planner</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Drag properties into a stage or use the dropdown on each card</div>
        </div>
        <button onClick={() => setAddingCol(true)} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          + Add column
        </button>
      </div>

      {/* Add column input */}
      {addingCol && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
          <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") setAddingCol(false); }} placeholder="Column name..." style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid #1b3d2a", fontFamily: "'DM Sans', sans-serif", fontSize: 14, width: 220, outline: "none" }} />
          <button onClick={addColumn} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add</button>
          <button onClick={() => { setAddingCol(false); setNewColName(""); }} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
        </div>
      )}

      {/* Board */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>

        {/* Unassigned column */}
        {unassigned.length > 0 && (
          <div
            onDragOver={e => handleDragOver(e, "unassigned")}
            onDrop={e => handleDrop(e, "unassigned")}
            style={{ minWidth: 260, maxWidth: 260, background: isOverUnassigned ? "#f5f3ff" : "#f9fafb", borderRadius: 14, border: `2px solid ${isOverUnassigned ? "#7c3aed" : "#e5e7eb"}`, transition: "all 0.15s", flexShrink: 0 }}
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

        {/* Regular columns — draggable */}
        {columns.map(col => {
          const cards = properties.filter(p => p.planner_stage === col.id);
          const isOver = dragOver === col.id;
          const isColDragging = draggingCol === col.id;
          const isColOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              draggable
              onDragStart={e => handleColDragStart(e, col.id)}
              onDragEnd={handleColDragEnd}
              onDragOver={e => { handleDragOver(e, col.id); handleColDragOver(e, col.id); }}
              onDrop={e => { handleDrop(e, col.id); handleColDrop(e, col.id); }}
              style={{
                minWidth: 260, maxWidth: 260,
                background: isOver ? col.bg : "#f9fafb",
                borderRadius: 14,
                border: isColOver ? `2px dashed ${col.color}` : `2px solid ${isOver ? col.color : "#e5e7eb"}`,
                transition: "all 0.15s",
                flexShrink: 0,
                opacity: isColDragging ? 0.5 : 1,
                cursor: "default",
              }}
            >
              {/* Column header — grab handle */}
              <div
                style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb", cursor: "grab", userSelect: "none" }}
                title="Drag to reorder column"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#d1d5db", fontSize: 12, letterSpacing: "1px" }}>⠿</span>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{col.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.color}`, borderRadius: 20, padding: "2px 9px" }}>{cards.length}</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteColumn(col.id); }}
                      title="Delete column"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", lineHeight: 1, fontFamily: "'DM Sans', sans-serif", borderRadius: 4 }}
                      onMouseOver={e => e.currentTarget.style.color = "#dc2626"}
                      onMouseOut={e => e.currentTarget.style.color = "#d1d5db"}
                    >✕</button>
                  </div>
                </div>
              </div>
              <div
                style={{ padding: "10px 10px", minHeight: 80 }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (!draggingCol) setDragOver(col.id); }}
                onDrop={e => { e.stopPropagation(); if (dragging && !draggingCol) { moveCard(dragging.id, col.id); setDragging(null); setDragOver(null); } }}
              >
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
