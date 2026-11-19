import React, { useEffect, useState } from 'react';
import {
  Target,
  Shield,
  Zap,
  TrendingUp,
  Award,
  Activity,
  Compass,
  Flag,
  Crosshair,
  Users,
  Timer,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Star,
  Image as ImageIcon,
} from 'lucide-react';
import type {
  ImageSlideElement,
  ShapeSlideElement,
  IconSlideElement,
  TableSlideElement,
  SvgDiagramSlideElement,
  PlayerCardSlideElement,
  MatchComparisonSlideElement,
} from '../../types/presentation';
import { getImageAssetUrl } from '../../storage/presentationRepository';

export const ICON_REGISTRY: Record<string, React.FC<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>> = {
  Target,
  Shield,
  Zap,
  TrendingUp,
  Award,
  Activity,
  Compass,
  Flag,
  Crosshair,
  Users,
  Timer,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Star,
};

export const ImageElementRenderer: React.FC<{ element: ImageSlideElement }> = ({ element }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(element.src || null);

  useEffect(() => {
    let active = true;
    if (element.assetId) {
      getImageAssetUrl(element.assetId).then((url) => {
        if (active && url) setResolvedUrl(url);
      });
    } else if (element.src) {
      setResolvedUrl(element.src);
    }
    return () => {
      active = false;
    };
  }, [element.assetId, element.src]);

  const crop = element.crop;
  const imgStyle: React.CSSProperties = crop
    ? {
        width: `${(1 / Math.max(0.1, crop.w)) * 100}%`,
        height: `${(1 / Math.max(0.1, crop.h)) * 100}%`,
        maxWidth: 'none',
        maxHeight: 'none',
        transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
        objectFit: element.objectFit || 'cover',
        objectPosition: element.objectPosition || '50% 50%',
      }
    : {
        width: '100%',
        height: '100%',
        objectFit: element.objectFit || 'cover',
        objectPosition: element.objectPosition || '50% 50%',
      };

  return (
    <div
      className="w-full h-full overflow-hidden flex items-center justify-center bg-slate-900/60"
      style={{
        borderRadius: element.borderRadius ?? 16,
        border:
          element.borderWidth && element.borderWidth > 0
            ? `${element.borderWidth}px solid ${element.borderColor || '#ffffff'}`
            : undefined,
      }}
    >
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt={element.alt || 'Slide image'}
          draggable={false}
          referrerPolicy="no-referrer"
          style={imgStyle}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-white/40 p-4">
          <ImageIcon className="w-12 h-12" />
          <span className="text-lg font-medium">Image Placeholder</span>
        </div>
      )}
    </div>
  );
};

export const ShapeElementRenderer: React.FC<{ element: ShapeSlideElement }> = ({ element }) => {
  if (element.shapeKind === 'line' || element.shapeKind === 'arrow') {
    const w = Math.max(10, element.width);
    const h = Math.max(10, element.height);
    const midY = h / 2;
    const stroke = element.strokeColor || element.fillColor || '#c6ff1f';
    const sw = Math.max(2, element.strokeWidth || 4);

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
        <defs>
          <marker
            id={`shp-arr-end-${element.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
          >
            <path d="M0,1 L9,5 L0,9 Z" fill={stroke} />
          </marker>
          <marker
            id={`shp-arr-start-${element.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="2"
            refY="5"
            orient="auto"
          >
            <path d="M10,1 L1,5 L10,9 Z" fill={stroke} />
          </marker>
        </defs>
        <line
          x1={element.arrowStart ? 12 : 2}
          y1={midY}
          x2={element.shapeKind === 'arrow' || element.arrowEnd ? w - 12 : w - 2}
          y2={midY}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={element.strokeDashed ? '12 8' : undefined}
          markerEnd={element.shapeKind === 'arrow' || element.arrowEnd ? `url(#shp-arr-end-${element.id})` : undefined}
          markerStart={element.arrowStart ? `url(#shp-arr-start-${element.id})` : undefined}
        />
      </svg>
    );
  }

  if (element.shapeKind === 'triangle') {
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polygon
          points="50,3 97,97 3,97"
          fill={element.fillColor}
          stroke={element.strokeColor}
          strokeWidth={element.strokeWidth}
          strokeDasharray={element.strokeDashed ? '6 4' : undefined}
        />
      </svg>
    );
  }

  if (element.shapeKind === 'circle') {
    return (
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          backgroundColor: element.fillColor,
          border:
            element.strokeWidth > 0
              ? `${element.strokeWidth}px ${element.strokeDashed ? 'dashed' : 'solid'} ${element.strokeColor}`
              : undefined,
        }}
      >
        {element.label && (
          <span
            className="font-semibold px-3 text-center"
            style={{ color: element.labelColor || '#ffffff', fontSize: element.labelFontSize || 24 }}
          >
            {element.label}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        backgroundColor: element.fillColor,
        borderRadius: element.borderRadius ?? 16,
        border:
          element.strokeWidth > 0
            ? `${element.strokeWidth}px ${element.strokeDashed ? 'dashed' : 'solid'} ${element.strokeColor}`
            : undefined,
      }}
    >
      {element.label && (
        <span
          className="font-semibold px-4 text-center"
          style={{ color: element.labelColor || '#ffffff', fontSize: element.labelFontSize || 24 }}
        >
          {element.label}
        </span>
      )}
    </div>
  );
};

export const IconElementRenderer: React.FC<{ element: IconSlideElement }> = ({ element }) => {
  const IconComp = ICON_REGISTRY[element.iconName] || Target;
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        backgroundColor: element.backgroundColor || 'transparent',
        borderRadius: element.borderRadius ?? 16,
        padding: element.padding ?? 12,
      }}
    >
      <IconComp
        className="w-full h-full"
        style={{ color: element.color }}
        strokeWidth={element.strokeWidth ?? 2}
      />
    </div>
  );
};

export const TableElementRenderer: React.FC<{ element: TableSlideElement }> = ({ element }) => {
  const headers = element.headers || [];
  const rows = element.rows || [];
  return (
    <div
      className="w-full h-full rounded-2xl overflow-hidden flex flex-col"
      style={{ border: `2px solid ${element.borderColor}` }}
    >
      <table className="w-full h-full border-collapse table-fixed">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-5 py-3.5 text-left font-bold tracking-tight"
                style={{
                  backgroundColor: element.headerBg,
                  color: element.headerColor,
                  fontSize: (element.fontSize || 22) + 2,
                  borderBottom: `2px solid ${element.borderColor}`,
                  borderRight: i < headers.length - 1 ? `1px solid ${element.borderColor}` : undefined,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {headers.map((_, cIdx) => (
                <td
                  key={cIdx}
                  className="px-5 py-3 align-middle tabular-nums"
                  style={{
                    backgroundColor: rIdx % 2 === 1 && element.altCellBg ? element.altCellBg : element.cellBg,
                    color: element.cellColor,
                    fontSize: element.fontSize || 22,
                    borderBottom: rIdx < rows.length - 1 ? `1px solid ${element.borderColor}` : undefined,
                    borderRight: cIdx < headers.length - 1 ? `1px solid ${element.borderColor}` : undefined,
                  }}
                >
                  {row[cIdx] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const SvgDiagramElementRenderer: React.FC<{ element: SvgDiagramSlideElement }> = ({ element }) => {
  const nodes = element.nodes || [];
  const edges = element.edges || [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const vbW = 1200;
  const vbH = 600;
  const toX = (pct: number) => (pct / 100) * vbW;
  const toY = (pct: number) => (pct / 100) * vbH;

  return (
    <div
      className="w-full h-full rounded-2xl relative overflow-hidden p-4"
      style={{
        backgroundColor: element.surfaceColor,
        border: `2px solid rgba(255,255,255,0.12)`,
        color: element.textColor,
      }}
    >
      {element.title && (
        <div className="text-[22px] font-bold px-3 pt-1 pb-2">{element.title}</div>
      )}
      <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-[calc(100%-36px)]">
        <defs>
          <marker
            id={`diag-arr-${element.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
          >
            <path d="M0,1 L9,5 L0,9 Z" fill={element.accentColor} />
          </marker>
        </defs>

        {edges.map((edge, idx) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const x1 = toX(from.x);
          const y1 = toY(from.y);
          const x2 = toX(to.x);
          const y2 = toY(to.y);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={idx}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={element.accentColor}
                strokeWidth={3.5}
                strokeDasharray={edge.dashed ? '8 6' : undefined}
                markerEnd={`url(#diag-arr-${element.id})`}
              />
              {edge.label && (
                <g transform={`translate(${mx}, ${my})`}>
                  <rect
                    x={-68}
                    y={-15}
                    width={136}
                    height={30}
                    rx={8}
                    fill="#0c0e14"
                    stroke={element.accentColor}
                    strokeWidth={1.5}
                  />
                  <text
                    x={0}
                    y={6}
                    textAnchor="middle"
                    fill={element.accentColor}
                    fontSize={15}
                    fontWeight={600}
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {nodes.map((node) => {
          const cx = toX(node.x);
          const cy = toY(node.y);
          return (
            <g key={node.id} transform={`translate(${cx - 125}, ${cy - 54})`}>
              <rect
                width={250}
                height={108}
                rx={18}
                fill="#0c0e14"
                stroke={node.color || element.accentColor}
                strokeWidth={3}
              />
              <text
                x={125}
                y={48}
                textAnchor="middle"
                fill={element.textColor}
                fontSize={21}
                fontWeight={700}
              >
                {node.label}
              </text>
              {node.sublabel && (
                <text
                  x={125}
                  y={78}
                  textAnchor="middle"
                  fill={element.textColor}
                  fillOpacity={0.7}
                  fontSize={16}
                >
                  {node.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const PlayerCardElementRenderer: React.FC<{ element: PlayerCardSlideElement }> = ({ element }) => {
  return (
    <div
      className="w-full h-full rounded-2xl p-7 flex flex-col justify-between overflow-hidden"
      style={{
        backgroundColor: element.backgroundColor,
        color: element.textColor,
        border: `2px solid ${element.accentColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div
            className="text-[18px] font-mono font-bold uppercase tracking-wider"
            style={{ color: element.accentColor }}
          >
            {element.position} · {element.teamName}
          </div>
          <div className="text-[38px] font-extrabold leading-tight mt-1 truncate">
            {element.playerName}
          </div>
          {element.subtitle && (
            <div className="text-[18px] opacity-70 mt-1">{element.subtitle}</div>
          )}
        </div>
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center font-mono text-[38px] font-extrabold shrink-0"
          style={{
            backgroundColor: element.accentColor,
            color: '#090b10',
          }}
        >
          {element.jerseyNumber}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/10">
        {(element.stats || []).map((st, idx) => (
          <div key={idx} className="bg-black/20 rounded-xl p-4">
            <div className="text-[15px] opacity-65 font-medium">{st.label}</div>
            <div
              className="text-[30px] font-mono font-bold tabular-nums mt-1"
              style={{ color: element.accentColor }}
            >
              {st.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const MatchComparisonElementRenderer: React.FC<{ element: MatchComparisonSlideElement }> = ({
  element,
}) => {
  return (
    <div
      className="w-full h-full rounded-2xl p-7 flex flex-col justify-between overflow-hidden"
      style={{
        backgroundColor: element.backgroundColor,
        color: element.textColor,
        border: '2px solid rgba(255,255,255,0.12)',
      }}
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: element.homeColor }} />
          <span className="text-[28px] font-bold">{element.homeTeam}</span>
        </div>
        <div className="text-[34px] font-mono font-extrabold tabular-nums">
          {element.homeScore ?? '0'} - {element.awayScore ?? '0'}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[28px] font-bold">{element.awayTeam}</span>
          <span className="w-4 h-4 rounded-full" style={{ backgroundColor: element.awayColor }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-evenly py-2">
        {(element.metrics || []).map((m, idx) => {
          const total = Math.max(0.01, m.homeValue + m.awayValue);
          const homePct = (m.homeValue / total) * 100;
          const awayPct = (m.awayValue / total) * 100;
          return (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center justify-between text-[20px] font-mono font-bold tabular-nums">
                <span style={{ color: element.homeColor }}>
                  {m.homeValue}
                  {m.unit || ''}
                </span>
                <span className="font-sans font-semibold text-[18px] opacity-80">{m.label}</span>
                <span style={{ color: element.awayColor }}>
                  {m.awayValue}
                  {m.unit || ''}
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-white/10 overflow-hidden flex">
                <div style={{ width: `${homePct}%`, backgroundColor: element.homeColor }} />
                <div style={{ width: `${awayPct}%`, backgroundColor: element.awayColor }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
