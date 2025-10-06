const BYTE_TO_HEX = Array.from({ length: 256 }, (_, index) => {
  return (index + 0x100).toString(16).slice(1);
});

function uuidFromBytes(bytes: Uint8Array): string {
  return (
    BYTE_TO_HEX[bytes[0]] +
    BYTE_TO_HEX[bytes[1]] +
    BYTE_TO_HEX[bytes[2]] +
    BYTE_TO_HEX[bytes[3]] + "-" +
    BYTE_TO_HEX[bytes[4]] +
    BYTE_TO_HEX[bytes[5]] + "-" +
    BYTE_TO_HEX[bytes[6]] +
    BYTE_TO_HEX[bytes[7]] + "-" +
    BYTE_TO_HEX[bytes[8]] +
    BYTE_TO_HEX[bytes[9]] + "-" +
    BYTE_TO_HEX[bytes[10]] +
    BYTE_TO_HEX[bytes[11]] +
    BYTE_TO_HEX[bytes[12]] +
    BYTE_TO_HEX[bytes[13]] +
    BYTE_TO_HEX[bytes[14]] +
    BYTE_TO_HEX[bytes[15]]
  );
}

export function generateId(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  const getRandomValues = cryptoObj?.getRandomValues?.bind(cryptoObj) ?? ((buffer: Uint8Array) => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  });

  const bytes = new Uint8Array(16);
  getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return uuidFromBytes(bytes);
}
