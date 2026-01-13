(async ()=>{
  const video = document.getElementById('video');
  const startBtn = document.getElementById('startBtn');
  // shotCountBtn 제거: 이제 startBtn의 텍스트를 직접 변경
  const countdownEl = document.getElementById('countdown');
  const canvas = document.getElementById('canvas');
  const photo = document.getElementById('photo');
  const btn4cut = document.getElementById('btn4cut');
  const landing = document.getElementById('landing');
  const captureUI = document.getElementById('captureUI');
  const landingLogo = document.getElementById('landingLogo');
  const landingText = document.getElementById('landingText');
  const rollsEl = document.getElementById('rolls');
  // onecut removed: keep 4cut only

  // initial UI state: hide videos and rolls on main
  if(video) video.style.display = 'none';
  if(rollsEl) rollsEl.style.display = 'none';

  // if this page load is a reload, ensure we show the landing (main) UI
  try{
    const nav = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
    const reloaded = (nav && nav.type === 'reload') || (performance && performance.navigation && performance.navigation.type === 1);
    if(reloaded){
      showLanding();
    }
  }catch(e){ /* ignore */ }

  // try to load a logo at assets/logo.png; if it exists, show it and hide the text
  try{
    if(landingLogo){
      landingLogo.onerror = ()=>{
        landingLogo.style.display = 'none';
        if(landingText) landingText.style.display = 'block';
      };
      landingLogo.onload = ()=>{
        landingLogo.style.display = 'block';
        if(landingText) landingText.style.display = 'none';
      };
      // If image is already loaded (from cache), trigger onload manually
      if(landingLogo.complete && landingLogo.naturalWidth > 0){
        landingLogo.onload();
      }
    }
  }catch(e){/* ignore */}

  let stream;
  let currentMode = null; // set on 4cut entry

  async function ensureCamera(){
    if(stream) return;
    try{
      // request higher resolution when possible for better final output
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      if(video) try{ video.srcObject = stream; await video.play(); }catch(e){}
    }catch(e){
      throw e;
    }
  }

  // show capture UI and hide landing
  function showCaptureUI(){
    if(landing) landing.style.display = 'none';
    if(captureUI) captureUI.style.display = 'flex';
  }

  // show landing (main) and hide capture UI + previews
  function showLanding(){
    if(landing) landing.style.display = 'flex';
    if(captureUI) captureUI.style.display = 'none';
    if(rollsEl) rollsEl.style.display = 'none';
    if(video) video.style.display = 'none';
  }

  // capture a mirrored frame from the live video and return an Image
  function captureFrameMirrored(){
  return new Promise((resolve)=>{
    const TARGET_W = 640;
    const TARGET_H = 480;

    const srcW = video.videoWidth;
    const srcH = video.videoHeight;

    // 원본 비율 유지한 채, 4:3 영역 계산
    const targetRatio = TARGET_W / TARGET_H;
    const srcRatio = srcW / srcH;

    let cropW, cropH, cropX, cropY;

    if (srcRatio > targetRatio) {
      // 원본이 더 넓음 → 좌우 자르기
      cropH = srcH;
      cropW = srcH * targetRatio;
      cropX = (srcW - cropW) / 2;
      cropY = 0;
    } else {
      // 원본이 더 높음 → 위아래 자르기
      cropW = srcW;
      cropH = srcW / targetRatio;
      cropX = 0;
      cropY = (srcH - cropH) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');

    // 좌우 반전 + 크롭
    ctx.save();
    ctx.translate(TARGET_W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      cropX, cropY, cropW, cropH,
      0, 0, TARGET_W, TARGET_H
    );
    ctx.restore();

    const img = new Image();
    img.onload = ()=> resolve(img);
    img.src = canvas.toDataURL('image/png');
  });
}


  // draw background 'cover' into given ctx at (0,0,w,h)
  function drawBgCoverInto(ctx, bg, w, h){
    const bw = bg.width;
    const bh = bg.height;
    const scaleBg = Math.max(w / bw, h / bh);
    const drawBgW = Math.round(bw * scaleBg);
    const drawBgH = Math.round(bh * scaleBg);
    const bgDx = Math.round((w - drawBgW) / 2);
    const bgDy = Math.round((h - drawBgH) / 2);
    ctx.drawImage(bg, bgDx, bgDy, drawBgW, drawBgH);
  }

  // capture 4 frames sequentially (top->bottom), composite them into single JPEG and download
  async function captureFourAndCombine(){
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    // load background list and pick a random one containing '배경화면'
    let bgName = '배경화면 1.jpg';
    try{
      const resp = await fetch('assets/bg-list.json');
      if(resp.ok){
        const list = await resp.json();
        const candidates = (Array.isArray(list) ? list : []).filter(n=>/배경화면/i.test(n) && /\.jpe?g$/i.test(n));
        if(candidates.length) bgName = candidates[Math.floor(Math.random()*candidates.length)];
      }
    }catch(e){
      console.warn('bg-list.json load failed, falling back to default', e);
    }
    // preload chosen background
    const bg = new Image();
    bg.src = encodeURI('assets/' + bgName);
    await new Promise((res,rej)=>{ bg.onload = res; bg.onerror = ()=>res(); });

    const rollEls = [
      document.getElementById('roll1'),
      document.getElementById('roll2'),
      document.getElementById('roll3'),
      document.getElementById('roll4')
    ];
    // Hide all roll previews before starting
    rollEls.forEach(el => { if(el) { el.style.display = 'none'; el.src = ''; }});

    // combine into single canvas using the single background image
    // enforce fixed background size regardless of source image
    // render at higher resolution (scale factor) to improve text/font quality
    const SCALE = 2; // increase to 3 for even higher DPI if needed
    const FIXED_BG_W = 498 * SCALE;
    const FIXED_BG_H = 1201 * SCALE;
    const finalW = FIXED_BG_W;
    const finalH = FIXED_BG_H;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalW;
    finalCanvas.height = finalH;
    const fctx = finalCanvas.getContext('2d');

    // draw background to fill canvas (cover)
    drawBgCoverInto(fctx, bg, finalW, finalH);

    // layout for stacked rolls on top of the single background
    const topMargin = Math.round(finalH * 0.06);
    const bottomMargin = Math.round(finalH * 0.04);
    // slightly larger gap than before
    const gap = Math.max(4, Math.round(finalH * 0.015));
    const availableHeight = finalH - topMargin - bottomMargin - gap * 3;
    const perSlotH = Math.floor(availableHeight / 4);

    // compute side inset equal to bottomMargin and use inner width for frames
    const sideInset = bottomMargin;
    const innerW = Math.max(40, finalW - sideInset * 2);
    // target overlay width relative to inner width (increased for larger photos)
    const overlayMaxW = Math.round(innerW * 0.78);

    const title = "Lavv's photo studio";
    let titleDrawn = false;

    const capturedRolls = [];
    // startBtn 텍스트를 0/4로 변경
    if(startBtn) {
      startBtn.textContent = `0/4`;
    }
    // now capture sequentially and draw each directly onto final canvas
    for(let i=0;i<4;i++){
      if(startBtn) startBtn.textContent = `${i+1}/4`;
      // per-shot countdown before capturing
      await initialCountdown(3);
      const frame = await captureFrameMirrored();
      // update individual roll preview to show captured frame
      if(rollEls[i]) {
        rollEls[i].src = frame.src;
        rollEls[i].style.display = 'inline-block';
      }
      // determine draw size preserving aspect ratio and fitting in perSlotH and overlayMaxW
      let drawW = overlayMaxW;
      let drawH = Math.round(drawW * (frame.height / frame.width));
      if(drawH > perSlotH){
        drawH = perSlotH;
        drawW = Math.round(drawH * (frame.width / frame.height));
      }

      const x = Math.round(sideInset + (innerW - drawW) / 2);
      const ySlotTop = topMargin + i * (perSlotH + gap);
      const y = ySlotTop + Math.round((perSlotH - drawH) / 2);

      // draw frame with a subtle border onto final canvas
      fctx.save();
      fctx.fillStyle = 'rgba(255,255,255,0.9)';
      fctx.fillRect(x-4, y-4, drawW+8, drawH+8);
      fctx.drawImage(frame, x, y, drawW, drawH);
      fctx.restore();

      // store captured frame but do not show it in the page
      capturedRolls[i] = frame.src;
      // draw title only once above the first photo inside the topMargin
      if(!titleDrawn){
        let fontSize = Math.round(topMargin * 0.6);
        // scale font appropriately for high-res canvas
        fctx.font = `${fontSize}px 'Cafe24SurroundAir', sans-serif`;
        fctx.textBaseline = 'middle';
        let measure = fctx.measureText(title).width;
        while(measure > drawW && fontSize > 8){
          fontSize -= 1;
          fctx.font = `${fontSize}px 'Cafe24SurroundAir', sans-serif`;
          measure = fctx.measureText(title).width;
        }
        const textX = Math.round(sideInset + (innerW - measure) / 2);
        const textY = Math.round(topMargin / 2);
        fctx.lineWidth = Math.max(2, Math.round(fontSize / 10));
        fctx.strokeStyle = 'rgba(0,0,0,0.6)';
        fctx.fillStyle = 'white';
        // draw immediately so preview shows title as well
        fctx.strokeText(title, textX, textY);
        fctx.fillText(title, textX, textY);
        titleDrawn = true;
      }

      // update combined preview after each shot
      const combinedEl = document.getElementById('combined');
      if(combinedEl) combinedEl.src = finalCanvas.toDataURL('image/png');

      // short pause between shots
      await new Promise(r=>setTimeout(r,250));
    }

    if(startBtn) startBtn.textContent = '시작 (4장 연속 촬영)';
    // prepare data for save page: final combined + individual rolls
    // export as PNG (lossless) to preserve crisp text and font rendering
    const dataUrl = finalCanvas.toDataURL('image/png');
    const combinedEl2 = document.getElementById('combined');
    if(combinedEl2) combinedEl2.src = dataUrl;
    // try storing captures in sessionStorage; if quota exceeded, fall back to smaller/compressed payloads
    const payload = { final: dataUrl, rolls: capturedRolls };
    try{
      sessionStorage.setItem('vibe_captures', JSON.stringify(payload));
      window.location.href = 'save.html';
      return;
    }catch(e){
      console.warn('sessionStorage full or storing failed, attempting compressed fallback', e);
    }
    // fallback: store a compressed JPG final, but keep rolls if possible
    try{
      const compressedFinal = finalCanvas.toDataURL('image/jpeg', 0.8);
      const fallbackPayload = { final: compressedFinal, rolls: capturedRolls };
      sessionStorage.setItem('vibe_captures', JSON.stringify(fallbackPayload));
      window.location.href = 'save.html';
      return;
    }catch(e2){
      console.warn('compressed fallback failed, trying window.name fallback', e2);
    }
    // last resort: use window.name to pass data across navigation (less size-constrained in practice)
    try{
      window.name = JSON.stringify({ final: dataUrl, rolls: capturedRolls });
      window.location.href = 'save.html';
      return;
    }catch(e3){
      console.error('all fallbacks failed while saving captures', e3);
      alert('사진 저장에 실패했습니다. 콘솔을 확인하세요.');
    }
  }
  // initial countdown before starting capture
  async function initialCountdown(seconds){
    let count = seconds;
    if(countdownEl) countdownEl.textContent = count;
    while(count>0){
      await new Promise(r=>setTimeout(r,1000));
      count--;
      if(countdownEl) countdownEl.textContent = count>0?count:'';
    }
    // clear shortly after
    await new Promise(r=>setTimeout(r,250));
    if(countdownEl) countdownEl.textContent = '';
  }

  startBtn.addEventListener('click', async ()=>{
    if(!currentMode) return;
    startBtn.disabled = true;
    try{ await ensureCamera(); }catch(e){ alert('카메라 권한을 허용해야 촬영할 수 있습니다. 콘솔을 확인하세요.'); console.error(e); startBtn.disabled=false; return; }

    try{
        await captureFourAndCombine();
    }catch(e){ console.error('capture sequence failed', e); alert('촬영 중 오류가 발생했습니다. 콘솔을 확인하세요.'); }
    startBtn.disabled = false;
    // reset mode after
  });

  // wire landing buttons
  if(btn4cut){
    btn4cut.addEventListener('click', async ()=>{
      showCaptureUI();
      if(rollsEl) rollsEl.style.display = 'flex';
      if(video) video.style.display = 'block';
      currentMode = '4';
      startBtn.style.display = 'inline-block';
      startBtn.disabled = false;
      try{ await ensureCamera(); }catch(e){ alert('카메라 권한 필요'); return; }
    });
  }
  function adjustCaptureUIScale(){
  const ui = document.getElementById('captureUI');
  if(!ui) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // 기준 크기 (촬영 UI가 가장 잘 보이는 사이즈)
  const BASE_W = 390; // 모바일 세로 기준
  const BASE_H = 780;

  const scale = Math.min(vw / BASE_W, vh / BASE_H, 1);

  ui.style.transform = `scale(${scale})`;
  ui.style.transformOrigin = 'center center';
}

// 최초 실행
adjustCaptureUIScale();

// 화면 회전 / 리사이즈 대응
window.addEventListener('resize', adjustCaptureUIScale);
window.addEventListener('orientationchange', adjustCaptureUIScale);


  // 1cut capture logic (identical to 4cut, but for 1 image)

})();
