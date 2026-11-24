// mushaf-pdf.js — Authentic Mohammadi Mushaf viewer (PDF.js)
// Loaded before main app script.

let muhammadiPdfDoc = null;
let pdfCurrentPage = 1;
let pdfTotalPages = 0;
let pdfScale = 1.15;
let pdfRendering = false;
let pdfPendingPage = null;
let mushafDisplayMode = localStorage.getItem('mihrab_mushaf_mode') || 'pdf';

function getMuhammadiPageOffset() {
  const meta = (typeof state !== 'undefined' && state.pdfMeta && state.pdfMeta['muhammadi_pdf']) || {};
  return Math.max(0, parseInt(meta.pageOffset || meta.offset || '0', 10) || 0);
}

function hizbToMuhammadiPage(hizb) {
  const h = Math.max(1, Math.min(60, parseInt(hizb, 10) || 1));
  const contentPages = 638;
  const approx = 1 + Math.floor(((h - 1) / 60) * (contentPages - 1));
  return getMuhammadiPageOffset() + approx;
}

function setMushafDisplayMode(mode) {
  mushafDisplayMode = mode === 'text' ? 'text' : 'pdf';
  localStorage.setItem('mihrab_mushaf_mode', mushafDisplayMode);
  const pdfWrap = document.getElementById('pdfViewerWrap');
  const textBlock = document.getElementById('muhammadiContent');
  const btnPdf = document.getElementById('modePdfBtn');
  const btnText = document.getElementById('modeTextBtn');
  if (pdfWrap) pdfWrap.classList.toggle('active', mushafDisplayMode === 'pdf');
  if (textBlock) textBlock.classList.toggle('hidden-by-pdf', mushafDisplayMode === 'pdf');
  if (btnPdf) btnPdf.classList.toggle('active', mushafDisplayMode === 'pdf');
  if (btnText) btnText.classList.toggle('active', mushafDisplayMode === 'text');
  if (mushafDisplayMode === 'pdf' && muhammadiPdfDoc) {
    renderPdfPage(pdfCurrentPage);
  }
}

async function ensureMuhammadiPdfLoaded() {
  if (muhammadiPdfDoc) return muhammadiPdfDoc;
  if (!window.pdfjsLib) {
    if (typeof showToast === 'function') showToast('تعذر تحميل محرك PDF. تحقق من الاتصال.');
    return null;
  }
  const saved = await getBlobFromDB('pdf_muhammadi_pdf').catch(() => null);
  if (!saved || !saved.blob) return null;

  const panel = document.getElementById('pdfUploadPanel');
  const canvas = document.getElementById('pdfCanvas');
  if (panel) panel.innerHTML = '<div style="padding:28px;font-family:Cairo,sans-serif;">جاري فتح المصحف المحمدي...</div>';

  try {
    const data = await saved.blob.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data });
    muhammadiPdfDoc = await loadingTask.promise;
    pdfTotalPages = muhammadiPdfDoc.numPages;
    if (panel) panel.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    const meta = (state.pdfMeta && state.pdfMeta['muhammadi_pdf']) || {};
    pdfCurrentPage = Math.max(1, Math.min(pdfTotalPages, parseInt(meta.page || '1', 10) || 1));
    return muhammadiPdfDoc;
  } catch (e) {
    console.error(e);
    if (panel) {
      panel.style.display = 'block';
      panel.innerHTML = '<div style="color:var(--danger);padding:16px;">تعذر قراءة ملف PDF. جرّب رفع الملف مرة أخرى.</div><button class="btn btn-gold" onclick="triggerPdfUpload(\'muhammadi_pdf\')">📂 إعادة الرفع</button>';
    }
    muhammadiPdfDoc = null;
    return null;
  }
}

async function renderPdfPage(num) {
  if (!muhammadiPdfDoc) {
    const doc = await ensureMuhammadiPdfLoaded();
    if (!doc) {
      const panel = document.getElementById('pdfUploadPanel');
      const canvas = document.getElementById('pdfCanvas');
      if (panel) panel.style.display = 'block';
      if (canvas) canvas.style.display = 'none';
      return;
    }
  }
  if (pdfRendering) {
    pdfPendingPage = num;
    return;
  }
  pdfRendering = true;
  try {
    const pageNum = Math.max(1, Math.min(pdfTotalPages, num));
    pdfCurrentPage = pageNum;
    const page = await muhammadiPdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdfCanvas');
    const box = document.getElementById('pdfCanvasBox');
    if (!canvas || !box) return;

    const unscaled = page.getViewport({ scale: 1 });
    const containerWidth = Math.max(280, box.clientWidth - 8);
    const fitScale = containerWidth / unscaled.width;
    const scale = Math.max(0.6, Math.min(2.8, pdfScale * fitScale));
    const viewport = page.getViewport({ scale });

    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const info = document.getElementById('pdfPageInfo');
    if (info) info.textContent = pageNum + ' / ' + pdfTotalPages;
    const jump = document.getElementById('pdfJumpInput');
    if (jump) jump.value = pageNum;

    if (!state.pdfMeta['muhammadi_pdf']) state.pdfMeta['muhammadi_pdf'] = {};
    state.pdfMeta['muhammadi_pdf'].page = pageNum;
    if (typeof saveState === 'function') saveState();
  } catch (e) {
    console.error('PDF render error', e);
    if (typeof showToast === 'function') showToast('تعذر عرض الصفحة');
  } finally {
    pdfRendering = false;
    if (pdfPendingPage !== null) {
      const p = pdfPendingPage;
      pdfPendingPage = null;
      renderPdfPage(p);
    }
  }
}

function pdfPrevPage() {
  if (pdfCurrentPage > 1) renderPdfPage(pdfCurrentPage - 1);
}
function pdfNextPage() {
  if (pdfCurrentPage < pdfTotalPages) renderPdfPage(pdfCurrentPage + 1);
}
function pdfZoom(delta) {
  pdfScale = Math.max(0.5, Math.min(2.5, pdfScale + delta));
  renderPdfPage(pdfCurrentPage);
}
function pdfFitWidth() {
  pdfScale = 1.0;
  renderPdfPage(pdfCurrentPage);
}
function pdfGoToInputPage() {
  const v = parseInt(document.getElementById('pdfJumpInput')?.value || '1', 10) || 1;
  renderPdfPage(v);
}
function pdfGoToHizbPage() {
  const p = hizbToMuhammadiPage(typeof currentMushafHizb !== 'undefined' ? currentMushafHizb : 1);
  renderPdfPage(p);
  if (typeof showToast === 'function') showToast('تقريبي: صفحة الحزب ' + (currentMushafHizb || 1) + ' ≈ ' + p);
}

async function openMuhammadiPdfInViewer(preferredPage) {
  setMushafDisplayMode('pdf');
  const doc = await ensureMuhammadiPdfLoaded();
  if (!doc) {
    if (typeof showToast === 'function') showToast('ارفع أولاً ملف PDF للمصحف المحمدي');
    return false;
  }
  const page = preferredPage || pdfCurrentPage || 1;
  await renderPdfPage(page);
  return true;
}
