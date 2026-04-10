// ─── AI Creator — Shared Types ────────────────────────────────────────────────

export type Engine    = 'browser' | 'api'
export type OutputFmt = 'images'  | 'video'
export type CtxMode   = 'model'   | 'background'
export type BgStatus  = 'idle' | 'processing' | 'done' | 'error'
export type ItemStatus = 'pending' | 'running' | 'done' | 'error'
export type Phase = 'idle' | 'bg-remove' | 'generating' | 'post' | 'done'

export interface AngleConfig {
  id: string
  label: string      // "Toàn thân thẳng"
  prompt: string     // prompt gửi vào Gemini
  enabled: boolean
}

export interface AngleResult {
  angleId: string
  label: string
  imagePath?: string
  previewUrl?: string
  status: ItemStatus
}

export interface ProductItem {
  id: string
  // Source
  sourcePath: string
  sourcePreview: string       // blob URL hoặc /api/file?path=...
  fileName: string
  // Bg removal
  bgRemovedPath?: string
  bgRemovedPreview?: string
  bgStatus: BgStatus
  // Generation
  angles: AngleResult[]
  status: ItemStatus
}

export interface ContextAsset {
  // Scenario A — Model (trang phục)
  modelImagePath?: string
  modelImagePreview?: string
  modelPrompt: string
  // Scenario B — Background (đồ vật tĩnh)
  bgImagePath?: string
  bgImagePreview?: string
  bgPrompt: string
}

export interface PipelineProgress {
  phase: Phase
  currentProductIdx: number
  currentAngleIdx: number
  totalImages: number
  doneImages: number
  errorImages: number
}

export const DEFAULT_ANGLES: AngleConfig[] = [
  { id: 'front',   label: 'Toàn thân thẳng',   prompt: 'Góc chụp thẳng toàn thân, người mẫu nhìn thẳng vào camera, đứng tự tin, ánh sáng studio',       enabled: true  },
  { id: 'q3',      label: 'Nghiêng 3/4',        prompt: 'Góc chụp nghiêng 3/4, người mẫu quay nhẹ về phía phải, ánh sáng tự nhiên, tư thế tự nhiên',      enabled: true  },
  { id: 'close',   label: 'Cận cảnh trang phục', prompt: 'Cận cảnh phần thân trên, focus vào chi tiết trang phục, ánh sáng đẹp làm nổi chất liệu vải',     enabled: true  },
  { id: 'dynamic', label: 'Dáng di chuyển',      prompt: 'Người mẫu đang bước đi nhẹ nhàng, trang phục bay nhẹ, chuyển động tự nhiên, năng động',          enabled: false },
  { id: 'back',    label: 'Góc sau lưng',        prompt: 'Góc chụp từ phía sau, người mẫu quay lưng nhẹ nhìn qua vai, thể hiện phần sau trang phục',       enabled: false },
  { id: 'sit',     label: 'Ngồi / Thư giãn',     prompt: 'Người mẫu ngồi thoải mái trên ghế, tư thế thư giãn tự nhiên, trang phục gọn đẹp',               enabled: false },
]
