import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'

const IN_TO_M = 0.0254

// ── Check if two boxes overlap (world inches) ────────────────────────────
function boxesOverlap(a, b) {
  const eps = 0.5 // half-inch tolerance
  return (
    a.x     < b.x + b.l - eps && a.x + a.l > b.x + eps &&
    a.y     < b.y + b.w - eps && a.y + a.w > b.y + eps &&
    a.z     < b.z + b.h - eps && a.z + a.h > b.z + eps
  )
}

// ── Single packed box mesh ────────────────────────────────────────────────
function PackedBox({
  box, clipX, clipY, clipZ, explodeAmount,
  isHovered, onHover, onUnhover,
  isDragging, isOverlapping,
  editMode, onDragStart,
}) {
  const meshRef = useRef()

  // Explode: push box away from truck center on load-order axis (disabled in edit mode)
  const explodeOffset = editMode ? 0 : explodeAmount * box.loadOrder * 0.01

  const cx = box.x + box.l / 2 + explodeOffset
  const cy = box.y + box.w / 2
  const cz = box.z + box.h / 2

  // Clip: hide box if its center is beyond the clip planes
  const visible = (
    (cx * IN_TO_M) <= (clipX) + 0.001 &&
    (cy * IN_TO_M) <= (clipY) + 0.001 &&
    (cz * IN_TO_M) <= (clipZ) + 0.001
  )

  if (!visible) return null

  const color = box.department_color || '#6b7280'
  const rgb = new THREE.Color(color)

  // Visual state
  let opacity = isHovered ? 0.95 : 0.75
  let edgeColor = isHovered ? '#ffffff' : rgb.clone().multiplyScalar(1.5)
  let boxColor = rgb
  if (isDragging) { opacity = 0.9; edgeColor = '#facc15' }
  if (isOverlapping && !isDragging) { boxColor = new THREE.Color('#ef4444'); edgeColor = '#ff0000'; opacity = 0.85 }

  return (
    <group position={[cx * IN_TO_M, cz * IN_TO_M, cy * IN_TO_M]}>
      {/* Solid face */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onHover(box) }}
        onPointerOut={(e) => { e.stopPropagation(); onUnhover() }}
        onPointerDown={editMode ? (e) => { e.stopPropagation(); onDragStart(e, box) } : undefined}
      >
        <boxGeometry args={[box.l * IN_TO_M, box.h * IN_TO_M, box.w * IN_TO_M]} />
        <meshStandardMaterial
          color={boxColor}
          transparent
          opacity={opacity}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      {/* Wireframe edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(box.l * IN_TO_M, box.h * IN_TO_M, box.w * IN_TO_M)]} />
        <lineBasicMaterial color={edgeColor} linewidth={1} />
      </lineSegments>
      {/* Edit mode: show drag handle indicator */}
      {editMode && isHovered && !isDragging && (
        <Html center distanceFactor={6}>
          <div style={{
            background: 'rgba(250,204,21,0.9)', color: '#000', fontSize: '10px',
            padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>drag to move</div>
        </Html>
      )}
    </group>
  )
}

// ── Invisible drag plane (floor XZ or vertical XY) ───────────────────────
function DragPlane({ onMove, planeY, isVertical }) {
  const { camera, gl } = useThree()
  const planeRef = useRef(new THREE.Plane())

  useFrame(() => {
    if (isVertical) {
      // XY plane (vertical drag: constant Z through drag start)
      planeRef.current.set(new THREE.Vector3(0, 0, 1), -planeY)
    } else {
      // XZ plane (floor drag: constant Y = floor)
      planeRef.current.set(new THREE.Vector3(0, 1, 0), -planeY)
    }
  })

  const handlePointerMove = useCallback((e) => {
    const raycaster = new THREE.Raycaster()
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    raycaster.ray.intersectPlane(planeRef.current, target)
    if (target) onMove(target)
  }, [camera, gl, onMove])

  return (
    <mesh
      position={[0, 0, 0]}
      rotation={isVertical ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
      onPointerMove={handlePointerMove}
      visible={false}
    >
      <planeGeometry args={[1000, 1000]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0} />
    </mesh>
  )
}

// ── Truck wireframe shell ─────────────────────────────────────────────────
function TruckShell({ truck }) {
  const l = truck.length * IN_TO_M
  const w = truck.width * IN_TO_M
  const h = truck.height * IN_TO_M

  const geo = useMemo(() => new THREE.BoxGeometry(l, h, w), [l, h, w])
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo])

  return (
    <group position={[l / 2, h / 2, w / 2]}>
      {/* Transparent shell */}
      <mesh>
        <primitive object={geo} />
        <meshStandardMaterial color="#1a2a4a" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      {/* Wire edges */}
      <lineSegments>
        <primitive object={edges} />
        <lineBasicMaterial color="#4f8ef7" linewidth={2} />
      </lineSegments>
    </group>
  )
}

// ── Main scene ────────────────────────────────────────────────────────────
function Scene({
  truck, packed, clipX, clipY, clipZ, explodeAmount,
  onHover, onUnhover, hoveredBox,
  editMode, draggingBox, overlappingIds,
  onDragStart, onDragMove, onDragEnd,
  dragPlaneY, dragIsVertical,
}) {
  const IN_TO_M_local = IN_TO_M
  const l = truck.length * IN_TO_M_local
  const w = truck.width  * IN_TO_M_local
  const h = truck.height * IN_TO_M_local

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <pointLight position={[l / 2, 3, w / 2]} intensity={0.4} color="#4f8ef7" />

      <TruckShell truck={truck} />

      {/* CAB / DOOR labels — Html projects 3D position to screen so they rotate with the scene */}
      <Html position={[0, h * 0.55, w / 2]} center>
        <div style={{
          color: '#22c55e', fontWeight: 'bold', fontSize: '13px',
          background: 'rgba(0,0,0,0.75)', padding: '3px 8px',
          borderRadius: '4px', border: '1px solid #22c55e',
          userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap'
        }}>CAB</div>
      </Html>
      <Html position={[l, h * 0.55, w / 2]} center>
        <div style={{
          color: '#f97316', fontWeight: 'bold', fontSize: '13px',
          background: 'rgba(0,0,0,0.75)', padding: '3px 8px',
          borderRadius: '4px', border: '1px solid #f97316',
          userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap'
        }}>DOOR</div>
      </Html>

      {packed.map((box, i) => (
        <PackedBox
          key={`${box.id}-${box.unitIndex}-${i}`}
          box={box}
          clipX={clipX}
          clipY={clipY}
          clipZ={clipZ}
          explodeAmount={explodeAmount}
          isHovered={hoveredBox && hoveredBox.id === box.id && hoveredBox.unitIndex === box.unitIndex}
          onHover={onHover}
          onUnhover={onUnhover}
          editMode={editMode}
          isDragging={draggingBox && draggingBox.id === box.id && draggingBox.unitIndex === box.unitIndex}
          isOverlapping={overlappingIds && overlappingIds.has(`${box.id}-${box.unitIndex}`)}
          onDragStart={onDragStart}
        />
      ))}

      {/* Full-scene drag plane when dragging */}
      {editMode && draggingBox && (
        <DragPlane
          onMove={onDragMove}
          planeY={dragPlaneY}
          isVertical={dragIsVertical}
        />
      )}

      {/* Click anywhere to end drag */}
      {editMode && draggingBox && (
        <mesh
          position={[l / 2, h / 2, w / 2]}
          onPointerUp={onDragEnd}
          visible={false}
        >
          <boxGeometry args={[1000, 1000, 1000]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}

      <Grid
        position={[l / 2, 0, w / 2]}
        args={[l + 2, w + 2]}
        cellSize={0.3}
        cellThickness={0.5}
        cellColor={editMode ? '#1a3a1a' : '#2d2d40'}
        sectionSize={1}
        sectionThickness={1}
        sectionColor={editMode ? '#2a5a2a' : '#3d3d55'}
        fadeDistance={20}
        fadeStrength={2}
        followCamera={false}
        infiniteGrid={false}
      />
    </>
  )
}

// ── Tooltip overlay ───────────────────────────────────────────────────────
function BoxTooltip({ box }) {
  if (!box) return null
  return (
    <div className="absolute top-4 right-4 card z-10 text-sm min-w-48 pointer-events-none">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: box.department_color || '#6b7280' }}
        />
        <span className="font-semibold text-white">{box.name}</span>
      </div>
      {box.sku && <div className="text-gray-400 text-xs mb-1">SKU: {box.sku}</div>}
      {box.department_name && (
        <div className="text-xs text-gray-400 mb-1">Dept: {box.department_name}</div>
      )}
      <div className="text-xs text-gray-300">
        {box.l}" × {box.w}" × {box.h}"
      </div>
      <div className="text-xs text-gray-400">
        {box.weight ? `${box.weight} lbs` : 'Weight N/A'}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Load order: #{box.loadOrder}
      </div>
    </div>
  )
}

// ── Exported viewer component ─────────────────────────────────────────────
class CanvasErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full bg-dark-900 text-red-400 text-sm p-6 text-center">
          <div>
            <div className="text-2xl mb-2">⚠️</div>
            <div className="font-semibold mb-1">3D view error</div>
            <div className="text-xs text-gray-500">{String(this.state.error.message)}</div>
            <button
              className="mt-3 btn-secondary !text-xs"
              onClick={() => this.setState({ error: null })}
            >Retry</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function TruckViewer3D({ truck, packed, editMode, onBoxMoved }) {
  const [hoveredBox, setHoveredBox] = useState(null)
  const [explodeAmount, setExplodeAmount] = useState(0)
  const [clipX, setClipX] = useState(truck ? truck.length * IN_TO_M : 100)
  const [clipY, setClipY] = useState(truck ? truck.width * IN_TO_M : 100)
  const [clipZ, setClipZ] = useState(truck ? truck.height * IN_TO_M : 100)
  const [perspective, setPerspective] = useState(true)

  // Drag state
  const [draggingBox, setDraggingBox] = useState(null)      // the box being dragged (copy)
  const [dragOffset, setDragOffset] = useState(null)        // {dx, dy, dz} from box origin to pick point
  const [dragIsVertical, setDragIsVertical] = useState(false) // Shift = vertical mode
  const [dragPlaneY, setDragPlaneY] = useState(0)           // the plane's constant coordinate
  const [overlappingIds, setOverlappingIds] = useState(null) // Set of key strings

  // Ref to avoid stale closure in drag handlers
  const dragBoxRef = useRef(null)
  const dragOffsetRef = useRef(null)
  const dragVertRef = useRef(false)
  const packedRef = useRef(packed)
  useEffect(() => { packedRef.current = packed }, [packed])

  if (!truck) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a truck profile to see the 3D view
      </div>
    )
  }

  const tl = truck.length * IN_TO_M
  const tw = truck.width * IN_TO_M
  const th = truck.height * IN_TO_M

  // Snap position to 1-inch grid, clamped within truck bounds
  const snapAndClamp = useCallback((box, rawX, rawY, rawZ) => {
    const snap = 1 // 1 inch
    let x = Math.round(rawX / snap) * snap
    let y = Math.round(rawY / snap) * snap
    let z = Math.round(rawZ / snap) * snap
    x = Math.max(0, Math.min(truck.length - DOOR_CLEARANCE_IN - box.l, x))
    y = Math.max(0, Math.min(truck.width - box.w, y))
    z = Math.max(0, Math.min(truck.height - box.h, z))
    return { x, y, z }
  }, [truck])

  const DOOR_CLEARANCE_IN = 12

  const handleDragStart = useCallback((e, box) => {
    if (!editMode) return
    const isVertical = e.shiftKey
    dragVertRef.current = isVertical
    setDragIsVertical(isVertical)

    // dragPlaneY: for floor drag = box bottom Y in metres; for vertical = box front Z in metres
    const planeVal = isVertical
      ? (box.y + box.w / 2) * IN_TO_M   // Z in world (R3F world: z = y in inches)
      : box.z * IN_TO_M                   // floor height in world Y

    setDragPlaneY(planeVal)
    dragBoxRef.current = { ...box }
    setDraggingBox({ ...box })
    setDragOffset({ dx: 0, dy: 0, dz: 0 })
    dragOffsetRef.current = { dx: 0, dy: 0, dz: 0 }
  }, [editMode])

  const handleDragMove = useCallback((worldPoint) => {
    const box = dragBoxRef.current
    if (!box) return
    const isVert = dragVertRef.current

    let rawX, rawY, rawZ
    if (isVert) {
      // world: x→x, y→z(height), z→y(width) in inches
      rawX = worldPoint.x / IN_TO_M - box.l / 2
      rawY = box.y                                 // keep y fixed
      rawZ = worldPoint.y / IN_TO_M - box.h / 2   // vertical = world Y
    } else {
      // floor plane: world x→x, world z→y(width), y is floor
      rawX = worldPoint.x / IN_TO_M - box.l / 2
      rawY = worldPoint.z / IN_TO_M - box.w / 2
      rawZ = box.z                                 // keep height fixed
    }

    const snapped = snapAndClamp(box, rawX, rawY, rawZ)

    // For Shift+drag vertical: snap to nearest stacking level
    if (isVert) {
      const others = packedRef.current.filter(b =>
        !(b.id === box.id && b.unitIndex === box.unitIndex)
      )
      // Find top faces within footprint
      const supportZ = others.reduce((best, b) => {
        const footprintX = snapped.x < b.x + b.l - 0.5 && snapped.x + box.l > b.x + 0.5
        const footprintY = snapped.y < b.y + b.w - 0.5 && snapped.y + box.w > b.y + 0.5
        if (footprintX && footprintY) return Math.max(best, b.z + b.h)
        return best
      }, 0)
      // Snap to floor or nearest top-face within 6 inches
      const levels = [0, ...others.map(b => b.z + b.h)].sort((a, b) => a - b)
      let bestLevel = snapped.z
      let bestDist = Infinity
      for (const lvl of levels) {
        const d = Math.abs(snapped.z - lvl)
        if (d < bestDist) { bestDist = d; bestLevel = lvl }
      }
      snapped.z = bestLevel
    }

    // Overlap check
    const others = packedRef.current.filter(b =>
      !(b.id === box.id && b.unitIndex === box.unitIndex)
    )
    const candidate = { ...box, ...snapped }
    const hits = new Set()
    for (const b of others) {
      if (boxesOverlap(candidate, b)) hits.add(`${b.id}-${b.unitIndex}`)
    }
    setOverlappingIds(hits.size > 0 ? hits : null)

    // Update dragging box position for live preview
    const updated = { ...box, ...snapped }
    dragBoxRef.current = updated
    setDraggingBox(updated)
  }, [snapAndClamp])

  const handleDragEnd = useCallback(() => {
    const box = dragBoxRef.current
    if (!box) return
    dragBoxRef.current = null
    setDraggingBox(null)
    setOverlappingIds(null)
    if (onBoxMoved) onBoxMoved(box)
  }, [onBoxMoved])

  // Build the packed array with dragging box substituted in for live preview
  const displayPacked = useMemo(() => {
    if (!draggingBox) return packed
    return packed.map(b =>
      (b.id === draggingBox.id && b.unitIndex === draggingBox.unitIndex) ? draggingBox : b
    )
  }, [packed, draggingBox])

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center gap-4 px-3 py-2 bg-dark-800 border-b border-dark-600 text-xs flex-wrap">
        {/* Edit mode indicator */}
        {editMode && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-semibold text-xs">
            ✏️ Edit Mode — drag cases to reposition · Shift+drag = up/down · Ctrl+Z = undo
          </div>
        )}

        {!editMode && (
          <>
            {/* Layer sliders */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-medium">Front Clip:</span>
              <input
                type="range" min={0} max={tl} step={tl / 100}
                value={clipX} onChange={e => setClipX(parseFloat(e.target.value))}
                className="w-24 accent-blue-500"
              />
              <span className="text-gray-500 w-12">{Math.round((clipX / tl) * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-medium">Side Clip:</span>
              <input
                type="range" min={0} max={tw} step={tw / 100}
                value={clipY} onChange={e => setClipY(parseFloat(e.target.value))}
                className="w-24 accent-purple-500"
              />
              <span className="text-gray-500 w-12">{Math.round((clipY / tw) * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-medium">Height Clip:</span>
              <input
                type="range" min={0} max={th} step={th / 100}
                value={clipZ} onChange={e => setClipZ(parseFloat(e.target.value))}
                className="w-24 accent-teal-500"
              />
              <span className="text-gray-500 w-12">{Math.round((clipZ / th) * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 border-l border-dark-500 pl-4">
              <span className="text-gray-400 font-medium">Explode:</span>
              <input
                type="range" min={0} max={100} step={1}
                value={explodeAmount} onChange={e => setExplodeAmount(parseFloat(e.target.value))}
                className="w-24 accent-orange-400"
              />
            </div>
            <button
              onClick={() => { setClipX(tl); setClipY(tw); setClipZ(th); setExplodeAmount(0) }}
              className="btn-secondary !py-1 !px-2 text-xs ml-auto"
            >
              Reset View
            </button>
            <button
              onClick={() => setPerspective(p => !p)}
              className="btn-secondary !py-1 !px-2 text-xs"
            >
              {perspective ? 'Isometric' : 'Perspective'}
            </button>
          </>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <CanvasErrorBoundary>
          <Canvas
            camera={
              perspective
                ? { position: [tl * 0.8, th * 1.2, tw * 1.8], fov: 50, near: 0.01, far: 100 }
                : { position: [tl * 0.8, th * 1.2, tw * 1.8], fov: 10, near: 0.01, far: 200 }
            }
            style={{ background: '#0a0a0f', cursor: editMode ? (draggingBox ? 'grabbing' : 'grab') : 'default' }}
            shadows
            onPointerUp={draggingBox ? handleDragEnd : undefined}
          >
            <Scene
              truck={truck}
              packed={displayPacked}
              clipX={editMode ? tl : clipX}
              clipY={editMode ? tw : clipY}
              clipZ={editMode ? th : clipZ}
              explodeAmount={explodeAmount}
              onHover={setHoveredBox}
              onUnhover={() => setHoveredBox(null)}
              hoveredBox={hoveredBox}
              editMode={editMode}
              draggingBox={draggingBox}
              overlappingIds={overlappingIds}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              dragPlaneY={dragPlaneY}
              dragIsVertical={dragIsVertical}
            />
            <OrbitControls
              enabled={!editMode || !draggingBox}
              enableRotate={!editMode}
              enableDamping
              dampingFactor={0.08}
              minDistance={0.5}
              maxDistance={30}
              target={[tl / 2, th / 2, tw / 2]}
            />
          </Canvas>
        </CanvasErrorBoundary>

        <BoxTooltip box={hoveredBox} />

        {/* Overlap warning */}
        {overlappingIds && overlappingIds.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-500 text-red-200 text-xs px-3 py-1.5 rounded-lg pointer-events-none">
            ⚠ Overlapping {overlappingIds.size} case{overlappingIds.size > 1 ? 's' : ''} — release to place anyway or drag clear
          </div>
        )}
      </div>
    </div>
  )
}
