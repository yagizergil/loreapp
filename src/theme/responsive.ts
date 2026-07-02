/**
 * Lore — Responsive layout helpers
 *
 * Screens/sheets are designed against phone widths. On iPad the raw window
 * width blows up grids, maps and modal cards into oversized/misaligned
 * layouts (the cause of the App Store Guideline 4 "crowded" rejection), so
 * layout-sensitive measurements should clamp against CONTENT_MAX_WIDTH
 * instead of using the raw screen width.
 */
import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Comfortable ceiling for a single-column phone-style layout (large-phone
// width). Anything wider than this centers within the available space.
export const CONTENT_MAX_WIDTH = 430;

export const isTablet = SCREEN_W >= 600;

// Use in place of raw `Dimensions.get('window').width` for grid/media sizing.
export const contentWidth = Math.min(SCREEN_W, CONTENT_MAX_WIDTH);

export const screenWidth = SCREEN_W;
export const screenHeight = SCREEN_H;
