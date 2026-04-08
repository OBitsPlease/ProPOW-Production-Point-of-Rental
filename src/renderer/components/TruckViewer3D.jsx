import { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import * as THREE from 'three'

// ── Single packed box mesh ────────────────────────────────────────────────
function PackedBox({ box, clipX, clipY, clipZ, explodeAmount, isHovered, onHover, onUnhover }) {
  const meshRef = useRef()

  // Explode: push box away from truck center on load-order axis
  const explodeOffset = explodeAmount * box.loadOrder * 0.01

  const cx = box.x + box.l / 2 + explodeOffset
  const cy = box.y + box.w / 2
  const cz = box.z + box.h / 2

  // Clip: hide box if its center is beyond the clip planes
  const IN_TO_M = 0.0254
  const visible = (
    (cx * IN_TO_M) <= (clipX) + 0.001 &&
    (cy * IN_TO_M) <= (clipY) + 0.001 &&
    (cz * IN_TO_M) <= (clipZ) + 0.001
  )

  if (!visible) return null

  const color = box.department_color || '#6b7280'
  const rgb = new THREE.Color(color)

  return (
    <group position={[cx * IN_TO_M, cz * IN_TO_M, cy * IN_TO_M]}>
      {/* Solid face */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onHover(box) }}
        onPointerOut={(e) => { e.stopPropagation(); onUnhover() }}
      >
        <boxGeometry args={[box.l * IN_TO_M, box.h * IN_TO_M, box.w * IN_TO_M]} />
        <meshStandardMaterial
          color={rgb}
          transparent
          opacity={isHovered ? 0.95 : 0.75}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
      {/* Wireframe edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(box.l * IN_TO_M, box.h * IN_TO_M, box.w * IN_TO_M)]} />
        <lineBasicMaterial color={isHovered ? '#ffffff' : rgb.clone().multiplyScalar(1.5)} linewidth={1} />
      </lineSegments>
    </group>
  )
}

// ── Truck wireframe shell ─────────────────────────────────────────────────
function TruckShell({ truck }) {
  const IN_TO_M = 0.0254
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

// ── Axis labels ───────────────────────────────────────────────────────────
function AxisLabel({ position, text }) {
  return (
    <Text position={position} fontSize={0.12} color="#6b7280" anchorX="center" anchorY="middle">
      {text}
    </Text>
  )
}

// ── Main scene ────────────────────────────────────────────────────────────
function Scene({ truck, packed, clipX, clipY, clipZ, explodeAmount, onHover, onUnhover, hoveredBox }) {
  const IN_TO_M = 0.0254
  const l = truck.length * IN_TO_M
  const w = truck.width * IN_TO_M

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />
      <pointLight position={[l / 2, 3, w / 2]} intensity={0.4} color="#4f8ef7" />

      <TruckShell truck={truck} />

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
        />
      ))}

      <Grid
        position={[l / 2, 0, w / 2]}
        args={[l + 2, w + 2]}
        cellSize={0.3}
        cellThickness={0.5}
        cellColor="#2d2d40"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3d3d55"
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
export default function TruckViewer3D({ truck, packed }) {
  const IN_TO_M = 0.0254
  const [hoveredBox, setHoveredBox] = useState(null)
  const [explodeAmount, setExplodeAmount] = useState(0)
  const [clipX, setClipX] = useState(truck ? truck.length * IN_TO_M : 100)
  const [clipY, setClipY] = useState(truck ? truck.width * IN_TO_M : 100)
  const [clipZ, setClipZ] = useState(truck ? truck.height * IN_TO_M : 100)
  const [perspective, setPerspective] = useState(true)

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

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Controls bar */}
      <div className="flex items-center gap-4 px-3 py-2 bg-dark-800 border-b border-dark-600 text-xs flex-wrap">
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
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={
            perspective
              ? { position: [tl * 0.8, th * 1.2, tw * 1.8], fov: 50, near: 0.01, far: 100 }
              : { position: [tl * 0.8, th * 1.2, tw * 1.8], fov: 10, near: 0.01, far: 200 }
          }
          style={{ background: '#0a0a0f' }}
          shadows
        >
          <Scene
            truck={truck}
            packed={packed || []}
            clipX={clipX}
            clipY={clipY}
            clipZ={clipZ}
            explodeAmount={explodeAmount}
            onHover={setHoveredBox}
            onUnhover={() => setHoveredBox(null)}
            hoveredBox={hoveredBox}
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={0.5}
            maxDistance={30}
            target={[tl / 2, th / 2, tw / 2]}
          />
        </Canvas>

        <BoxTooltip box={hoveredBox} />
      </div>
    </div>
  )
}
