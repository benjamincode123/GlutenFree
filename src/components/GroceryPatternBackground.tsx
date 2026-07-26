import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Pattern,
  Rect,
} from 'react-native-svg';

type Props = {
  backgroundColor: string;
  /** Outline color for grocery icons (slightly darker than background). */
  lineColor: string;
  opacity?: number;
};

const CELL = 96;
const COLS = 3;
const ROWS = 3;
const TILE_W = CELL * COLS;
const TILE_H = CELL * ROWS;

type IconProps = { cx: number; cy: number };

function Bottle({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx - 3} ${cy - 30} h6 v8
           C${cx + 8} ${cy - 20} ${cx + 11} ${cy - 14} ${cx + 11} ${cy - 8}
           V${cy + 28} H${cx - 11} V${cy - 8}
           C${cx - 11} ${cy - 14} ${cx - 8} ${cy - 20} ${cx - 3} ${cy - 22} Z`}
      />
      <Line x1={cx - 3} y1={cy - 30} x2={cx - 3} y2={cy - 34} />
      <Line x1={cx + 3} y1={cy - 30} x2={cx + 3} y2={cy - 34} />
      <Line x1={cx - 3} y1={cy - 34} x2={cx + 3} y2={cy - 34} />
      <Line x1={cx - 7} y1={cy - 2} x2={cx + 7} y2={cy - 2} />
      <Rect x={cx - 5} y={cy + 6} width={10} height={12} rx={1} />
    </G>
  );
}

function Apple({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx} ${cy - 8}
           C${cx - 18} ${cy - 8} ${cx - 20} ${cy + 10} ${cx - 12} ${cy + 22}
           C${cx - 6} ${cy + 30} ${cx + 6} ${cy + 30} ${cx + 12} ${cy + 22}
           C${cx + 20} ${cy + 10} ${cx + 18} ${cy - 8} ${cx} ${cy - 8} Z`}
      />
      <Path d={`M${cx} ${cy - 8} C${cx - 2} ${cy - 20} ${cx + 2} ${cy - 28} ${cx + 1} ${cy - 32}`} />
      <Path
        d={`M${cx + 1} ${cy - 20}
           C${cx + 8} ${cy - 24} ${cx + 16} ${cy - 18} ${cx + 14} ${cy - 12}
           C${cx + 10} ${cy - 16} ${cx + 4} ${cy - 14} ${cx + 1} ${cy - 20} Z`}
      />
      <Path d={`M${cx - 6} ${cy + 2} Q${cx - 10} ${cy + 8} ${cx - 8} ${cy + 14}`} />
    </G>
  );
}

function Carrot({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx} ${cy + 28}
           L${cx - 12} ${cy - 10}
           Q${cx} ${cy - 16} ${cx + 12} ${cy - 10} Z`}
      />
      <Line x1={cx - 4} y1={cy + 2} x2={cx + 3} y2={cy - 2} />
      <Line x1={cx - 2} y1={cy + 12} x2={cx + 4} y2={cy + 8} />
      <Path d={`M${cx - 4} ${cy - 12} L${cx - 10} ${cy - 30}`} />
      <Path d={`M${cx} ${cy - 14} L${cx + 2} ${cy - 32}`} />
      <Path d={`M${cx + 4} ${cy - 12} L${cx + 12} ${cy - 28}`} />
      <Path d={`M${cx - 2} ${cy - 14} L${cx - 6} ${cy - 26}`} />
    </G>
  );
}

function Bowl({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx - 28} ${cy}
           Q${cx - 28} ${cy + 28} ${cx} ${cy + 30}
           Q${cx + 28} ${cy + 28} ${cx + 28} ${cy}`}
      />
      <Line x1={cx - 28} y1={cy} x2={cx + 28} y2={cy} />
      <Path d={`M${cx - 16} ${cy - 4} Q${cx - 10} ${cy - 16} ${cx - 2} ${cy - 6}`} />
      <Path d={`M${cx - 2} ${cy - 8} Q${cx + 6} ${cy - 18} ${cx + 14} ${cy - 4}`} />
      <Path d={`M${cx + 8} ${cy - 6} Q${cx + 16} ${cy - 14} ${cx + 20} ${cy - 2}`} />
      <Circle cx={cx - 8} cy={cy - 2} r={2.5} />
      <Circle cx={cx + 4} cy={cy - 4} r={2} />
    </G>
  );
}

function Milk({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx - 14} ${cy - 8}
           L${cx - 10} ${cy - 28} H${cx + 10} L${cx + 14} ${cy - 8}
           V${cy + 28} H${cx - 14} Z`}
      />
      <Line x1={cx - 10} y1={cy - 28} x2={cx - 10} y2={cy - 32} />
      <Line x1={cx + 10} y1={cy - 28} x2={cx + 10} y2={cy - 32} />
      <Line x1={cx - 10} y1={cy - 32} x2={cx + 10} y2={cy - 32} />
      <Line x1={cx - 10} y1={cy - 2} x2={cx + 10} y2={cy - 2} />
      <Rect x={cx - 8} y={cy + 4} width={16} height={14} rx={1.5} />
      <Line x1={cx - 4} y1={cy + 11} x2={cx + 4} y2={cy + 11} />
    </G>
  );
}

function Tomato({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx} ${cy - 10}
           C${cx - 20} ${cy - 10} ${cx - 22} ${cy + 12} ${cx - 10} ${cy + 22}
           C${cx - 2} ${cy + 28} ${cx + 2} ${cy + 28} ${cx + 10} ${cy + 22}
           C${cx + 22} ${cy + 12} ${cx + 20} ${cy - 10} ${cx} ${cy - 10} Z`}
      />
      <Path d={`M${cx - 8} ${cy - 10} L${cx} ${cy - 24} L${cx + 8} ${cy - 10}`} />
      <Path d={`M${cx} ${cy - 24} V${cy - 10}`} />
      <Path
        d={`M${cx - 2} ${cy - 18}
           C${cx - 10} ${cy - 22} ${cx - 14} ${cy - 14} ${cx - 8} ${cy - 12}`}
      />
      <Path
        d={`M${cx + 2} ${cy - 18}
           C${cx + 10} ${cy - 22} ${cx + 14} ${cy - 14} ${cx + 8} ${cy - 12}`}
      />
    </G>
  );
}

function Bread({ cx, cy }: IconProps) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 4} rx={26} ry={14} />
      <Path d={`M${cx - 18} ${cy - 2} Q${cx} ${cy - 18} ${cx + 18} ${cy - 2}`} />
      <Path d={`M${cx - 12} ${cy - 6} Q${cx - 4} ${cy - 14} ${cx + 2} ${cy - 6}`} />
      <Path d={`M${cx + 2} ${cy - 8} Q${cx + 10} ${cy - 14} ${cx + 16} ${cy - 4}`} />
      <Line x1={cx - 10} y1={cy + 8} x2={cx - 6} y2={cy + 2} />
      <Line x1={cx + 2} y1={cy + 10} x2={cx + 6} y2={cy + 4} />
    </G>
  );
}

function Pepper({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx - 2} ${cy - 16}
           C${cx - 18} ${cy - 12} ${cx - 22} ${cy + 8} ${cx - 10} ${cy + 24}
           C${cx - 2} ${cy + 32} ${cx + 10} ${cy + 30} ${cx + 14} ${cy + 18}
           C${cx + 20} ${cy + 2} ${cx + 12} ${cy - 14} ${cx - 2} ${cy - 16} Z`}
      />
      <Path d={`M${cx - 2} ${cy - 16} L${cx + 2} ${cy - 30}`} />
      <Path
        d={`M${cx + 2} ${cy - 30}
           C${cx + 10} ${cy - 32} ${cx + 14} ${cy - 24} ${cx + 8} ${cy - 20}
           C${cx + 4} ${cy - 24} ${cx + 2} ${cy - 26} ${cx + 2} ${cy - 30} Z`}
      />
      <Path d={`M${cx - 6} ${cy + 2} Q${cx - 2} ${cy + 10} ${cx + 2} ${cy + 4}`} />
    </G>
  );
}

function Cheese({ cx, cy }: IconProps) {
  return (
    <G>
      <Path
        d={`M${cx - 22} ${cy + 18}
           L${cx + 22} ${cy + 18}
           L${cx + 10} ${cy - 20}
           L${cx - 10} ${cy - 20} Z`}
      />
      <Line x1={cx - 10} y1={cy - 20} x2={cx - 22} y2={cy + 18} />
      <Line x1={cx + 10} y1={cy - 20} x2={cx + 22} y2={cy + 18} />
      <Circle cx={cx - 4} cy={cy} r={3.5} />
      <Circle cx={cx + 8} cy={cy + 6} r={2.8} />
      <Circle cx={cx + 2} cy={cy + 12} r={2.2} />
    </G>
  );
}

const ICONS = [Bottle, Apple, Carrot, Bowl, Milk, Tomato, Bread, Pepper, Cheese];

/** Seamless grocery line-art texture for branded screens (login, etc.). */
export function GroceryPatternBackground({
  backgroundColor,
  lineColor,
  opacity = 1,
}: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern
            id="groceryPattern"
            patternUnits="userSpaceOnUse"
            width={TILE_W}
            height={TILE_H}
          >
            <G
              stroke={lineColor}
              strokeWidth={1.85}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              {ICONS.map((Icon, i) => {
                const col = i % COLS;
                const row = Math.floor(i / COLS);
                const cx = col * CELL + CELL / 2;
                const cy = row * CELL + CELL / 2;
                return <Icon key={i} cx={cx} cy={cy} />;
              })}
            </G>
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={backgroundColor} />
        <Rect x={0} y={0} width={width} height={height} fill="url(#groceryPattern)" />
      </Svg>
    </View>
  );
}

/** Darken a hex color toward black (for pattern strokes on primary green). */
export function darkenHex(hex: string, amount = 0.28): string {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = parseInt(full, 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
