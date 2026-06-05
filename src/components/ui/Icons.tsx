/**
 * Lore icon system — SVG stroke icons, 24×24 viewBox.
 * All icons: 2px stroke, round caps/joins, no fill (except active variants).
 */

import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';

interface IconProps {
  color?: string;
  size?: number;
  strokeWidth?: number;
}

// ─── Map / Location pin ───────────────────────────────────────────────────────
export function IconMapPin({ color = '#fff', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle
        cx="12"
        cy="9"
        r="2.5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

// ─── Timeline / Feed ──────────────────────────────────────────────────────────
// Three timeline rows: dot + line
export function IconTimeline({ color = '#fff', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Row 1 */}
      <Circle cx="5" cy="7" r="1.5" fill={color} />
      <Path d="M9 7H19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* Row 2 */}
      <Circle cx="5" cy="12" r="1.5" fill={color} />
      <Path d="M9 12H19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* Row 3 — shorter, feels like a real feed */}
      <Circle cx="5" cy="17" r="1.5" fill={color} />
      <Path d="M9 17H15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Chat / Conversations ─────────────────────────────────────────────────────
export function IconChat({ color = '#fff', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Main bubble */}
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Three dots inside */}
      <Circle cx="9"  cy="10" r="1" fill={color} />
      <Circle cx="12" cy="10" r="1" fill={color} />
      <Circle cx="15" cy="10" r="1" fill={color} />
    </Svg>
  );
}

// ─── Person / Profile ─────────────────────────────────────────────────────────
export function IconPerson({ color = '#fff', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Circle
        cx="12"
        cy="8"
        r="4"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      {/* Shoulders */}
      <Path
        d="M4 20c0-4 3.58-7 8-7s8 3 8 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Bell / Notifications ─────────────────────────────────────────────────────
export function IconBell({ color = '#fff', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bell body */}
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Clapper */}
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Bell with notification dot ───────────────────────────────────────────────
export function IconBellDot({ color = '#fff', dotColor = '#D4603A', size = 24, strokeWidth = 2 }: IconProps & { dotColor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Notification dot */}
      <Circle cx="18" cy="5" r="3" fill={dotColor} />
    </Svg>
  );
}

// ─── Back chevron ─────────────────────────────────────────────────────────────
export function IconChevronLeft({ color = '#fff', size = 24, strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Plus / Add ───────────────────────────────────────────────────────────────
export function IconPlus({ color = '#fff', size = 24, strokeWidth = 2.5 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Locate me / My location ──────────────────────────────────────────────────
// Classic crosshair: ring + center dot + four ticks. Reads instantly as
// "center on my location" and matches the app's stroke-icon language.
export function IconLocateMe({ color = '#fff', size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="5" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="12" cy="12" r="1.6" fill={color} />
      <Path
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Messages / Inbox ─────────────────────────────────────────────────────────
export function IconMessages({ color = '#fff', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer bubble */}
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Three dots */}
      <Path d="M8 10h.01M12 10h.01M16 10h.01" stroke={color} strokeWidth={strokeWidth + 0.5} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export function IconSignOut({ color = '#fff', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M16 17l5-5-5-5"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M21 12H9"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Trash / Delete ───────────────────────────────────────────────────────────
export function IconTrash({ color = '#fff', size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}
