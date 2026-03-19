#!/bin/bash

# Make a backup
cp app/src/app/workflow/page.tsx app/src/app/workflow/page.tsx.bak

# Update imports to include useEffect
sed -i '' 's/import { useState, useRef, useCallback }/import { useState, useRef, useCallback, useEffect }/g' app/src/app/workflow/page.tsx

# Replace state initialization to add config state
awk '
/const \[manualUrl, setManualUrl\]/ {
    print $0
    print "  const [config, setConfig] = useState<any>(null)"
    print ""
    print "  useEffect(() => {"
    print "    fetch(\047/api/config\047).then(r => r.json()).then(setConfig).catch(() => {})"
    print "  }, [])"
    print ""
    print "  const updConfig = async (updates: any) => {"
    print "    const next = { ...config, ...updates }"
    print "    setConfig(next)"
    print "    await fetch(\047/api/config\047, { method: \047PUT\047, headers: { \047Content-Type\047: \047application/json\047 }, body: JSON.stringify(next) })"
    print "  }"
    print ""
    print "  const togglePlatform = (platform: string) => {"
    print "    if (!config) return;"
    print "    const current = config.upload?.platforms || [];"
    print "    const nextPlatforms = current.includes(platform) ? current.filter((p: string) => p !== platform) : [...current, platform];"
    print "    updConfig({ upload: { ...config.upload, platforms: nextPlatforms } })"
    print "  }"
    print ""
    print "  const setTool = (useJDownloader: boolean) => {"
    print "    if (!config) return;"
    print "    updConfig({ crawler: { ...config.crawler, useJDownloader } })"
    print "  }"
    next
}
{ print }
' app/src/app/workflow/page.tsx > app/src/app/workflow/page.tsx.tmp
mv app/src/app/workflow/page.tsx.tmp app/src/app/workflow/page.tsx

# Find where to inject the UI for tool selection and platform selection
# Look for <div className="flex-1" />\n          <YtDlpBadge />\n          <JDownloaderBadge />
awk '
/<div className="flex-1" \/>/ {
    print $0
    next
}
/<YtDlpBadge \/>/ {
    print "          {config && ("
    print "            <div className=\"flex items-center gap-1.5 bg-white p-1 rounded-md border border-slate-200\">"
    print "              <button "
    print "                onClick={() => setTool(false)} "
    print "                className={cn(\"px-2 py-1 rounded text-[10px] font-bold transition-all\", !config.crawler?.useJDownloader ? \"bg-red-50 text-red-700 border border-red-200\" : \"text-slate-400 hover:text-slate-600\")}"
    print "              >"
    print "                yt-dlp"
    print "              </button>"
    print "              <button "
    print "                onClick={() => setTool(true)} "
    print "                className={cn(\"px-2 py-1 rounded text-[10px] font-bold transition-all\", config.crawler?.useJDownloader ? \"bg-amber-50 text-amber-700 border border-amber-200\" : \"text-slate-400 hover:text-slate-600\")}"
    print "              >"
    print "                JDownloader"
    print "              </button>"
    print "            </div>"
    print "          )}"
    next
}
/<JDownloaderBadge \/>/ {
    # Skip original JDownloaderBadge
    next
}
{ print }
' app/src/app/workflow/page.tsx > app/src/app/workflow/page.tsx.tmp
mv app/src/app/workflow/page.tsx.tmp app/src/app/workflow/page.tsx

# Find where to inject upload platforms UI after "Crawl Sources" section ends
# Looking for   <div className="section-card p-4"> which is the Progress bar
awk '
/{* Progress bar *}/ {
    # Add platforms section before the progress bar
    print "      {/* Upload Platforms */}"
    print "      <div className=\"section-card overflow-hidden\">"
    print "        <div className=\"px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2\">"
    print "          <Layers className=\"text-blue-500 w-4 h-4\" />"
    print "          <p className=\"text-xs font-semibold text-slate-600 uppercase tracking-wide\">Upload Targets</p>"
    print "        </div>"
    print "        <div className=\"p-3 flex flex-wrap gap-3\">"
    print "           {\047tiktok\047, \047facebook\047, \047threads\047, \047youtube\047].map(platform => {"
    print "             const P = { tiktok: TikTokIcon, facebook: FacebookIcon, threads: ThreadsIcon, youtube: YouTubeIcon }[platform] as any"
    print "             const isEnabled = config?.upload?.platforms?.includes(platform)"
    print "             return ("
    print "               <label key={platform} className={cn("
    print "                 \"flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer\","
    print "                 isEnabled ? \"bg-blue-50 border-blue-200 text-blue-800\" : \"bg-white border-slate-200 text-slate-600 hover:bg-slate-50\""
    print "               )}>"
    print "                 <input type=\"checkbox\" checked={!!isEnabled} onChange={() => togglePlatform(platform)} className=\"accent-blue-500 w-3.5 h-3.5\" />"
    print "                 <P size={14} className={isEnabled ? \"text-blue-600\" : \"text-slate-400\"} />"
    print "                 <span className=\"text-[11px] font-medium capitalize\">{platform}</span>"
    print "               </label>"
    print "             )"
    print "           })}"
    print "        </div>"
    print "      </div>"
    print ""
    print $0
    next
}
{ print }
' app/src/app/workflow/page.tsx > app/src/app/workflow/page.tsx.tmp
mv app/src/app/workflow/page.tsx.tmp app/src/app/workflow/page.tsx

