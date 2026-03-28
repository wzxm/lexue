// tab 选中状态单例 — 持久存活，不受组件 mount/unmount 影响
type Listener = (idx: number) => void
type VisibleListener = (visible: boolean) => void

let _current = 0
const _listeners = new Set<Listener>()
let _visible = true
const _visibleListeners = new Set<VisibleListener>()

export const tabState = {
  get current() {
    return _current
  },
  get visible() {
    return _visible
  },
  setSelected(idx: number) {
    _current = idx
    _listeners.forEach((fn) => fn(idx))
  },
  setVisible(visible: boolean) {
    if (_visible === visible) return
    _visible = visible
    _visibleListeners.forEach((fn) => fn(visible))
  },
  subscribe(fn: Listener): () => void {
    _listeners.add(fn)
    return () => {
      _listeners.delete(fn)
    }
  },
  subscribeVisible(fn: VisibleListener): () => void {
    _visibleListeners.add(fn)
    return () => {
      _visibleListeners.delete(fn)
    }
  },
}
