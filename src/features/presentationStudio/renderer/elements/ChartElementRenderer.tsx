import React from 'react';
import type { ChartSlideElement } from '../../types/presentation';

interface ChartElementRendererProps {
  element: ChartSlideElement;
}

export const ChartElementRenderer: React.FC<ChartElementRendererProps> = ({ element }) => {
  const data = element.data || [];
  const accent = element.accentColor || '#c6ff1f';
  const secondary = element.secondaryColor || '#38bdf8';
  const textColor = element.textColor || '#f8fafc';
  const bg = element.backgroundColor || 'rgba(21,25,35,0.9)';
  const border = element.borderColor || 'rgba(255,255,255,0.12)';

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.value || 0, d.secondaryValue || 0])
  );

  const svgW = 800;
  const svgH = 440;
  const padL = 68;
  const padR = 32;
  const padT = 36;
  const padB = 64;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  return (
    <div
      className="w-full h-full rounded-2xl p-6 flex flex-col justify-between overflow-hidden"
      style={{
        backgroundColor: bg,
        border: `2px solid ${border}`,
        color: textColor,
      }}
    >
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="text-[24px] font-bold tracking-tight truncate">
          {element.title || 'Analytics Chart'}
        </div>
        {(element.primaryLabel || element.secondaryLabel) && (
          <div className="flex items-center gap-4 text-[16px] opacity-80 shrink-0">
            {element.primaryLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: accent }} />
                {element.primaryLabel}
              </span>
            )}
            {element.secondaryLabel && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: secondary }} />
                {element.secondaryLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 w-full">
        {element.chartKind === 'donut' ? (
          <svg viewBox="0 0 600 320" className="w-full h-full">
            {(() => {
              const total = Math.max(
                1,
                data.reduce((acc, d) => acc + Math.max(0, d.value), 0)
              );
              const palette = [accent, secondary, '#f59e0b', '#fb7185', '#a78bfa'];
              const cx = 170;
              const cy = 160;
              const r = 110;
              const circ = 2 * Math.PI * r;
              let offset = 0;

              return (
                <>
                  {data.map((d, idx) => {
                    const frac = Math.max(0, d.value) / total;
                    const dash = frac * circ;
                    const seg = (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke={d.color || palette[idx % palette.length]}
                        strokeWidth={42}
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-offset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                      />
                    );
                    offset += dash;
                    return seg;
                  })}
                  <text
                    x={cx}
                    y={cy + 8}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={28}
                    fontWeight={800}
                    fontFamily="'JetBrains Mono', monospace"
                  >
                    {total}
                  </text>
                  {data.map((d, idx) => (
                    <g key={idx} transform={`translate(335, ${56 + idx * 44})`}>
                      <rect
                        width={16}
                        height={16}
                        rx={4}
                        fill={d.color || palette[idx % palette.length]}
                      />
                      <text x={28} y={14} fill={textColor} fontSize={18} fontWeight={500}>
                        {d.label} ({Math.round((d.value / total) * 100)}%)
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        ) : element.chartKind === 'horizontal-bar' ? (
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
            {data.map((d, idx) => {
              const rowH = plotH / Math.max(1, data.length);
              const y = padT + idx * rowH + rowH * 0.22;
              const barH = Math.min(36, rowH * 0.56);
              const w1 = (Math.max(0, d.value) / maxVal) * (plotW - 140);
              return (
                <g key={idx}>
                  <text
                    x={padL}
                    y={y + barH * 0.72}
                    fill={textColor}
                    fontSize={18}
                    fontWeight={600}
                  >
                    {d.label}
                  </text>
                  <rect
                    x={padL + 150}
                    y={y}
                    width={Math.max(6, w1)}
                    height={barH}
                    rx={6}
                    fill={d.color || accent}
                  />
                  {element.showValues && (
                    <text
                      x={padL + 162 + w1}
                      y={y + barH * 0.72}
                      fill={textColor}
                      fontSize={17}
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight={700}
                    >
                      {d.value}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ) : element.chartKind === 'line' ? (
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
            {element.showGrid &&
              [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const gy = padT + plotH * (1 - t);
                return (
                  <line
                    key={i}
                    x1={padL}
                    y1={gy}
                    x2={padL + plotW}
                    y2={gy}
                    stroke={textColor}
                    strokeOpacity={0.12}
                    strokeDasharray="4 6"
                  />
                );
              })}
            {data.length > 1 && (
              <polyline
                fill="none"
                stroke={accent}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={data
                  .map((d, i) => {
                    const px = padL + (i / Math.max(1, data.length - 1)) * plotW;
                    const py = padT + plotH * (1 - Math.max(0, d.value) / maxVal);
                    return `${px},${py}`;
                  })
                  .join(' ')}
              />
            )}
            {data.map((d, i) => {
              const px = padL + (i / Math.max(1, data.length - 1)) * plotW;
              const py = padT + plotH * (1 - Math.max(0, d.value) / maxVal);
              return (
                <g key={i}>
                  <circle cx={px} cy={py} r={8} fill={accent} stroke={bg} strokeWidth={3} />
                  {element.showValues && (
                    <text
                      x={px}
                      y={py - 16}
                      textAnchor="middle"
                      fill={textColor}
                      fontSize={16}
                      fontFamily="'JetBrains Mono', monospace"
                      fontWeight={700}
                    >
                      {d.value}
                    </text>
                  )}
                  <text
                    x={px}
                    y={svgH - 20}
                    textAnchor="middle"
                    fill={textColor}
                    fillOpacity={0.75}
                    fontSize={16}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          /* Vertical Bar Chart */
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full">
            {element.showGrid &&
              [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const gy = padT + plotH * (1 - t);
                return (
                  <g key={i}>
                    <line
                      x1={padL}
                      y1={gy}
                      x2={padL + plotW}
                      y2={gy}
                      stroke={textColor}
                      strokeOpacity={0.12}
                      strokeDasharray="4 6"
                    />
                    <text
                      x={padL - 12}
                      y={gy + 5}
                      textAnchor="end"
                      fill={textColor}
                      fillOpacity={0.5}
                      fontSize={14}
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {Math.round(maxVal * t)}
                    </text>
                  </g>
                );
              })}

            {data.map((d, idx) => {
              const groupW = plotW / Math.max(1, data.length);
              const hasSecondary = typeof d.secondaryValue === 'number';
              const barW = hasSecondary ? Math.min(44, groupW * 0.32) : Math.min(68, groupW * 0.54);
              const centerX = padL + groupW * idx + groupW / 2;
              const h1 = (Math.max(0, d.value) / maxVal) * plotH;
              const y1 = padT + plotH - h1;

              const h2 = hasSecondary ? (Math.max(0, d.secondaryValue || 0) / maxVal) * plotH : 0;
              const y2 = padT + plotH - h2;

              return (
                <g key={idx}>
                  <rect
                    x={hasSecondary ? centerX - barW - 4 : centerX - barW / 2}
                    y={y1}
                    width={barW}
                    height={Math.max(4, h1)}
                    rx={6}
                    fill={d.color || accent}
                  />
                  {element.showValues && (
                    <text
                      x={hasSecondary ? centerX - barW / 2 - 4 : centerX}
                      y={y1 - 10}
                      textAnchor="middle"
                      fill={textColor}
                      fontSize={15}
                      fontWeight={700}
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {d.value}
                    </text>
                  )}
                  {hasSecondary && (
                    <>
                      <rect
                        x={centerX + 4}
                        y={y2}
                        width={barW}
                        height={Math.max(4, h2)}
                        rx={6}
                        fill={secondary}
                      />
                      {element.showValues && (
                        <text
                          x={centerX + 4 + barW / 2}
                          y={y2 - 10}
                          textAnchor="middle"
                          fill={secondary}
                          fontSize={15}
                          fontWeight={700}
                          fontFamily="'JetBrains Mono', monospace"
                        >
                          {d.secondaryValue}
                        </text>
                      )}
                    </>
                  )}
                  <text
                    x={centerX}
                    y={svgH - 22}
                    textAnchor="middle"
                    fill={textColor}
                    fillOpacity={0.8}
                    fontSize={16}
                    fontWeight={500}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};
