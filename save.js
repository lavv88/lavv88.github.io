(() => {
  // if this page was reached by a browser reload, send user back to main
  try{
    const nav = (performance && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
    const reloaded = (nav && nav.type === 'reload') || (performance && performance.navigation && performance.navigation.type === 1);
    if(reloaded){
      window.location.href = 'index.html';
      return;
    }
  }catch(e){ /* ignore if unavailable */ }
  const KEY = 'vibe_captures';
  let raw = sessionStorage.getItem(KEY);
  // window.name fallback: if sessionStorage is empty, try window.name
  if(!raw && window.name && window.name.startsWith('{')){
    raw = window.name;
    // clear window.name after use
    window.name = '';
  }
  const finalImg = document.getElementById('finalImg');
  const thumbs = document.getElementById('thumbs');
  const downloadFinalBtn = document.getElementById('downloadFinal');
  const retakeBtn = document.getElementById('retake');
  const goMainBtn = document.getElementById('goMain');

  if(!raw){
    document.body.innerHTML = '<div style="padding:24px;font-family:system-ui;">저장할 사진이 없습니다. <a href="index.html">다시 촬영하러 가기</a></div>';
    return;
  }

  let data;
  try{ data = JSON.parse(raw); }catch(e){ data = null; }
  if(!data){
    document.body.innerHTML = '<div style="padding:24px;font-family:system-ui;">데이터를 불러올 수 없습니다. <a href="index.html">다시 촬영하러 가기</a></div>';
    return;
  }

  finalImg.src = data.final || '';

  function makeDownload(name, dataUrl){
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadFinalBtn.addEventListener('click', ()=>{
    if(data.final) makeDownload(`final-${new Date().toISOString().replace(/[:.]/g,'-')}.jpg`, data.final);
  });

  retakeBtn.addEventListener('click', ()=>{
    // clear stored captures and return
    sessionStorage.removeItem(KEY);
    window.location.href = 'index.html';
  });

  if(goMainBtn){
    goMainBtn.addEventListener('click', ()=>{
      // navigate to main landing without clearing captures (user may want them preserved)
      window.location.href = 'index.html';
    });
  }

  // render individual thumbnails with save buttons
  (data.rolls || []).forEach((r, idx) => {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '8px';

    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = r || '';
    img.alt = `photo-${idx+1}`;

    const btn = document.createElement('button');
    btn.textContent = `${idx+1}번 저장`;
    btn.addEventListener('click', ()=>{
      if(r) makeDownload(`photo-${idx+1}-${new Date().toISOString().replace(/[:.]/g,'-')}.png`, r);
    });

    container.appendChild(img);
    container.appendChild(btn);
    thumbs.appendChild(container);
  });

})();
