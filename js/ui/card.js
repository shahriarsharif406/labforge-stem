// Report-card PNG (1200x630) drawn on a canvas. The name appears only here, never in a URL.
export function cardPNG({ name, expLabel, planet, seedTag, g }) {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630;
  const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 1200, 630); bg.addColorStop(0, '#0B1020'); bg.addColorStop(1, '#1A2340');
  x.fillStyle = bg; x.fillRect(0, 0, 1200, 630);
  x.strokeStyle = '#26304A'; for (let i = 0; i < 1200; i += 48) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 630); x.stroke(); }
  x.fillStyle = '#4FF0C3'; x.font = '700 28px "JetBrains Mono",monospace'; x.fillText('LABFORGE · REPORT CARD', 60, 80);
  x.fillStyle = '#EEF1F7'; x.font = '700 64px "Space Grotesk",system-ui,sans-serif'; x.fillText(expLabel, 60, 170);
  x.fillStyle = '#A9B3C9'; x.font = '400 28px "Space Grotesk",system-ui,sans-serif'; x.fillText(`${name || 'Student'}  ·  world ${planet}  ·  ${seedTag}`, 60, 218);
  // ring
  const cx = 930, cy = 300, r = 150;
  x.lineWidth = 22; x.strokeStyle = '#26304A'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.strokeStyle = '#4FF0C3'; x.shadowColor = '#4FF0C3'; x.shadowBlur = 24; x.lineCap = 'round';
  x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (g.total / 100) * Math.PI * 2); x.stroke(); x.shadowBlur = 0;
  x.fillStyle = '#EEF1F7'; x.textAlign = 'center'; x.font = '700 110px "JetBrains Mono",monospace'; x.fillText(String(g.total), cx, cy + 36);
  x.fillStyle = '#4FF0C3'; x.font = '700 24px "JetBrains Mono",monospace'; x.fillText(g.band.toUpperCase(), cx, cy + 84);
  x.textAlign = 'left';
  g.parts.forEach((p, i) => {
    const y = 290 + i * 46;
    x.fillStyle = '#A9B3C9'; x.font = '400 24px "Space Grotesk",system-ui,sans-serif'; x.fillText(p.label, 60, y);
    x.fillStyle = '#141B2E'; x.fillRect(330, y - 20, 380, 14);
    x.fillStyle = '#4FF0C3'; x.fillRect(330, y - 20, 380 * (p.pts / p.max), 14);
    x.fillStyle = '#EEF1F7'; x.font = '700 22px "JetBrains Mono",monospace'; x.fillText(`${p.pts}/${p.max}`, 730, y);
  });
  x.fillStyle = '#A9B3C9'; x.font = '400 20px "JetBrains Mono",monospace'; x.fillText('Auto-graded by readable formulas · virtual lab · runs in the browser', 60, 595);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
