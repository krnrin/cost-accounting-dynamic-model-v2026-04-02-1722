import 'fake-indexeddb/auto';

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
