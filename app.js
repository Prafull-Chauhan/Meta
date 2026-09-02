/**
 * Meta Glasses Studio Converter - Engine
 */
(() => {
  'use strict';

  // Hardware Model Presets
  const HARDWARE_PRESETS = {
    rayban_gen2_standard: {
      make: 'Meta AI',
      model: 'Ray-Ban Meta Smart Glasses',
      width: 3024,
      height: 4032,
      label: 'Ray-Ban Meta 2'
    },
    rayban_gen2_headliner: {
      make: 'Meta AI',
      model: 'Ray-Ban Meta Headliner',
      width: 3024,
      height: 4032,
      label: 'Ray-Ban Headliner'
    },
    rayban_stories_legacy: {
      make: 'Facebook',
      model: 'Ray-Ban Stories',
      width: 2592,
      height: 1944,
      label: 'Ray-Ban Stories Gen 1'
    }
  };

  const DOM = {
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    cameraInput: document.getElementById('cameraInput'),
    cameraBtn: document.getElementById('cameraBtn'),
    galleryBtn: document.getElementById('galleryBtn'),
    previewContainer: document.getElementById('previewContainer'),
    preview: document.getElementById('preview'),
    previewTag: document.getElementById('previewTag'),
    uploadTitle: document.getElementById('uploadTitle'),
    uploadSub: document.getElementById('uploadSub'),
    queueSection: document.getElementById('queueSection'),
    queueTray: document.getElementById('queueTray'),
    queueCount: document.getElementById('queueCount'),
    clearQueueBtn: document.getElementById('clearQueueBtn'),
    hardwarePreset: document.getElementById('hardwarePreset'),
    customConfigFields: document.getElementById('customConfigFields'),
    customMake: document.getElementById('customMake'),
    customModel: document.getElementById('customModel'),
    convertAllBtn: document.getElementById('convertAllBtn'),
    convertBtnText: document.getElementById('convertBtnText'),
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    downloadBtnText: document.getElementById('downloadBtnText'),
    specResolution: document.getElementById('specResolution'),
    specModel: document.getElementById('specModel'),
    status: document.getElementById('status')
  };

  // State Management
  const state = {
    queue: [], // Array of { id, file, sourceDataUrl, finalDataUrl, converted: bool }
    activeIndex: -1,
    isProcessing: false
  };

  function getActiveConfig() {
    const presetKey = DOM.hardwarePreset.value;
    if (presetKey === 'custom') {
      return {
        make: DOM.customMake.value.trim() || 'Meta AI',
        model: DOM.customModel.value.trim() || 'Smart Glasses',
        width: 3024,
        height: 4032,
        label: 'Custom'
      };
    }
    return HARDWARE_PRESETS[presetKey];
  }

  function syncSpecUI() {
    const config = getActiveConfig();
    DOM.specResolution.innerHTML = `${config.width} &times; ${config.height} px`;
    DOM.specModel.textContent = config.label;
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
  }

  function showStatus(message, type = 'success', isLoading = false) {
    if (!DOM.status) return;
    DOM.status.className = `status-banner ${type}`;
    DOM.status.style.display = 'flex';

    if (isLoading) {
      DOM.status.innerHTML = `<span class="ui-spinner" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`;
    } else {
      const icon = type === 'success'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
      DOM.status.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    }
  }

  function hideStatus() {
    if (DOM.status) {
      DOM.status.style.display = 'none';
      DOM.status.innerHTML = '';
    }
  }

  function renderQueue() {
    DOM.queueTray.innerHTML = '';
    state.queue.forEach((item, idx) => {
      const wrap = document.createElement('div');
      wrap.className = `queue-thumb-wrap ${idx === state.activeIndex ? 'active' : ''}`;
      wrap.role = 'listitem';
      wrap.innerHTML = `
        <img src="${item.finalDataUrl || item.sourceDataUrl}" class="queue-thumb" alt="${escapeHtml(item.file.name)}">
        <span class="queue-status-dot ${item.converted ? 'converted' : ''}"></span>
      `;
      wrap.addEventListener('click', () => setActiveItem(idx));
      DOM.queueTray.appendChild(wrap);
    });

    DOM.queueCount.textContent = state.queue.length;
    DOM.queueSection.style.display = state.queue.length > 0 ? 'flex' : 'none';
    DOM.convertAllBtn.disabled = state.queue.length === 0 || state.isProcessing;

    const hasAnyConverted = state.queue.some(i => i.converted);
    DOM.downloadBtn.disabled = !hasAnyConverted || state.isProcessing;
    DOM.downloadBtnText.textContent = state.queue.length > 1 ? 'Export All (ZIP)' : 'Export Image';

    const activeItem = state.queue[state.activeIndex];
    DOM.copyBtn.disabled = !activeItem || !activeItem.converted;
  }

  function setActiveItem(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.activeIndex = index;
    const item = state.queue[index];

    DOM.preview.src = item.finalDataUrl || item.sourceDataUrl;
    DOM.previewContainer.style.display = 'block';
    DOM.previewTag.textContent = item.converted ? 'Meta Verified' : 'Source Ready';

    renderQueue();
  }

  async function enqueueFiles(fileList) {
    const validFiles = Array.from(fileList).filter(f => f.type.match(/^image\/jpe?g$/i) || /\.jpe?g$/i.test(f.name));

    if (validFiles.length === 0) {
      showStatus('Invalid format. Please supply standard JPEG files.', 'error');
      return;
    }

    showStatus(`Ingesting ${validFiles.length} file(s)...`, 'loading', true);

    for (const file of validFiles) {
      const sourceDataUrl = await new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.readAsDataURL(file);
      });

      state.queue.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        sourceDataUrl,
        finalDataUrl: null,
        converted: false
      });
    }

    if (state.activeIndex === -1 || state.activeIndex >= state.queue.length) {
      setActiveItem(state.queue.length - validFiles.length);
    } else {
      renderQueue();
    }

    DOM.uploadTitle.textContent = `${state.queue.length} file(s) queued`;
    DOM.uploadSub.textContent = 'Ready for batch conversion';
    hideStatus();
  }

  function readOrientation(dataUrl) {
    if (typeof piexif === 'undefined') return 1;
    try {
      const exif = piexif.load(dataUrl);
      return exif['0th']?.[piexif.ImageIFD.Orientation] || 1;
    } catch {
      return 1;
    }
  }

  function drawCorrected(dataUrl, targetW, targetH, orientation) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { alpha: false });

        if (!ctx) {
          reject(new Error('Canvas init failure'));
          return;
        }

        const isSwapped = orientation >= 5 && orientation <= 8;
        const srcW = isSwapped ? img.height : img.width;
        const srcH = isSwapped ? img.width : img.height;

        const scale = Math.max(targetW / srcW, targetH / srcH);
        const drawW = img.width * scale;
        const drawH = img.height * scale;

        ctx.save();
        ctx.translate(targetW / 2, targetH / 2);

        switch (orientation) {
          case 2: ctx.scale(-1, 1); break;
          case 3: ctx.rotate(Math.PI); break;
          case 4: ctx.scale(1, -1); break;
          case 5: ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); break;
          case 6: ctx.rotate(0.5 * Math.PI); break;
          case 7: ctx.rotate(-0.5 * Math.PI); ctx.scale(1, -1); break;
          case 8: ctx.rotate(-0.5 * Math.PI); break;
          default: break;
        }

        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };

      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = dataUrl;
    });
  }

  function buildMetaExif(dataUrl, config) {
    let exif = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
    if (typeof piexif !== 'undefined') {
      try {
        exif = piexif.load(dataUrl);
      } catch {
        exif = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'thumbnail': null };
      }

      exif['GPS'] = {};
      if (exif['0th']) {
        delete exif['0th'][piexif.ImageIFD.Software];
        delete exif['0th'][piexif.ImageIFD.HostComputer];
      }
      if (exif['Exif']) {
        delete exif['Exif'][piexif.ExifIFD.MakerNote];
        delete exif['Exif'][piexif.ExifIFD.LensMake];
        delete exif['Exif'][piexif.ExifIFD.LensModel];
        delete exif['Exif'][piexif.ExifIFD.LensSpecification];
      }

      exif['0th'][piexif.ImageIFD.Make] = config.make;
      exif['0th'][piexif.ImageIFD.Model] = config.model;
      exif['0th'][piexif.ImageIFD.Orientation] = 1;
      exif['Exif'][piexif.ExifIFD.ColorSpace] = 1;
      exif['Exif'][piexif.ExifIFD.PixelXDimension] = config.width;
      exif['Exif'][piexif.ExifIFD.PixelYDimension] = config.height;
    }
    return exif;
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binaryStr = atob(parts[1]);
    const len = binaryStr.length;
    const u8arr = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      u8arr[i] = binaryStr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }

  async function convertSingleItem(item, config) {
    const orientation = readOrientation(item.sourceDataUrl);
    const canvasJpeg = await drawCorrected(item.sourceDataUrl, config.width, config.height, orientation);

    if (typeof piexif !== 'undefined') {
      const exif = buildMetaExif(item.sourceDataUrl, config);
      const exifBytes = piexif.dump(exif);
      item.finalDataUrl = piexif.insert(exifBytes, canvasJpeg);
    } else {
      item.finalDataUrl = canvasJpeg;
    }

    item.converted = true;
    return item.finalDataUrl;
  }

  function bindEvents() {
    DOM.hardwarePreset.addEventListener('change', () => {
      DOM.customConfigFields.style.display = DOM.hardwarePreset.value === 'custom' ? 'grid' : 'none';
      syncSpecUI();
    });

    [DOM.customMake, DOM.customModel].forEach(input => {
      input.addEventListener('input', syncSpecUI);
    });

    DOM.cameraBtn.addEventListener('click', () => DOM.cameraInput.click());
    DOM.galleryBtn.addEventListener('click', () => DOM.fileInput.click());
    DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());

    DOM.dropZone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        DOM.fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(n => {
      DOM.dropZone.addEventListener(n, e => {
        e.preventDefault();
        DOM.dropZone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach(n => {
      DOM.dropZone.addEventListener(n, e => {
        e.preventDefault();
        DOM.dropZone.classList.remove('drag-active');
      });
    });

    DOM.dropZone.addEventListener('drop', e => {
      if (e.dataTransfer?.files?.length) enqueueFiles(e.dataTransfer.files);
    });

    DOM.fileInput.addEventListener('change', e => {
      if (e.target.files?.length) enqueueFiles(e.target.files);
      e.target.value = '';
    });

    DOM.cameraInput.addEventListener('change', e => {
      if (e.target.files?.length) enqueueFiles(e.target.files);
      e.target.value = '';
    });

    DOM.clearQueueBtn.addEventListener('click', () => {
      state.queue = [];
      state.activeIndex = -1;
      DOM.previewContainer.style.display = 'none';
      DOM.uploadTitle.textContent = 'Select or drop raw images';
      DOM.uploadSub.textContent = 'JPG / JPEG format • Multi-file batch supported';
      renderQueue();
      hideStatus();
    });

    DOM.convertAllBtn.addEventListener('click', async () => {
      if (state.queue.length === 0 || state.isProcessing) return;

      state.isProcessing = true;
      DOM.convertAllBtn.disabled = true;
      const config = getActiveConfig();

      showStatus(`Converting batch of ${state.queue.length} photo(s)...`, 'loading', true);

      try {
        for (let i = 0; i < state.queue.length; i++) {
          await convertSingleItem(state.queue[i], config);
          renderQueue();
        }

        setActiveItem(state.activeIndex);
        showStatus(`All ${state.queue.length} photos stamped with ${config.label}!`, 'success');
      } catch (err) {
        console.error(err);
        showStatus('Batch conversion encountered an error.', 'error');
      } finally {
        state.isProcessing = false;
        DOM.convertAllBtn.disabled = false;
        renderQueue();
      }
    });

    DOM.copyBtn.addEventListener('click', async () => {
      const activeItem = state.queue[state.activeIndex];
      if (!activeItem || !activeItem.finalDataUrl) return;

      const base64 = activeItem.finalDataUrl.split(',')[1] || '';
      try {
        await navigator.clipboard.writeText(base64);
        showStatus('Base64 payload copied to clipboard!', 'success');
      } catch {
        showStatus('Clipboard permission was denied.', 'error');
      }
    });

    DOM.downloadBtn.addEventListener('click', async () => {
      const convertedItems = state.queue.filter(i => i.converted);
      if (convertedItems.length === 0) return;

      // Single file export
      if (convertedItems.length === 1) {
        const item = convertedItems[0];
        const outName = item.file.name.replace(/\.[^/.]+$/, '') + '-meta.jpg';
        const blob = dataUrlToBlob(item.finalDataUrl);
        const file = new File([blob], outName, { type: 'image/jpeg' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Meta Glass Photo' });
            return;
          } catch (e) {
            if (e.name === 'AbortError') return;
          }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = outName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return;
      }

      // Batch ZIP export
      if (typeof JSZip === 'undefined') {
        showStatus('Archive library unavailable for batch zip.', 'error');
        return;
      }

      showStatus('Bundling ZIP package...', 'loading', true);
      const zip = new JSZip();

      convertedItems.forEach((item, idx) => {
        const base64Data = item.finalDataUrl.split(',')[1];
        const cleanName = item.file.name.replace(/\.[^/.]+$/, '');
        zip.file(`${cleanName}-meta-${idx + 1}.jpg`, base64Data, { base64: true });
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `meta-batch-${Date.now()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(zipUrl), 4000);

      showStatus(`Exported ${convertedItems.length} photos as ZIP archive!`, 'success');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    syncSpecUI();
    bindEvents();
  });
})();