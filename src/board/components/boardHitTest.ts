import { Point, Project, Slide, TeamSide, ToolType, Drawing } from '../types';
import { pointToLineSegmentDistance } from '../utils';

export const isPointItem = (type: ToolType): boolean => [
  ToolType.BALL, ToolType.CONE, ToolType.DISC, ToolType.GOAL,
  ToolType.GOAL_MINI, ToolType.GOAL_SIDE, ToolType.MANNEQUIN,
  ToolType.LADDER, ToolType.HURDLE, ToolType.POLE
].includes(type);

export const getPointItemRadius = (type: ToolType): number => {
  switch (type) {
    case ToolType.GOAL: return 60;
    case ToolType.LADDER: return 70;
    case ToolType.GOAL_MINI: return 40;
    case ToolType.GOAL_SIDE: return 35;
    case ToolType.MANNEQUIN: return 30;
    case ToolType.BALL: return 12;
    default: return 20;
  }
};

export const getPlayerAtPosition = (
  pos: Point,
  project: Project,
  currentSlide: Slide,
  globalScale: number,
  baseCoinSize: number,
  excludeId?: string
): string | null => {
  const allPlayers = [
    ...project.teams[TeamSide.HOME].players,
    ...project.teams[TeamSide.AWAY].players,
    ...(project.teams[TeamSide.NEUTRAL] ? project.teams[TeamSide.NEUTRAL].players : [])
  ];

  for (const player of allPlayers) {
    if (excludeId && player.id === excludeId) continue;
    if (currentSlide.positions[player.id]) {
      const pPos = currentSlide.positions[player.id];
      const scale = (pPos.scale || 1) * globalScale;
      // Hit radius slightly larger than visual radius for usability
      const radius = (baseCoinSize / 2) * scale;
      const dist = Math.sqrt(Math.pow(pos.x - pPos.x, 2) + Math.pow(pos.y - pPos.y, 2));
      if (dist < Math.max(20, radius)) {
        return player.id;
      }
    }
  }
  return null;
};

export const findDrawingAtPosition = (
  pos: Point,
  drawings: Drawing[],
  positions: Slide['positions']
): Drawing | null => {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    let found = false;

    if (d.type === ToolType.CIRCLE) {
      const start = d.points[0];
      const end = d.points[d.points.length - 1];
      if (start && end) {
        const r = Math.hypot(end.x - start.x, end.y - start.y);
        const dist = Math.hypot(pos.x - start.x, pos.y - start.y);
        if (Math.abs(dist - r) < 15 || dist < r) {
          found = true;
        }
      }
    } else if (d.type === ToolType.CONNECTOR) {
      const p1 = d.props?.startPlayerId ? positions[d.props.startPlayerId] : undefined;
      const p2 = d.props?.endPlayerId ? positions[d.props.endPlayerId] : undefined;
      if (p1 && p2 && pointToLineSegmentDistance(pos, p1, p2) < 15) {
        found = true;
      }
    } else if (d.type === ToolType.TEXT) {
      const p = d.points[0];
      const textLen = (d.text || '').length * 16;
      if (pos.x >= p.x - 10 && pos.x <= p.x + textLen + 10 && pos.y >= p.y - 30 && pos.y <= p.y + 10) {
        found = true;
      }
    } else if (isPointItem(d.type)) {
      const p = d.points[0];
      const radius = getPointItemRadius(d.type);
      if (p && Math.hypot(p.x - pos.x, p.y - pos.y) < radius) {
        found = true;
      }
    } else {
      // PEN, LINE, ARROW, CURVE_ARROW, POLYGON
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of d.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      if (pos.x >= minX - 15 && pos.x <= maxX + 15 && pos.y >= minY - 15 && pos.y <= maxY + 15) {
        for (let j = 0; j < d.points.length - 1; j++) {
          const p1 = d.points[j];
          const p2 = d.points[j + 1];
          if (pointToLineSegmentDistance(pos, p1, p2) < 15) {
            found = true;
            break;
          }
        }
      }
      if (!found && d.type === ToolType.POLYGON && d.points.length > 2) {
        const p1 = d.points[d.points.length - 1];
        const p2 = d.points[0];
        if (pointToLineSegmentDistance(pos, p1, p2) < 15) {
          found = true;
        }
      }
      if (!found && d.points.length === 1) {
        if (Math.hypot(d.points[0].x - pos.x, d.points[0].y - pos.y) < 15) {
          found = true;
        }
      }
    }

    if (found) {
      return d;
    }
  }
  return null;
};
