import { useEffect, useRef } from 'react'

function buildPallets(ruta) {
  const n = ruta.palets
  const zceEach = Math.round(ruta.zce / n)
  const retEach  = Math.round(ruta.retornables / n)
  const baseKg   = Math.round(zceEach * 0.55 + retEach * 0.28 + 75)
  return Array.from({ length: n }, (_, i) => ({
    content: i % 2 === 0
      ? `Retornables — ${retEach} ud.`
      : `ZCE Lote ${String.fromCharCode(65 + i)} — ${zceEach} cj.`,
    weight: `${baseKg + (i - Math.floor(n / 2)) * 12} KG`,
  }))
}

function html6P(pallets) {
  const data = JSON.stringify(pallets)
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{margin:0;overflow:hidden;background:#050505;font-family:'Segoe UI',sans-serif;}
  #info{position:absolute;top:20px;left:20px;color:#fff;background:rgba(10,15,20,.85);padding:20px 24px;border:1px solid #4a90e2;border-radius:4px;display:none;pointer-events:none;z-index:10;box-shadow:0 0 15px rgba(74,144,226,.3);backdrop-filter:blur(4px);}
  #info h3{margin:0 0 8px;color:#4a90e2;border-bottom:1px solid #4a90e2;padding-bottom:7px;font-size:13px;letter-spacing:.5px;}
  #info p{margin:0;font-size:13px;line-height:1.5;color:#ddd;}
  #title{position:absolute;bottom:24px;width:100%;text-align:center;color:#fff;pointer-events:none;}
  #title h2{margin:0 0 4px;letter-spacing:4px;font-weight:300;font-size:14px;}
  #title p{color:#666;font-size:12px;}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head><body>
<div id="info"><h3 id="it">Palet #</h3><p id="ic"></p><p id="iw" style="color:#8ac926;margin-top:5px;font-weight:700;"></p></div>
<div id="title"><h2>CAMIÓN MEDIANO · 6 PALETS</h2><p>Arrastra para rotar · Clic en los palets</p></div>
<script>
const palletData=${data};
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x050505,.03);
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.05;
const g=new THREE.Group();scene.add(g);
const lm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.5});
const hm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9});
function ep(geo,mat,x,y,z){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),mat);e.position.set(x,y,z);g.add(e);return e;}
ep(new THREE.BoxGeometry(2.6,2.6,4.2),lm,0,2.0,.1);
ep(new THREE.BoxGeometry(1.0,.2,6.8),hm,0,.6,1.4);
ep(new THREE.BoxGeometry(2.6,1.2,2.0),lm,0,1.3,3.8);
ep(new THREE.BoxGeometry(2.6,.8,1.4),lm,0,2.3,3.5);
const wg=new THREE.CylinderGeometry(.45,.45,.6,16);
[[1.3,.45,3.8],[-1.3,.45,3.8],[1.3,.45,-1.0],[-1.3,.45,-1.0]].forEach(p=>{const w=new THREE.LineSegments(new THREE.EdgesGeometry(wg),hm);w.rotation.z=Math.PI/2;w.position.set(p[0],p[1],p[2]);g.add(w);});
scene.add(new THREE.GridHelper(20,20,0x444444,0x222222));
const pallets=[];const bx=new THREE.BoxGeometry(.95,.95,.95);
const colors=[0xff595e,0xffca3a,0x8ac926,0x1982c4,0x6a4c93,0xe07a5f];
let id=0;for(let r=0;r<3;r++){for(let c=0;c<2;c++){
  const mat=new THREE.MeshBasicMaterial({color:colors[id],transparent:true,opacity:.9});
  const box=new THREE.Mesh(bx,mat);
  box.add(new THREE.LineSegments(new THREE.EdgesGeometry(bx),new THREE.LineBasicMaterial({color:0xffffff})));
  box.position.set(c===0?-.6:.6,1.3,(r*1.2)-.7);
  box.userData={id:id+1,content:palletData[id]?.content||'Carga',weight:palletData[id]?.weight||'—'};
  g.add(box);pallets.push(box);id++;}}
camera.position.set(-6,4,7);
const rc=new THREE.Raycaster();const mouse=new THREE.Vector2();
window.addEventListener('click',e=>{
  mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  rc.setFromCamera(mouse,camera);
  const ix=rc.intersectObjects(pallets);
  if(ix.length>0){const s=ix[0].object;
    document.getElementById('it').innerText='Palet #'+s.userData.id;
    document.getElementById('ic').innerText='Contenido: '+s.userData.content;
    document.getElementById('iw').innerText='Peso: '+s.userData.weight;
    pallets.forEach(p=>{p.material.opacity=.15;p.scale.set(1,1,1);});
    s.material.opacity=1;s.scale.set(1.07,1.07,1.07);
    document.getElementById('info').style.display='block';
  } else {pallets.forEach(p=>{p.material.opacity=.9;p.scale.set(1,1,1);});document.getElementById('info').style.display='none';}
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
</script></body></html>`
}

function html8P(pallets) {
  const data = JSON.stringify(pallets)
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{margin:0;overflow:hidden;background:#050505;font-family:'Segoe UI',sans-serif;}
  #info{position:absolute;top:20px;left:20px;color:#fff;background:rgba(10,15,20,.85);padding:20px 24px;border:1px solid #4a90e2;border-radius:4px;display:none;pointer-events:none;z-index:10;box-shadow:0 0 15px rgba(74,144,226,.3);backdrop-filter:blur(4px);}
  #info h3{margin:0 0 8px;color:#4a90e2;border-bottom:1px solid #4a90e2;padding-bottom:7px;font-size:13px;letter-spacing:.5px;text-transform:uppercase;}
  #info p{margin:0;font-size:13px;line-height:1.5;color:#ddd;}
  #title{position:absolute;bottom:24px;width:100%;text-align:center;color:#fff;pointer-events:none;}
  #title h2{margin:0 0 4px;letter-spacing:4px;font-weight:300;font-size:14px;text-shadow:0 0 10px rgba(255,255,255,.4);}
  #title p{color:#666;font-size:12px;letter-spacing:1px;}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head><body>
<div id="info"><h3 id="it">Palet #</h3><p id="ic"></p><p id="iw" style="color:#8ac926;margin-top:5px;font-weight:700;"></p></div>
<div id="title"><h2>CAMIÓN GRANDE · 8 PALETS</h2><p>Arrastra para rotar · Clic en los palets</p></div>
<script>
const palletData=${data};
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x050505,.03);
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.05;controls.maxPolarAngle=Math.PI/2+.1;
const g=new THREE.Group();scene.add(g);
const lm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.5,linewidth:2});
const hm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9,linewidth:2});
function ep(geo,mat,x,y,z){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),mat);e.position.set(x,y,z);g.add(e);return e;}
ep(new THREE.BoxGeometry(2.6,2.6,5.6),lm,0,2.0,-.6);
ep(new THREE.BoxGeometry(1.0,.2,8.2),hm,0,.6,.7);
ep(new THREE.BoxGeometry(2.6,1.2,2.0),lm,0,1.3,3.8);
ep(new THREE.BoxGeometry(2.6,.8,1.4),lm,0,2.3,3.5);
const wg=new THREE.CylinderGeometry(.45,.45,.6,16);
[[1.3,.45,3.8],[-1.3,.45,3.8],[1.3,.45,-1.2],[-1.3,.45,-1.2],[1.3,.45,-2.4],[-1.3,.45,-2.4]].forEach(p=>{const w=new THREE.LineSegments(new THREE.EdgesGeometry(wg),hm);w.rotation.z=Math.PI/2;w.position.set(p[0],p[1],p[2]);g.add(w);});
scene.add(new THREE.GridHelper(20,20,0x444444,0x222222));
const pallets=[];const bx=new THREE.BoxGeometry(.95,.95,.95);
const colors=[0xff595e,0xffca3a,0x8ac926,0x1982c4,0x6a4c93,0xe07a5f,0x3d405b,0x81b29a];
let id=0;for(let r=0;r<4;r++){for(let c=0;c<2;c++){
  const mat=new THREE.MeshBasicMaterial({color:colors[id],transparent:true,opacity:.9});
  const box=new THREE.Mesh(bx,mat);
  box.add(new THREE.LineSegments(new THREE.EdgesGeometry(bx),new THREE.LineBasicMaterial({color:0xffffff,linewidth:2})));
  box.position.set(c===0?-.6:.6,1.3,(r*1.2)-2.0);
  box.userData={id:id+1,content:palletData[id]?.content||'Carga',weight:palletData[id]?.weight||'—'};
  g.add(box);pallets.push(box);id++;}}
camera.position.set(-7,5,8);
const rc=new THREE.Raycaster();const mouse=new THREE.Vector2();
window.addEventListener('click',e=>{
  mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  rc.setFromCamera(mouse,camera);
  const ix=rc.intersectObjects(pallets);
  if(ix.length>0){const s=ix[0].object;
    document.getElementById('it').innerText='Palet #'+s.userData.id;
    document.getElementById('ic').innerText='Contenido: '+s.userData.content;
    document.getElementById('iw').innerText='Peso: '+s.userData.weight;
    pallets.forEach(p=>{p.material.opacity=.15;p.scale.set(1,1,1);});
    s.material.opacity=1;s.scale.set(1.07,1.07,1.07);
    document.getElementById('info').style.display='block';
  } else {pallets.forEach(p=>{p.material.opacity=.9;p.scale.set(1,1,1);});document.getElementById('info').style.display='none';}
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
</script></body></html>`
}

function htmlFurgo(pallets) {
  const data = JSON.stringify(pallets)
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body{margin:0;overflow:hidden;background:#050505;font-family:'Segoe UI',sans-serif;}
  #info{position:absolute;top:20px;left:20px;color:#fff;background:rgba(10,15,20,.85);padding:20px 24px;border:1px solid #4a90e2;border-radius:4px;display:none;pointer-events:none;z-index:10;box-shadow:0 0 15px rgba(74,144,226,.3);backdrop-filter:blur(4px);}
  #info h3{margin:0 0 8px;color:#4a90e2;border-bottom:1px solid #4a90e2;padding-bottom:7px;font-size:13px;letter-spacing:.5px;}
  #info p{margin:0;font-size:13px;line-height:1.5;color:#ddd;}
  #title{position:absolute;bottom:24px;width:100%;text-align:center;color:#fff;pointer-events:none;}
  #title h2{margin:0 0 4px;letter-spacing:4px;font-weight:300;font-size:14px;}
  #title p{color:#666;font-size:12px;}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head><body>
<div id="info"><h3 id="it">Palet #</h3><p id="ic"></p><p id="iw" style="color:#8ac926;margin-top:5px;font-weight:700;"></p></div>
<div id="title"><h2>FURGONETA · 3 PALETS</h2><p>Arrastra para rotar · Clic en los palets</p></div>
<script>
const palletData=${data};
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x050505,.03);
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.05;
const g=new THREE.Group();scene.add(g);
const lm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.5});
const hm=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9});
function ep(geo,mat,x,y,z){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),mat);e.position.set(x,y,z);g.add(e);return e;}
ep(new THREE.BoxGeometry(1.6,2.0,4.0),lm,0,1.6,.2);
ep(new THREE.BoxGeometry(1.0,.2,5.5),hm,0,.5,.95);
ep(new THREE.BoxGeometry(1.6,1.0,1.5),lm,0,1.1,2.95);
ep(new THREE.BoxGeometry(1.6,.8,1.0),lm,0,2.0,2.7);
const wg=new THREE.CylinderGeometry(.35,.35,.4,16);
[[.8,.35,2.95],[-.8,.35,2.95],[.8,.35,-.8],[-.8,.35,-.8]].forEach(p=>{const w=new THREE.LineSegments(new THREE.EdgesGeometry(wg),hm);w.rotation.z=Math.PI/2;w.position.set(p[0],p[1],p[2]);g.add(w);});
scene.add(new THREE.GridHelper(20,20,0x444444,0x222222));
const pallets=[];const bx=new THREE.BoxGeometry(.95,.95,.95);
const colors=[0xff595e,0xffca3a,0x1982c4];
for(let r=0;r<3;r++){
  const mat=new THREE.MeshBasicMaterial({color:colors[r],transparent:true,opacity:.9});
  const box=new THREE.Mesh(bx,mat);
  box.add(new THREE.LineSegments(new THREE.EdgesGeometry(bx),new THREE.LineBasicMaterial({color:0xffffff})));
  box.position.set(0,1.1,(r*1.2)-.8);
  box.userData={id:r+1,content:palletData[r]?.content||'Carga',weight:palletData[r]?.weight||'—'};
  g.add(box);pallets.push(box);}
camera.position.set(-5,3,6);
const rc=new THREE.Raycaster();const mouse=new THREE.Vector2();
window.addEventListener('click',e=>{
  mouse.x=(e.clientX/innerWidth)*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
  rc.setFromCamera(mouse,camera);
  const ix=rc.intersectObjects(pallets);
  if(ix.length>0){const s=ix[0].object;
    document.getElementById('it').innerText='Palet #'+s.userData.id;
    document.getElementById('ic').innerText='Contenido: '+s.userData.content;
    document.getElementById('iw').innerText='Peso: '+s.userData.weight;
    pallets.forEach(p=>{p.material.opacity=.15;p.scale.set(1,1,1);});
    s.material.opacity=1;s.scale.set(1.07,1.07,1.07);
    document.getElementById('info').style.display='block';
  } else {pallets.forEach(p=>{p.material.opacity=.9;p.scale.set(1,1,1);});document.getElementById('info').style.display='none';}
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
</script></body></html>`
}

function getHtml(ruta) {
  const pallets = buildPallets(ruta)
  if (ruta.tipo === '8P') return html8P(pallets)
  if (ruta.tipo === 'FURGO') return htmlFurgo(pallets)
  return html6P(pallets)
}

const TIPO_LABEL = { '6P': 'Camión Mediano', '8P': 'Camión Grande', 'FURGO': 'Furgoneta' }
const TIPO_COLOR = { '8P': '#a78bfa', '6P': '#38bdf8', 'FURGO': '#fb923c' }

export function TruckViewer3D({ ruta, onClose }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const html  = getHtml(ruta)
    const blob  = new Blob([html], { type: 'text/html' })
    const url   = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [ruta])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.72)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 'min(88vw, 1000px)', height: 'min(82vh, 680px)',
        background: '#050505',
        borderRadius: 14,
        border: `1px solid ${TIPO_COLOR[ruta.tipo]}44`,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 60px ${TIPO_COLOR[ruta.tipo]}22, 0 30px 80px rgba(0,0,0,.7)`,
      }}>
        {/* header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 18px',
          background: 'rgba(10,15,30,.95)',
          borderBottom: `1px solid ${TIPO_COLOR[ruta.tipo]}33`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px',
              borderRadius: 20, background: `${TIPO_COLOR[ruta.tipo]}1a`,
              color: TIPO_COLOR[ruta.tipo], border: `1px solid ${TIPO_COLOR[ruta.tipo]}44`,
            }}>{ruta.tipo}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#cfd5e6' }}>
              {TIPO_LABEL[ruta.tipo]} · {ruta.id}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(160,170,200,.5)' }}>
              {ruta.conductor} · {ruta.palets} palés · {ruta.zce} ZCE
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 8, color: '#8993ab', cursor: 'pointer',
            width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, lineHeight: 1,
          }}>×</button>
        </div>

        <iframe
          ref={iframeRef}
          title="truck-3d"
          style={{ flex: 1, border: 'none', display: 'block' }}
          sandbox="allow-scripts"
        />
      </div>
    </div>
  )
}
