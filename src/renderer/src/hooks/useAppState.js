import { useState, useCallback, useEffect } from 'react'

const DEFAULT_AUDIO = {
  files: [], loopCounts: [], shuffle: true, exportList: true,
  overlayEnabled: false, overlayFile: '',
  sfxLoop: { enabled: false, file: '', count: 1, sfxStart: 0, sfxEnd: 0 }
}
const DEFAULT_VIDEO = {
  files: [], mutedFlags: [], soloFlags: [], shuffle: true, scale: true,
  overlayEnabled: false, overlayFile: '',
  introEnabled: false, introFile: '', introDuration: '00:00:03', introScale: true
}
const DEFAULT_MUSIC = { enabled: false, folder: '', num: 0, subfolders: false }
const DEFAULT_CLIP = { enabled: false, folder: '', num: 0, subfolders: false }

export function useAppState() {
  const [audioState, setAudioState] = useState(DEFAULT_AUDIO)
  const [videoState, setVideoState] = useState(DEFAULT_VIDEO)
  const [outputName, setOutputName] = useState('VideoMix')
  const [outputFolder, setOutputFolder] = useState('')
  const [resolution, setResolution] = useState('FullHD')
  const [musicFolder, setMusicFolder] = useState(DEFAULT_MUSIC)
  const [clipFolder, setClipFolder] = useState(DEFAULT_CLIP)
  const [queue, setQueue] = useState([])
  const [metadataPresets, setMetadataPresets] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const s = await window.api.state.load()
        if (!s || !Object.keys(s).length) {
          setOutputFolder(await getDesktop())
          setLoaded(true)
          return
        }
        if (s.audioState) setAudioState({
          ...DEFAULT_AUDIO,
          ...s.audioState,
          sfxLoop: {
            ...DEFAULT_AUDIO.sfxLoop,
            ...(s.audioState.sfxLoop || {}),
            sfxStart: toSecs(s.audioState.sfxLoop?.sfxStart),
            sfxEnd:   toSecs(s.audioState.sfxLoop?.sfxEnd),
          }
        })
        if (s.videoState) setVideoState({ ...DEFAULT_VIDEO, ...s.videoState })
        if (s.outputName) setOutputName(s.outputName)
        if (s.outputFolder) setOutputFolder(s.outputFolder)
        else setOutputFolder(await getDesktop())
        if (s.resolution) setResolution(s.resolution)
        if (s.musicFolder) setMusicFolder({ ...DEFAULT_MUSIC, ...s.musicFolder })
        if (s.clipFolder) setClipFolder({ ...DEFAULT_CLIP, ...s.clipFolder })
        if (s.queue) setQueue(s.queue)
        if (s.metadataPresets) setMetadataPresets(s.metadataPresets)
      } catch {
        setOutputFolder(await getDesktop())
      }
      setLoaded(true)
    }
    load()
  }, [])

  const saveState = useCallback((data) => {
    if (!loaded) return
    window.api.state.save(data).catch(() => {})
  }, [loaded])

  return {
    audioState, setAudioState,
    videoState, setVideoState,
    outputName, setOutputName,
    outputFolder, setOutputFolder,
    resolution, setResolution,
    musicFolder, setMusicFolder,
    clipFolder, setClipFolder,
    queue, setQueue,
    metadataPresets, setMetadataPresets,
    saveState, loaded
  }
}

// Converts both old string format ("1:30") and new number format (90) to seconds
function toSecs(val) {
  if (typeof val === 'number') return val
  if (!val) return 0
  const s = String(val).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s)
  const parts = s.split(':').map(Number)
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1]
  return 0
}

async function getDesktop() {
  try {
    // Electron provides the path via shell
    return ''
  } catch {
    return ''
  }
}
