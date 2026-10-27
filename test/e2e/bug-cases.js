// Focused regressions for the audited failures; no performance/coverage matrix.
export async function regressions(b) {
  const results = [];
  const check = (condition, message) => { if (!condition) throw Error(message); };
  const throws = fn => { let caught = false; try { fn(); } catch { caught = true; } check(caught, 'expected rejection'); };
  const canvas = b.createCanvas(256, 256, {parent: null});
  const gl = canvas.getContext('webgl2');
  const reset = () => {
    b.render(); b.load(canvas); b.clear('white'); b.noClip(); b.noFill(); b.noWash(); b.noHatch(); b.noMass(); b.noField(); b.noStroke();
    b.angleMode(b.DEGREES); b.seed(123);
  };
  const pixel = (x, y) => {
    const data = new Uint8Array(4);
    gl.readPixels(128 + x, 128 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data[0];
  };
  const run = async (name, fn) => {
    try { reset(); await fn(); results.push({name}); }
    catch (e) { results.push({name, error:e.message}); }
  };
  const poly = () => new b.Polygon([[-20,-20],[20,-20],[20,20],[-20,20]]);
  const params = {type:'marker',weight:12,scatter:0,spacing:2,opacity:255,pressure:[1,1],noise:0,markerTip:false};
  b.add('regression-solid', {...params});

  await run('B01/B02 bounded hatch, mass and spray', () => {
    for (const distance of [0,-1,NaN,Infinity]) throws(() => b.hatch(distance));
    throws(() => b.add('bad-spacing', {...params,spacing:0}));
    throws(() => b.scaleBrushes(0));
    b.add('zero-spray', {...params,type:'spray',grain:2,pressure:[0,0]});
    b.set('zero-spray','black'); b.line(-5,0,5,0);
    throws(() => b.flowLine(0,0,Infinity,0));
    b.noStroke(); b.mass('regression-solid','black',{strength:0,precision:1});
    b.rect(-5,-5,10,10); b.render();
    check(gl.getError() === 0, 'GL error after bounded edge cases');
  });
  await run('B03 clip, call-time transform, push/pop and noClip', () => {
    b.set('regression-solid','black');
    b.push(); b.translate(30,0); b.rotate(90); b.clip([-5,-20,5,20]); b.rotate(-90); b.translate(-30,0);
    b.line(-50,0,60,0); b.render();
    check(pixel(30,0) < 100 && pixel(0,0) === 255, 'transformed clip did not restrict stroke');
    b.pop(); b.clear('white'); b.line(-50,0,60,0); b.render();
    check(pixel(0,0) < 100, 'pop did not restore unclipped state');
    b.clip([-5,-5,5,5]); b.noClip(); b.clear('white'); b.line(-50,0,60,0); b.render();
    check(pixel(30,0) < 100, 'noClip did not disable clip');
  });
  await run('B04/B05 custom tip density, rotation and nonuniform scale', () => {
    b.add('regression-tip', {...params,type:'custom',weight:20,spacing:1,tip:g=>{g.fill(0);g.rect(-50,-25,100,50);}});
    const extents = (target, density) => {
      const context = target.getContext('webgl2'), size=128*density, data=new Uint8Array(size*size*4);
      context.readPixels(0,0,size,size,context.RGBA,context.UNSIGNED_BYTE,data);
      let x0=size,y0=size,x1=-1,y1=-1;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[(y*size+x)*4]<128){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      return [(x1-x0+1)/density,(y1-y0+1)/density];
    };
    for (const density of [1,2]) {
      const target=b.createCanvas(128,128,{pixelDensity:density,parent:null});
      b.clear('white'); b.set('regression-tip','black'); b.flowLine(0,0,1,0); b.render();
      const plain=extents(target,density); check(plain[0]===20 && plain[1]===10, `density ${density}: ${plain}`);
      b.clear('white'); b.push(); b.rotate(90); b.flowLine(0,0,1,0); b.pop(); b.render();
      const rotated=extents(target,density); check(rotated[0]===10 && rotated[1]===20, `rotation: ${rotated}`);
      b.clear('white'); b.push(); b.scale(2,.5); b.flowLine(0,0,1,0); b.pop(); b.render();
      const scaled=extents(target,density); check(scaled[0]===40 && Math.abs(scaled[1]-5)<=1, `nonuniform scale: ${scaled}`);
      b.clear('white'); b.set('regression-solid','black'); b.push(); b.scale(2,.5); b.flowLine(0,0,2,0); b.pop(); b.render();
      const ellipse=extents(target,density); check(Math.abs(ellipse[0]-24)<=2 && Math.abs(ellipse[1]-6)<=2, `circle affine transform: ${ellipse}`);
      b.set('regression-tip','black'); b.load(target); b.clear('white'); b.flowLine(0,0,1,0); b.render();
      check(extents(target,density)[0]===20, 'reload lost logical density');
      b.clip([-5,-5,5,5]); b.clear('white'); b.flowLine(0,0,1,0); b.render();
      check(extents(target,density)[0]===10, 'custom-tip clip/density mismatch'); b.noClip();
      check(contextError(target)===0, 'tip GL error');
    }
    function contextError(target) { return target.getContext('webgl2').getError(); }
  });
  await run('B06/B07/B13/B14 spline, scaled polygons and independent sampling', () => {
    check(b.spline([[0,0],[30,0]]).length===30, 'two-point spline is empty');
    const p=new b.Plot('segments'); p.addSegment(0,40,1); p.addSegment(0,40,3); p.endPlot(0,9);
    p.angle(60); check(p.pressure(10)===1.5, 'pressure depends on stale angle query');
    const small=p.genPol(0,0,1,0).a.at(-1)[0], large=p.genPol(0,0,2,0).a.at(-1)[0];
    check(large>small*1.8, 'genPol ignored scale');
    const pos=new b.Position(-200,128); pos.moveTo(0,400,1);
    check(pos.x===200 && pos.plotted===400, 'off-canvas position froze');
  });
  await run('B08/B09/B15 explicit overrides, zero opacity and empty fill', () => {
    poly().fill('black',200,0,0,0); b.render(); check(pixel(0,0)<255, 'explicit fill failed while noFill');
    b.clear('white'); poly().draw('regression-solid','black'); b.render(); check(pixel(20,0)<100, 'explicit draw failed while noStroke');
    b.clear('white'); b.fill('black',0); b.rect(-20,-20,40,40); b.render(); check(pixel(0,0)===255, 'zero fill opacity ignored');
    new b.Polygon([]).fill(); b.render(); check(gl.getError()===0, 'empty fill GL error');
  });
  await run('B10/B11/B12 target switching, resource reuse and field dimensions', () => {
    b.set('regression-solid','black'); b.line(-30,0,30,0); // deliberately pending
    const target=b.createCanvas(64,128,{parent:null}); b.clear('white');
    const oldError=gl.getError(), newError=target.getContext('webgl2').getError();
    check(oldError===0 && newError===0, `target switch GL errors: old=${oldError}, new=${newError}`);
    b.load(canvas); b.render(); check(pixel(0,0)<100, 'switch did not flush old target');
    let allocations=0; const create=gl.createTexture;
    gl.createTexture=function(...args){allocations++;return create.apply(this,args);};
    try { b.load(canvas); b.load(canvas); b.line(-5,0,5,0); b.render(); check(allocations===0, 'same-canvas load reallocated textures'); }
    finally { gl.createTexture=create; }
    const sizes=[]; b.addField('regression-field', (_t,grid)=>{sizes.push([grid.length,grid[0].length]);return grid;});
    b.field('regression-field'); b.load(target); b.field('regression-field');
    check(sizes[0][1]===200 && sizes[1][1]===400, `stale field dimensions ${JSON.stringify(sizes)}`);
    b.noField();
  });
  await run('F12 straight lines follow their exact direction', () => {
    // Line directions were looked up as 360° − 30.0125° = 329.9875°, which a
    // truncating 0.25° table turns into 329.75° (~0.8 px off at x = 90).
    b.add('regression-thin', {...params,weight:1.5,spacing:0.25});
    const [x1, y1, x2, y2] = [-100, 60, 100, 60 - 200 * Math.tan(30.0125 * Math.PI / 180)];
    b.set('regression-thin','black'); b.line(x1, y1, x2, y2); b.render();
    const x = 90, ideal = y1 + (y2 - y1) * (x - x1) / (x2 - x1);
    let ink = 0, sum = 0;
    for (let y = Math.round(ideal) - 6; y <= Math.round(ideal) + 6; y++) {
      const v = 255 - pixel(x, y);
      ink += v; sum += v * y;
    }
    const centre = sum / ink;
    check(ink > 0 && Math.abs(centre - ideal) < 0.4, `line centre ${centre.toFixed(2)} at x=${x}, expected ${ideal.toFixed(2)}`);
  });
  await run('Paper tooth: seeded, repeatable, and removes ink', async () => {
    const snapshot = async (strength, options) => {
      b.paper(strength, options); b.clear('white'); b.seed(9);
      b.set('2B','black',1); b.hatch(2, 30); b.rect(-60,-60,120,120); b.noHatch(); b.render();
      const data = new Uint8Array(256 * 256 * 4);
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let ink = 0; for (let i = 0; i < data.length; i += 4) ink += 255 - data[i];
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].join(',');
      return { ink, hash };
    };
    try {
      const a = await snapshot(1, {seed: 1}), again = await snapshot(1, {seed: 1}), other = await snapshot(1, {seed: 2});
      const smooth = await snapshot(0);
      check(a.hash === again.hash, 'same paper seed rendered differently');
      check(a.hash !== other.hash, 'paper seed had no effect');
      check(smooth.ink > a.ink * 1.05, `paper did not remove ink (${a.ink} vs smooth ${smooth.ink})`);
    } finally { b.paper(); }
  });
  await run('Seeded mass repeats exactly, including the first after a resize', async () => {
    // A canvas size no other case uses forces the flow field to be rebuilt.
    const target = b.createCanvas(200, 180, {parent: null});
    const context = target.getContext('webgl2');
    const hashes = [];
    for (let i = 0; i < 3; i++) {
      b.clear('white'); b.seed(5); b.noiseSeed(5);
      b.mass('HB', 'black'); b.rect(-60, -60, 120, 120); b.noMass(); b.render();
      const data = new Uint8Array(200 * 180 * 4);
      context.readPixels(0, 0, 200, 180, context.RGBA, context.UNSIGNED_BYTE, data);
      hashes.push([...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].join(','));
    }
    b.load(canvas);
    check(hashes[0] === hashes[1] && hashes[1] === hashes[2], 'same seed drew a different mass');
  });
  await run('B16 transparent CSS colors', () => {
    for (const css of ['transparent','#ff000080','rgb(255 0 0 / 0.5)']) {
      const c=new b.Color(css); check(c._array[3]<1, `alpha lost for ${css}`);
    }
    throws(() => new b.Color('not-a-color'));
  });
  await run('B18 exception recovery does not leak temporary brush/hatch styles', () => {
    b.set('regression-solid','black'); b.hatchStyle('missing-brush','red'); b.hatch(10);
    throws(() => b.rect(-20,-20,40,40)); b.noHatch(); b.line(-20,0,20,0); b.render();
    b.noStroke(); throws(() => poly().draw('missing-brush','red'));
    b.clear('white'); poly().show(); b.render(); check(pixel(20,0)===255, 'failed override enabled outer stroke');
    let calls=0;
    b.add('throwing-pressure',{...params,spacing:1,pressure:()=>{if(++calls===3)throw Error('pressure failed');return 1;}});
    b.set('throwing-pressure','red'); throws(()=>b.line(-80,-80,-40,-80));
    b.set('regression-solid','black'); b.line(-5,0,5,0); b.render();
    check(pixel(-70,-80)===255, 'failed stroke leaked queued stamps into the next stroke');
  });
  await run('B21 image-processing errors reject load promises', async () => {
    const NativeImage=globalThis.Image;
    class BadImage { set src(_value) { queueMicrotask(()=>this.onload()); } }
    globalThis.Image=BadImage;
    try {
      let rejected=false;
      try { await b.add('bad-image',{...params,type:'image',image:{src:'regression-invalid-image'}}); }
      catch { rejected=true; }
      check(rejected, 'image processing failed without rejecting');
    } finally { globalThis.Image=NativeImage; }
  });
  await run('B22/B23 image alpha and custom-tip style stack', async () => {
    // Transparent black must remain transparent after luminance conversion.
    const source=document.createElement('canvas');source.width=source.height=4;
    source.getContext('2d').fillRect(1,1,2,2);
    await b.add('alpha-image',{...params,type:'image',weight:40,spacing:1,image:{src:source.toDataURL()}});
    b.set('alpha-image','black'); b.flowLine(0,0,1,0); b.render();
    check(pixel(0,0)<100 && pixel(17,0)===255, 'transparent image pixels became ink');
    b.add('style-tip',{...params,type:'custom',weight:40,spacing:1,tip:g=>{
      g.fill(0);g.push();g.fill(255);g.noStroke();g.strokeWeight(9);g.pop();g.rect(-50,-50,100,100);
    }});
    b.clear('white'); b.set('style-tip','black'); b.flowLine(0,0,1,0); b.render();
    check(pixel(0,0)<100, 'tip pop did not restore its fill style');
  });
  b.render();
  await run('Fill mask: no canvas allocation, leaks or GL errors with alternating sizes at densities 1/2', () => {
    for (const density of [1,2]) {
      const target=b.createCanvas(128,128,{pixelDensity:density,parent:null}), context=target.getContext('webgl2');
      const NativeCanvas=window.OffscreenCanvas; let allocations=0;
      window.OffscreenCanvas=class extends NativeCanvas {constructor(...args){super(...args);allocations++;}};
      try {
        b.noStroke(); b.wash('blue',180);
        for (let i=0;i<6;i++) {
          b.clear('white');
          if(i%2) b.rect(20,20,10,10); else b.rect(-40,-20,30,30);
          b.render();
        }
        check(allocations<=2, `repeated fill sizes allocated ${allocations} 2D canvases`);
        const data=new Uint8Array(4);
        context.readPixels(39*density,69*density,1,1,context.RGBA,context.UNSIGNED_BYTE,data);
        check(data[0]===255, 'previous fill leaked into cleared destination');
        check(context.getError()===0, 'GL error after repeated fills');
      } finally { window.OffscreenCanvas=NativeCanvas; }
    }
  });
  return results;
}
