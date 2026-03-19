const fs = require('fs');
let code = fs.readFileSync('src/app/editor/page.tsx', 'utf8');

// 1. Update layout type
code = code.replace(
  'layout: { templateX: number; templateY: number; logoX: number; logoY: number; logoScale: string }',
  'layout: { templateX: number; templateY: number; logoX: number; logoY: number; logoScale: string; subtitleY?: number; subtitleSize?: number; subtitleColor?: string; subtitleOutline?: string }'
);

// 2. Add subtitle states in CanvasEditor
code = code.replace(
  'const logoSize = parseInt(layout.logoScale?.split(\x27:\x27)[0] ?? \x27130\x27)',
  'const logoSize = parseInt(layout.logoScale?.split(\x27:\x27)[0] ?? \x27130\x27)\n  const subY = Math.min(toC(layout.subtitleY ?? 800), ar.ch - 10)'
);

// 3. Update mouse events to support subtitle drag
code = code.replace(
  /const onMouseDown = \(e: React.MouseEvent, el: string\) => {([\s\S]*?)const onUp = \(\) => {/m,
  `const onMouseDown = (e: React.MouseEvent, el: string) => {
    e.preventDefault(); e.stopPropagation()
    const o = el === 'template' ? { x: 0, y: layout.templateY } : el === 'subtitle' ? { x: 0, y: layout.subtitleY ?? 800 } : { x: layout.logoX, y: layout.logoY }
    drag.current = { el, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y }

    const onMove = (ev: MouseEvent) => {
      if (!drag.current) return
      const dx = (ev.clientX - drag.current.sx) * scale
      const dy = (ev.clientY - drag.current.sy) * scale
      if (drag.current.el === 'template') {
        onLayout({ templateY: Math.max(0, Math.min(ar.rh - 50, Math.round(drag.current.oy + dy))) })
      } else if (drag.current.el === 'subtitle') {
        onLayout({ subtitleY: Math.max(0, Math.min(ar.rh - 20, Math.round(drag.current.oy + dy))) })
      } else {
        onLayout({
          logoX: Math.max(0, Math.round(drag.current.ox + dx)),
          logoY: Math.max(0, Math.round(drag.current.oy + dy)),
        })
      }
    }
    const onUp = () => {`
);

// 4. Inject subtitle visual block inside the <div className="absolute inset-0 ..."> below template mask where children are
const subtitleVisual = `
      {/* Subtitles */}
      <div 
        onMouseDown={(e) => onMouseDown(e, 'subtitle')} 
        className="absolute z-30 cursor-move py-1 px-4 rounded border-2 border-dashed border-transparent hover:border-pink-500/50 group" 
        style={{ 
          top: subY, left: '50%', transform: 'translateX(-50%)',
          color: layout.subtitleColor ?? '#FFFFFF',
          textShadow: '1px 1px 2px ' + (layout.subtitleOutline ?? '#000000')
        }}
      >
        <div className="text-center whitespace-nowrap font-bold" style={{ fontSize: (layout.subtitleSize ?? 42) / scale }}>Mẫu Chữ Subtitle</div>
        <div className="absolute -right-1 -top-3 hidden group-hover:flex bg-pink-500 text-white text-[8px] px-1 rounded shadow-sm">Subtitle</div>
      </div>
`;
code = code.replace('{/* Logo */}', subtitleVisual + '      {/* Logo */}');

// 5. Add properties editor input logic
const subtitleInputs = `
                {/* Subtitle Settings */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                       <span className="w-2.5 h-0.5 bg-pink-400 rounded-full" />
                       Cài Đặt Subtitle
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-[9px] text-slate-500 font-medium block mb-1">Vị Trí Y (px)</span>
                      <input type="number" className={inputCls} 
                        value={config?.layout.subtitleY ?? 800} 
                        onChange={e => updateLayout({ subtitleY: +e.target.value })} 
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-medium block mb-1">Cỡ Chữ (px)</span>
                      <input type="number" className={inputCls} 
                        value={config?.layout.subtitleSize ?? 42} 
                        onChange={e => updateLayout({ subtitleSize: +e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <span className="text-[9px] text-slate-500 font-medium block mb-1">Màu Chữ</span>
                      <input type="color" className="w-full h-8 cursor-pointer rounded-md border border-slate-200" 
                        value={config?.layout.subtitleColor ?? "#FFFFFF"} 
                        onChange={e => updateLayout({ subtitleColor: e.target.value })} 
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-medium block mb-1">Viền Chữ</span>
                      <input type="color" className="w-full h-8 cursor-pointer rounded-md border border-slate-200" 
                        value={config?.layout.subtitleOutline ?? "#000000"} 
                        onChange={e => updateLayout({ subtitleOutline: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-200" />
`;
code = code.replace('{/* Logo */}', subtitleInputs + '                {/* Logo */}');

fs.writeFileSync('src/app/editor/page.tsx', code);
console.log('Patched correctly');
