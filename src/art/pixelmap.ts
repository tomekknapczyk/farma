export interface PixelSprite {
  key: string;
  palette: Record<string, string>;
  rows: string[]; // '.' = transparent
}

export function validateSprite(sp: PixelSprite): string[] {
  const errors: string[] = [];
  if (sp.rows.length === 0) return [`${sp.key}: no rows`];
  const w = sp.rows[0].length;
  if (w === 0) errors.push(`${sp.key}: empty row 0`);
  sp.rows.forEach((row, y) => {
    if (row.length !== w) errors.push(`${sp.key}: row ${y} has length ${row.length}, expected ${w}`);
    for (const ch of row) {
      if (ch !== '.' && !(ch in sp.palette)) errors.push(`${sp.key}: row ${y} has char '${ch}' not in palette`);
    }
  });
  return errors;
}

export function drawSpriteToCanvas(sp: PixelSprite, canvas: HTMLCanvasElement): void {
  canvas.width = sp.rows[0]?.length ?? 0;
  canvas.height = sp.rows.length;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  sp.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      g.fillStyle = sp.palette[ch];
      g.fillRect(x, y, 1, 1);
    }
  });
}
