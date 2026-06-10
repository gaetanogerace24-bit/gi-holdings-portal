import { useState, useEffect, useRef, useCallback } from "react";
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

  // Card drag state
  const [draggingCard, setDraggingCard] = useState(null);
  const [cardOver, setCardOver] = useState(null);
  const ghostRef = useRef(null);

  // Column drag state
  const [draggingCol, setDraggingCol] = useState(null);
  const [colOver, setColOver] = useState(null);

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
    const idx = columns.length % colors.length;
    saveColumns([...columns, { id, label: newColName.trim(), color: colors[idx], bg: bgs[idx] }]);
    setNewColName(""); setAddingCol(false);
  };

  // ── Pointer-based card drag ──────────────────────────────────────
  const boardRef = useRef(null);
  const pointerDragRef = useRef({ active: false, propId: null, ghost: null, startX: 0, startY: 0 });

  const onCardPointerDown = (e, prop) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();

    // Create ghost
    const ghost = el.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.opacity = "0.85";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
    ghost.style.borderRadius = "10px";
    ghost.style.transform = "rotate(2deg)";
    document.body.appendChild(ghost);

    pointerDragRef.current = {
      active: true,
      propId: prop.id,
      ghost,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
    };
    setDraggingCard(prop.id);
    el.setPointerCapture(e.pointerId);
  };

  const onCardPointerMove = (e) => {
    const ref = pointerDragRef.current;
    if (!ref.active) return;
    e.preventDefault();

    ref.ghost.style.left = (e.clientX - ref.startX) + "px";
    ref.ghost.style.top = (e.clientY - ref.startY) + "px";

    // Find which column we're over
    ref.ghost.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    ref.ghost.style.display = "";
    const colEl = el?.closest("[data-colid]");
    const hoveredCol = colEl ? colEl.getAttribute("data-colid") : null;
    setCardOver(hoveredCol);
  };

  const onCardPointerUp = (e) => {
    const ref = pointerDragRef.current;
    if (!ref.active) return;

    if (ref.ghost) { ref.ghost.remove(); }

    // Drop into hovered column
    ref.ghost.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const colEl = el?.closest("[data-colid]");
    const targetCol = colEl ? colEl.getAttribute("data-colid") : null;
    if (targetCol !== null) {
      moveCard(ref.propId, targetCol === "unassigned" ? null : targetCol);
    }

    pointerDragRef.current = { active: false, propId: null, ghost: null, startX: 0, startY: 0 };
    setDraggingCard(null);
    setCardOver(null);
  };

  // ── Double-click column drag (HTML5) ────────────────────────────
  const handleColDblClick = (colId) => {
    setDraggingCol(colId);
  };

  const unassigned = properties.filter(p => !p.planner_stage);

  if (loading) return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Planner</h1>
      <div style={{ color: "#9ca3af", fontSize: 14, marginTop: 8 }}>Loading...</div>
    </div>
  );

  const CardItem = ({ prop }) => {
    const t = getTenant(prop);
    const isBeingDragged = draggingCard === prop.id;
    return (
      <div
        onPointerDown={e => onCardPointerDown(e, prop)}
        onPointerMove={onCardPointerMove}
        onPointerUp={onCardPointerUp}
        style={{
          background: "#fff", borderRadius: 10,
          border: "1.5px solid #e5e7eb",
          padding: "12px 14px",
          cursor: "grab",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          userSelect: "none", marginBottom: 8,
          opacity: isBeingDragged ? 0.3 : 1,
          touchAction: "none",
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
          onPointerDown={e => e.stopPropagation()}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0, letterSpacing: "-0.5px" }}>🗂 Property Planner</h1>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Single-click drag cards · Double-click column header to reorder</div>
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

      <div ref={boardRef} style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <div
            data-colid="unassigned"
            style={{ minWidth: 260, maxWidth: 260, background: cardOver === "unassigned" ? "#f5f3ff" : "#f9fafb", borderRadius: 14, border: `2px solid ${cardOver === "unassigned" ? "#7c3aed" : "#e5e7eb"}`, transition: "all 0.15s", flexShrink: 0 }}
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

        {columns.map((col, colIdx) => {
          const cards = properties.filter(p => p.planner_stage === col.id);
          const isCardOver = cardOver === col.id;
          const isColOver = colOver === col.id && draggingCol && draggingCol !== col.id;
          const isThisColDragging = draggingCol === col.id;

          return (
            <div
              key={col.id}
              data-colid={col.id}
              draggable={isThisColDragging}
              onDragStart={e => {
                if (!isThisColDragging) { e.preventDefault(); return; }
                e.dataTransfer.setData("colId", col.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => { setDraggingCol(null); setColOver(null); }}
              onDragOver={e => { if (draggingCol) { e.preventDefault(); setColOver(col.id); } }}
              onDrop={e => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("colId");
                if (!fromId || fromId === col.id) return;
                const newCols = [...columns];
                const fromIdx = newCols.findIndex(c => c.id === fromId);
                const toIdx = newCols.findIndex(c => c.id === col.id);
                const [moved] = newCols.splice(fromIdx, 1);
                newCols.splice(toIdx, 0, moved);
                saveColumns(newCols);
                setDraggingCol(null); setColOver(null);
              }}
              style={{
                minWidth: 260, maxWidth: 260,
                background: isCardOver ? col.bg : "#f9fafb",
                borderRadius: 14,
                border: isColOver ? `2px dashed ${col.color}` : `2px solid ${isCardOver ? col.color : "#e5e7eb"}`,
                transition: "all 0.15s",
                flexShrink: 0,
                opacity: isThisColDragging ? 0.4 : 1,
              }}
            >
              <div
                onDoubleClick={() => handleColDblClick(col.id)}
                style={{ padding: "14px 16px 10px", borderBottom: "1px solid #e5e7eb", cursor: isThisColDragging ? "grabbing" : "default", userSelect: "none" }}
                title="Double-click to drag this column"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{col.label}</span>
                    {isThisColDragging && <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>drag now</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.color, background: col.bg, border: `1px solid ${col.color}`, borderRadius: 20, padding: "2px 9px" }}>{cards.length}</span>
                    <button onClick={e => { e.stopPropagation(); deleteColumn(col.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 13, padding: "2px 4px", fontFamily: "'DM Sans', sans-serif", borderRadius: 4 }}
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
