import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
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

  const addColumn = () => {
    if (!newColName.trim()) return;
    const id = newColName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const colors = ["#7c3aed", "#0891b2", "#db2777", "#ea580c", "#65a30d"];
    const bgs = ["#f5f3ff", "#ecfeff", "#fdf2f8", "#fff7ed", "#f7fee7"];
    saveColumns([...columns, { id, label: newColName.trim(), color: colors[columns.length % 5], bg: bgs[columns.length % 5] }]);
    setNewColName(""); setAddingCol(false);
  };

  const onDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    // Column reorder
    if (type === "COLUMN") {
      const newCols = [...columns];
      const [moved] = newCols.splice(source.index, 1);
      newCols.splice(destination.index, 0, moved);
      saveColumns(newCols);
      return;
    }

    // Card moved
    const newStage = destination.droppableId === "unassigned" ? null : destination.droppableId;
    const propId = result.draggableId;
    moveCard(propId, newStage);
  };

  const unassigned = properties.filter(p => !p.planner_stage);

  if (loading) return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>🗂 Property Planner</h1>
      <div style={{ color: "#9ca3af", marginTop: 8 }}>Loading...</div>
    </div>
  );

  // Build column list including unassigned
  const allColumns = [
    ...(unassigned.length > 0 ? [{ id: "unassigned", label: "Unassigned", color: "#9ca3af", bg: "#f9fafb", isUnassigned: true }] : []),
    ...columns,
  ];

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>🗂 Property Planner</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Drag cards or columns to reorder</div>
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

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}
            >
              {allColumns.map((col, colIndex) => {
                const cards = col.isUnassigned
                  ? unassigned
                  : properties.filter(p => p.planner_stage === col.id);

                return (
                  <Draggable
                    key={col.id}
                    draggableId={col.id}
                    index={colIndex}
                    isDragDisabled={col.isUnassigned}
                  >
                    {(colProvided, colSnapshot) => (
                      <div
                        ref={colProvided.innerRef}
                        {...colProvided.draggableProps}
                        style={{
                          minWidth: 260, maxWidth: 260, flexShrink: 0, borderRadius: 14,
                          background: colSnapshot.isDragging ? col.bg : "#f9fafb",
                          border: `2px solid ${colSnapshot.isDragging ? col.color : "#e5e7eb"}`,
                          boxShadow: colSnapshot.isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : "none",
                          ...colProvided.draggableProps.style,
                        }}
                      >
                        {/* Column header — drag handle for columns */}
                        <div
                          {...colProvided.dragHandleProps}
                          style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb", cursor: col.isUnassigned ? "default" : "grab", userSelect: "none" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{col.label}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.color}`, borderRadius: 20, padding: "2px 9px" }}>{cards.length}</span>
                              {!col.isUnassigned && (
                                <button onClick={() => deleteColumn(col.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", fontFamily: "'DM Sans', sans-serif" }}
                                  onMouseOver={e => e.currentTarget.style.color = "#dc2626"}
                                  onMouseOut={e => e.currentTarget.style.color = "#d1d5db"}
                                >✕</button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cards */}
                        <Droppable droppableId={col.id} type="CARD">
                          {(cardProvided, cardSnapshot) => (
                            <div
                              ref={cardProvided.innerRef}
                              {...cardProvided.droppableProps}
                              style={{
                                padding: "10px 10px", minHeight: 80,
                                background: cardSnapshot.isDraggingOver ? col.bg : "transparent",
                                borderRadius: "0 0 12px 12px",
                                transition: "background 0.15s",
                              }}
                            >
                              {cards.map((prop, index) => {
                                const t = getTenant(prop);
                                return (
                                  <Draggable key={prop.id} draggableId={prop.id} index={index}>
                                    {(cardProv, cardSnap) => (
                                      <div
                                        ref={cardProv.innerRef}
                                        {...cardProv.draggableProps}
                                        {...cardProv.dragHandleProps}
                                        style={{
                                          background: "#fff", borderRadius: 10,
                                          border: "1.5px solid #e5e7eb",
                                          padding: "12px 14px", cursor: "grab",
                                          boxShadow: cardSnap.isDragging ? "0 6px 18px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
                                          userSelect: "none", marginBottom: 8,
                                          ...cardProv.draggableProps.style,
                                        }}
                                      >
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>🏠 {prop.address}</div>
                                        {t ? (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                                            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f9f4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1b3d2a", flexShrink: 0 }}>
                                              {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                            </div>
                                            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{t.name}</span>
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>No tenant</div>
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
                                    )}
                                  </Draggable>
                                );
                              })}
                              {cardProvided.placeholder}
                              {cards.length === 0 && (
                                <div style={{ textAlign: "center", padding: "20px 10px", color: "#d1d5db", fontSize: 12 }}>Drop cards here</div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
