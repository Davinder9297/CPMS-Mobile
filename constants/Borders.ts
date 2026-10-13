// Single source of truth for border styling across every screen and component
// (iOS, Android and web). Change a value here and all borders follow.
//
// BORDER_COLOR replaces the neutral grey borders (dividers, cards, inputs,
// table cells). Semantic borders - brand green, error red, selected blue - keep
// their own colour and only pick up BORDER_WIDTH.

// Dark neutral grey (Tailwind gray-500): clearly visible on white and on the
// #F5F5F5 screen background.
export const BORDER_COLOR = '#6B7280';

// Default stroke weight (was 1).
export const BORDER_WIDTH = 1.5;
