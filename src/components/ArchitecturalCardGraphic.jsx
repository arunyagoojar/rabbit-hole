import { useState, useEffect, useId } from 'react'
import {
  Satellite, Network, Globe, Cpu, Search, MapPin, QrCode, Lock, Sparkles, Brain,
  Binary, ScanFace, AudioWaveform, Database, Infinity as InfinityIcon,
  Dice5, Box, Radar, MessageSquareCode, RadioTower, Telescope, Hourglass, Maximize2,
  CircleDot, Sun, Moon, Rocket, Compass, Clock, Timer, Atom, Layers, Shield, Scale,
  EyeOff, GitCommit, Dna, ShieldCheck, RefreshCw, Ghost, Music, Activity, Hand, Target,
  Eye, HeartPulse, Thermometer, Circle, Landmark, BookOpen, Map, Train, Split,
  Coins, Feather, ArrowLeftRight, CreditCard, Banknote, TrendingUp, CandlestickChart,
  Plane, Package, ShoppingCart, Zap, Cable, BatteryCharging, RotateCw, Snowflake,
  VolumeX, Fingerprint, Camera, Navigation2, ShieldAlert, GitMerge, Anchor, CloudSun,
  Wind, Footprints, Users, Handshake, Building2, Building, Languages, MessageCircle,
  Palette, Wheat, Sprout
} from 'lucide-react'

const ICON_MAP = {
  'satellite': Satellite,
  'network': Network,
  'globe': Globe,
  'cpu': Cpu,
  'search': Search,
  'map-pin': MapPin,
  'qr-code': QrCode,
  'lock': Lock,
  'sparkles': Sparkles,
  'brain': Brain,
  'binary': Binary,
  'scan-face': ScanFace,
  'waveform': AudioWaveform,
  'database': Database,
  'infinity': InfinityIcon,
  'dice-5': Dice5,
  'box': Box,
  'radar': Radar,
  'message-square-code': MessageSquareCode,
  'radio-tower': RadioTower,
  'telescope': Telescope,
  'hourglass': Hourglass,
  'maximize-2': Maximize2,
  'circle-dot': CircleDot,
  'sun': Sun,
  'moon': Moon,
  'rocket': Rocket,
  'compass': Compass,
  'clock': Clock,
  'timer': Timer,
  'atom': Atom,
  'layers': Layers,
  'shield': Shield,
  'scale': Scale,
  'eye-off': EyeOff,
  'git-commit': GitCommit,
  'dna': Dna,
  'shield-check': ShieldCheck,
  'refresh-cw': RefreshCw,
  'ghost': Ghost,
  'music': Music,
  'activity': Activity,
  'hand': Hand,
  'target': Target,
  'eye': Eye,
  'heart-pulse': HeartPulse,
  'thermometer': Thermometer,
  'circle': Circle,
  'landmark': Landmark,
  'book-open': BookOpen,
  'map': Map,
  'train': Train,
  'split': Split,
  'coins': Coins,
  'feather': Feather,
  'arrow-left-right': ArrowLeftRight,
  'credit-card': CreditCard,
  'banknote': Banknote,
  'trending-up': TrendingUp,
  'candlestick-chart': CandlestickChart,
  'plane': Plane,
  'package': Package,
  'shopping-cart': ShoppingCart,
  'zap': Zap,
  'cable': Cable,
  'battery-charging': BatteryCharging,
  'rotate-cw': RotateCw,
  'snowflake': Snowflake,
  'volume-x': VolumeX,
  'fingerprint': Fingerprint,
  'camera': Camera,
  'navigation-2': Navigation2,
  'shield-alert': ShieldAlert,
  'git-merge': GitMerge,
  'anchor': Anchor,
  'cloud-sun': CloudSun,
  'wind': Wind,
  'footprints': Footprints,
  'users': Users,
  'handshake': Handshake,
  'building-2': Building2,
  'building': Building,
  'languages': Languages,
  'message-circle': MessageCircle,
  'palette': Palette,
  'wheat': Wheat,
  'sprout': Sprout
}

export default function ArchitecturalCardGraphic({
  style = 'waves',
  iconName = '',
  term = '',
  category = '',
  className = ''
}) {
  const [svgContent, setSvgContent] = useState(null)
  const [svgLoading, setSvgLoading] = useState(false)
  const uniqueId = useId()

  const LucideComponent = ICON_MAP[iconName] || null

  useEffect(() => {
    // If not using a pure Lucide icon and we have a specific term, optionally fetch from SVG API
    if (!LucideComponent && (term || iconName)) {
      let cancelled = false
      setSvgLoading(true)

      const url = `/api/v1/media/svg-icon?term=${encodeURIComponent(term || iconName)}&icon=${encodeURIComponent(iconName || '')}&prefix=tabler`
      
      fetch(url)
        .then(res => res.text())
        .then(text => {
          if (!cancelled && text.includes('<svg')) {
            // Strip width and height to let it scale via viewBox
            const cleaned = text
              .replace(/width="[^"]*"/, 'width="100%"')
              .replace(/height="[^"]*"/, 'height="100%"')
              .replace(/stroke="[^"]*"/g, 'stroke="currentColor"')
            setSvgContent(cleaned)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setSvgLoading(false)
        })

      return () => { cancelled = true }
    }
  }, [term, iconName, LucideComponent])

  return (
    <div className={`arch-graphic-container ${className}`}>
      {/* Background Architectural Drafting Grid */}
      <svg
        className="arch-drafting-grid"
        viewBox="0 0 300 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <pattern id={`grid-pattern-${uniqueId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="20" y2="0" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.12" strokeDasharray="2 2" />
            <line x1="0" y1="0" x2="0" y2="20" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.12" strokeDasharray="2 2" />
          </pattern>
        </defs>

        {/* Faint coordinate grid background */}
        <rect width="300" height="220" fill={`url(#grid-pattern-${uniqueId})`} />

        {/* Corner registration markers */}
        <path d="M 20 28 L 20 20 L 28 20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
        <path d="M 280 28 L 280 20 L 272 20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
        <path d="M 20 192 L 20 200 L 28 200" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
        <path d="M 280 192 L 280 200 L 272 200" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />

        {/* Crosshairs & Center Guide Ring */}
        <line x1="150" y1="18" x2="150" y2="202" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.18" strokeDasharray="4 4" />
        <line x1="30" y1="110" x2="270" y2="110" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.18" strokeDasharray="4 4" />
        <circle cx="150" cy="110" r="74" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.14" strokeDasharray="3 3" />
        <circle cx="150" cy="110" r="44" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.1" />

        {/* ─── Geometric Foreground Styles (Exact match to reference image) ─── */}
        {style === 'waves' && (
          <g className="arch-geom-waves" fill="currentColor">
            {/* Background vertical barcode/frequency guide lines */}
            {[45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255].map((x) => (
              <line key={`vguide-${x}`} x1={x} y1="20" x2={x} y2="200" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.18" />
            ))}
            {/* Modulated Frequency Barcode Diamonds (From Card 1 in reference) */}
            {[
              { x: 50, h: 22 },
              { x: 60, h: 32 },
              { x: 70, h: 46 },
              { x: 80, h: 62 },
              { x: 90, h: 74 },
              { x: 100, h: 84 },
              { x: 110, h: 74 },
              { x: 120, h: 62 },
              { x: 130, h: 46 },
              { x: 140, h: 32 },
              { x: 150, h: 22 },
              { x: 160, h: 32 },
              { x: 170, h: 46 },
              { x: 180, h: 62 },
              { x: 190, h: 74 },
              { x: 200, h: 84 },
              { x: 210, h: 74 },
              { x: 220, h: 62 },
              { x: 230, h: 46 },
              { x: 240, h: 32 },
              { x: 250, h: 22 },
            ].map(({ x, h }, idx) => (
              <rect
                key={`bar-${idx}`}
                x={x - 1.5}
                y={110 - h / 2}
                width="3.2"
                height={h}
                rx="1"
                fill="currentColor"
                fillOpacity="0.9"
              />
            ))}
          </g>
        )}

        {style === 'spokes' && (
          <g className="arch-geom-spokes">
            {/* Diagonal dashed guide crosshairs (From Card 2 in reference) */}
            <line x1="90" y1="50" x2="210" y2="170" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.18" strokeDasharray="4 4" />
            <line x1="210" y1="50" x2="90" y2="170" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.18" strokeDasharray="4 4" />
            <circle cx="150" cy="110" r="70" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.2" strokeDasharray="4 4" />

            {/* 8 Tapered Starburst Spokes radiating from center hub */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <g key={`spoke-${angle}`} transform={`rotate(${angle} 150 110)`}>
                <polygon
                  points="150,42 153.5,60 153.5,98 150,102 146.5,98 146.5,60"
                  fill="currentColor"
                  fillOpacity="0.92"
                />
              </g>
            ))}
            <circle cx="150" cy="110" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.92" />
          </g>
        )}

        {style === 'orbit' && (
          <g className="arch-geom-orbit">
            {/* Concentric Nested Spheres with Tonal Grayscale Shades (From Card 3 in reference) */}
            <circle cx="150" cy="110" r="68" fill="currentColor" fillOpacity="0.04" />
            <circle cx="155" cy="115" r="56" fill="currentColor" fillOpacity="0.08" />
            <circle cx="160" cy="120" r="44" fill="currentColor" fillOpacity="0.14" />
            <circle cx="165" cy="125" r="32" fill="currentColor" fillOpacity="0.25" />
            <circle cx="170" cy="130" r="20" fill="currentColor" fillOpacity="0.45" />
          </g>
        )}

        {style === 'matrix' && (
          <g className="arch-geom-matrix" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Isometric Cube / Data Lattice */}
            <polygon points="150,60 198,88 150,116 102,88" fill="currentColor" fillOpacity="0.07" />
            <polygon points="102,88 150,116 150,166 102,138" fill="currentColor" fillOpacity="0.16" />
            <polygon points="198,88 150,116 150,166 198,138" fill="currentColor" fillOpacity="0.28" />
            <line x1="150" y1="60" x2="150" y2="116" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
            <line x1="102" y1="88" x2="150" y2="116" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
            <line x1="198" y1="88" x2="150" y2="116" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.8" />
          </g>
        )}

        {style === 'grid' && (
          <g className="arch-geom-grid" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none">
            {/* Perspective Elevation Grid */}
            <line x1="70" y1="160" x2="230" y2="160" strokeOpacity="0.8" />
            <line x1="85" y1="140" x2="215" y2="140" strokeOpacity="0.6" />
            <line x1="100" y1="120" x2="200" y2="120" strokeOpacity="0.4" />
            <line x1="115" y1="100" x2="185" y2="100" strokeOpacity="0.25" />
            <line x1="150" y1="60" x2="70" y2="160" strokeOpacity="0.6" />
            <line x1="150" y1="60" x2="110" y2="160" strokeOpacity="0.6" />
            <line x1="150" y1="60" x2="150" y2="160" strokeOpacity="0.8" />
            <line x1="150" y1="60" x2="190" y2="160" strokeOpacity="0.6" />
            <line x1="150" y1="60" x2="230" y2="160" strokeOpacity="0.6" />
            <circle cx="150" cy="60" r="5" fill="currentColor" fillOpacity="0.9" />
          </g>
        )}

        {style === 'spectrum' && (
          <g className="arch-geom-spectrum">
            {/* Fraunhofer spectral lines */}
            <rect x="70" y="80" width="160" height="60" rx="6" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeWidth="1" strokeOpacity="0.2" />
            {[82, 90, 94, 108, 120, 124, 138, 142, 146, 160, 172, 185, 192, 206, 218].map((lx, i) => (
              <line
                key={`spec-${i}`}
                x1={lx}
                y1="82"
                x2={lx}
                y2="138"
                stroke="currentColor"
                strokeWidth={i % 3 === 0 ? "2.5" : i % 2 === 0 ? "1.8" : "1"}
                strokeOpacity={0.85}
              />
            ))}
          </g>
        )}
      </svg>

      {/* Foreground Lucide or Cached SVG Vector Glyph overlay (centered inside crosshair target) */}
      <div className="arch-center-icon-wrapper" aria-hidden="true">
        {LucideComponent ? (
          <LucideComponent size={34} strokeWidth={1.75} className="arch-lucide-icon" />
        ) : svgContent ? (
          <div
            className="arch-raw-svg-container"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : null}
      </div>
    </div>
  )
}
