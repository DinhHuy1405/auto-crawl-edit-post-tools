#!/bin/bash

# Define full layout interface in AppConfig
sed -i '' 's/layout: { templateX: number; templateY: number; logoX: number; logoY: number; logoScale: string }/layout: { templateX: number; templateY: number; logoX: number; logoY: number; logoScale: string; subtitleY?: number; subtitleSize?: number; subtitleColor?: string; subtitleOutline?: string }/g' app/src/app/editor/page.tsx

# In CanvasEditor, extract subtitle from layout
awk '
/const logoSize = / {
    print $0
    print "  const subY = Math.min(toC(layout.subtitleY ?? 800), ar.ch - 10)"
    next
}
/const onMouseDown = / {
    print "  const onMouseDown = (e: React.MouseEvent, el: string) => {"
    print "    e.preventDefault(); e.stopPropagation()"
    print "    const o = el === \x27template\x27 ? { x: 0, y: layout.templateY } : el === \x27subtitle\x27 ? { x: 0, y: layout.subtitleY ?? 800 } : { x: layout.logoX, y: layout.logoY }"
    print "    drag.current = { el, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y }"
    print "    const onMove = (ev: MouseEvent) => {"
    print "      if (!drag.current) return"
    print "      const dx = (ev.clientX - drag.current.sx) * scale"
    print "      const dy = (ev.clientY - drag.current.sy) * scale"
    print "      if (drag.current.el === \x27template\x27) {"
    print "        onLayout({ templateY: Math.max(0, Math.min(ar.rh - 50, Math.round(drag.current.oy + dy))) })"
    print "      } else if (drag.current.el === \x27subtitle\x27) {"
    print "        onLayout({ subtitleY: Math.max(0, Math.min(ar.rh - 20, Math.round(drag.current.oy + dy))) })"
    print "      } else {"
    print "        onLayout({"
    print "          logoX: Math.max(0, Math.round(drag.current.ox + dx)),"
    print "          logoY: Math.max(0, Math.round(drag.current.oy + dy)),"
    print "        })"
    print "      }"
    print "    }"
    print "    const onUp = () => { drag.current = null; window.removeEventListener(\x27mousemove\x27, onMove); window.removeEventListener(\x27mouseup\x27, onUp) }"
    print "    window.addEventListener(\x27mousemove\x27, onMove)"
    print "    window.addEventListener(\x27mouseup\x27, onUp)"
    print "  }"
    next
}
/const onMove =/,/  window.addEventListener/ {
    # Skip original mouse move logic since we replaced it
    if ($0 ~ /window\.addEventListener\('mouseup'/) next
    next
}
/      {\/\* Logo \*\/}/ {
    print "      {/* Subtitles */}"
    print "      <div "
    print "        onMouseDown={(e) => onMouseDown(e, \x27subtitle\x27)} "
    print "        className=\"absolute z-30 cursor-move py-1 px-4 rounded border-2 border-dashed border-transparent hover:border-pink-500/50 group\" "
    print "        style={{ "
    print "          top: subY, left: \x2750%\x27, transform: \x27translateX(-50%)\x27,"
    print "          color: layout.subtitleColor ?? \x27#FFFFFF\x27,"
    print "          textShadow: \x271px 1px 2px \x27 + (layout.subtitleOutline ?? \x27#000000\x27)"
    print "        }}"
    print "      >"
    print "        <div className=\"text-center whitespace-nowrap font-bold\" style={{ fontSize: (layout.subtitleSize ?? 42) / scale }}>Sample Subtitle Text</div>"
    print "        <div className=\"absolute -right-1 -top-3 hidden group-hover:flex bg-pink-500 text-white text-[8px] px-1 rounded shadow-sm\">Subtitle</div>"
    print "      </div>"
    print ""
    print $0
    next
}
/              <p className={sectionTitle}><LayoutTemplate className="w-3.5 h-3.5" \/> Positioning<\/p>/ {
    print $0
    next
}
/                {/* Logo \*\/}/ {
    print "                {/* Subtitle Settings */}"
    print "                <div>"
    print "                  <div className=\"flex items-center justify-between mb-1\">"
    print "                    <label className=\"text-xs font-medium text-slate-700 flex items-center gap-1.5\">"
    print "                       <span className=\"w-2.5 h-0.5 bg-pink-400 rounded-full\" />"
    print "                       Subtitle Options"
    print "                    </label>"
    print "                  </div>"
    print "                  <div className=\"grid grid-cols-2 gap-2 mb-2\">"
    print "                    <div>"
    print "                      <span className=\"text-[9px] text-slate-500 font-medium block mb-1\">Y Offset (px)</span>"
    print "                      <input type=\"number\" className={inputCls} "
    print "                        value={config?.layout.subtitleY ?? 800} "
    print "                        onChange={e => onLayout({ subtitleY: +e.target.value })} "
    print "                      />"
    print "                    </div>"
    print "                    <div>"
    print "                      <span className=\"text-[9px] text-slate-500 font-medium block mb-1\">Font Size (px)</span>"
    print "                      <input type=\"number\" className={inputCls} "
    print "                        value={config?.layout.subtitleSize ?? 42} "
    print "                        onChange={e => onLayout({ subtitleSize: +e.target.value })} "
    print "                      />"
    print "                    </div>"
    print "                  </div>"
    print "                  <div className=\"grid grid-cols-2 gap-2 mb-2\">"
    print "                    <div>"
    print "                      <span className=\"text-[9px] text-slate-500 font-medium block mb-1\">Text Color</span>"
    print "                      <input type=\"color\" className=\"w-full h-8 cursor-pointer rounded-md border border-slate-200\" "
    print "                        value={config?.layout.subtitleColor ?? \"#FFFFFF\"} "
    print "                        onChange={e => onLayout({ subtitleColor: e.target.value })} "
    print "                      />"
    print "                    </div>"
    print "                    <div>"
    print "                      <span className=\"text-[9px] text-slate-500 font-medium block mb-1\">Outline Color</span>"
    print "                      <input type=\"color\" className=\"w-full h-8 cursor-pointer rounded-md border border-slate-200\" "
    print "                        value={config?.layout.subtitleOutline ?? \"#000000\"} "
    print "                        onChange={e => onLayout({ subtitleOutline: e.target.value })} "
    print "                      />"
    print "                    </div>"
    print "                  </div>"
    print "                </div>"
    print ""
    print "                <hr className=\"border-slate-200\" />"
    print ""
    print $0
    next
}
{ print }
' app/src/app/editor/page.tsx > app/src/app/editor/page.tsx.tmp

mv app/src/app/editor/page.tsx.tmp app/src/app/editor/page.tsx
npx tsc --noEmit
