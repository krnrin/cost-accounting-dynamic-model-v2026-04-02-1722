import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

const canvasContextStub = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  fillRect: () => {},
  clearRect: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => {},
  createImageData: () => ({ data: new Uint8ClampedArray(4) }),
  setTransform: () => {},
  drawImage: () => {},
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  stroke: () => {},
  translate: () => {},
  scale: () => {},
  rotate: () => {},
  arc: () => {},
  fill: () => {},
  measureText: () => ({ width: 0 }),
  transform: () => {},
  rect: () => {},
  clip: () => {},
  canvas: null as HTMLCanvasElement | null,
};

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: function getContext() {
      canvasContextStub.canvas = this;
      return canvasContextStub;
    },
  });
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof URL !== 'undefined' && !URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: () => 'blob:mock',
  });
}

if (typeof URL !== 'undefined' && !URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: () => {},
  });
}
