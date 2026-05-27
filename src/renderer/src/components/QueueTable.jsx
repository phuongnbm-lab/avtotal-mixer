import { useState } from 'react'
import Btn from './Btn'
import CTADialog from './CTADialog'
import MetadataPresetDialog from './MetadataPresetDialog'
import { useLang } from '../LangContext'

function VipToast({ message, onDone }) {
  return (
    <div style={{
      position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
      background: '#2D2B52', color: '#fff', borderRadius: 10,
      padding: '10px 22px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)', zIndex: 9999,
      animation: 'fadeInUp 0.2s ease',
      whiteSpace: 'nowrap'
    }}>
      {message}
    </div>
  )
}

export default function QueueTable({ queue, setQueue, renderState, onRenderAll, onRenderOne, onCancel, metadataPresets, setMetadataPresets, isVip }) {
  const { t } = useLang()
  const [ctaDialog, setCtaDialog]   = useState(null) // { jobIndex }
  const [metaDialog, setMetaDialog] = useState(null) // { jobIndex }
  const [vipToast, setVipToast]     = useState(null)

  function showVipToast(msg) {
    setVipToast(msg)
    setTimeout(() => setVipToast(null), 3000)
  }

  function openCTA(i) {
    if (!isVip) { showVipToast(t.vipCta); return }
    setCtaDialog({ jobIndex: i })
  }

  function openMeta(i) {
    if (!isVip) { showVipToast(t.vipMeta); return }
    setMetaDialog({ jobIndex: i })
  }

  function deleteJob(i) {
    if (!confirm(t.deleteJob)) return
    setQueue(q => q.filter((_, idx) => idx !== i))
  }

  function deleteAll() {
    if (!queue.length) return
    if (!confirm(t.deleteAllJobs)) return
    setQueue([])
  }

  function moveJob(i, delta) {
    const j = i + delta
    if (j < 0 || j >= queue.length) return
    const q = [...queue]
    ;[q[i], q[j]] = [q[j], q[i]]
    setQueue(q)
  }

  function renameJob(i) {
    const name = prompt(t.renamePrompt, queue[i].name)
    if (!name) return
    setQueue(q => q.map((item, idx) => idx === i ? { ...item, name } : item))
  }

  function saveCTA(jobIndex, slots) {
    setQueue(q => q.map((item, i) => i === jobIndex ? { ...item, ctaSlots: slots } : item))
    setCtaDialog(null)
  }

  function saveMetadata(jobIndex, selectedPresetId, presets) {
    setMetadataPresets(presets)
    setQueue(q => q.map((item, i) => i === jobIndex ? { ...item, metadataPresetId: selectedPresetId } : item))
    setMetaDialog(null)
  }

  return (
    <div style={{
      background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)',
      overflow: 'hidden', marginBottom: 8
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: queue.length || renderState.active ? '10px 18px' : '5px 18px', borderBottom: '1px solid var(--border)', transition: 'padding 0.2s' }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', letterSpacing: 1 }}>
          {t.renderQueue}{queue.length > 0 ? ` — ${t.job(queue.length)}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        {queue.length > 0 && !renderState.active && (
          <>
            <Btn onClick={deleteAll} style={{ color: '#EC8B8B', marginRight: 8 }}>{t.clearAll}</Btn>
            <Btn
              onClick={onRenderAll}
              style={{ background: '#5A3DF0', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, padding: '7px 20px' }}
            >
              {t.renderAll}
            </Btn>
          </>
        )}
        {renderState.active && (
          <Btn onClick={onCancel} style={{ color: '#EC8B8B' }}>{t.stopRender}</Btn>
        )}
      </div>

      {/* Progress bar (when rendering) */}
      {renderState.active && (
        <div style={{ padding: '8px 18px', background: 'var(--soft)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>{renderState.status}</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{renderState.progress}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#18C9B7', borderRadius: 3,
              width: `${renderState.progress}%`, transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!queue.length && !renderState.active && (
        <div style={{ padding: '2px 18px 3px', color: 'var(--muted)', fontSize: 11, textAlign: 'center' }}>
          {t.noJobs} <strong style={{ color: 'var(--text)' }}>{t.addToQueue}</strong>.
        </div>
      )}

      {/* Table */}
      {queue.length > 0 && <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 64 }} />   {/* # */}
            <col style={{ width: '18%' }} /> {/* Name */}
            <col />                          {/* Folder — tự co giãn */}
            <col style={{ width: 90 }} />    {/* Duration */}
            <col style={{ width: 110 }} />   {/* Status */}
            <col style={{ width: 'max-content' }} /> {/* Actions — vừa khít nút */}
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--soft)' }}>
              {[t.colNum, t.colName, t.colFolder, t.colDuration, t.colStatus, t.colActions].map((h, i) => (
                <th key={h} style={{
                  padding: '7px 10px', textAlign: i === 0 ? 'center' : 'left',
                  color: 'var(--muted)', fontWeight: 600, fontSize: 11,
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.map((job, i) => (
              <tr key={job._id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--soft)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                    <button onClick={() => moveJob(i, -1)} style={navBtn} disabled={i === 0}>▲</button>
                    <span style={{ color: 'var(--muted)', minWidth: 20, textAlign: 'center' }}>{i + 1}</span>
                    <button onClick={() => moveJob(i, 1)} style={navBtn} disabled={i === queue.length - 1}>▼</button>
                  </div>
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--text)', fontWeight: 600 }}>
                  <span style={{ cursor: 'pointer' }} onDoubleClick={() => renameJob(i)}>{job.name}</span>
                  {job.metadataPresetId && (() => {
                    const preset = (metadataPresets || []).find(p => p.id === job.metadataPresetId)
                    return preset ? (
                      <div style={{ fontSize: 10, color: '#F59E0B', marginTop: 2, fontWeight: 500 }}>
                        {'★'.repeat(preset.rating || 0)} {preset.name}
                      </div>
                    ) : null
                  })()}
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.folderPath}
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{job.duration || '--:--:--'}</td>
                <td style={{ padding: '6px 10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: job.progress?.includes('Done') ? '#EAFBF8' : job.progress === 'Rendering...' ? '#F1EDFF' : 'var(--soft)',
                      color: job.progress?.includes('Done') ? '#18C9B7' : job.progress === 'Rendering...' ? '#5A3DF0' : 'var(--muted)'
                    }}>
                      {job.progress || t.pending}
                    </span>
                    {job.renderTime && (
                      <span style={{ fontSize: 10, color: 'var(--muted)', paddingLeft: 2 }}>
                        ⏱ {job.renderTime}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '6px 10px 6px 0', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', paddingRight: 10 }}>
                    <Btn
                      onClick={() => openCTA(i)}
                      style={{ padding: '3px 8px', fontSize: 11, ...(job.ctaSlots?.length > 0 ? { background: '#5A3DF0', color: '#fff', border: 'none', fontWeight: 700 } : {}) }}
                    >
                      CTA{job.ctaSlots?.length > 0 ? ` ${job.ctaSlots.length}` : ''}
                    </Btn>
                    <Btn
                      onClick={() => openMeta(i)}
                      title={job.metadataPresetId ? `Metadata: ${(metadataPresets || []).find(p => p.id === job.metadataPresetId)?.name || ''}` : 'Set Metadata Preset'}
                      style={{ padding: '3px 8px', fontSize: 11, ...(job.metadataPresetId ? { background: '#F59E0B', color: '#fff', border: 'none', fontWeight: 700 } : {}) }}
                    >
                      META
                    </Btn>
                    <Btn onClick={() => onRenderOne(i)} disabled={renderState.active} style={{ padding: '3px 8px', fontSize: 11 }}>▶</Btn>
                    <Btn onClick={() => deleteJob(i)} style={{ padding: '3px 10px', fontSize: 13, color: '#EC8B8B', fontWeight: 700 }}>✕</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {ctaDialog && (
        <CTADialog
          jobIndex={ctaDialog.jobIndex}
          job={queue[ctaDialog.jobIndex]}
          prevJob={ctaDialog.jobIndex > 0 ? queue[ctaDialog.jobIndex - 1] : null}
          onSave={saveCTA}
          onClose={() => setCtaDialog(null)}
        />
      )}

      {metaDialog && (
        <MetadataPresetDialog
          jobName={queue[metaDialog.jobIndex]?.name || ''}
          presets={metadataPresets || []}
          selectedId={queue[metaDialog.jobIndex]?.metadataPresetId || null}
          onSave={(selectedId, presets) => saveMetadata(metaDialog.jobIndex, selectedId, presets)}
          onClose={() => setMetaDialog(null)}
        />
      )}

      {vipToast && <VipToast message={vipToast} />}
    </div>
  )
}

const navBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted)', fontSize: 10, padding: '1px 2px'
}
