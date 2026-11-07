// Whether this is a screen that's tapped: there's no pointing at anything without tapping it
export const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
