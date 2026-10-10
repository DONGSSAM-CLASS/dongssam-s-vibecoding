import * as THREE from 'three';
import { makeCanvas, toTex } from './textures.js';
import { tfbm } from './util.js';

// 큰 구조는 history.js의 소장품 설명·공식 사진과 대조했다.
// 세부 조각은 교육용 간략화. 박물관 3D 스캔 또는 측량 모델이 아니다.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(g, geo, mat, p = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p); m.scale.set(...s); g.add(m); return m;
}
function tube(g, points, r, mat, steps = 32) {
  return mesh(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => V(...p))), steps, r, 6, false), mat);
}
function oval(g, mat, p, s, segments = 12) {
  return mesh(g, new THREE.SphereGeometry(1, segments, 6), mat, p, s);
}

export function historicalCenser() {
  const g = new THREE.Group();
  const surface=makeCanvas(256,256),ctx=surface.getContext('2d'),pixels=ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const n=tfbm(x/23,y/23,71,3),i=(y*256+x)*4;
    pixels.data[i]=92+100*n;pixels.data[i+1]=70+94*n;pixels.data[i+2]=43+71*n;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const map=toTex(surface);
  const bronze = new THREE.MeshStandardMaterial({ map, metalness: .82, roughness: .54 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x655333, metalness: .72, roughness: .6 });
  // 얇고 넓은 용 받침: 몸을 말고 솟아올라 연꽃 줄기를 문다.
  tube(g, [[-.09,.012,.02],[-.05,.014,.085],[.065,.014,.065],[.08,.02,-.04],[.01,.027,-.055],[-.025,.05,-.01],[-.018,.12,.01],[0,.185,.015]], .011, bronze, 64);
  oval(g, bronze, [0,.185,.018], [.018,.024,.029]);
  oval(g, dark, [0,.183,.04], [.014,.006,.016]);
  for (const s of [-1, 1]) {
    tube(g, [[s*.017,.195,.003],[s*.026,.215,-.012],[s*.03,.235,-.03]], .003, bronze);
    tube(g, [[s*.038,.035,.033],[s*.06,.014,.015],[s*.096,.009,.04]], .005, bronze);
    tube(g, [[s*.01,.09,.014],[s*.035,.065,.027],[s*.05,.02,.06]], .006, bronze);
    for(let j=0;j<3;j++) tube(g, [[s*.09,.008,.04],[s*(.099+j*.003),.007,.031+j*.01]], .002, bronze, 8);
    tube(g, [[s*.012,.18,.04],[s*.036,.16,.06],[s*.041,.145,.075]], .002, bronze);
  }
  for(let i=0;i<9;i++) oval(g, bronze, [0,.04+i*.014,-.023], [.009,.012,.012], 8);
  tube(g, [[0,.205,0],[0,.223,0]], .008, bronze, 8);
  // 아래쪽 연꽃은 둥근 그릇. 세 줄의 꽃잎이 위로 겹친다.
  const bowl = [[.008,.22],[.026,.23],[.052,.245],[.073,.27],[.086,.3],[.093,.337],[.092,.347]].map(p=>new THREE.Vector2(...p));
  mesh(g, new THREE.LatheGeometry(bowl, 64), bronze);
  for(let row=0;row<3;row++) {
    const n=8+row*4, rad=[.046,.078,.092][row], y=.243+row*.033;
    for(let k=0;k<n;k++) {
      const a=k/n*Math.PI*2+row*.18;
      const petal=oval(g, bronze, [Math.sin(a)*rad,y,Math.cos(a)*rad], [.018,.03,.006]);
      petal.rotation.set(.22, a, 0);
      tube(g, [[Math.sin(a)*rad,y-.022,Math.cos(a)*rad],[Math.sin(a)*(rad+.006),y,Math.cos(a)*(rad+.006)],[Math.sin(a)*rad,y+.026,Math.cos(a)*rad]], .001, dark, 10);
    }
  }
  for(const y of [.34,.347,.354]) mesh(g,new THREE.TorusGeometry(.093,.0017,6,64),bronze,[0,y,0]).rotation.x=Math.PI/2;
  // 산형 뚜껑. 원본의 모든 봉우리·인물·동물 수를 재현했다고 주장하지 않는다.
  const lid=[[.093,.35],[.086,.38],[.07,.42],[.051,.46],[.03,.5],[.008,.525]].map(p=>new THREE.Vector2(...p));
  mesh(g,new THREE.LatheGeometry(lid,64),bronze);
  for(let row=0;row<4;row++) {
    const n=[12,10,8,5][row], rad=[.081,.067,.048,.027][row], y=[.37,.406,.444,.48][row];
    for(let k=0;k<n;k++) {
      const a=k/n*Math.PI*2+row*.3;
      const peakPts=[[.018,0],[.017,.016],[.01,.04],[.006,.054],[0,.067]].map(p=>new THREE.Vector2(...p));
      const mountain=new THREE.LatheGeometry(peakPts,12);
      const position=mountain.attributes.position;
      for(let i=0;i<position.count;i++){
        const xx=position.getX(i),zz=position.getZ(i),yy=position.getY(i),fold=1+.26*Math.sin(Math.atan2(xx,zz)*3+k);
        position.setXYZ(i,xx*fold+yy*.13*Math.cos(a),yy,zz*fold+yy*.13*Math.sin(a));
      }
      mountain.computeVertexNormals();
      const p=mesh(g,mountain,bronze,[Math.sin(a)*rad,y,Math.cos(a)*rad]);
      p.rotation.set(.18*Math.cos(a),0,-.18*Math.sin(a));
      oval(g,dark,[Math.sin(a)*(rad+.006),y+.008,Math.cos(a)*(rad+.006)],[.007,.011,.005],8);
    }
  }
  // 정상 가까이에 다섯 악사(얼굴·악기는 도식화).
  for(let k=0;k<5;k++) {
    const a=k/5*Math.PI*2, x=Math.sin(a)*.031,z=Math.cos(a)*.031;
    oval(g,bronze,[x,.518,z],[.004,.005,.004],10);
    oval(g,bronze,[x,.505,z],[.005,.009,.004],10);
    const instrument=mesh(g,new THREE.BoxGeometry(.014,.002,.004),dark,[x,.505,z+.004]); instrument.rotation.y=-a;
  }
  // 봉황: 구슬 위 다리, 구부러진 목, 머리와 볏, 뒤로 길게 솟은 꼬리.
  oval(g,bronze,[0,.532,0],[.011,.01,.011]);
  for(const s of [-1,1]) tube(g,[[s*.004,.541,0],[s*.004,.557,0]],.002,bronze,8);
  oval(g,bronze,[0,.566,0],[.012,.02,.012]);
  tube(g,[[0,.57,.008],[0,.587,.018],[0,.601,.013],[0,.6,.004]],.004,bronze,20);
  oval(g,bronze,[0,.602,.009],[.005,.006,.007]);
  tube(g,[[0,.603,.012],[0,.601,.025]],.002,bronze,8);
  for(const s of [-1,1]) {
    const w=oval(g,bronze,[s*.01,.568,-.004],[.004,.018,.015]); w.rotation.z=-s*.22;
    for(let j=0;j<3;j++) tube(g,[[s*.009,.558,-.007],[s*(.015+j*.004),.576,-.033],[s*(.018+j*.004),.611,-.055-j*.004]],.002,bronze,20);
  }
  tube(g,[[0,.605,.003],[0,.618,-.005]],.002,bronze,8);
  return g;
}

export function historicalSundial() {
  const g = new THREE.Group(), R=.147; // 지평환 포함 지름 .352m, 높이 약 .14m
  const bronze=new THREE.MeshStandardMaterial({color:0x292720,metalness:.78,roughness:.48,side:THREE.DoubleSide});
  const silver=new THREE.MeshStandardMaterial({color:0xc9c8b8,metalness:.85,roughness:.36});
  // 얕은 오목 시반. 내부까지 보이며 지평환은 수평이다.
  const pts=[];
  for(let i=0;i<=32;i++) {const r=R*i/32;pts.push(new THREE.Vector2(r,-.112+.09*(r/R)**2));}
  mesh(g,new THREE.LatheGeometry(pts,80),bronze);
  mesh(g,new THREE.RingGeometry(R,.176,80).rotateX(-Math.PI/2),bronze,[0,-.022,0]);
  const onBowl=(x,z)=>[x,-.112+.09*((x*x+z*z)/(R*R))+.0007,z];
  // 13개 절기선과 시각선: 원본의 은상감 격자를 간략화한 시각 자료.
  for(let k=-6;k<=6;k++) {
    const z=k*.019, len=Math.sqrt(R*R-z*z)*.97, line=[];
    for(let i=0;i<=48;i++){const x=-len+2*len*i/48;line.push(onBowl(x,z));}
    tube(g,line,.00055,silver,48);
  }
  for(let k=-5;k<=5;k++) {
    const x=k*.023, len=Math.sqrt(R*R-x*x)*.97,line=[];
    for(let i=0;i<=48;i++){const z=-len+2*len*i/48;line.push(onBowl(x,z));}
    tube(g,line,.0005,silver,48);
  }
  // 남쪽 바닥에서 북극 방향으로. 표준시와 자동 연동되는 측정기는 아니다.
  const latitude=(37+20/60)*Math.PI/180, needleLen=.13;
  const end=[0,-.022,-.015], start=[0,end[1]-Math.sin(latitude)*needleLen,end[2]+Math.cos(latitude)*needleLen];
  tube(g,[start,end],.002,silver,8);
  for(let k=0;k<4;k++) {
    const a=k*Math.PI/2+Math.PI/4, x=Math.sin(a),z=Math.cos(a);
    tube(g,[[x*.115,-.059,z*.115],[x*.148,-.107,z*.148],[x*.135,-.139,z*.135]],.007,bronze,20);
    oval(g,bronze,[x*.14,-.134,z*.14],[.012,.004,.016],12);
  }
  return g;
}
