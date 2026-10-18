// Controlled reconstruction of historical spell primitives, not old gameplay.
// Run from the repository root with Vite on :5173.
import { chromium } from 'playwright';
const browser = await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:840}});
  await page.goto('http://localhost:5173/');
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    document.body.innerHTML = `<main style="font:18px system-ui;color:#28343e;padding:28px;background:#eae7df;height:100vh"><h1 style="font-size:28px">Historical spell materials · controlled reconstruction</h1><p>Same light background, camera and specimen positions. Only historical geometry/material recipes vary. This is not a replay of an old fight.</p><div style="display:grid;grid-template-columns:repeat(3,1fr);text-align:center;font-weight:700"><div>Before separation refactor<br><small>6f70b0b^ · additive halo / bright ice edges</small></div><div>After separation refactor<br><small>6f70b0b · normal alpha / simplified ice</small></div><div>Round 2 C<br><small>1175edf · same fire / dark ice edges</small></div></div><canvas></canvas><p>Top: fireball layers. Bottom: falling ice body and edges. Lighting, old particle motion and whole-scene appearance are outside this study.</p></main>`;
    const canvas = document.querySelector('canvas'); canvas.style.cssText='display:block;width:1360px;height:500px';
    const renderer = new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true}); renderer.setSize(1360,500); renderer.setPixelRatio(1);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeae7df);
    const camera = new THREE.OrthographicCamera(-180,180,66,-66,0.1,1000); camera.position.set(0,0,300);camera.lookAt(0,0,0);
    const layers = [[0.55,0xffb040,1],[0.85,0xff5008,0.55],[1.1,0xc02000,0.35],[1.35,0x600400,0.18]];
    for(let col=0;col<3;col++) {
      const x = (col-1)*120;
      for(const [scale,color,opacity] of layers) {
        const material = new THREE.MeshBasicMaterial({color,transparent:col===0?opacity<1:true,opacity,blending:col===0&&opacity<1?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:col===0?opacity>=1:false,side:col===0?THREE.FrontSide:THREE.DoubleSide});
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(14*scale,col===0?16:12,col===0?12:8),material);sphere.position.set(x,32,0);scene.add(sphere);
      }
      const geo = new THREE.OctahedronGeometry(12);geo.scale(0.7,3,0.7);
      const mat = new THREE.MeshBasicMaterial({color:0xb8e4ff,transparent:true,opacity:col===0?0.4:0.7,blending:col===0?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:false,side:col===0?THREE.FrontSide:THREE.DoubleSide});
      const ice = new THREE.Mesh(geo,mat);ice.position.set(x,-31,0);ice.rotation.y=0.45; scene.add(ice);
      if(col!==1) {const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:col===0?0xeaffff:0x174b79,transparent:col===0,opacity:col===0?0.85:1}));ice.add(edge);}
    }
    renderer.render(scene,camera);
  });
  await page.screenshot({path:'public/experiments/art-direction-v1/diagnostics/historical-materials.png'});
} finally {await browser.close();}
