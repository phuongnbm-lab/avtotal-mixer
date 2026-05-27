import { useState, useRef, useCallback } from 'react'
import { playSound } from '../sound'
import { useLang } from '../LangContext'

function formatElapsed(ms) {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function useRender(queue, setQueue) {
  const { t } = useLang()
  const [renderState, setRenderState] = useState({
    active: false, progress: 0, status: '', renderId: null
  })
  const renderIdRef = useRef(null)
  const jobStartTimeRef = useRef(null) // thời điểm bắt đầu job hiện tại

  const startRender = useCallback(async (jobs) => {
    if (!jobs.length) return
    const renderId = Date.now().toString()
    renderIdRef.current = renderId
    jobStartTimeRef.current = Date.now()

    setRenderState({ active: true, progress: 0, status: t.preparing, renderId })

    const progressHandler = ({ pct, msg, renderId: rid }) => {
      if (rid !== renderId) return
      setRenderState(s => ({ ...s, progress: pct, status: msg }))
    }

    const jobDoneHandler = ({ renderId: rid, jobIndex, total, file }) => {
      if (rid !== renderId) return
      const now = Date.now()
      const elapsed = formatElapsed(now - (jobStartTimeRef.current || now))
      jobStartTimeRef.current = now // reset cho job tiếp theo
      setQueue(q => q.map((item) => {
        const matchIdx = jobs.findIndex(j => j._id === item._id)
        if (matchIdx === jobIndex) return { ...item, progress: t.done, renderTime: elapsed }
        return item
      }))
      // Phát âm thanh sau mỗi job trung gian (không phát cho job cuối)
      if (jobs.length > 1 && jobIndex < jobs.length - 1) {
        playSound('Done_Job1.mp3')
      }
    }

    window.api.ffmpeg.onProgress(progressHandler)
    window.api.ffmpeg.onJobDone(jobDoneHandler)

    try {
      const result = await window.api.ffmpeg.render({ jobs, renderId })

      if (result.success) {
        setRenderState({ active: false, progress: 100, status: t.done, renderId: null })
        await playSound('Complete.wav')
        const msg = result.files.length === 1
          ? t.exportComplete(result.files[0])
          : t.exportMultiple(result.files.length, result.files.join('\n'))
        setTimeout(() => {
          alert(msg)
          setRenderState({ active: false, progress: 0, status: '', renderId: null })
        }, 100)
      } else if (result.cancelled) {
        setRenderState({ active: false, progress: 0, status: t.cancelled, renderId: null })
      } else {
        setRenderState({ active: false, progress: 0, status: t.renderError, renderId: null })
        await playSound('Error.wav')
        alert(t.renderErrMsg(result.error))
      }
    } catch (e) {
      setRenderState({ active: false, progress: 0, status: t.renderError, renderId: null })
      await playSound('Error.wav')
      alert(t.errMsg(e.message))
    } finally {
      window.api.ffmpeg.removeListeners()
    }
  }, [setQueue])

  const cancelRender = useCallback(() => {
    if (renderIdRef.current) {
      window.api.ffmpeg.cancel(renderIdRef.current)
    }
  }, [])

  return { renderState, startRender, cancelRender }
}
