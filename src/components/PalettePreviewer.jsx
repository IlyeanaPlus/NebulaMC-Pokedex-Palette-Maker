import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function PalettePreviewer() {
  // ----- State -----
  const [primary, setPrimary]     = useState({ r: 30, g: 116, b: 231, a: 1 })
  const [secondary, setSecondary] = useState({ r: 200, g: 215, b: 255, a: 1 })
  const [text, setText]           = useState({ r: 30, g: 116, b: 231, a: 1 })
  const [headerLabel, setHeaderLabel] = useState('POKEDEX')

  const [enforceModRules, setEnforceModRules] = useState(true)
  const [lightenPct, setLightenPct]   = useState(22)
  const [satChange,  setSatChange]    = useState(-12)
  const [textThreshold, setTextThreshold] = useState(4.5)

  const [activeTarget, setActiveTarget] = useState('primary')

  // ----- Sprites (fixed) -----
  const SPRITES = {
    Kanto: ['bulbasaur', 'charmander', 'squirtle'],
    Johto: ['chikorita', 'cyndaquil', 'totodile'],
    Hoenn: ['treecko', 'torchic', 'mudkip'],
  }
  const SPRITE_BASE = '/sprites'
  const SPRITE_SIZE = 75

  // ----- Helpers -----
  const clamp = (v,min,max)=>Math.min(max,Math.max(min,v))
  const toRGBA = c => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round((c.a??1)*100)/100})`
  const toHex  = c => `#${[c.r,c.g,c.b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase()}`
  const hexToRgb = hex => {
    const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
    return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16),a:1}:null
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

  // ----- Rules -----
  useEffect(()=>{
    if(!enforceModRules) return
    const next=adjustHsl(primary,{ ds:satChange, dl:lightenPct })
    next.a=secondary.a
    setSecondary(next)
  },[primary,lightenPct,satChange,enforceModRules])

  useEffect(()=>{
    if(enforceModRules) setText({ ...primary })
  },[primary,enforceModRules])

  const realignToRules=()=>{
    const defaultLighten = 22
    const defaultSaturate = -12
    setLightenPct(defaultLighten)
    setSatChange(defaultSaturate)
    const next = adjustHsl(primary,{ ds: defaultSaturate, dl: defaultLighten })
    next.a = secondary.a
    setSecondary(next)
    if(enforceModRules) setText({ ...primary })
  }

  // ----- Reference image -----
  const canvasRef = useRef(null)
  const handleImage=(file)=>{
    if(!file) return
    const url=URL.createObjectURL(file)
    const img=new Image()
    img.onload=()=>{
      const cvs=canvasRef.current; if(!cvs) return
      const maxW=512,maxH=320
      const scale=Math.min(1,maxW/img.width,maxH/img.height)
      cvs.width=Math.round(img.width*scale)
      cvs.height=Math.round(img.height*scale)
      const ctx=cvs.getContext('2d')
      ctx.imageSmoothingEnabled=false
      ctx.clearRect(0,0,cvs.width,cvs.height)
      ctx.drawImage(img,0,0,cvs.width,cvs.height)
    }
    img.src=url
  }
  const onCanvasClick=e=>{
    const cvs=canvasRef.current; if(!cvs) return
    const rect=cvs.getBoundingClientRect()
    const x=Math.floor((e.clientX-rect.left)*(cvs.width/rect.width))
    const y=Math.floor((e.clientY-rect.top)*(cvs.height/rect.height))
    const {data}=cvs.getContext('2d').getImageData(x,y,1,1)
    const picked={ r:data[0], g:data[1], b:data[2], a:+(data[3]/255).toFixed(3) }
    if(activeTarget==='primary') setPrimary(picked)
    if(activeTarget==='secondary') setSecondary(picked)
    if(activeTarget==='text') setText(picked)
  }

  // ----- CSS vars for preview -----
  const secondaryEdge=useMemo(()=>adjustHsl(secondary,{ dl:-8, ds:-5 }),[secondary])
  const primaryEdge=useMemo(()=>adjustHsl(primary,{ dl:-15, ds:-10 }),[primary])
  const cssVars=useMemo(()=>({
    ['--c-primary']:toRGBA(primary),
    ['--c-primary-edge']:toRGBA(primaryEdge),
    ['--c-secondary']:toRGBA(secondary),
    ['--c-secondary-edge']:toRGBA(secondaryEdge),
    ['--c-text']:toRGBA(text)
  }),[primary,primaryEdge,secondary,secondaryEdge,text])

  // JSON export text
  const liveJSON=useMemo(()=>JSON.stringify({
    primary:{r:Math.round(primary.r),g:Math.round(primary.g),b:Math.round(primary.b),a:1},
    secondary:{r:Math.round(secondary.r),g:Math.round(secondary.g),b:Math.round(secondary.b),a:1},
    text:{r:Math.round(text.r),g:Math.round(text.g),b:Math.round(text.b),a:1}
  },null,2),[primary,secondary,text])

  const [jsonDirty, setJsonDirty] = useState(false)
  const [jsonText, setJsonText]   = useState(liveJSON)
  useEffect(()=>{ if(!jsonDirty) setJsonText(liveJSON) }, [liveJSON, jsonDirty])

  const copy = async str => { try { await navigator.clipboard.writeText(str); alert('Copied!') } catch(e){ console.error(e) } }

  const applyJsonValues = () => {
    try{
      const parsed = JSON.parse(jsonText)
      const norm = (c, fallback) => {
        if (!c || typeof c !== 'object') return fallback
        const r = clamp(Math.round(+c.r || 0),0,255)
        const g = clamp(Math.round(+c.g || 0),0,255)
        const b = clamp(Math.round(+c.b || 0),0,255)
        const a = (typeof c.a === 'number') ? Math.max(0, Math.min(1, +c.a)) : 1
        return { r,g,b,a }
      }
      if ('primary' in parsed)   setPrimary(norm(parsed.primary, primary))
      if ('secondary' in parsed) setSecondary(norm(parsed.secondary, secondary))
      if ('text' in parsed)      setText(norm(parsed.text, text))
      alert('Applied JSON values to preview.')
    }catch(e){
      alert('Invalid JSON. Expect keys: primary, secondary, text with r,g,b,a numbers.')
    }
  }

  // ----- Small UI bits -----
  const EyeDropIcon = ({size=16}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M16.88 3.549a3.25 3.25 0 1 1 4.596 4.596l-2.12 2.12-4.596-4.596 2.12-2.12zM13.94 6.49l4.596 4.596-8.334 8.334a2 2 0 0 1-1.28.58l-3.77.28a.75.75 0 0 1-.8-.8l.28-3.77a2 2 0 0 1 .58-1.28l8.334-8.334z" fill="currentColor"/>
    </svg>
  )

  const ColorRow=({label,color,setColor,allowLinkBtn})=>{
    const id = label.toLowerCase()
    const toHex  = c => `#${[c.r,c.g,c.b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase()}`
    const hexToRgb = hex => {
      const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
      return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16),a:1}:null
    }

    return (
      <div className="color-row row-grid">
        <div className="cr-label">{label}</div>
        <input
          type="color" className="color"
          value={toHex(color)}
          onChange={e=>{ const rgb=hexToRgb(e.target.value); if(rgb) setColor({ ...color, ...rgb }) }}
        />
        {['r','g','b'].map(ch=>(
          <div key={ch} className="cr-chan col">
            <div className="cr-chan-label">{ch.toUpperCase()}</div>
            <input
              className="number"
              type="number" min="0" max="255"
              value={Math.round(color[ch])}
              onChange={e=>setColor({ ...color, [ch]: clamp(Math.round(+e.target.value||0), 0, 255) })}
            />
          </div>
        ))}
        {allowLinkBtn && (
          <button
            className={`icon-button ${activeTarget===id ? 'active' : ''}`}
            onClick={()=>setActiveTarget(id)}
            title={`Eyedrop to ${label}`}
            aria-label={`Eyedrop ${label}`}
          >
            <EyeDropIcon />
          </button>
        )}
      </div>
    )
  }

  const CardRow=({region,caught})=>{
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
          {names.map(n=><SpriteOrSilhouette key={n} name={n} size={size} silH={silH}/>)}
        </div>
      </div>
    )
  }

  const SpriteOrSilhouette=({name,size,silH})=>{
    const [err,setErr]=useState(false)
    const src=`${SPRITE_BASE}/${name}.png`
    if(!err){
      return <img className="dex-sprite-img" width={size} height={size} src={src} alt={name} onError={()=>setErr(true)}/>
    }
    return <div className="dex-sil" style={{width:size,height:silH}}/>
  }

  return (
    <div style={cssVars}>
      <header className="app-header">
        <h1>Ilyeana&apos;s Pixelmon Palette Previewer</h1>
      </header>

      <div className="grid">
        {/* Column A */}
        <div className="vstack">
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
            <div className="header">
              <h2>Reference image</h2>
              <label className="button" style={{cursor:'pointer'}}>
                Upload
                <input type="file" accept="image/*" style={{display:'none'}}
                       onChange={e=>handleImage(e.target.files?.[0])}/>
              </label>
            </div>
            <div className="checker" style={{padding:'8px'}}>
              <canvas ref={canvasRef} onClick={onCanvasClick} style={{width:'100%',display:'block'}}/>
            </div>
            <div className="small" style={{marginTop:8}}>Active eyedrop target: <b>{activeTarget}</b></div>
          </div>
        </div>

        {/* Column B */}
        <div className="vstack col-b">
          <div className="panel">
            <div className="header"><h3>Main Options</h3></div>

            <div className="small" style={{margin:'4px 0 8px'}}>Label</div>
            <input className="number" style={{ width: 240, marginBottom: 10 }} type="text" maxLength={20}
                   value={headerLabel} onChange={(e)=> setHeaderLabel(e.target.value)} />

            <ColorRow label="Primary"   color={primary}   setColor={setPrimary}   allowLinkBtn />
            <ColorRow label="Secondary" color={secondary} setColor={setSecondary} allowLinkBtn />
            <ColorRow label="Text"      color={text}      setColor={setText}      allowLinkBtn />
          </div>

          <div className="panel panel-rules">
            <div className="header"><h3>Secondary Options</h3></div>

            <div className="hstack rules-top">
              <div className="toggle">
                <input type="checkbox" id="rules" checked={enforceModRules}
                       onChange={e=>setEnforceModRules(e.target.checked)}/>
                <label htmlFor="rules">Auto Sync Colours</label>
              </div>
              <button className="button" onClick={realignToRules}>Resync</button>
            </div>

            <div className="small manual-hint">Manual Mode <span>(adjust when sync is turned off)</span></div>

            <div className="section-title small">Secondary rule (from Primary)</div>
            <div className="slider-row small">
              <span className="slider-label">Lighten L%</span>
              <input className="range" type="range" min="-40" max="60" value={lightenPct}
                     onChange={e=>setLightenPct(Number(e.target.value))}/>
            </div>
            <div className="slider-row small">
              <span className="slider-label">Δ Saturation %</span>
              <input className="range" type="range" min="-50" max="50" value={satChange}
                     onChange={e=>setSatChange(Number(e.target.value))}/>
            </div>

            <div className="section-title small" style={{marginTop:8}}>Text rule</div>
            <div className="slider-row small">
              <span className="slider-label">Min contrast</span>
              <input className="range" type="range" min="3" max="14" step="0.1"
                     value={textThreshold}
                     onChange={e=>setTextThreshold(Number(e.target.value))}
                     disabled={enforceModRules}/>
            </div>
            <div className="small">
              {enforceModRules ? 'Using Primary color for Text.'
                               : `Current contrast vs Primary: ${contrast(text, primary).toFixed(2)}:1`}
            </div>
          </div>
        </div>

        {/* Column C: JSON Variables (independent height) */}
        <div className="vstack col-c">
          <div className="panel export json-values" style={{ paddingBottom: 8 }}>
            <div className="header">
              <h3>JSON Variables</h3>
            </div>
            <div className="hstack" style={{ marginBottom: 18 }}>
              <button className="button" onClick={()=>copy(jsonText)}>Copy</button>
              <button className="button" onClick={applyJsonValues}>Apply</button>
            </div>
            <textarea
              className="codearea fixed"
              style={{ height: '520px', fontSize: '16px', lineHeight: '22px', padding: '20px', marginBottom: 20 }}
              value={jsonText}
              onChange={e=>{ setJsonText(e.target.value); setJsonDirty(true) }}
              spellCheck={false}
              placeholder={`{
  "primary":   {"r":30,"g":116,"b":231,"a":1},
  "secondary": {"r":140,"g":180,"b":234,"a":1},
  "text":      {"r":30,"g":116,"b":231,"a":1}
}`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
