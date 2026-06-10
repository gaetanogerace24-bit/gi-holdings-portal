import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const DEFAULT_COLUMNS = [
  { id: "vacant", label: "Vacant", color: "#dc2626", bg: "#fef2f2" },
  { id: "under_construction", label: "Under Construction", color: "#d97706", bg: "#fffbeb" },
  { id: "inspection", label: "Inspection", color: "#2563eb", bg: "#eff6ff" },
  { id: "ready_to_rent", label: "Completed — Ready to Rent", color: "#16a34a", bg: "#f0f9f4" },
];

export default function AdminPlanner({ tenants = [] }) {
  const [properties, setProperties] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [hiddenIds, setHiddenIds] = useState([]); // IDs to HIDE (default: show all)
  const [showFilter, setShowFilter] = useState(false);

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
    // Move all properties in this column to vacant
    const affectedProps = properties.filter(p => getStage(p) === colId);
    if (affectedProps.length > 0) {
      const ids = affectedProps.map(p => p.id);
      setProperties(prev => prev.map(p => ids.includes(p.id) ? { ...p, planner_stage: "vacant" } : p));
      await supabase.from("properties").update({ planner_stage: "vacant" }).in("id", ids);
    }
    saveColumns(columns.filter(c => c.id !== colId));
  };

  const getTenant = (prop) => tenants.find(t => t.id === prop.tenant_id) || null;
  const getStage = (prop) => prop.planner_stage || "vacant";

  const moveCard = async (propId, newStage) => {
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, planner_stage: newStage } : p));
    await supabase.from("properties").update({ planner_stage: newStage }).eq("id", propId);
  };

  const handleDragStart = (e, prop) => { setDragging(prop); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, colId) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(colId); };
  const handleDrop = (e, colId) => {
    e.preventDefault();
    if (dragging && dragging.id) moveCard(dragging.id, colId);
    setDragging(null); setDragOver(null);
  };
  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  const addColumn = () => {
    if (!newColName.trim()) return;
    const id = newColName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#65a30d"];
    const bgs = ["#f5f3ff", "#ecfeff", "#fdf2f8", "#fff7ed", "#f7fee7"];
    const idx = columns.length % colors.length;
    saveColumns([...columns, { id, label: newColName.trim(), color: colors[idx], bg: bgs[idx] }]);
    setNewColName(""); setAddingCol(false);
  };

  const toggleHide = (id) => {
    setHiddenIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  const visibleProperties = properties.filter(p => !hiddenIds.includes(p.id));
  const hiddenCount = hiddenIds.length;

  if (loading) {
    return (
      <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Planner</h1>
        <div style={{ color: "#9ca3af", fontSize: 14, marginTop: 8 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>🗂 Property Planner</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Drag properties between stages to track their status</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowFilter(f => !f)}
            style={{ background: showFilter ? "#1b3d2a" : "#fff", color: showFilter ? "#fff" : "#1b3d2a", border: "1.5px solid #1b3d2a", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}
          >
            🏠 Properties
            {hiddenCount > 0 && <span style={{ background: "#dc2626", color: "#fff", borderRadius: 20, padding: "1px 7px", fontSize: 11 }}>{hiddenCount} hidden</span>}
          </button>
          <button onClick={() => setAddingCol(true)} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            + Add column
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>Click a property to show/hide it on the board</div>
            {hiddenCount > 0 && (
              <button onClick={() => setHiddenIds([])} style={{ fontSize: 12, color: "#4caf7d", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                Show all
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {properties.map(prop => {
              const t = getTenant(prop);
              const hidden = hiddenIds.includes(prop.id);
              const stage = columns.find(c => c.id === getStage(prop));
              return (
                <div
                  key={prop.id}
                  onClick={() => toggleHide(prop.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 12px", borderRadius: 10, background: hidden ? "#f9fafb" : "#f0f9f4", border: `1.5px solid ${hidden ? "#e5e7eb" : "#4caf7d"}`, transition: "all 0.15s", opacity: hidden ? 0.5 : 1 }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${hidden ? "#d1d5db" : "#1b3d2a"}`, background: hidden ? "#fff" : "#1b3d2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {!hidden && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>🏠 {prop.address}</div>
                    {t && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{t.name}</div>}
                    {!t && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>No tenant</div>}
                  </div>
                  {stage && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: stage.bg, color: stage.color }}>
                      {stage.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add column input */}
      {addingCol && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
          <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") setAddingCol(false); }} placeholder="Column name..." style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid #1b3d2a", fontFamily: "'DM Sans', sans-serif", fontSize: 14, width: 220, outline: "none" }} />
          <button onClick={addColumn} style={{ background: "#1b3d2a", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add</button>
          <button onClick={() => { setAddingCol(false); setNewColName(""); }} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#6b7280", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
        {columns.map(col => {
          const cards = visibleProperties.filter(p => getStage(p) === col.id);
          const isOver = dragOver === col.id;
          return (
            <div key={col.id} onDragOver={e => handleDragOver(e, col.id)} onDrop={e => handleDrop(e, col.id)}
              style={{ minWidth: 260, maxWidth: 260, background: isOver ? col.bg : "#f9fafb", borderRadius: 14, border: `2px solid ${isOver ? col.color : "#e5e7eb"}`, transition: "border-color 0.15s, background 0.15s", flexShrink: 0 }}
            >
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{col.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.color}`, borderRadius: 20, padding: "2px 9px" }}>{cards.length}</span>
                    <button onClick={() => deleteColumn(col.id)} title="Delete column"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", lineHeight: 1, fontFamily: "'DM Sans', sans-serif", borderRadius: 4 }}
                      onMouseOver={e => e.currentTarget.style.color = "#dc2626"}
                      onMouseOut={e => e.currentTarget.style.color = "#d1d5db"}
                    >✕</button>
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 80 }}>
                {cards.map(prop => {
                  const t = getTenant(prop);
                  const isDragging = dragging?.id === prop.id;
                  return (
                    <div key={prop.id} draggable onDragStart={e => handleDragStart(e, prop)} onDragEnd={handleDragEnd}
                      style={{ background: "#fff", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "12px 14px", cursor: "grab", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s, box-shadow 0.15s", boxShadow: isDragging ? "none" : "0 1px 3px rgba(0,0,0,0.06)", userSelect: "none" }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.3 }}>🏠 {prop.address}</div>
                      {t && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                            {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{t.name}</span>
                        </div>
                      )}
                      {!t && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>No tenant</div>}
                      <select value={getStage(prop)} onChange={e => moveCard(prop.id, e.target.value)} onClick={e => e.stopPropagation()}
                        style={{ marginTop: 10, width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid #e5e7eb", fontSize: 11, color: "#6b7280", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", background: "#f9fafb" }}
                      >
                        {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  );
                })}
                {cards.length === 0 && <div style={{ textAlign: "center", padding: "20px 10px", color: "#d1d5db", fontSize: 12 }}>Drop cards here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
