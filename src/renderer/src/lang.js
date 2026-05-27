export const LANGS = {
  en: {
    // FileListCard
    audio: 'Audio', video: 'Video',
    addMp3: '+ Add MP3', addMp4: '+ Add MP4',
    autoShuffle: 'Auto Shuffle', exportList: 'Export List',
    randomize: '⤮ Randomize', scale: 'Scale', clear: '🗑 Clear',
    overlay: 'Overlay', overlaid: 'Overlaid', intro: 'Intro', introOn: 'Intro ✓',
    sfxLoop: 'SFX Loop',
    dropAudio: 'Drag & drop audio files here\nor click "Add MP3"',
    dropVideo: 'Drag & drop video files here\nor click "Add MP4"',
    dropHint: (type) => `Drop ${type} files here`,
    files: (n) => `${n} files`,
    confirmClear: 'Clear all files?',
    ctxPlay: '▶ Play', ctxMute: '🔇 Mute audio', ctxUnmute: '🔊 Unmute',
    ctxSolo: 'Solo', ctxSoloOff: 'Solo OFF',
    ctxSetLoop: '🔁 Set Loop...', ctxDuplicate: '📋 Duplicate', ctxDelete: '🗑 Delete',
    ctxMoveUp: '↑ Move Up', ctxMoveDown: '↓ Move Down',
    ctxBringTop: '⇑ Bring to Top', ctxBringBottom: '⇓ Bring to Bottom',
    ctxOpenFolder: '📁 Open Folder',
    loopPrompt: (name) => `Loop count for "${name}":`,

    // OutputCard
    outputSection: 'OUTPUT', resetAll: '🗑 Reset All',
    fileName: 'File name', resolution: 'Resolution', outputFolder: 'Output folder',
    browse: 'Browse', noFolder: 'No folder selected',
    addToQueue: 'Add to Queue', quickRender: '⚡ Render',
    musicFolder: 'Music Folder', clipFolder: 'Clip Folder',
    num: 'Num:', sub: 'Sub', total: 'Total', saved: '▾ Saved',

    // QueueTable
    renderQueue: 'RENDER QUEUE',
    job: (n) => `${n} job${n !== 1 ? 's' : ''}`,
    clearAll: '🗑 Clear All', renderAll: '▶ Render All', stopRender: '⏹ Stop Render',
    noJobs: 'No jobs yet. Add audio + video → enter file name → click',
    colNum: '#', colName: 'Name', colFolder: 'Folder',
    colDuration: 'Duration', colStatus: 'Status', colActions: 'Actions',
    pending: 'Pending',
    deleteJob: 'Delete this job?', deleteAllJobs: 'Delete all jobs in queue?',
    renamePrompt: 'New job name:',
    vipCta: 'CTA is a VIP feature. Contact admin to upgrade.',
    vipMeta: 'META is a VIP feature. Contact admin to upgrade.',

    // Render status
    preparing: 'Preparing...', done: 'Done ✓',
    cancelled: 'Cancelled', renderError: 'Error',
    exportComplete: (f) => `Export complete:\n${f}`,
    exportMultiple: (n, files) => `Exported ${n} files:\n${files}`,
    renderErrMsg: (e) => `Render error:\n${e}`,
    errMsg: (e) => `Error: ${e}`,

    // TitleBar
    darkMode: '🌙 Dark', lightMode: '☀ Light',
    support: '☕ Support', checkingLicense: 'Checking license...',
    lifetime: 'Lifetime', days: 'days', langBtn: 'VI',
  },

  vi: {
    // FileListCard
    audio: 'Âm thanh', video: 'Video',
    addMp3: '+ Thêm MP3', addMp4: '+ Thêm MP4',
    autoShuffle: 'Xáo trộn', exportList: 'Xuất danh sách',
    randomize: '⤮ Ngẫu nhiên', scale: 'Thu phóng', clear: '🗑 Xóa hết',
    overlay: 'Overlay', overlaid: 'Đã Overlay', intro: 'Intro', introOn: 'Intro ✓',
    sfxLoop: 'SFX Loop',
    dropAudio: 'Kéo thả file âm thanh vào đây\nhoặc nhấn "Thêm MP3"',
    dropVideo: 'Kéo thả file video vào đây\nhoặc nhấn "Thêm MP4"',
    dropHint: (type) => `Thả file ${type} vào đây`,
    files: (n) => `${n} file`,
    confirmClear: 'Xóa hết file?',
    ctxPlay: '▶ Phát', ctxMute: '🔇 Tắt tiếng', ctxUnmute: '🔊 Bật tiếng',
    ctxSolo: 'Solo', ctxSoloOff: 'Tắt Solo',
    ctxSetLoop: '🔁 Đặt vòng lặp...', ctxDuplicate: '📋 Nhân bản', ctxDelete: '🗑 Xóa',
    ctxMoveUp: '↑ Lên trên', ctxMoveDown: '↓ Xuống dưới',
    ctxBringTop: '⇑ Lên đầu', ctxBringBottom: '⇓ Xuống cuối',
    ctxOpenFolder: '📁 Mở thư mục',
    loopPrompt: (name) => `Số vòng lặp cho "${name}":`,

    // OutputCard
    outputSection: 'ĐẦU RA', resetAll: '🗑 Đặt lại',
    fileName: 'Tên file', resolution: 'Độ phân giải', outputFolder: 'Thư mục xuất',
    browse: 'Chọn', noFolder: 'Chưa chọn thư mục',
    addToQueue: 'Thêm vào hàng đợi', quickRender: '⚡ Render',
    musicFolder: 'Thư mục nhạc', clipFolder: 'Thư mục video',
    num: 'Số:', sub: 'Thư mục con', total: 'Tổng', saved: '▾ Đã lưu',

    // QueueTable
    renderQueue: 'HÀNG ĐỢI RENDER',
    job: (n) => `${n} job`,
    clearAll: '🗑 Xóa hết', renderAll: '▶ Render tất cả', stopRender: '⏹ Dừng',
    noJobs: 'Chưa có job. Thêm audio + video → nhập tên file → nhấn',
    colNum: '#', colName: 'Tên', colFolder: 'Thư mục',
    colDuration: 'Thời lượng', colStatus: 'Trạng thái', colActions: 'Hành động',
    pending: 'Chờ xử lý',
    deleteJob: 'Xóa job này?', deleteAllJobs: 'Xóa tất cả job trong hàng đợi?',
    renamePrompt: 'Tên mới:',
    vipCta: 'CTA là tính năng VIP. Liên hệ admin để nâng cấp.',
    vipMeta: 'META là tính năng VIP. Liên hệ admin để nâng cấp.',

    // Render status
    preparing: 'Đang chuẩn bị...', done: 'Hoàn thành ✓',
    cancelled: 'Đã hủy', renderError: 'Lỗi',
    exportComplete: (f) => `Xuất xong:\n${f}`,
    exportMultiple: (n, files) => `Đã xuất ${n} file:\n${files}`,
    renderErrMsg: (e) => `Lỗi render:\n${e}`,
    errMsg: (e) => `Lỗi: ${e}`,

    // TitleBar
    darkMode: '🌙 Tối', lightMode: '☀ Sáng',
    support: '☕ Ủng hộ', checkingLicense: 'Đang kiểm tra bản quyền...',
    lifetime: 'Vĩnh viễn', days: 'ngày', langBtn: 'EN',
  }
}
