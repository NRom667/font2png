(() => {
  "use strict";

  const MAX_CHARS = 2000;
  const state = {
    fontFamily: "",
    fontFileName: "",
    fontStatus: "未読み込み",
    busy: false,
    previewTimer: null,
  };

  const el = {
    dropZone: document.getElementById("drop-zone"),
    fileInput: document.getElementById("font-file"),
    fontStatus: document.getElementById("font-status"),
    fontFilename: document.getElementById("font-filename"),
    textInput: document.getElementById("text-input"),
    charCount: document.getElementById("char-count"),
    colorModeRadios: document.querySelectorAll('input[name="color-mode"]'),
    gradDirectionRadios: document.querySelectorAll('input[name="grad-direction"]'),
    solidOptions: document.getElementById("solid-options"),
    gradientOptions: document.getElementById("gradient-options"),
    solidColor: document.getElementById("solid-color"),
    solidAlpha: document.getElementById("solid-alpha"),
    solidAlphaRange: document.getElementById("solid-alpha-range"),
    gradColor1: document.getElementById("grad-color-1"),
    gradAlpha1: document.getElementById("grad-alpha-1"),
    gradAlpha1Range: document.getElementById("grad-alpha-1-range"),
    gradColor2: document.getElementById("grad-color-2"),
    gradAlpha2: document.getElementById("grad-alpha-2"),
    gradAlpha2Range: document.getElementById("grad-alpha-2-range"),
    fontSize: document.getElementById("font-size"),
    fontSizeRange: document.getElementById("font-size-range"),
    lineHeight: document.getElementById("line-height"),
    lineHeightRange: document.getElementById("line-height-range"),
    padding: document.getElementById("padding"),
    paddingRange: document.getElementById("padding-range"),
    outlineEnabled: document.getElementById("outline-enabled"),
    outlineWidth: document.getElementById("outline-width"),
    outlineWidthRange: document.getElementById("outline-width-range"),
    outlineColor: document.getElementById("outline-color"),
    outlineAlpha: document.getElementById("outline-alpha"),
    outlineAlphaRange: document.getElementById("outline-alpha-range"),
    shadowEnabled: document.getElementById("shadow-enabled"),
    shadowColor: document.getElementById("shadow-color"),
    shadowAlpha: document.getElementById("shadow-alpha"),
    shadowAlphaRange: document.getElementById("shadow-alpha-range"),
    shadowBlur: document.getElementById("shadow-blur"),
    shadowBlurRange: document.getElementById("shadow-blur-range"),
    shadowOffsetX: document.getElementById("shadow-offset-x"),
    shadowOffsetXRange: document.getElementById("shadow-offset-x-range"),
    shadowOffsetY: document.getElementById("shadow-offset-y"),
    shadowOffsetYRange: document.getElementById("shadow-offset-y-range"),
    previewBtn: document.getElementById("preview-btn"),
    downloadBtn: document.getElementById("download-btn"),
    previewCanvas: document.getElementById("preview-canvas"),
    statusMessage: document.getElementById("status-message"),
  };

  const allowedExt = new Set([".ttf", ".otf", ".woff", ".woff2"]);

  function setStatus(message, isError = false) {
    el.statusMessage.textContent = message;
    el.statusMessage.classList.toggle("error", Boolean(isError));
  }

  function setBusy(busy, message = "") {
    state.busy = busy;
    el.previewBtn.disabled = busy;
    el.downloadBtn.disabled = busy;
    if (message) {
      setStatus(message, false);
    }
  }

  function clampNumber(inputEl, min, max, fallback, label, warnings, integer = false) {
    const raw = Number.parseFloat(inputEl.value);
    let value = Number.isFinite(raw) ? raw : fallback;
    const original = value;
    value = Math.min(max, Math.max(min, value));
    if (integer) {
      value = Math.round(value);
    }
    if (value !== original) {
      warnings.push(`${label}を範囲内に補正しました。`);
    }
    inputEl.value = String(value);
    return value;
  }

  function hexToRgba(hex, alphaPercent) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if (!m) {
      return `rgba(0, 0, 0, ${alphaPercent / 100})`;
    }
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    const a = Math.min(100, Math.max(0, alphaPercent)) / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function getExtension(filename) {
    const idx = filename.lastIndexOf(".");
    return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
  }

  async function loadFont(file) {
    if (!file) {
      return;
    }

    const ext = getExtension(file.name);
    if (!allowedExt.has(ext)) {
      state.fontStatus = "失敗";
      el.fontStatus.textContent = "失敗（非対応拡張子）";
      setStatus("非対応拡張子です。.ttf/.otf/.woff/.woff2 を選択してください。", true);
      return;
    }

    setBusy(true, "フォントを読み込み中...");
    try {
      const buffer = await file.arrayBuffer();
      const family = `UploadedFont_${Date.now()}`;
      const fontFace = new FontFace(family, buffer);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
      await document.fonts.load(`16px "${family}"`);

      state.fontFamily = family;
      state.fontFileName = file.name;
      state.fontStatus = "成功";
      el.fontStatus.textContent = "成功";
      el.fontFilename.textContent = file.name;
      setStatus("フォントを読み込みました。", false);
      schedulePreview();
    } catch (error) {
      state.fontStatus = "失敗";
      el.fontStatus.textContent = "失敗";
      setStatus(`フォント読み込みに失敗しました: ${error.message || "不明なエラー"}`, true);
    } finally {
      setBusy(false);
    }
  }

  function collectOptions() {
    const warnings = [];

    const colorMode =
      document.querySelector('input[name="color-mode"]:checked')?.value || "solid";
    const solidAlpha = clampNumber(el.solidAlpha, 0, 100, 100, "単色透明度", warnings, true);
    el.solidAlphaRange.value = String(solidAlpha);
    const gradAlpha1 = clampNumber(el.gradAlpha1, 0, 100, 100, "グラデーション色1透明度", warnings, true);
    el.gradAlpha1Range.value = String(gradAlpha1);
    const gradAlpha2 = clampNumber(el.gradAlpha2, 0, 100, 100, "グラデーション色2透明度", warnings, true);
    el.gradAlpha2Range.value = String(gradAlpha2);

    const fontSize = clampNumber(el.fontSize, 8, 512, 128, "フォントサイズ", warnings, true);
    el.fontSizeRange.value = String(fontSize);
    const lineHeight = clampNumber(el.lineHeight, 0.8, 3, 1.2, "行間倍率", warnings, false);
    el.lineHeightRange.value = String(lineHeight);
    const padding = clampNumber(el.padding, 0, 200, 10, "余白", warnings, true);
    el.paddingRange.value = String(padding);

    const outlineEnabled = el.outlineEnabled.checked;
    const outlineWidth = clampNumber(el.outlineWidth, 0, 50, 0, "縁取り太さ", warnings, true);
    el.outlineWidthRange.value = String(outlineWidth);
    const outlineAlpha = clampNumber(el.outlineAlpha, 0, 100, 100, "縁取り透明度", warnings, true);
    el.outlineAlphaRange.value = String(outlineAlpha);

    const shadowEnabled = el.shadowEnabled.checked;
    const shadowAlpha = clampNumber(el.shadowAlpha, 0, 100, 45, "影の濃さ", warnings, true);
    el.shadowAlphaRange.value = String(shadowAlpha);
    const shadowBlur = clampNumber(el.shadowBlur, 0, 100, 12, "影のぼかし", warnings, true);
    el.shadowBlurRange.value = String(shadowBlur);
    const shadowOffsetX = clampNumber(el.shadowOffsetX, -200, 200, 0, "影Xずらし", warnings, true);
    el.shadowOffsetXRange.value = String(shadowOffsetX);
    const shadowOffsetY = clampNumber(el.shadowOffsetY, -200, 200, 0, "影Yずらし", warnings, true);
    el.shadowOffsetYRange.value = String(shadowOffsetY);

    return {
      warnings,
      colorMode,
      solidColor: el.solidColor.value,
      solidAlpha,
      gradColor1: el.gradColor1.value,
      gradAlpha1,
      gradColor2: el.gradColor2.value,
      gradAlpha2,
      gradDirection:
        document.querySelector('input[name="grad-direction"]:checked')?.value || "top-bottom",
      fontSize,
      lineHeight,
      padding,
      outlineEnabled,
      outlineWidth,
      outlineColor: el.outlineColor.value,
      outlineAlpha,
      shadowEnabled,
      shadowColor: el.shadowColor.value,
      shadowAlpha,
      shadowBlur,
      shadowOffsetX,
      shadowOffsetY,
    };
  }

  function getTextLines(text) {
    return text.replace(/\r\n/g, "\n").split("\n");
  }

  function computeLayout(ctx, lines, options) {
    ctx.font = `${options.fontSize}px "${state.fontFamily}", sans-serif`;
    const lineAdvance = options.fontSize * options.lineHeight;

    let maxLeft = 0;
    let maxRight = 1;
    let maxAscent = options.fontSize * 0.82;
    let maxDescent = options.fontSize * 0.2;

    for (const line of lines) {
      const probe = line.length > 0 ? line : " ";
      const m = ctx.measureText(probe);
      const left = Math.ceil(m.actualBoundingBoxLeft || 0);
      const right = Math.ceil(m.actualBoundingBoxRight || m.width || options.fontSize * 0.5);
      const ascent = Math.ceil(m.actualBoundingBoxAscent || options.fontSize * 0.82);
      const descent = Math.ceil(m.actualBoundingBoxDescent || options.fontSize * 0.2);

      maxLeft = Math.max(maxLeft, left);
      maxRight = Math.max(maxRight, right);
      maxAscent = Math.max(maxAscent, ascent);
      maxDescent = Math.max(maxDescent, descent);
    }

    const textWidth = Math.max(1, maxLeft + maxRight);
    const textHeight = Math.max(1, maxAscent + maxDescent + lineAdvance * Math.max(lines.length - 1, 0));

    const outlineExtent = options.outlineEnabled ? options.outlineWidth : 0;
    const shadowExtent = options.shadowEnabled
      ? Math.ceil(options.shadowBlur + Math.max(Math.abs(options.shadowOffsetX), Math.abs(options.shadowOffsetY)))
      : 0;
    const extra = outlineExtent + shadowExtent + 8;

    return {
      lineAdvance,
      maxLeft,
      maxAscent,
      textWidth,
      textHeight,
      canvasWidth: Math.max(1, Math.ceil(textWidth + extra * 2)),
      canvasHeight: Math.max(1, Math.ceil(textHeight + extra * 2)),
      originX: extra + maxLeft,
      originY: extra + maxAscent,
      drawLeft: extra,
      drawTop: extra,
      drawRight: extra + textWidth,
      drawBottom: extra + textHeight,
    };
  }

  function createFillStyle(ctx, options, layout) {
    if (options.colorMode === "solid") {
      return hexToRgba(options.solidColor, options.solidAlpha);
    }

    let x0 = layout.drawLeft;
    let y0 = layout.drawTop;
    let x1 = layout.drawLeft;
    let y1 = layout.drawBottom;

    if (options.gradDirection === "bottom-top") {
      y0 = layout.drawBottom;
      y1 = layout.drawTop;
    } else if (options.gradDirection === "left-right") {
      x0 = layout.drawLeft;
      y0 = layout.drawTop;
      x1 = layout.drawRight;
      y1 = layout.drawTop;
    } else if (options.gradDirection === "right-left") {
      x0 = layout.drawRight;
      y0 = layout.drawTop;
      x1 = layout.drawLeft;
      y1 = layout.drawTop;
    }

    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, hexToRgba(options.gradColor1, options.gradAlpha1));
    grad.addColorStop(1, hexToRgba(options.gradColor2, options.gradAlpha2));
    return grad;
  }

  function drawTextToCanvas(text, options) {
    const lines = getTextLines(text);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Canvasコンテキストを取得できません。");
    }

    const layout = computeLayout(ctx, lines, options);
    canvas.width = layout.canvasWidth;
    canvas.height = layout.canvasHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${options.fontSize}px "${state.fontFamily}", sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    if (options.shadowEnabled) {
      ctx.shadowColor = hexToRgba(options.shadowColor, options.shadowAlpha);
      ctx.shadowBlur = options.shadowBlur;
      ctx.shadowOffsetX = options.shadowOffsetX;
      ctx.shadowOffsetY = options.shadowOffsetY;
    } else {
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    const fillStyle = createFillStyle(ctx, options, layout);

    if (options.outlineEnabled && options.outlineWidth > 0) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = options.outlineWidth;
      ctx.strokeStyle = hexToRgba(options.outlineColor, options.outlineAlpha);
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const y = layout.originY + i * layout.lineAdvance;
      if (options.outlineEnabled && options.outlineWidth > 0) {
        ctx.strokeText(line, layout.originX, y);
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(line, layout.originX, y);
    }

    return trimTransparent(canvas, options.padding);
  }

  function trimTransparent(sourceCanvas, extraPad) {
    const srcCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!srcCtx) {
      return sourceCanvas;
    }

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const data = srcCtx.getImageData(0, 0, width, height).data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const a = data[(y * width + x) * 4 + 3];
        if (a > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return sourceCanvas;
    }

    const trimmedW = maxX - minX + 1;
    const trimmedH = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = Math.max(1, trimmedW + extraPad * 2);
    out.height = Math.max(1, trimmedH + extraPad * 2);

    const outCtx = out.getContext("2d");
    if (!outCtx) {
      return sourceCanvas;
    }

    outCtx.clearRect(0, 0, out.width, out.height);
    outCtx.drawImage(sourceCanvas, minX, minY, trimmedW, trimmedH, extraPad, extraPad, trimmedW, trimmedH);
    return out;
  }

  async function renderPreview() {
    if (state.busy) {
      return null;
    }

    if (!state.fontFamily) {
      setStatus("フォントを読み込んでください。", true);
      return null;
    }

    const text = el.textInput.value;
    if (!text.trim()) {
      setStatus("文字を入力してください。", true);
      return null;
    }

    const options = collectOptions();
    if (options.warnings.length > 0) {
      setStatus(options.warnings.join(" "), false);
    } else {
      setStatus("プレビューを更新しました。", false);
    }

    setBusy(true, "描画中...");
    try {
      const outCanvas = drawTextToCanvas(text, options);
      const previewCtx = el.previewCanvas.getContext("2d");
      if (!previewCtx) {
        throw new Error("プレビュー描画に失敗しました。");
      }
      el.previewCanvas.width = outCanvas.width;
      el.previewCanvas.height = outCanvas.height;
      previewCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
      previewCtx.drawImage(outCanvas, 0, 0);
      setStatus("プレビューを更新しました。", false);
      return outCanvas;
    } catch (error) {
      setStatus(`描画に失敗しました: ${error.message || "不明なエラー"}`, true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function formatTimestamp(date) {
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
  }

  async function downloadPng() {
    const outCanvas = await renderPreview();
    if (!outCanvas) {
      return;
    }

    setBusy(true, "PNGを生成中...");
    try {
      const blob = await new Promise((resolve, reject) => {
        outCanvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("PNG化に失敗しました。"));
          }
        }, "image/png");
      });

      const filename = `text_${formatTimestamp(new Date())}.png`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`ダウンロードしました: ${filename}`, false);
    } catch (error) {
      setStatus(`ダウンロードに失敗しました: ${error.message || "不明なエラー"}`, true);
    } finally {
      setBusy(false);
    }
  }

  function schedulePreview() {
    clearTimeout(state.previewTimer);
    state.previewTimer = window.setTimeout(() => {
      if (!state.fontFamily) {
        return;
      }
      if (!el.textInput.value.trim()) {
        return;
      }
      renderPreview();
    }, 160);
  }

  function syncColorMode() {
    const gradient =
      (document.querySelector('input[name="color-mode"]:checked')?.value || "solid") === "gradient";
    el.gradientOptions.classList.toggle("hidden", !gradient);
    el.solidOptions.classList.toggle("hidden", gradient);
    schedulePreview();
  }

  async function handleFileList(files) {
    if (!files || files.length === 0) {
      return;
    }
    const [file] = files;
    el.fontFilename.textContent = file.name;
    await loadFont(file);
  }

  function onDragOver(event) {
    event.preventDefault();
    el.dropZone.classList.add("dragover");
  }

  function onDragLeave(event) {
    event.preventDefault();
    el.dropZone.classList.remove("dragover");
  }

  async function onDrop(event) {
    event.preventDefault();
    el.dropZone.classList.remove("dragover");
    await handleFileList(event.dataTransfer.files);
  }

  function bindEvents() {
    el.fileInput.addEventListener("change", async (event) => {
      await handleFileList(event.target.files);
    });

    el.dropZone.addEventListener("dragover", onDragOver);
    el.dropZone.addEventListener("dragleave", onDragLeave);
    el.dropZone.addEventListener("drop", onDrop);

    el.textInput.addEventListener("input", () => {
      const len = el.textInput.value.length;
      el.charCount.textContent = String(len);
      if (len > MAX_CHARS) {
        setStatus("文字数が上限を超えています。", true);
      } else {
        schedulePreview();
      }
    });

    el.colorModeRadios.forEach((radio) => {
      radio.addEventListener("change", syncColorMode);
    });
    el.gradDirectionRadios.forEach((radio) => {
      radio.addEventListener("change", schedulePreview);
    });

    function bindPair(numberEl, rangeEl) {
      rangeEl.addEventListener("input", () => {
        numberEl.value = rangeEl.value;
        schedulePreview();
      });
      numberEl.addEventListener("input", () => {
        rangeEl.value = numberEl.value;
        schedulePreview();
      });
    }

    bindPair(el.fontSize, el.fontSizeRange);
    bindPair(el.lineHeight, el.lineHeightRange);
    bindPair(el.padding, el.paddingRange);
    bindPair(el.outlineWidth, el.outlineWidthRange);
    bindPair(el.solidAlpha, el.solidAlphaRange);
    bindPair(el.gradAlpha1, el.gradAlpha1Range);
    bindPair(el.gradAlpha2, el.gradAlpha2Range);
    bindPair(el.outlineAlpha, el.outlineAlphaRange);
    bindPair(el.shadowAlpha, el.shadowAlphaRange);
    bindPair(el.shadowBlur, el.shadowBlurRange);
    bindPair(el.shadowOffsetX, el.shadowOffsetXRange);
    bindPair(el.shadowOffsetY, el.shadowOffsetYRange);

    const previewInputs = [
      el.solidColor,
      el.gradColor1,
      el.gradColor2,
      el.outlineEnabled,
      el.outlineColor,
      el.shadowEnabled,
      el.shadowColor,
    ];

    previewInputs.forEach((input) => {
      input.addEventListener("input", schedulePreview);
      input.addEventListener("change", schedulePreview);
    });

    el.previewBtn.addEventListener("click", () => {
      renderPreview();
    });

    el.downloadBtn.addEventListener("click", () => {
      downloadPng();
    });
  }

  function init() {
    bindEvents();
    syncColorMode();
    el.charCount.textContent = "0";
    setStatus("フォントを読み込み、文字を入力してください。", false);
  }

  init();
})();
