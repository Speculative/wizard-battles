import * as T from 'three';
import type { ArtStyle } from './artDirection';

// Round two is additive: the first-round construction paths remain untouched.
const mat = (color: number, roughness = .55, metalness = 0) => new T.MeshStandardMaterial({color, roughness, metalness, side:T.DoubleSide});
const light = (color: number, opacity = 1) => new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1,side:T.DoubleSide});
function mesh(g:T.Group, geometry:T.BufferGeometry, material:T.Material, pos=[0,0,0]) {
  const m=new T.Mesh(geometry,material);m.position.set(pos[0],pos[1],pos[2]);g.add(m);return m;
}
function box(g:T.Group,color:number,size:number[],pos:number[],rough=.6) { const m=mesh(g,new T.BoxGeometry(size[0],size[1],size[2]),mat(color,rough),pos);m.receiveShadow=true;return m; }
function stroke(g:T.Group,pts:number[],color:number,opacity=1) {
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));
  const line=new T.LineSegments(geo,new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));g.add(line);return line;
}
function circle(g:T.Group,r:number,width:number,color:number,y=.5,opacity=1) {
  const m=mesh(g,new T.RingGeometry(r-width,r,96),light(color,opacity),[0,y,0]);m.rotation.x=-Math.PI/2;return m;
}
function edge(g:T.Group,m:T.Mesh,color:number,opacity=1) {
  const e=new T.LineSegments(new T.EdgesGeometry(m.geometry,20),new T.LineBasicMaterial({color,transparent:opacity<1,opacity}));
  e.position.copy(m.position);e.rotation.copy(m.rotation);e.scale.copy(m.scale);g.add(e);return e;
}
function family(s:ArtStyle) {return s.family!;}

export function revisedArena(s:ArtStyle):T.Group {
  const g=new T.Group();g.name=`art-room:${s.id}`;
  const f=family(s);
  box(g,s.floor,[1000,22,1000],[0,-13,0],f==='porcelain'?.23:.8);
  box(g,s.wall,[1000,350,14],[0,175,-507]);box(g,s.wall,[14,350,1000],[-507,175,0]);
  // All dressing stays outside the gameplay surface or sits flush with it.
  if(f==='porcelain') {
    // Celadon alcoves, warm ceramic ribs and a quiet inlaid practice circle.
    for(const x of [-330,0,330]) {
      box(g,0x659493,[282,242,5],[x,192,-498]);
      box(g,0xe7eadb,[249,203,8],[x,192,-493],.2);
      for(const dx of [-139,139]) box(g,0xf8e8c8,[12,274,18],[x+dx,175,-486],.25);
      box(g,0xb3c9bc,[210,8,10],[x,82,-485]);
    }
    for(const z of [-330,0,330]) box(g,0x9fbab0,[10,270,10],[-491,175,z]);
    circle(g,355,2,s.accent,.2,.5);circle(g,370,1,s.accent,.2,.22);
    for(const p of [-500,500]) {box(g,0xa4bdb0,[1000,5,8],[0,0,p]);box(g,0xa4bdb0,[8,5,1000],[p,0,0]);}
    // The warm key and cool fill shape the ceramics without painted shadows.
  } else if(f==='photon') {
    // Preserve the owner's preferred dark room and luminous contrast; refine
    // the calibration system rather than adding a new layer of spectacle.
    for(const p of [-400,-200,0,200,400]) stroke(g,[p,.3,-500,p,.3,500,-500,.3,p,500,.3,p],s.line,.5);
    for(const p of [-500,500]) {box(g,s.accent,[1000,2,3],[0,.1,p]);box(g,s.accent,[3,2,1000],[p,.1,0]);}
    for(const x of [-350,0,350]) {
      const dial=mesh(g,new T.TorusGeometry(48,.9,5,64),light(s.accent,.55),[x,210,-497]);
      const inner=mesh(g,new T.TorusGeometry(39,.7,5,64,Math.PI*1.5),light(s.accent,.28),[x,210,-496]);inner.rotation.z=x/100;
      stroke(g,[x-61,210,-494,x-51,210,-494,x+51,210,-494,x+61,210,-494,x,149,-494,x,159,-494,x,261,-494,x,271,-494],s.accent,.7);
      dial.name='calibration-dial';
    }
    for(let i=0;i<20;i++) {const p=-475+i*50;stroke(g,[p,.5,-480,p+14,.5,-480,-480,.5,p,-480,.5,p+14],s.accent,.38);}
  } else if(f==='observatory') {
    // A vaulted astronomy classroom. Repeated arches and a central orrery
    // provide architecture, not machinery or a field of competing symbols.
    for(const x of [-330,0,330]) {
      box(g,0x29263e,[272,223,5],[x,150,-498]);
      const arch=mesh(g,new T.TorusGeometry(111,4,6,48,Math.PI),mat(s.accent,.4,.55),[x,215,-488]);arch.rotation.z=0;
      for(const dx of [-111,111]) box(g,s.accent,[7,190,7],[x+dx,119,-488]);
      box(g,0x5a4d68,[264,14,21],[x,22,-483]);
      const orbit=mesh(g,new T.TorusGeometry(x===0?53:31,1.3,5,64),mat(s.accent,.4,.6),[x,174,-485]);orbit.rotation.y=.5;
      const cross=mesh(g,new T.TorusGeometry(x===0?41:22,1,5,48),mat(s.accent,.4,.6),[x,174,-482]);cross.rotation.x=.7;
      mesh(g,new T.OctahedronGeometry(x===0?9:5),light(0xd8e6d0),[x,174,-479]);
    }
    circle(g,360,1.5,s.accent,.1,.34);circle(g,451,1,s.accent,.1,.27);
    for(let i=0;i<24;i++){const a=i*Math.PI/12;stroke(g,[Math.cos(a)*438,.4,Math.sin(a)*438,Math.cos(a)*451,.4,Math.sin(a)*451],s.accent,.65);}
    for(const z of [-330,0,330]) {box(g,0x554860,[9,310,14],[-490,168,z]);mesh(g,new T.OctahedronGeometry(8),light(0x90d4c6),[-480,275,z]);}
  } else if(f==='paper') {
    // Explicit cut-and-fold card stage: visible thickness, bent tabs, seams
    // and a strong warm key; the bodies remain low-poly as the owner liked.
    for(const x of [-330,0,330]) {
      const sheet=box(g,0xe7cfa7,[310,278,7],[x,181,-492]);sheet.rotation.z=x/20000;
      const inner=box(g,0xf5e6c9,[285,248,3],[x,181,-486]);inner.rotation.z=sheet.rotation.z;
      for(const dx of [-133,133]) {const tab=box(g,s.accent,[26,44,3],[x+dx,67,-477]);tab.rotation.x=.35;}
      const medallion=mesh(g,new T.CircleGeometry(48,6),mat(s.accent,1),[x,208,-478]);medallion.rotation.z=Math.PI/6;
      stroke(g,[x-25,208,-475,x+25,208,-475,x,183,-475,x,233,-475],0xf5e6c9);
    }
    for(const z of [-330,0,330]) {const panel=box(g,0xd1d7ba,[5,260,310],[-493,181,z]);panel.rotation.x=.025;}
    // Folded corner gussets expose the stage's construction at viewing scale.
    for(const x of [-440,440]) {
      const fold=mesh(g,new T.ConeGeometry(48,92,3),mat(0xf2ddb7,1),[x,304,-480]);fold.rotation.z=Math.PI/2;fold.rotation.x=Math.PI/6;
      edge(g,fold,0xb59669,.55);
    }
    for(const p of [-333,0,333]) stroke(g,[p,-1,-500,p,-1,500,-500,-1,p,500,-1,p],0xc5a77c,.4);
    circle(g,360,2,0xb59b72,.2,.45);
    for(const x of [-480,480]) for(const z of [-480,480]) {const tab=box(g,0xd7bd91,[32,12,42],[x,3,z]);tab.rotation.z=x>0?.25:-.25;}
  } else {
    // Recast the foundry as a mineral atelier. Keep dense molten / fractured
    // spell forms, remove bolts, busbars, vents and hazard-strip factory cues.
    for(const x of [-330,0,330]) {
      box(g,0x293d40,[275,238,5],[x,183,-498]);
      for(const dx of [-143,143]) box(g,0x416263,[12,300,22],[x+dx,154,-487]);
      const crest=mesh(g,new T.OctahedronGeometry(47),mat(s.accent,.38,.25),[x,204,-482]);crest.scale.set(1,1.4,.12);edge(g,crest,0xc2cba3,.55);
      box(g,0x809889,[194,9,40],[x,63,-475]);
    }
    for(const z of [-330,0,330]) box(g,0x416263,[18,300,12],[-487,154,z]);
    circle(g,371,3,0x9ba88a,.1,.6);circle(g,385,1,0x9ba88a,.1,.3);
    for(const x of [-450,450]) for(const z of [-450,450]) {
      const stone=mesh(g,new T.DodecahedronGeometry(30,0),mat(0x48615c),[x,18,z]);stone.scale.y=.55;
      const crystal=mesh(g,new T.OctahedronGeometry(16),mat(s.ice,.25),[x,48,z]);crystal.scale.y=1.9;edge(g,crystal,s.iceCore,.5);
    }
  }
  return g;
}

export function revisedLighting(scene:T.Scene,s:ArtStyle) {
  const f=family(s);
  if (f === 'photon') return; // Keep the liked round-one high-contrast light rig.
  scene.traverse(node=>{
    if(node instanceof T.AmbientLight) {node.intensity=f==='porcelain'?.34:.3;node.color.setHex(f==='paper'?0xdce6e3:0xcfddeb);}
    if(node instanceof T.DirectionalLight) {node.intensity=f==='porcelain'?2.3:f==='paper'?2.1:1.35;node.color.setHex(f==='porcelain'||f==='paper'?0xffe3ad:0xdce5ff);node.position.set(-300,650,400);}
    if(node instanceof T.SpotLight) {node.intensity=1.7;node.color.setHex(f==='observatory'?0xd7d4ff:0xffffff);node.position.set(250,1000,350);node.penumbra=.65;node.shadow.normalBias=1.5;}
  });
  // Warm key / cool fill make surfaces read as objects rather than flat swatches.
  const fill=new T.DirectionalLight(f==='foundry'?0xa0d3c4:0xa8cbd4,.45);fill.position.set(500,280,-200);scene.add(fill);
}

export function revisedFigure(figure:T.Group,s:ArtStyle,id:string) {
  const color=s.fighters[Math.max(0,['red','blue','green','yellow'].indexOf(id))];
  const f=family(s);
  const [body,hat,brim,nose]=figure.children as T.Mesh[];
  for(const node of [body,hat,brim]) {(node.material as T.Material).dispose();node.material=mat(color,f==='paper'?1:s.roughness,s.metalness);}
  if(f==='photon') {
    // Preserve the round-one translucent shell and scanning latitude rings.
    for(const node of [body,hat,brim]) {
      const material=node.material as T.MeshStandardMaterial;material.emissive.setHex(color);material.emissiveIntensity=.22;material.transparent=true;material.opacity=.58;material.depthWrite=false;
      const wire=new T.LineSegments(new T.WireframeGeometry(node.geometry),new T.LineBasicMaterial({color,transparent:true,opacity:.19}));wire.scale.setScalar(1.06);node.add(wire);
    }
    for(const y of [-9,0,9]) circle(figure,Math.sqrt(400-y*y),.7,color,y,.7);
    (nose.material as T.Material).dispose();nose.material=light(color,.7);
  } else if(f==='observatory') {
    // Replace the spherical body, retaining the owner's liked hats and colors.
    body.geometry.dispose();body.geometry=new T.CylinderGeometry(12,23,36,7);body.position.y=-1;
    const robe=body.material as T.MeshStandardMaterial;robe.roughness=.82;robe.metalness=.04;
    const collar=mesh(figure,new T.TorusGeometry(11,1.8,6,24),mat(s.accent,.4,.5),[0,17,0]);collar.rotation.x=Math.PI/2;
    const sash=mesh(figure,new T.CylinderGeometry(14,16,7,7),mat(0x423650,.8),[0,2,0]);sash.name='scholar-sash';
    for(const a of [0,2*Math.PI/3,4*Math.PI/3]) {const x=Math.cos(a),z=Math.sin(a);stroke(figure,[x*12,16,z*12,x*22,-19,z*22],s.accent,.72);}
    mesh(figure,new T.OctahedronGeometry(4),light(s.accent),[11,45,5]);
  } else if(f==='paper') {
    body.geometry.dispose();body.geometry=new T.IcosahedronGeometry(20,0);
    edge(figure,body,0xf6dfb4,.75);
    // Raised card brim and visibly folded, asymmetric hat.
    hat.geometry.dispose();hat.geometry=new T.ConeGeometry(21,34,4);hat.rotation.z=-.12;
    brim.geometry.dispose();brim.geometry=new T.CylinderGeometry(27,27,2.8,6);edge(figure,hat,0xffe8c5,.75);
    const seam=mesh(figure,new T.BoxGeometry(2,31,1),mat(0xf4dfb9,1),[9,30,10]);seam.rotation.z=-.25;
    (nose.material as T.Material).dispose();nose.material=mat(0xe7c59a,1);
  } else if(f==='porcelain') {
    const glaze=body.material as T.MeshStandardMaterial;glaze.roughness=.16;glaze.metalness=.06;
    const band=mesh(figure,new T.TorusGeometry(21,1.4,6,40),mat(0xf2dfb0,.25),[0,5,0]);band.rotation.x=Math.PI/2;
    (nose.material as T.Material).dispose();nose.material=mat(0xe8c798,.35);
  } else {
    body.geometry.dispose();body.geometry=new T.DodecahedronGeometry(20,1);
    const bodyMat=body.material as T.MeshStandardMaterial;bodyMat.roughness=.5;bodyMat.metalness=.15;
    const band=mesh(figure,new T.TorusGeometry(20.5,1.5,5,32),mat(s.accent,.35,.2),[0,-3,0]);band.rotation.x=Math.PI/2;
  }
  const band=mesh(figure,new T.CylinderGeometry(18,18,3,f==='paper'?4:24),mat(s.accent,.4,.3),[0,26,0]);band.name='hat-band';
}

export function revisedProjectile(s:ArtStyle,r:number,ice:boolean) {
  const g=new T.Group(),f=family(s),c=ice?s.ice:s.fire,k=ice?s.iceCore:s.fireCore;
  const add=(geo:T.BufferGeometry,color:number,opacity=1)=>mesh(g,geo,light(color,opacity));
  if(f==='photon') {
    const needle=add(new T.OctahedronGeometry(r),k);needle.scale.set(ice?3.5:2.5,.4,.4);
    const sheath=add(new T.OctahedronGeometry(r),c,.34);sheath.scale.set(4,.8,.8);
    for(const m of [needle,sheath]) (m.material as T.MeshBasicMaterial).blending=T.AdditiveBlending;
    // Keep distinct needle silhouettes. One open bracket replaces stacked hoops.
    const bracket=add(new T.TorusGeometry(r*.8,.65,5,24,Math.PI*1.5),c,.7);bracket.rotation.y=Math.PI/2;bracket.position.x=-r*1.2;
  } else if(f==='observatory') {
    const body=add(new T.OctahedronGeometry(r),c);body.scale.set(ice?2.8:1.65,.65,.65);edge(g,body,k,.75);
    const core=add(new T.OctahedronGeometry(r*.6),k);core.position.x=r*.55;core.scale.set(1.9,.6,.6);
    if(!ice) {const orbit=add(new T.TorusGeometry(r*1.18,.8,5,32),s.accent,.65);orbit.rotation.y=Math.PI/3;}
  } else if(f==='paper') {
    // Four folded, solid card facets: thickness and creases instead of crossed
    // unlit planes. Warm edges stay visible against the ruled card floor.
    const head=mesh(g,new T.OctahedronGeometry(r),mat(c,1));head.scale.set(ice?2.8:2,.8,.65);edge(g,head,k);
    const inset=mesh(g,new T.OctahedronGeometry(r*.6),mat(k,1));inset.scale.set(1.8,.7,.7);inset.position.x=r*.45;
    if(!ice)for(const z of [-.3,.3]) {const tail=mesh(g,new T.ConeGeometry(r*.5,r*2.3,3),mat(c,1));tail.rotation.z=Math.PI/2;tail.position.set(-r,z*r,r*z);}
  } else if(ice) {
    const body=mesh(g,new T.OctahedronGeometry(r),mat(c,.18,.12));body.scale.set(2.6,.7,.7);edge(g,body,k,.8);
    const core=add(new T.OctahedronGeometry(r*.48),k);core.scale.set(2.7,.6,.6);core.position.z=r*.48;
  } else {
    // Foundry keeps its dense molten silhouette. Porcelain now uses a glazed
    // orange shell with a warm core rather than several flat saturated disks.
    const body=mesh(g,new T.SphereGeometry(r,f==='porcelain'?20:7,8),f==='porcelain'?mat(c,.2):light(c));body.scale.set(1.5,.85,.85);
    const core=add(new T.SphereGeometry(r*.64,f==='porcelain'?20:7,8),k);core.position.x=r*.65;
    for(let i=0;i<3;i++){const t=add(new T.ConeGeometry(r*(.45-i*.08),r*(2.7-i*.3),f==='porcelain'?12:7),i===1?k:c);t.rotation.z=Math.PI/2;t.position.set(-r*(.7+i*.15),(i-1)*r*.5,0);}
  }
  return {group:g,update(time:number,frozen:boolean){g.scale.setScalar(frozen ? .9+.1*Math.sin(time*10) : 1);g.rotation.x=f==='paper'?.18*Math.sin(time*7):time*(f==='photon'?4:2);}};
}

export function revisedShard(s:ArtStyle) {
  const g=new T.Group(),f=family(s);
  if(f==='photon') {
    const blade=mesh(g,new T.OctahedronGeometry(22),light(s.ice,.28));blade.scale.set(.6,3,.6);(blade.material as T.MeshBasicMaterial).blending=T.AdditiveBlending;edge(g,blade,s.iceCore,.8);
    const core=mesh(g,new T.OctahedronGeometry(11),light(s.iceCore),[0,0,4]);core.scale.set(.45,5,.45);
  } else {
    const body=mesh(g,new T.OctahedronGeometry(22),mat(s.ice,f==='paper'?1:.19,.08));body.scale.set(.7,3,.7);edge(g,body,f==='paper'?0xd6e7d4:s.iceCore,f==='observatory'?.65:.9);
    const face=mesh(g,new T.OctahedronGeometry(12),f==='paper'?mat(s.iceCore,1):light(s.iceCore),[3,-4,10]);face.scale.set(.65,4,.35);
    if(f==='observatory'){const orbit=mesh(g,new T.TorusGeometry(24,.7,5,48),light(s.accent,.65));orbit.rotation.x=.9;}
    if(f==='foundry')for(const x of [-15,16]) {const chip=mesh(g,new T.OctahedronGeometry(10),mat(s.ice,.25));chip.scale.y=3.2;chip.position.set(x,10,2);edge(g,chip,s.iceCore,.45);}
  }
  return g;
}
