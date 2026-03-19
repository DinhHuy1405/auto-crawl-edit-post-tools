node -e "
const fs = require('fs')
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'))
if (!cfg.layout.subtitleY) {
  cfg.layout = {
    ...cfg.layout,
    subtitleY: 800,
    subtitleSize: 42,
    subtitleColor: '#FFFFFF',
    subtitleOutline: '#000000'
  }
  fs.writeFileSync('config.json', JSON.stringify(cfg, null, 2))
}
"
