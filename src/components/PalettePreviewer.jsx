import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function PalettePreviewer() {
  // ----- State -----
  const [primary, setPrimary]     = useState({ r: 30, g: 116, b: 231, a: 1 })
  const [secondary, setSecondary] = useState({ r: 200, g: 215, b: 255, a: 1 })
  const [text, setText]           = useState({ r: 30, g: 116, b: 231, a: 1 })
  const [headerLabel, setHeaderLabel] = useState('Pokemon')

  const [enforceModRules, setEnforceModRules] = useState(true)
  const [lightenPct, setLightenPct]   = useState(22)
  const [satChange,  setSatChange]    = useState(-12)
  const [textThreshold, setTextThreshold] = useState(4.5)

  const [activeTarget, setActiveTarget] = useState('primary')

  // ===== Info dialog state =====
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoText, setInfoText] = useState('');
  const [infoStatus, setInfoStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const INFO_URL = (import.meta.env.BASE_URL || '/') + 'instructions.txt';

  const openInfo = async () => {
    setInfoOpen(true);
    if (infoStatus === 'ready') return;
    try {
      setInfoStatus('loading');
      const res = await fetch(INFO_URL);
      if (!res.ok) throw new Error('Failed to load instructions');
      const txt = await res.text();
      setInfoText(txt);
      setInfoStatus('ready');
    } catch (e) {
      setInfoStatus('error');
      setInfoText('Could not load instructions. Ensure instructions.txt exists in your public folder.');
    }
  };

  // ----- Sprites (fixed) -----
  const SPRITES = {
    Kanto: ['bulbasaur', 'charmander', 'squirtle'],
    Johto: ['chikorita', 'cyndaquil', 'totodile'],
    Hoenn: ['treecko', 'torchic', 'mudkip'],
  }
  const SPRITE_BASE = (import.meta.env.BASE_URL || '/') + 'sprites'
  const SPRITE_SIZE = 75

  // ----- Helpers -----
  const clamp = (v,min,max)=>Math.min(max,Math.max(min,v))
  const clamp255 = v => clamp(Math.round(Number(v) || 0), 0, 255)

  const toRGBA = c => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round((c.a??1)*100)/100})`
  const toHex  = c => `#${[c.r,c.g,c.b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase()}`
  const hexToRgbFast = (hex) => {
    const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
    return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:null
  }
  const rgbToHsl = ({r,g,b})=>{
    r/=255; g/=255; b/=255
    const max=Math.max(r,g,b), min=Math.min(r,g,b)
    let h,s,l=(max+min)/2
    if(max===min){ h=0; s=0 }
    else{
      const d=max-min
      s=l>0.5? d/(2-max-min): d/(max+min)
      switch(max){ case r: h=(g-b)/d+(g<b?6:0); break
                   case g: h=(b-r)/d+2; break
                   case b: h=(r-g)/d+4; break }
      h/=6
    }
    return { h:h*360, s:s*100, l:l*100 }
  }
  const hslToRgb = ({h,s,l})=>{
    h/=360; s/=100; l/=100
    let r,g,b
    if(s===0){ r=g=b=l }
    else{
      const hue2rgb=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1;
        if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q;
        if(t<2/3)return p+(q-p)*(2/3-t)*6; return p }
      const q=l<0.5? l*(1+s) : l+s-l*s
      const p=2*l-q
      r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3)
    }
    return { r:r*255, g:g*255, b:b*255 }
  }
  const adjustHsl=(rgb,{dh=0,ds=0,dl=0})=>{
    const hsl=rgbToHsl(rgb)
    const out={ h:(hsl.h+dh+360)%360, s:clamp(hsl.s+ds,0,100), l:clamp(hsl.l+dl,0,100) }
    return { ...hslToRgb(out), a: rgb.a ?? 1 }
  }
  const relLum=({r,g,b})=>{
    const s=[r,g,b].map(v=>v/255).map(v=> v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4))
    return 0.2126*s[0]+0.7152*s[1]+0.0722*s[2]
  }
  const contrast=(c1,c2)=>{ const L1=relLum(c1), L2=relLum(c2); const [a,b]=L1>L2?[L1,L2]:[L2,L1]; return (a+0.05)/(b+0.05) }

  // ----- Rule propagation -----
  useEffect(()=>{
    if(!enforceModRules) return
    const next=adjustHsl(primary,{ ds:satChange, dl:lightenPct })
    next.a=secondary.a
    setSecondary(next)
  },[primary,lightenPct,satChange,enforceModRules, secondary.a])

  useEffect(()=>{
    if(enforceModRules) setText(prev => ({ ...prev, r:primary.r, g:primary.g, b:primary.b }))
  },[primary.r, primary.g, primary.b, enforceModRules])

  const realignToRules=()=>{
    const defaultLighten = 22
    const defaultSaturate = -12
    setLightenPct(defaultLighten)
    setSatChange(defaultSaturate)
    const next = adjustHsl(primary,{ ds: defaultSaturate, dl: defaultLighten })
    next.a = secondary.a
    setSecondary(next)
    if(enforceModRules) setText(prev => ({ ...prev, r:primary.r, g:primary.g, b:primary.b }))
  }

  // ----- Reference image with zoom/pan + DPR-accurate eyedrop -----
  const canvasRef = useRef(null);
  const rawCanvasRef = useRef(null); // full-resolution image buffer
  const view = useRef({ scale: 1, x: 0, y: 0, min: 0.5, max: 8 });
  const drag = useRef({ active:false, x:0, y:0 });

  // Track devicePixelRatio for precise pointer mapping
  const dprRef = useRef(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);
  useEffect(()=>{
    const update = () => { dprRef.current = window.devicePixelRatio || 1; };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  },[]);

  const handleImage = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // draw into offscreen raw canvas at native pixels
      const raw = rawCanvasRef.current || (rawCanvasRef.current = document.createElement('canvas'));
      raw.width = img.width;
      raw.height = img.height;
      const rctx = raw.getContext('2d', { willReadFrequently: true });
      rctx.imageSmoothingEnabled = false;
      rctx.clearRect(0, 0, raw.width, raw.height);
      rctx.drawImage(img, 0, 0);

      // size visible canvas to fit max box
      const cvs = canvasRef.current;
      if (!cvs) return;
      const maxW = 640, maxH = 420;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      cvs.width  = Math.round(img.width  * scale);
      cvs.height = Math.round(img.height * scale);

      // reset viewport
      view.current.scale = 1;
      view.current.x = 0;
      view.current.y = 0;

      redraw();
    };
    img.src = url;
  };

  const redraw = () => {
    const cvs = canvasRef.current;
    const raw = rawCanvasRef.current;
    if (!cvs || !raw) return;
    const ctx = cvs.getContext('2d');
    // Reset any prior transforms and draw with no smoothing
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    ctx.save();
    // base scale maps raw->canvas fit
    const baseScaleX = cvs.width / raw.width;
    const baseScaleY = cvs.height / raw.height;
    ctx.translate(view.current.x, view.current.y);
    ctx.scale(view.current.scale * baseScaleX, view.current.scale * baseScaleY);
    ctx.drawImage(raw, 0, 0);
    ctx.restore();
  };

  // Convert a client pointer to raw image pixel coords (DPR-aware)
  const canvasToImageCoords = (clientX, clientY) => {
    const cvs = canvasRef.current, raw = rawCanvasRef.current;
    if (!cvs || !raw) return { ix: 0, iy: 0 };
    const rect = cvs.getBoundingClientRect();
    const dpr = dprRef.current;

    // Pointer in canvas pixel units
    const cx = (clientX - rect.left) * dpr;
    const cy = (clientY - rect.top) * dpr;

    const baseScaleX = cvs.width / raw.width;
    const baseScaleY = cvs.height / raw.height;
    const s = view.current.scale;
    const ix = Math.floor((cx - view.current.x) / (s * baseScaleX));
    const iy = Math.floor((cy - view.current.y) / (s * baseScaleY));
    return { ix, iy };
  };

  const onWheel = (e) => {
    e.preventDefault();
    const cvs = canvasRef.current, raw = rawCanvasRef.current;
    if (!cvs || !raw) return;

    const dpr = dprRef.current;
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;

    const baseScaleX = cvs.width / raw.width;
    const baseScaleY = cvs.height / raw.height;

    const s0 = view.current.scale;
    const factor = e.deltaY > 0 ? 1/1.1 : 1.1;

    // World coords under cursor before zoom
    const wx = (mx - view.current.x) / (s0 * baseScaleX);
    const wy = (my - view.current.y) / (s0 * baseScaleY);

    // Apply zoom (clamped)
    const s1 = Math.min(view.current.max, Math.max(view.current.min, s0 * factor));
    view.current.scale = s1;

    // Keep the same world point under the cursor
    view.current.x = mx - wx * s1 * baseScaleX;
    view.current.y = my - wy * s1 * baseScaleY;

    redraw();
  };

  const onDown = (e) => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const dpr = dprRef.current;
    drag.current.active = true;
    drag.current.x = (e.clientX - rect.left) * dpr;
    drag.current.y = (e.clientY - rect.top) * dpr;
  };

  const onMove = (e) => {
    if (!drag.current.active) return;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const dpr = dprRef.current;
    const nx = (e.clientX - rect.left) * dpr;
    const ny = (e.clientY - rect.top) * dpr;
    const dx = nx - drag.current.x;
    const dy = ny - drag.current.y;
    drag.current.x = nx;
    drag.current.y = ny;

    view.current.x += dx;
    view.current.y += dy;
    redraw();
  };

  const onUp = () => { drag.current.active = false; };

  const onCanvasClick = (e) => {
    const raw = rawCanvasRef.current;
    if (!raw) return;
    const { ix, iy } = canvasToImageCoords(e.clientX, e.clientY);
    if (ix < 0 || iy < 0 || ix >= raw.width || iy >= raw.height) return;
    const data = raw.getContext('2d').getImageData(ix, iy, 1, 1).data;
    const picked = { r:data[0], g:data[1], b:data[2], a:+(data[3]/255).toFixed(3) };
    if (activeTarget==='primary')   setPrimary(picked);
    if (activeTarget==='secondary') setSecondary(picked);
    if (activeTarget==='text')      setText(picked);
  };

  // ----- CSS vars & JSON -----
  const secondaryEdge=useMemo(()=>adjustHsl(secondary,{ dl:-8, ds:-5 }),[secondary])
  const primaryEdge=useMemo(()=>adjustHsl(primary,{ dl:-15, ds:-10 }),[primary])
  const cssVars=useMemo(()=>({
    ['--c-primary']:toRGBA(primary),
    ['--c-primary-edge']:toRGBA(primaryEdge),
    ['--c-secondary']:toRGBA(secondary),
    ['--c-secondary-edge']:toRGBA(secondaryEdge),
    ['--c-text']:toRGBA(text)
  }),[primary,primaryEdge,secondary,secondaryEdge,text])

  const liveJSON=useMemo(()=>JSON.stringify({
    primary:{r:clamp255(primary.r),g:clamp255(primary.g),b:clamp255(primary.b),a:1},
    secondary:{r:clamp255(secondary.r),g:clamp255(secondary.g),b:clamp255(secondary.b),a:1},
    text:{r:clamp255(text.r),g:clamp255(text.g),b:clamp255(text.b),a:1}
  },null,2),[primary,secondary,text])

  const [jsonText, setJsonText]   = useState(liveJSON)
  useEffect(()=>{ setJsonText(liveJSON) }, [liveJSON])

  const copy = async str => { try { await navigator.clipboard.writeText(str); alert('Copied!') } catch(e){ console.error(e) } }

  const applyJsonValues = () => {
    try{
      const parsed = JSON.parse(jsonText)
      const norm = (c, fallback) => {
        if (!c || typeof c !== 'object') return fallback
        const r = clamp255(c.r), g = clamp255(c.g), b = clamp255(c.b)
        const a = (typeof c.a === 'number') ? Math.max(0, Math.min(1, +c.a)) : 1
        return { r,g,b,a }
      }
      if ('primary' in parsed)   setPrimary(p => ({ ...p, ...norm(parsed.primary, primary) }))
      if ('secondary' in parsed) setSecondary(p => ({ ...p, ...norm(parsed.secondary, secondary) }))
      if ('text' in parsed)      setText(p => ({ ...p, ...norm(parsed.text, text) }))
      alert('Applied JSON values to preview.')
    }catch(e){
      alert('Invalid JSON. Expect keys: primary, secondary, text with r,g,b,a numbers.')
    }
  }

  const EyeDropIcon = ({size=16}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M16.88 3.549a3.25 3.25 0 1 1 4.596 4.596l-2.12 2.12-4.596-4.596 2.12-2.12zM13.94 6.49l4.596 4.596-8.334 8.334a2 2 0 0 1-1.28.58l-3.77.28a.75.75 0 0 1-.8-.8l.28-3.77a2 2 0 0 1 .58-1.28l8.334-8.334z" fill="currentColor"/>
    </svg>
  )

  /* ===== Color row ===== */
  const ColorRow = ({ label, color, setColor, allowLinkBtn, showLabel = true }) => {
    const id = label.toLowerCase();
    const colorRef = React.useRef(null);

    React.useEffect(() => {
      if (colorRef.current) {
        const hex = toHex(color);
        if (colorRef.current.value !== hex) {
          colorRef.current.value = hex;
        }
      }
    }, [color.r, color.g, color.b]);

    const commitHex = (hex) => {
      const rgb = hexToRgbFast(hex);
      if (!rgb) return;
      setColor(prev => (
        prev.r === rgb.r && prev.g === rgb.g && prev.b === rgb.b
          ? prev
          : { ...prev, r: rgb.r, g: rgb.g, b: rgb.b }
      ));
    };

    const handleInput  = (e) => commitHex(e.target.value);
    const handleChange = (e) => commitHex(e.target.value);

    const handleChan = (ch) => (e) => {
      const v = clamp255(e.target.value);
      setColor(prev => (prev[ch] === v ? prev : { ...prev, [ch]: v }));
    };

    return (
      <div className={`color-row row-grid ${showLabel ? '' : 'no-label'}`}>
        {showLabel && <div className="cr-label">{label}</div>}

        <input
          ref={colorRef}
          type="color"
          className="color"
          defaultValue={toHex(color)}
          onInput={handleInput}
          onChange={handleChange}
          aria-label={`${label} color`}
        />

        {['r','g','b'].map(ch => (
          <div key={ch} className="cr-chan col">
            <div className="cr-chan-label">{ch.toUpperCase()}</div>
            <input
              className="number"
              type="number"
              min="0"
              max="255"
              value={Math.round(color[ch] ?? 0)}
              onInput={handleChan(ch)}
              onChange={handleChan(ch)}
              aria-label={`${label} ${ch.toUpperCase()}`}
            />
          </div>
        ))}

        {allowLinkBtn && (
          <button
            className={`icon-button ${activeTarget === id ? 'active' : ''}`}
            onClick={() => setActiveTarget(id)}
            title={`Eyedrop to ${label}`}
            aria-label={`Eyedrop ${label}`}
          >
            <EyeDropIcon />
          </button>
        )}
      </div>
    );
  };

  // ----- Layout -----
  return (
    <div style={cssVars}>
      <header className="app-header">
        <img
          src={import.meta.env.BASE_URL + 'IlyBrandingPokedex.png'}
          alt="Ilyeana's Palette Helper"
          className="header-image"
        />

        <a
          href="https://ko-fi.com/ilyeana"
          target="_blank"
          rel="noopener noreferrer"
          className="kofi-button"
        >
          <img
            src={import.meta.env.BASE_URL + 'kofi.png'}
            alt="Support on Ko-fi"
            className="kofi-img"
          />
        </a>
      </header>

      {infoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instructions"
          onClick={() => setInfoOpen(false)}
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
            display:'grid', placeItems:'center', zIndex:50
          }}
        >
          <div
            className="panel"
            onClick={(e)=>e.stopPropagation()}
            style={{ width:'min(720px, 92vw)', maxHeight:'80vh', overflow:'auto' }}
          >
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
              <h3 style={{margin:0}}>Instructions</h3>
              <button className="button" onClick={()=>setInfoOpen(false)}>Close</button>
            </div>
            <pre style={{whiteSpace:'pre-wrap'}}>
              {infoStatus === 'loading' ? 'Loading…' : infoText}
            </pre>
          </div>
        </div>
      )}


      {/* 4-column grid: [pad][Palette Controls][preview+ref][pad] */}
      <div className="grid">
        <div /> {/* Column A: left padding */}

        {/* Column B: Palette Controls */}
        <div className="vstack">
          <div className="panel palette-controls"> 
            <div className="header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h3 style={{ margin: 0 }}>Palette Controls</h3>
              <button
                onClick={openInfo}
                aria-label="Instructions"
                title="Instructions"
                className="button"
                style={{ width: 28, height: 28, padding: 0, display:'grid', placeItems:'center' }}
              >
                i
              </button>
            </div>

            {/* Title text */}
            <div className="field">
              <div className="label-wrap">
                <div className="title">Pokedex Title</div>
                <div className="help">Shown in the preview header.</div>
              </div>
              <div className="control">
                <input
                  className="number"
                  style={{ width: 260 }}
                  type="text"
                  maxLength={20}
                  value={headerLabel}
                  onChange={(e)=> setHeaderLabel(e.target.value)}
                />
              </div>
            </div>

            {/* Sync at the top */}
            <div className="field">
              <div className="label-wrap">
                <div className="title">Sync all to Primary</div>
                <div className="help">Secondary & Text LOCKED to Primary when checked.</div>
              </div>
              <div className="control sync-row">
                <label className="toggle" htmlFor="rules">
                  <input
                    type="checkbox"
                    id="rules"
                    checked={enforceModRules}
                    onChange={e=>setEnforceModRules(e.target.checked)}
                  />
                  Keep In Sync
                </label>

                <button className="button resync" onClick={realignToRules}>Resync</button>
              </div>
            </div>

            {/* Grouped color controls with titles on the left */}
            <div className="field no-label">
              <div className="color-group two-col">

                {/* Primary */}
                <div className="subfield-row">
                  <div className="label-wrap">
                    <div className="sub-title">Primary Colour</div>
                    <div className="sub-help">Main brand colour; others can derive when sync is on.</div>
                  </div>
                  <div className="color-row inline">
                    <ColorRow label="Primary" color={primary} setColor={setPrimary} allowLinkBtn showLabel={false}/>
                  </div>
                </div>

                {/* Secondary */}
                <div className="subfield-row">
                  <div className="label-wrap">
                    <div className="sub-title">Secondary Colour</div>
                    <div className="sub-help">Usually a lighter companion to Primary.</div>
                  </div>
                  <div className="color-row inline">
                    <ColorRow label="Secondary" color={secondary} setColor={setSecondary} allowLinkBtn showLabel={false}/>
                  </div>
                </div>

                {/* Text */}
                <div className="subfield-row">
                  <div className="label-wrap">
                    <div className="sub-title">Text Colour</div>
                    <div className="sub-help">Used for labels; respects min contrast when Sync is off.</div>
                  </div>
                  <div className="color-row inline">
                    <ColorRow label="Text" color={text} setColor={setText} allowLinkBtn showLabel={false}/>
                  </div>
                </div>

              </div>
            </div>

            {/* Secondary adjustments */}
            <div className="field">
              <div className="label-wrap">
                <div className="title">Secondary Adjustments</div>
                <div className="help">Tweak lightness and saturation of Secondary.</div>
              </div>
              <div className="control">
                <div className="slider-row small" style={{marginTop:0}}>
                  <span className="slider-label">Lighten L%</span>
                  <input className="range" type="range" min="-40" max="60"
                         value={lightenPct} onChange={e=>setLightenPct(Number(e.target.value))}/>
                </div>
                <div className="slider-row small">
                  <span className="slider-label">Δ Saturation %</span>
                  <input className="range" type="range" min="-50" max="50"
                         value={satChange} onChange={e=>setSatChange(Number(e.target.value))}/>
                </div>
              </div>
            </div>

            {/* Text rule */}
            <div className="field">
              <div className="label-wrap">
                <div className="title">Text Adjustments</div>
                <div className="help">Minimum contrast versus background (only when Sync is off).</div>
              </div>
              <div className="control">
                <div className="slider-row small" style={{marginTop:0}}>
                  <span className="slider-label">Min contrast</span>
                  <input className="range" type="range" min="3" max="14" step="0.1"
                         value={textThreshold}
                         onChange={e=>setTextThreshold(Number(e.target.value))}
                         disabled={enforceModRules}/>
                </div>
                <div className="small" style={{marginTop:2}}>
                  {enforceModRules
                    ? 'Using Primary color for Text.'
                    : `Current contrast vs Primary: ${contrast(text, primary).toFixed(2)}:1`}
                </div>
              </div>
            </div>
          </div>

          {/* JSON Variables below */}
          <div className="panel export json-values" style={{ paddingBottom: 8 }}>
            <div className="header"><h3>JSON Variables</h3></div>
            <div className="hstack" style={{ marginBottom: 18, justifyContent:'center' }}>
              <button className="button" onClick={()=>copy(jsonText)}>Copy</button>
              <button className="button" onClick={applyJsonValues}>Apply Changes</button>
            </div>
            <textarea
              className="codearea fixed"
              style={{ height: '500px', fontSize: '16px', lineHeight: '22px', padding: '20px', marginBottom: 20 }}
              value={jsonText}
              onChange={e=>{ setJsonText(e.target.value) }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Column C: Preview + Reference */}
        <div className="vstack col-c">
          <div className="dex-panel">
            <div className="dex-header">
              <div className="dex-arrow" />
              <div className="dex-title">{headerLabel.toUpperCase()}</div>
              <div className="dex-arrow right" />
              <div className="dex-magnify" />
            </div>
            <div className="dex-scroll">
              <CardRow region="Kanto" caught={9}/>
              <CardRow region="Johto" caught={7}/>
              <CardRow region="Hoenn" caught={11}/>
            </div>
          </div>

          <div className="panel">
            <div className="header ref-image">
              <h3>Reference image</h3>
              <label className="button" style={{cursor:'pointer'}}>
                Upload
                <input
                  type="file"
                  accept="image/*"
                  style={{display:'none'}}
                  onChange={e=>handleImage(e.target.files?.[0])}
                />
              </label>
            </div>

            <div className="checker">
              <canvas
                ref={canvasRef}
                onWheel={onWheel}
                onMouseDown={onDown}
                onMouseMove={onMove}
                onMouseUp={onUp}
                onMouseLeave={onUp}
                onClick={onCanvasClick}
                style={{width:'100%'}}
              />
            </div>

            {/* Zoom controls (bottom of Reference image) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16 }}>
              <button
                className="button"
                onClick={() => {
                  view.current.scale = Math.max(view.current.min, view.current.scale / 1.1);
                  redraw();
                }}
              >
                −
              </button>

              <input
                className="zoom-range"
                type="range"
                min={Math.round(view.current.min * 100)}
                max={Math.round(view.current.max * 100)}
                value={Math.round(view.current.scale * 100)}
                onChange={(e) => {
                  view.current.scale = Math.min(
                    view.current.max,
                    Math.max(view.current.min, Number(e.target.value) / 100)
                  );
                  redraw();
                }}
              />

              <button
                className="button"
                onClick={() => {
                  view.current.scale = Math.min(view.current.max, view.current.scale * 1.1);
                  redraw();
                }}
              >
                +
              </button>

              <span className="zoom-readout">{Math.round(view.current.scale * 100)}%</span>

              {/* Flex spacer pushes Reset to the far right */}
              <div style={{ flex: 1 }} />

              <button
                className="button"
                onClick={() => {
                  view.current.scale = 1;
                  view.current.x = 0;
                  view.current.y = 0;
                  redraw();
                }}
              >
                Reset
              </button>
            </div>

            <div className="small" style={{marginTop:8}}>
              Active eyedrop target: <b>{activeTarget}</b>
            </div>
          </div>
        </div>

        <div /> {/* Column D: right padding */}
      </div>
    </div>
  )
}

/* ===== Supporting components ===== */
function CardRow({region,caught}) {
  const SPRITES = {
    Kanto: ['bulbasaur', 'charmander', 'squirtle'],
    Johto: ['chikorita', 'cyndaquil', 'totodile'],
    Hoenn: ['treecko', 'torchic', 'mudkip'],
  }
  const SPRITE_BASE = (import.meta.env.BASE_URL || '/') + 'sprites'
  const SPRITE_SIZE = 75

  const names=SPRITES[region]||[]
  const size = SPRITE_SIZE
  const gap  = 8
  const pad  = 10
  const rightWidth = Math.round(size * 3 + gap * 2 + pad * 2)
  const silH = Math.round(size * 0.78)

  return (
    <div className="dex-row" style={{'--dex-right-w':`${rightWidth}px`}}>
      <div className="dex-left">
        <div className="dex-region">{region}</div>
        <div className="dex-count">Caught: {caught}</div>
      </div>
      <div className="dex-right">
        {names.map(n=><SpriteOrSilhouette key={n} name={n} size={size} silH={silH} base={SPRITE_BASE}/>)}
      </div>
    </div>
  )
}

function SpriteOrSilhouette({name,size,silH, base}) {
  const [err,setErr]=useState(false)
  const src=`${base}/${name}.png`
  if(!err){
    return <img className="dex-sprite-img" width={size} height={size} src={src} alt={name} onError={()=>setErr(true)}/>
  }
  return <div className="dex-sil" style={{width:size,height:silH}}/>
}
