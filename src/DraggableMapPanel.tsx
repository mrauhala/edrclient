import React, { useState, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import CollectionInfo, { LicenseInfo } from './CollectionInfo';
import { Collection } from './DataRetrievalAPI';
import { useValidation } from './contexts/ValidationContext';

interface DraggableMapPanelProps {
  collection: Collection;
  fallbackLicense?: LicenseInfo | null;
}

export default function DraggableMapPanel({ collection, fallbackLicense }: DraggableMapPanelProps) {
  const { validationResult } = useValidation();
  const validationErrors = validationResult.collectionErrors
    ? (validationResult.collectionErrors[collection.id] ?? [])
    : undefined;

  const [pos, setPos] = useState({ x: 10, y: 10 });
  const [collapsed, setCollapsed] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const constrainPosition = useCallback((x: number, y: number) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return { x, y };

    const maxX = parent.clientWidth - panel.offsetWidth;
    const maxY = parent.clientHeight - panel.offsetHeight;
    return {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY)),
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPos(constrainPosition(dragStart.current.posX + dx, dragStart.current.posY + dy));
  }, [dragging, constrainPosition]);

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'absolute',
        top: pos.y,
        left: pos.x,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '8px',
        fontSize: '14px',
        width: 350,
        zIndex: 1000,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      {/* Drag handle bar */}
      <Box
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          pt: '6px',
          pb: '2px',
        }}
      >
        {/* Pill-shaped drag indicator */}
        <Box sx={{
          width: 32,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.25)',
        }} />
      </Box>

      {/* Content + expand button */}
      <Box sx={{ position: 'relative', px: '16px', pb: '12px' }}>
        {/* Expand/collapse button — top-right of content area */}
        <IconButton
          size="small"
          onClick={() => setCollapsed((c) => !c)}
          sx={{
            position: 'absolute',
            top: 0,
            right: 8,
            color: 'rgba(255,255,255,0.5)',
            '&:hover': { color: 'rgba(255,255,255,0.8)' },
          }}
        >
          {collapsed ? <ExpandMore sx={{ fontSize: 18 }} /> : <ExpandLess sx={{ fontSize: 18 }} />}
        </IconButton>

        {collapsed ? (
          <CollectionInfo collection={collection} dark compact fallbackLicense={fallbackLicense} validationErrors={validationErrors} />
        ) : (
          <CollectionInfo collection={collection} dark clampDescription fallbackLicense={fallbackLicense} validationErrors={validationErrors} />
        )}
      </Box>
    </Box>
  );
}
