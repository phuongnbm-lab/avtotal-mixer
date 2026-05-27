const soundCache = new Map()
let _chain = Promise.resolve()

async function getSoundDataUrl(filename) {
  if (soundCache.has(filename)) return soundCache.get(filename)
  const dataUrl = await window.api.app.soundDataUrl(filename)
  if (dataUrl) soundCache.set(filename, dataUrl)
  return dataUrl || null
}

async function _playOne(filename) {
  try {
    const dataUrl = await getSoundDataUrl(filename)
    if (!dataUrl) return
    const audio = new Audio(dataUrl)
    audio.volume = 1.0
    await new Promise(resolve => {
      audio.addEventListener('ended', resolve, { once: true })
      audio.addEventListener('error', resolve, { once: true })
      audio.play().catch(resolve)
    })
  } catch {}
}

export function playSound(filename) {
  _chain = _chain.then(() => _playOne(filename))
  return _chain
}
