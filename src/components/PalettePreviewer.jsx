import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function PalettePreviewer(){
  // Core palette
  const [primary, setPrimary] = useState({ r: 30, g: 116, b: 231, a: 1 })
  const [secondary, setSecondary] = useState({ r: 200, g: 215, b: 255, a: 1 })
  const [text, setText] = useState({ r: 25, g: 25, b: 25, a: 1 })

  // Mod palette rule toggle + params
  const [enforceModRules, setEnforceModRules] = useState(true)
  const [lightenPct, setLightenPct] = useState(22) // L% increase for secondary
  const [satChange, setSatChange] = useState(-12)  // S% change for secondary
  const [textThreshold, setTextThreshold] = useState(4.5) // contrast

  // Eyedropper
  const [activeTarget, setActiveTarget] = useState('primary') // primary | secondary | text
  const canvasRef = useRef(null)

  // Helpers
  const clamp = (v,min,max)=>Math.min(max,Math.max(min,v))
  const toRGBA = (c)=>`rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Number(c.a).toFixed(3)})`
  const toHex = (c)=>{
    const n=(x)=>clamp(Math.round(x),0,255).toString(16).padStart(2,'0')
    return `#${n(c.r)}${n(c.g)}${n(c.b)}`.toUpperCase()
  }
  const hexToRgb = (hex)=>{
    const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex)
    if(!m) return null
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16), a: 1 }
  }
  const rgbToHsl = ({r,g,b})=>{
    r/=255; g/=255; b/=255
    const max=Math.max(r,g,b), min=Math.min(r,g,b)
    let h,s,l=(max+min)/2
    if(max===min){ h=0; s=0 }
    else {
      const d=max-min
      s = l>0.5 ? d/(2-max-min) : d/(max+min)
      switch(max){
        case r: h=(g-b)/d+(g<b?6:0); break
        case g: h=(b-r)/d+2; break
        case b: h=(r-g)/d+4; break
      }
      h/=6
    }
    return { h:h*360, s:s*100, l:l*100 }
  }
  const hslToRgb = ({h,s,l})=>{
    h/=360; s/=100; l/=100
    let r,g,b
    if(s===0){ r=g=b=l }
    else {
      const hue2rgb=(p,q,t)=>{ if(t<0) t+=1; if(t>1) t-=1; if(t<1/6) return p+(q-p)*6*t; if(t<1/2) return q; if(t<2/3) return p+(q-p)*(2/3-t)*6; return p }
      const q = l < 0.5 ? l*(1+s) : l + s - l*s
      const p = 2*l - q
      r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3)
    }
    return { r:r*255, g:g*255, b:b*255 }
  }
  const adjustHsl = (rgb,{dh=0,ds=0,dl=0})=>{
    const hsl = rgbToHsl(rgb)
    const out = { h:(hsl.h+dh+360)%360, s:clamp(hsl.s+ds,0,100), l:clamp(hsl.l+dl,0,100) }
    return { ...hslToRgb(out), a: rgb.a ?? 1 }
  }
  const relLum = ({r,g,b})=>{
    const srgb=[r,g,b].map(v=>v/255).map(v=> v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4))
    return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2]
  }
  const contrast = (c1,c2)=>{
    const L1=relLum(c1), L2=relLum(c2)
    const [a,b] = L1>L2 ? [L1,L2] : [L2,L1]
    return (a+0.05)/(b+0.05)
  }

  // Derived colors when enforcing rules
  useEffect(()=>{
    if(!enforceModRules) return
    const next = adjustHsl(primary,{ ds: satChange, dl: lightenPct })
    next.a = secondary.a
    setSecondary(next)
  }, [primary, lightenPct, satChange, enforceModRules])

  useEffect(()=>{
    if(!enforceModRules) return
    const dark = { r:20,g:20,b:20,a:text.a }
    const light = { r:250,g:250,b:250,a:text.a }
    const pHsl = rgbToHsl(primary)
    let candidate = pHsl.l < 50 ? adjustHsl(primary,{ dl:55, ds:-20 }) : adjustHsl(primary,{ dl:-55, ds:-20 })
    if(contrast(candidate, primary) < textThreshold){
      candidate = contrast(light,primary) >= contrast(dark,primary) ? light : dark
    }
    setText({ ...candidate, a: text.a })
  }, [primary, textThreshold, enforceModRules])

  // Image upload + sample
  const handleImage = (file)=>{
    if(!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = ()=>{
      const canvas = canvasRef.current; if(!canvas) return
      const maxW=512, maxH=320
      let { width:w, height:h } = img
      const scale = Math.min(1, maxW/w, maxH/h)
      canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale)
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled=false
      ctx.clearRect(0,0,canvas.width,canvas.height)
      ctx.drawImage(img,0,0,canvas.width,canvas.height)
    }
    img.src = url
  }
  const onCanvasClick = (e)=>{
    const cvs = canvasRef.current; if(!cvs) return
    const rect = cvs.getBoundingClientRect()
    const x = Math.floor((e.clientX-rect.left)*(cvs.width/rect.width))
    const y = Math.floor((e.clientY-rect.top)*(cvs.height/rect.height))
    const { data } = cvs.getContext('2d').getImageData(x,y,1,1)
    const picked = { r:data[0], g:data[1], b:data[2], a:+(data[3]/255).toFixed(3) }
    if(activeTarget==='primary') setPrimary(picked)
    if(activeTarget==='secondary') setSecondary(picked)
    if(activeTarget==='text') setText(picked)
  }

  // CSS variables + exports
  const cssVars = useMemo(()=>({ ['--c-primary']:toRGBA(primary), ['--c-secondary']:toRGBA(secondary), ['--c-text']:toRGBA(text) }),[primary,secondary,text])
  const exportJSON = useMemo(()=> JSON.stringify({ primary, secondary, text }, null, 2), [primary,secondary,text])
  const exportCSS = useMemo(()=> `:root{\n  --c-primary: ${toRGBA(primary)};\n  --c-secondary: ${toRGBA(secondary)};\n  --c-text: ${toRGBA(text)};\n}`, [primary,secondary,text])

  const copy = async (str)=>{ try{ await navigator.clipboard.writeText(str); alert('Copied!') } catch(e){ console.error(e) } }

  const ColorRow = ({label, color, setColor, allowLinkBtn})=> (
    <div className="grid-12">
      <div className="small">{label}</div>
      <input type="color" className="color" value={toHex(color)} onChange={e=>{const rgb=hexToRgb(e.target.value); if(rgb) setColor({...color,...rgb})}} />
      <div className="hstack">
        <label><span className="tag">R</span><input className="number" type="number" min="0" max="255" value={Math.round(color.r)} onChange={e=>setColor({...color, r:Number(e.target.value)})} /></label>
        <label><span className="tag">G</span><input className="number" type="number" min="0" max="255" value={Math.round(color.g)} onChange={e=>setColor({...color, g:Number(e.target.value)})} /></label>
        <label><span className="tag">B</span><input className="number" type="number" min="0" max="255" value={Math.round(color.b)} onChange={e=>setColor({...color, b:Number(e.target.value)})} /></label>
      </div>
      <input className="range" type="range" min="0" max="1" step="0.01" value={color.a} onChange={e=>setColor({...color, a:Number(e.target.value)})} />
      {allowLinkBtn && (
        <button className="button" onClick={()=>setActiveTarget(label.toLowerCase())}>eyedrop</button>
      )}
    </div>
  )

  const CardRow = ({region, caught})=> (
    <div className="card-row">
      <div>
        <div className="region">{region}</div>
        <div className="count">Caught: {caught}</div>
      </div>
      <div className="hstack">
        <div className="icon"></div><div className="icon"></div><div className="icon"></div>
      </div>
    </div>
  )

  return (
    <div className="grid grid-2" style={cssVars}>
      {/* Left side: image + preview */}
      <div className="vstack">
        <div className="panel">
          <div className="header">
            <h2>Reference image</h2>
            <label className="button" style={{cursor:'pointer'}}>
              Upload
              <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImage(e.target.files?.[0])} />
            </label>
          </div>
          <div className="checker" style={{padding:'8px'}}>
            <canvas ref={canvasRef} onClick={onCanvasClick} style={{width:'100%', display:'block'}} />
          </div>
          <div className="small" style={{marginTop:8}}>Active eyedrop target: <b>{activeTarget}</b></div>
        </div>

        <div className="panel">
          <div className="hstack" style={{marginBottom:8}}>
            {['POKÉMON','SHINY','MEGA'].map(t=> <div key={t} className="badge">{t}</div>)}
          </div>
          <CardRow region="Kanto" caught={9} />
          <CardRow region="Johto" caught={7} />
          <CardRow region="Hoenn" caught={11} />
        </div>
      </div>

      {/* Right side: controls */}
      <div className="vstack">
        <div className="panel">
          <div className="header"><h2>Palette</h2></div>

          <div className="toggle" style={{marginBottom:10}}>
            <input type="checkbox" id="rules" checked={enforceModRules} onChange={e=>setEnforceModRules(e.target.checked)} />
            <label htmlFor="rules">Enforce Mod Palette Rules</label>
          </div>

          <ColorRow label="Primary" color={primary} setColor={setPrimary} allowLinkBtn />
          <ColorRow label="Secondary" color={secondary} setColor={setSecondary} allowLinkBtn />
          <ColorRow label="Text" color={text} setColor={setText} allowLinkBtn />

          <div className="grid grid-2">
            <div className="panel">
              <div className="header"><h3 className="small">Secondary rule (from Primary)</h3></div>
              <label className="hstack small">Lighten L% <input className="range" type="range" min="-40" max="60" value={lightenPct} onChange={e=>setLightenPct(Number(e.target.value))}/></label>
              <label className="hstack small">Δ Saturation % <input className="range" type="range" min="-50" max="50" value={satChange} onChange={e=>setSatChange(Number(e.target.value))}/></label>
              {!enforceModRules && <div className="small" style={{opacity:.7}}>Rules are off; secondary will not auto-update.</div>}
            </div>
            <div className="panel">
              <div className="header"><h3 className="small">Text rule (contrast target)</h3></div>
              <label className="hstack small">Min contrast <input className="range" type="range" min="3" max="14" step="0.1" value={textThreshold} onChange={e=>setTextThreshold(Number(e.target.value))}/></label>
              <div className="small">Current contrast vs Primary: {contrast(text, primary).toFixed(2)}:1</div>
              {!enforceModRules && <div className="small" style={{opacity:.7}}>Rules are off; text will not auto-adjust.</div>}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Exports</h3>
          <div className="small">CSS variables</div>
          <pre>{exportCSS}</pre>
          <button className="button" onClick={()=>copy(exportCSS)}>Copy CSS</button>
          <div className="small" style={{marginTop:10}}>JSON</div>
          <pre>{exportJSON}</pre>
          <button className="button" onClick={()=>copy(exportJSON)}>Copy JSON</button>
        </div>
      </div>
    </div>
  )
}
