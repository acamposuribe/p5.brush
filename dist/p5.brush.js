!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?e(exports):"function"==typeof define&&define.amd?define(["exports"],e):e((t="undefined"!=typeof globalThis?globalThis:t||self).brush={})}(this,(function(t){"use strict";let e,i=!1,s=!1,n=!1;function r(t=!1){let r=!(!s||!t)&&n;i&&o(!1),!t&&s&&(t=n),e=t||window.self,i||(i=!0,w.create(),_(e.width/250)),v.load(r)}function o(t=!0){i&&(v.masks[0].remove(),v.masks[0]=null,v.masks[1].remove(),v.masks[1]=null,v.masks[2].remove(),v.masks[2]=null,t&&brush.load())}function a(){i||r()}let h=new Math.seedrandom(Math.random());const l={random(t=0,e=1){return 1===arguments.length?this.map(h(),0,1,0,t):this.map(h(),0,1,t,e)},randInt(t,e){return Math.floor(this.random(t,e))},gaussian(t=0,e=1){const i=1-l.random(),s=l.random();return Math.sqrt(-2*Math.log(i))*Math.cos(2*Math.PI*s)*e+t},weightedRand(t){let e,i,s=[];for(e in t)for(i=0;i<10*t[e];i++)s.push(e);return s[Math.floor(h()*s.length)]},map(t,e,i,s,n,r=!1){let o=s+(t-e)/(i-e)*(n-s);return r?s<n?this.constrain(o,s,n):this.constrain(o,n,s):o},constrain:(t,e,i)=>Math.max(Math.min(t,i),e),cos(t){return this.c[Math.floor((t%360+360)%360*4)]},sin(t){return this.s[Math.floor((t%360+360)%360*4)]},isPrecalculationDone:!1,preCalculation(){if(this.isPrecalculationDone)return;const t=1440,e=2*Math.PI/t;this.c=new Float64Array(t),this.s=new Float64Array(t);for(let i=0;i<t;i++){const t=i*e;l.c[i]=Math.cos(t),l.s[i]=Math.sin(t)}this.isPrecalculationDone=!0},isNumber:t=>!isNaN(t),toDegrees:t=>(("radians"===e.angleMode()?180*t/Math.PI:t)%360+360)%360,dist:(t,e,i,s)=>Math.hypot(i-t,s-e)};function c(t,e,i,s,n=!1){let r=t.x,o=t.y,a=e.x,h=e.y,l=i.x,c=i.y,m=s.x,d=s.y;if(r===a&&o===h||l===m&&c===d)return!1;let u=a-r,p=h-o,f=m-l,v=d-c,g=v*u-f*p;if(0===g)return!1;let x=(f*(o-c)-v*(r-l))/g,y=(u*(o-c)-p*(r-l))/g;return!(!n&&(y<0||y>1))&&{x:r+x*u,y:o+x*p}}function m(t,e,i,s){return(Math.atan2(-(s-e),i-t)*(180/Math.PI)%360+360)%360}l.preCalculation();const d={field:{},stroke:{},hatch:{},fill:{},others:{}};const u={translation:[0,0],rotation:0,trans(){return this.translation=[e._renderer.uMVMatrix.mat4[12],e._renderer.uMVMatrix.mat4[13]],this.translation}};let p=1;function f(t){p*=t}const v={loaded:!1,isBlending:!1,isCaching:!0,currentColor:new Float32Array(3),load(t){this.type=s&&!t?0:t?2:1,this.masks=[];for(let i=0;i<3;i++)switch(this.type){case 0:this.masks[i]=e.createGraphics(e.width,e.height,1==i?e.WEBGL:e.P2D);break;case 1:this.masks[i]=createGraphics(e.width,e.height,1==i?WEBGL:P2D);break;case 2:this.masks[i]=t.createGraphics(t.width,t.height,1==i?t.WEBGL:t.P2D)}for(let t of this.masks)t.pixelDensity(e.pixelDensity()),t.clear(),t.angleMode(e.DEGREES),t.noSmooth();this.shader=e.createShader(this.vert,this.frag),v.loaded=!0},getPigment(t){let e=t.levels,i=new Float32Array(3);return i[0]=e[0]/255,i[1]=e[1]/255,i[2]=e[2]/255,i},color1:new Float32Array(3),color2:new Float32Array(3),blending1:!1,blending2:!1,blend(t=!1,i=!1,s=!1){if(this.isBlending=s?this.blending1:this.blending2,this.currentColor=s?this.color1:this.color2,!this.isBlending)if(t)this.currentColor=this.getPigment(t),s?(this.blending1=!0,this.color1=this.currentColor):(this.blending2=!0,this.color2=this.currentColor);else if(i)return void(s||g());if((t?this.getPigment(t):this.currentColor).toString()!==this.currentColor.toString()||i||!this.isCaching){if(g(),this.isBlending){e.push(),e.translate(-u.trans()[0],-u.trans()[1]),e.shader(this.shader),this.shader.setUniform("addColor",this.currentColor),this.shader.setUniform("source",e._renderer),this.shader.setUniform("active",v.watercolor),this.shader.setUniform("random",[l.random(),l.random(),l.random()]);let t=s?this.masks[1]:this.masks[0];this.shader.setUniform("mask",t),e.fill(0,0,0,0),e.noStroke(),e.rect(-e.width/2,-e.height/2,e.width,e.height),e.pop(),t.clear()}i||(this.currentColor=this.getPigment(t),s?this.color1=this.currentColor:this.color2=this.currentColor)}i&&(this.isBlending=!1,s?this.blending1=this.isBlending:this.blending2=this.isBlending)},vert:"precision highp float;attribute vec3 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelViewMatrix,uProjectionMatrix;varying vec2 vVertTexCoord;void main(){gl_Position=uProjectionMatrix*uModelViewMatrix*vec4(aPosition,1);vVertTexCoord=aTexCoord;}",frag:"precision highp float;varying vec2 vVertTexCoord;uniform sampler2D source,mask;uniform vec4 addColor;uniform vec3 random;uniform bool active;\n        #ifndef SPECTRAL\n        #define SPECTRAL\n        float x(float v){return v<.04045?v/12.92:pow((v+.055)/1.055,2.4);}float v(float v){return v<.0031308?v*12.92:1.055*pow(v,1./2.4)-.055;}vec3 m(vec3 v){return vec3(x(v[0]),x(v[1]),x(v[2]));}vec3 f(vec3 f){return clamp(vec3(v(f[0]),v(f[1]),v(f[2])),0.,1.);}void f(vec3 v,out float m,out float f,out float x,out float y,out float z,out float i,out float r){m=min(v.x,min(v.y,v.z));v-=m;f=min(v.y,v.z);x=min(v.x,v.z);y=min(v.x,v.y);z=min(max(0.,v.x-v.z),max(0.,v.x-v.y));i=min(max(0.,v.y-v.z),max(0.,v.y-v.x));r=min(max(0.,v.z-v.y),max(0.,v.z-v.x));}void f(vec3 v,inout float i[38]){float x,y,d,z,o,m,e;f(v,x,y,d,z,o,m,e);i[0]=max(1e-4,x+y*.96853629+d*.51567122+z*.02055257+o*.03147571+m*.49108579+e*.97901834);i[1]=max(1e-4,x+y*.96855103+d*.5401552+z*.02059936+o*.03146636+m*.46944057+e*.97901649);i[2]=max(1e-4,x+y*.96859338+d*.62645502+z*.02062723+o*.03140624+m*.4016578+e*.97901118);i[3]=max(1e-4,x+y*.96877345+d*.75595012+z*.02073387+o*.03119611+m*.2449042+e*.97892146);i[4]=max(1e-4,x+y*.96942204+d*.92826996+z*.02114202+o*.03053888+m*.0682688+e*.97858555);i[5]=max(1e-4,x+y*.97143709+d*.97223624+z*.02233154+o*.02856855+m*.02732883+e*.97743705);i[6]=max(1e-4,x+y*.97541862+d*.98616174+z*.02556857+o*.02459485+m*.013606+e*.97428075);i[7]=max(1e-4,x+y*.98074186+d*.98955255+z*.03330189+o*.0192952+m*.01000187+e*.96663223);i[8]=max(1e-4,x+y*.98580992+d*.98676237+z*.05185294+o*.01423112+m*.01284127+e*.94822893);i[9]=max(1e-4,x+y*.98971194+d*.97312575+z*.10087639+o*.01033111+m*.02636635+e*.89937713);i[10]=max(1e-4,x+y*.99238027+d*.91944277+z*.24000413+o*.00765876+m*.07058713+e*.76070164);i[11]=max(1e-4,x+y*.99409844+d*.32564851+z*.53589066+o*.00593693+m*.70421692+e*.4642044);i[12]=max(1e-4,x+y*.995172+d*.13820628+z*.79874659+o*.00485616+m*.85473994+e*.20123039);i[13]=max(1e-4,x+y*.99576545+d*.05015143+z*.91186529+o*.00426186+m*.95081565+e*.08808402);i[14]=max(1e-4,x+y*.99593552+d*.02912336+z*.95399623+o*.00409039+m*.9717037+e*.04592894);i[15]=max(1e-4,x+y*.99564041+d*.02421691+z*.97137099+o*.00438375+m*.97651888+e*.02860373);i[16]=max(1e-4,x+y*.99464769+d*.02660696+z*.97939505+o*.00537525+m*.97429245+e*.02060067);i[17]=max(1e-4,x+y*.99229579+d*.03407586+z*.98345207+o*.00772962+m*.97012917+e*.01656701);i[18]=max(1e-4,x+y*.98638762+d*.04835936+z*.98553736+o*.0136612+m*.9425863+e*.01451549);i[19]=max(1e-4,x+y*.96829712+d*.0001172+z*.98648905+o*.03181352+m*.99989207+e*.01357964);i[20]=max(1e-4,x+y*.89228016+d*8.554e-5+z*.98674535+o*.10791525+m*.99989891+e*.01331243);i[21]=max(1e-4,x+y*.53740239+d*.85267882+z*.98657555+o*.46249516+m*.13823139+e*.01347661);i[22]=max(1e-4,x+y*.15360445+d*.93188793+z*.98611877+o*.84604333+m*.06968113+e*.01387181);i[23]=max(1e-4,x+y*.05705719+d*.94810268+z*.98559942+o*.94275572+m*.05628787+e*.01435472);i[24]=max(1e-4,x+y*.03126539+d*.94200977+z*.98507063+o*.96860996+m*.06111561+e*.01479836);i[25]=max(1e-4,x+y*.02205445+d*.91478045+z*.98460039+o*.97783966+m*.08987709+e*.0151525);i[26]=max(1e-4,x+y*.01802271+d*.87065445+z*.98425301+o*.98187757+m*.13656016+e*.01540513);i[27]=max(1e-4,x+y*.0161346+d*.78827548+z*.98403909+o*.98377315+m*.22169624+e*.01557233);i[28]=max(1e-4,x+y*.01520947+d*.65738359+z*.98388535+o*.98470202+m*.32176956+e*.0156571);i[29]=max(1e-4,x+y*.01475977+d*.59909403+z*.98376116+o*.98515481+m*.36157329+e*.01571025);i[30]=max(1e-4,x+y*.01454263+d*.56817268+z*.98368246+o*.98537114+m*.4836192+e*.01571916);i[31]=max(1e-4,x+y*.01444459+d*.54031997+z*.98365023+o*.98546685+m*.46488579+e*.01572133);i[32]=max(1e-4,x+y*.01439897+d*.52110241+z*.98361309+o*.98550011+m*.47440306+e*.01572502);i[33]=max(1e-4,x+y*.0143762+d*.51041094+z*.98357259+o*.98551031+m*.4857699+e*.01571717);i[34]=max(1e-4,x+y*.01436343+d*.50526577+z*.98353856+o*.98550741+m*.49267971+e*.01571905);i[35]=max(1e-4,x+y*.01435687+d*.5025508+z*.98351247+o*.98551323+m*.49625685+e*.01571059);i[36]=max(1e-4,x+y*.0143537+d*.50126452+z*.98350101+o*.98551563+m*.49807754+e*.01569728);i[37]=max(1e-4,x+y*.01435408+d*.50083021+z*.98350852+o*.98551547+m*.49889859+e*.0157002);}vec3 t(vec3 x){mat3 i;i[0]=vec3(3.24306333,-1.53837619,-.49893282);i[1]=vec3(-.96896309,1.87542451,.04154303);i[2]=vec3(.05568392,-.20417438,1.05799454);float v=dot(i[0],x),y=dot(i[1],x),o=dot(i[2],x);return f(vec3(v,y,o));}vec3 d(float m[38]){vec3 i=vec3(0);i+=m[0]*vec3(6.469e-5,1.84e-6,.00030502);i+=m[1]*vec3(.00021941,6.21e-6,.00103681);i+=m[2]*vec3(.00112057,3.101e-5,.00531314);i+=m[3]*vec3(.00376661,.00010475,.01795439);i+=m[4]*vec3(.01188055,.00035364,.05707758);i+=m[5]*vec3(.02328644,.00095147,.11365162);i+=m[6]*vec3(.03455942,.00228226,.17335873);i+=m[7]*vec3(.03722379,.00420733,.19620658);i+=m[8]*vec3(.03241838,.0066888,.18608237);i+=m[9]*vec3(.02123321,.0098884,.13995048);i+=m[10]*vec3(.01049099,.01524945,.08917453);i+=m[11]*vec3(.00329584,.02141831,.04789621);i+=m[12]*vec3(.00050704,.03342293,.02814563);i+=m[13]*vec3(.00094867,.05131001,.01613766);i+=m[14]*vec3(.00627372,.07040208,.0077591);i+=m[15]*vec3(.01686462,.08783871,.00429615);i+=m[16]*vec3(.02868965,.09424905,.00200551);i+=m[17]*vec3(.04267481,.09795667,.00086147);i+=m[18]*vec3(.05625475,.09415219,.00036904);i+=m[19]*vec3(.0694704,.08678102,.00019143);i+=m[20]*vec3(.08305315,.07885653,.00014956);i+=m[21]*vec3(.0861261,.0635267,9.231e-5);i+=m[22]*vec3(.09046614,.05374142,6.813e-5);i+=m[23]*vec3(.08500387,.04264606,2.883e-5);i+=m[24]*vec3(.07090667,.03161735,1.577e-5);i+=m[25]*vec3(.05062889,.02088521,3.94e-6);i+=m[26]*vec3(.03547396,.01386011,1.58e-6);i+=m[27]*vec3(.02146821,.00810264,0);i+=m[28]*vec3(.01251646,.0046301,0);i+=m[29]*vec3(.00680458,.00249138,0);i+=m[30]*vec3(.00346457,.0012593,0);i+=m[31]*vec3(.00149761,.00054165,0);i+=m[32]*vec3(.0007697,.00027795,0);i+=m[33]*vec3(.00040737,.00014711,0);i+=m[34]*vec3(.00016901,6.103e-5,0);i+=m[35]*vec3(9.522e-5,3.439e-5,0);i+=m[36]*vec3(4.903e-5,1.771e-5,0);i+=m[37]*vec3(2e-5,7.22e-6,0);return i;}float d(float y,float m,float v){float z=m*pow(v,2.);return z/(y*pow(1.-v,2.)+z);}vec3 f(vec3 v,vec3 y,float z){vec3 x=m(v),o=m(y);float i[38],a[38];f(x,i);f(o,a);float r=d(i)[1],e=d(a)[1];z=d(r,e,z);float s[38];for(int u=0;u<38;u++){float p=(1.-z)*(pow(1.-i[u],2.)/(2.*i[u]))+z*(pow(1.-a[u],2.)/(2.*a[u]));s[u]=1.+p-sqrt(pow(p,2.)+2.*p);}return t(d(s));}vec4 f(vec4 v,vec4 x,float y){return vec4(f(v.xyz,x.xyz,y),mix(v.w,x.w,y));}\n        #endif\n        float d(vec2 m,vec2 v,float y,out vec2 i){vec2 f=vec2(m.x+m.y*.5,m.y),x=floor(f),o=fract(f);float z=step(o.y,o.x);vec2 d=vec2(z,1.-z),r=x+d,e=x+1.,a=vec2(x.x-x.y*.5,x.y),p=vec2(a.x+d.x-d.y*.5,a.y+d.y),s=vec2(a.x+.5,a.y+1.),w=m-a,g=m-p,k=m-s;vec3 u,c,t,A;if(any(greaterThan(v,vec2(0)))){t=vec3(a.x,p.x,s);A=vec3(a.y,p.y,s.y);if(v.x>0.)t=mod(vec3(a.x,p.x,s),v.x);if(v.y>0.)A=mod(vec3(a.y,p.y,s.y),v.y);u=floor(t+.5*A+.5);c=floor(A+.5);}else u=vec3(x.x,r.x,e),c=vec3(x.y,r.y,e.y);vec3 S=mod(u,289.);S=mod((S*51.+2.)*S+c,289.);S=mod((S*34.+10.)*S,289.);vec3 b=S*.07482+y,C=cos(b),D=sin(b);vec2 h=vec2(C.x,D),B=vec2(C.y,D.y),E=vec2(C.z,D.z);vec3 F=.8-vec3(dot(w,w),dot(g,g),dot(k,k));F=max(F,0.);vec3 G=F*F,H=G*G,I=vec3(dot(h,w),dot(B,g),dot(E,k)),J=G*F,K=-8.*J*I;i=10.9*(H.x*h+K.x*w+(H.y*B+K.y*g)+(H.z*E+K.z*k));return 10.9*dot(H,I);}vec4 d(vec3 v,float x){return vec4(mix(v,vec3(dot(vec3(.299,.587,.114),v)),x),1);}float f(vec2 v,float x,float y,float f){return fract(sin(dot(v,vec2(x,y)))*f);}void main(){vec4 v=texture2D(mask,vVertTexCoord);if(v.x>0.){vec2 x=vec2(12.9898,78.233),o=vec2(7.9898,58.233),m=vec2(17.9898,3.233);float y=f(vVertTexCoord,x.x,x.y,43358.5453)*2.-1.,z=f(vVertTexCoord,o.x,o.y,43213.5453)*2.-1.,e=f(vVertTexCoord,m.x,m.y,33358.5453)*2.-1.;const vec2 i=vec2(0);vec2 s;vec4 r;if(active){float a=d(vVertTexCoord*5.,i,10.*random.x,s),p=d(vVertTexCoord*5.,i,10.*random.y,s),g=d(vVertTexCoord*5.,i,10.*random.z,s),k=.25+.25*d(vVertTexCoord*4.,i,3.*random.x,s);r=vec4(d(addColor.xyz,k).xyz+vec3(a,p,g)*.03*abs(addColor.x-addColor.y-addColor.z),1);}else r=vec4(addColor.xyz,1);if(v.w>.7){float a=.5*(v.w-.7);r=r*(1.-a)-vec4(.5)*a;}vec3 a=f(texture2D(source,vVertTexCoord).xyz,r.xyz,.9*v.w);gl_FragColor=vec4(a+.01*vec3(y,z,e),1);}}"};function g(){e.push(),e.translate(-u.trans()[0],-u.trans()[1]),e.image(v.masks[2],-e.width/2,-e.height/2),v.masks[2].clear(),e.pop()}function x(t){t.registerMethod("afterSetup",(()=>v.blend(!1,!0))),t.registerMethod("afterSetup",(()=>v.blend(!1,!0,!0))),t.registerMethod("post",(()=>v.blend(!1,!0))),t.registerMethod("post",(()=>v.blend(!1,!0,!0)))}function y(t,e){a(),w.list.set(t,{gen:e}),w.current=t,w.refresh()}"undefined"!=typeof p5&&x(p5.prototype);const w={isActive:!1,list:new Map,current:"",step_length:()=>Math.min(e.width,e.height)/1e3,create(){this.R=.01*e.width,this.left_x=-1*e.width,this.top_y=-1*e.height,this.num_columns=Math.round(2*e.width/this.R),this.num_rows=Math.round(2*e.height/this.R),this.addStandard()},flow_field(){return this.list.get(this.current).field},refresh(t=0){this.list.get(this.current).field=this.list.get(this.current).gen(t,this.genField())},genField(){let t=new Array(this.num_columns);for(let e=0;e<this.num_columns;e++)t[e]=new Float64Array(this.num_rows);return t},addStandard(){y("curved",(function(t,i){let s=l.randInt(-25,-15);l.randInt(0,100)%2==0&&(s*=-1);for(let n=0;n<w.num_columns;n++)for(let r=0;r<w.num_rows;r++){let o=e.noise(.02*n+.03*t,.02*r+.03*t),a=l.map(o,0,1,-s,s);i[n][r]=3*a}return i})),y("truncated",(function(t,i){let s=l.randInt(-25,-15)+5*l.sin(t);l.randInt(0,100)%2==0&&(s*=-1);let n=l.randInt(5,10);for(let t=0;t<w.num_columns;t++)for(let r=0;r<w.num_rows;r++){let o=e.noise(.02*t,.02*r),a=Math.round(l.map(o,0,1,-s,s)/n)*n;i[t][r]=4*a}return i})),y("zigzag",(function(t,e){let i=l.randInt(-30,-15)+Math.abs(44*l.sin(t));l.randInt(0,100)%2==0&&(i*=-1);let s=i,n=0;for(let t=0;t<w.num_columns;t++){for(let i=0;i<w.num_rows;i++)e[t][i]=n,n+=s,s*=-1;n+=s,s*=-1}return e})),y("waves",(function(t,e){let i=l.randInt(10,15)+5*l.sin(t),s=l.randInt(3,6)+3*l.cos(t),n=l.randInt(20,35);for(let t=0;t<w.num_columns;t++)for(let r=0;r<w.num_rows;r++){let o=l.sin(i*t)*(n*l.cos(r*s))+l.randInt(-3,3);e[t][r]=o}return e})),y("seabed",(function(t,e){let i=l.random(.4,.8),s=l.randInt(18,26);for(let n=0;n<w.num_columns;n++)for(let r=0;r<w.num_rows;r++){let o=l.randInt(15,20),a=s*l.sin(i*r*n+o);e[n][r]=1.1*a*l.cos(t)}return e}))}};class k{constructor(t,e){this.update(t,e),this.plotted=0}update(t,e){this.x=t,this.y=e,w.isActive&&(this.x_offset=this.x-w.left_x+u.trans()[0],this.y_offset=this.y-w.top_y+u.trans()[1],this.column_index=Math.round(this.x_offset/w.R),this.row_index=Math.round(this.y_offset/w.R))}reset(){this.plotted=0}isIn(){return w.isActive?this.column_index>=0&&this.row_index>=0&&this.column_index<w.num_columns&&this.row_index<w.num_rows:this.isInCanvas()}isInCanvas(){let t=e.width,i=e.height;return this.x>=-t-u.trans()[0]&&this.x<=t-u.trans()[0]&&this.y>=-i-u.trans()[1]&&this.y<=i-u.trans()[1]}angle(){return this.isIn()&&w.isActive?w.flow_field()[this.column_index][this.row_index]:0}moveTo(t,e,i=A.spacing(),s=!0){if(this.isIn()){let n,r;s||(n=l.cos(-e),r=l.sin(-e));for(let o=0;o<t/i;o++){if(s){let t=this.angle();n=l.cos(t-e),r=l.sin(t-e)}let t=i*n,o=i*r;this.plotted+=i,this.update(this.x+t,this.y+o)}}else this.plotted+=i}plotTo(t,e,i,s){if(this.isIn()){const n=1/s;for(let s=0;s<e/i;s++){let e=this.angle(),s=t.angle(this.plotted),r=i*l.cos(e-s),o=i*l.sin(e-s);this.plotted+=i*n,this.update(this.x+r,this.y+o)}}else this.plotted+=i/f}}function _(t){for(let e of J){let i=A.list.get(e[0]).param;i.weight*=t,i.vibration*=t,i.spacing*=t}z=t}let z=1;const A={isActive:!0,list:new Map,c:"#000000",w:1,cr:null,name:"HB",spacing(){return this.p=this.list.get(this.name).param,"default"===this.p.type||"spray"===this.p.type?this.p.spacing/this.w:this.p.spacing},initializeDrawingState(t,e,i,s,n){this.position=new k(t,e),this.length=i,this.flow=s,this.plot=n,n&&n.calcIndex(0)},draw(t,e){e||(this.dir=t),this.pushState();const i=this.spacing(),s=e?Math.round(this.length*t/i):Math.round(this.length/i);for(let n=0;n<s;n++)this.tip(),e?this.position.plotTo(this.plot,i,i,t):this.position.moveTo(i,t,i,this.flow);this.popState()},drawTip(t){this.pushState(!0),this.tip(t),this.popState(!0)},pushState(t=!1){if(this.p=this.list.get(this.name).param,!t){this.a="custom"!==this.p.pressure.type?l.random(-1,1):0,this.b="custom"!==this.p.pressure.type?l.random(1,1.5):0,this.cp="custom"!==this.p.pressure.type?l.random(3,3.5):l.random(-.2,.2);const[t,e]=this.p.pressure.min_max;this.min=t,this.max=e}this.c=e.color(this.c),this.mask=this.p.blend?"image"===this.p.type?v.masks[1]:v.masks[0]:v.masks[2],u.trans(),this.mask.push(),this.mask.noStroke(),"image"===this.p.type?this.mask.translate(u.translation[0],u.translation[1]):this.mask.translate(u.translation[0]+e.width/2,u.translation[1]+e.height/2),this.mask.rotate(-u.rotation),this.mask.scale(p),this.p.blend&&(v.watercolor=!1,"image"!==this.p.type?v.blend(this.c):v.blend(this.c,!1,!0),t||this.markerTip()),this.alpha=this.calculateAlpha(),this.applyColor(this.alpha)},popState(t=!1){this.p.blend&&!t&&this.markerTip(),this.mask.pop()},tip(t=!1){let e=t||this.calculatePressure();if(this.isInsideClippingArea())switch(this.p.type){case"spray":this.drawSpray(e);break;case"marker":this.drawMarker(e);break;case"custom":case"image":this.drawCustomOrImage(e,this.alpha);break;default:this.drawDefault(e)}},calculatePressure(){return this.plot?this.simPressure()*this.plot.pressure(this.position.plotted):this.simPressure()},simPressure(){return"custom"===this.p.pressure.type?l.map(this.p.pressure.curve(this.position.plotted/this.length)+this.cp,0,1,this.min,this.max,!0):this.gauss()},gauss(t=.5+A.p.pressure.curve[0]*A.a,e=1-A.p.pressure.curve[1]*A.b,i=A.cp,s=A.min,n=A.max){return l.map(1/(1+Math.pow(Math.abs((this.position.plotted-t*this.length)/(e*this.length/2)),2*i)),0,1,s,n)},calculateAlpha(){return"default"!==this.p.type&&"spray"!==this.p.type?this.p.opacity/this.w:this.p.opacity},applyColor(t){this.p.blend?this.mask.fill(255,0,0,t/2):(this.c.setAlpha(t),this.mask.fill(this.c))},isInsideClippingArea(){if(A.cr)return this.position.x>=A.cr[0]&&this.position.x<=A.cr[2]&&this.position.y>=A.cr[1]&&this.position.y<=A.cr[3];{let t=.55*e.width,i=.55*e.height;return this.position.x>=-t-u.trans()[0]&&this.position.x<=t-u.trans()[0]&&this.position.y>=-i-u.trans()[1]&&this.position.y<=i-u.trans()[1]}},drawSpray(t){let e=this.w*this.p.vibration*t+this.w*l.gaussian()*this.p.vibration/3,i=this.p.weight*l.random(.9,1.1);const s=this.p.quality/t;for(let t=0;t<s;t++){let t=l.random(.9,1.1),s=t*e*l.random(-1,1),n=l.random(-1,1),r=Math.pow(t*e,2),o=Math.sqrt(r-Math.pow(s,2));this.mask.circle(this.position.x+s,this.position.y+n*o,i)}},drawMarker(t,e=!0){let i=e?this.w*this.p.vibration:0,s=e?i*l.random(-1,1):0,n=e?i*l.random(-1,1):0;this.mask.circle(this.position.x+s,this.position.y+n,this.w*this.p.weight*t)},drawCustomOrImage(t,e,i=!0){this.mask.push();let s=i?this.w*this.p.vibration:0,n=i?s*l.random(-1,1):0,r=i?s*l.random(-1,1):0;this.mask.translate(this.position.x+n,this.position.y+r),this.adjustSizeAndRotation(this.w*t,e),this.p.tip(this.mask),this.mask.pop()},drawDefault(t){let e=this.w*this.p.vibration*(this.p.definition+(1-this.p.definition)*l.gaussian()*this.gauss(.5,.9,5,.2,1.2)/t);l.random(0,this.p.quality*t)>.4&&this.mask.circle(this.position.x+.7*e*l.random(-1,1),this.position.y+e*l.random(-1,1),t*this.p.weight*l.random(.85,1.15))},adjustSizeAndRotation(t,e){if(this.mask.scale(t),"image"===this.p.type&&(this.p.blend?this.mask.tint(255,0,0,e/2):this.mask.tint(this.mask.red(this.c),this.mask.green(this.c),this.mask.blue(this.c),e)),"random"===this.p.rotate)this.mask.rotate(l.randInt(0,360));else if("natural"===this.p.rotate){let t=(this.plot?-this.plot.angle(this.position.plotted):-this.dir)+(this.flow?this.position.angle():0);this.mask.rotate(t)}},markerTip(){if(this.isInsideClippingArea()){let t=this.calculatePressure(),e=this.calculateAlpha(t);if(this.mask.fill(255,0,0,e/1.5),"marker"===A.p.type)for(let e=1;e<5;e++)this.drawMarker(t*e/5,!1);else if("custom"===A.p.type||"image"===A.p.type)for(let i=1;i<5;i++)this.drawCustomOrImage(t*i/5,e,!1)}}};function b(t,e){const i="marker"===e.type||"custom"===e.type||"image"===e.type;i||"spray"===e.type||(e.type="default"),"image"===e.type&&(I.add(e.image.src),e.tip=()=>A.mask.image(I.tips.get(A.p.image.src),-A.p.weight/2,-A.p.weight/2,A.p.weight,A.p.weight)),e.blend=!!(i&&!1!==e.blend||e.blend),A.list.set(t,{param:e,colors:[],buffers:[]})}function M(t,e,i=1){C(t),A.c=e,A.w=i,A.isActive=!0}function C(t){A.name=t}function S(t,e,i,s){a();let n=l.dist(t,e,i,s);if(0==n)return;A.initializeDrawingState(t,e,n,!1,!1);let r=m(t,e,i,s);A.draw(r,!1)}function P(t,e,i,s){a(),A.initializeDrawingState(e,i,t.length,!0,t),A.draw(s,!0)}const I={tips:new Map,add(t){this.tips.set(t,!1)},imageToWhite(t){t.loadPixels();for(let e=0;e<4*t.width*t.height;e+=4){let i=(t.pixels[e]+t.pixels[e+1]+t.pixels[e+2])/3;t.pixels[e]=t.pixels[e+1]=t.pixels[e+2]=255,t.pixels[e+3]=255-i}t.updatePixels()},load(){for(let t of this.tips.keys()){let e=(s?n:window.self).loadImage(t,(()=>I.imageToWhite(e)));this.tips.set(t,e)}}};function T(t=5,e=45,i={rand:!1,continuous:!1,gradient:!1}){D.isActive=!0,D.hatchingParams=[t,e,i]}const D={isActive:!1,hatchingParams:[5,45,{}],hatchingBrush:!1,hatch(t){let e=D.hatchingParams[0],i=D.hatchingParams[1],s=D.hatchingParams[2],n=A.c,r=A.name,o=A.w,a=A.isActive;D.hatchingBrush&&M(D.hatchingBrush[0],D.hatchingBrush[1],D.hatchingBrush[2]),i=l.toDegrees(i)%180;let h=1/0,c=-1/0,m=1/0,d=-1/0,u=t=>{for(let e of t.a)h=e[0]<h?e[0]:h,c=e[0]>c?e[0]:c,m=e[1]<m?e[1]:m,d=e[1]>d?e[1]:d};Array.isArray(t)||(t=[t]);for(let e of t)u(e);let p=new E([[h,m],[c,m],[c,d],[h,d]]),f=i<=90&&i>=0?m:d,v=s.gradient?l.map(s.gradient,0,1,1,1.1,!0):1,g=[],x=0,y=e,w=t=>({point1:{x:h+y*t*l.cos(90-i),y:f+y*t*l.sin(90-i)},point2:{x:h+y*t*l.cos(90-i)+l.cos(-i),y:f+y*t*l.sin(90-i)+l.sin(-i)}});for(;p.intersect(w(x)).length>0;){let e=[];for(let i of t)e.push(i.intersect(w(x)));g[x]=e.flat().sort(((t,e)=>t.x===e.x?t.y-e.y:t.x-e.x)),y*=v,x++}let k=[];for(let t of g)void 0!==t[0]&&k.push(t);let _=s.rand?s.rand:0;for(let t=0;t<k.length;t++){let i=k[t],n=t>0&&s.continuous;for(let s=0;s<i.length-1;s+=2)0!==_&&(i[s].x+=_*e*l.random(-10,10),i[s].y+=_*e*l.random(-10,10),i[s+1].x+=_*e*l.random(-10,10),i[s+1].y+=_*e*l.random(-10,10)),S(i[s].x,i[s].y,i[s+1].x,i[s+1].y),n&&S(k[t-1][1].x,k[t-1][1].y,i[s].x,i[s].y)}M(r,n,o),A.isActive=a}},B=D.hatch;class E{constructor(t,e=!1){this.a=t,this.vertices=t.map((t=>({x:t[0],y:t[1]}))),e&&(this.vertices=t),this.sides=this.vertices.map(((t,e,i)=>[t,i[(e+1)%i.length]]))}intersect(t){let e=`${t.point1.x},${t.point1.y}-${t.point2.x},${t.point2.y}`;if(this._intersectionCache&&this._intersectionCache[e])return this._intersectionCache[e];let i=[];for(let e of this.sides){let s=c(t.point1,t.point2,e[0],e[1]);!1!==s&&i.push(s)}return this._intersectionCache||(this._intersectionCache={}),this._intersectionCache[e]=i,i}draw(t=!1,e,i){let s=A.isActive;if(t&&M(t,e,i),A.isActive){a();for(let t of this.sides)S(t[0].x,t[0].y,t[1].x,t[1].y)}A.isActive=s}fill(t=!1,e,i,s,n,r){let o=U.isActive;t&&(W(t,e),q(i,r),j(s,n)),U.isActive&&(a(),U.fill(this)),U.isActive=o}hatch(t=!1,e,i){let s=D.isActive;t&&T(t,e,i),D.isActive&&(a(),D.hatch(this)),D.isActive=s}erase(t=!1,i=N.a){if(N.isActive||t){v.masks[2].push(),v.masks[2].noStroke();let s=e.color(t||N.c);s.setAlpha(i),v.masks[2].fill(s),v.masks[2].beginShape();for(let t of this.vertices)v.masks[2].vertex(t.x,t.y);v.masks[2].endShape(e.CLOSE),v.masks[2].pop()}}show(){this.fill(),this.hatch(),this.draw(),this.erase()}}class F{constructor(t){this.segments=[],this.angles=[],this.pres=[],this.type=t,this.dir=0,this.calcIndex(0),this.pol=!1}addSegment(t=0,e=0,i=1,s=!1){this.angles.length>0&&this.angles.splice(-1),t=s?(t%360+360)%360:l.toDegrees(t),this.angles.push(t),this.pres.push(i),this.segments.push(e),this.length=this.segments.reduce(((t,e)=>t+e),0),this.angles.push(t)}endPlot(t=0,e=1,i=!1){t=i?(t%360+360)%360:l.toDegrees(t),this.angles.splice(-1),this.angles.push(t),this.pres.push(e)}rotate(t){this.dir=l.toDegrees(t)}pressure(t){return t>this.length?this.pres[this.pres.length-1]:this.curving(this.pres,t)}angle(t){return t>this.length?this.angles[this.angles.length-1]:(this.calcIndex(t),"curve"===this.type?this.curving(this.angles,t)+this.dir:this.angles[this.index]+this.dir)}curving(t,e){let i=t[this.index],s=t[this.index+1];return void 0===s&&(s=i),Math.abs(s-i)>180&&(s>i?s=-(360-s):i=-(360-i)),l.map(e-this.suma,0,this.segments[this.index],i,s,!0)}calcIndex(t){this.index=-1,this.suma=0;let e=0;for(;e<=t;)this.suma=e,e+=this.segments[this.index+1],this.index++;return this.index}genPol(t,e,i=1,s=!1){a();const n=.5,r=[],o=Math.round(this.length/n),h=new k(t,e);let c=s?.15:3*U.bleed_strength,m=0,d=0;for(let t=0;t<o;t++){h.plotTo(this,n,n,1);let t=this.calcIndex(h.plotted);m+=n,(m>=this.segments[t]*c*l.random(.7,1.3)||t>=d)&&h.x&&(r.push([h.x,h.y]),m=0,t>=d&&d++)}return new E(r)}draw(t,e,i){A.isActive&&(a(),this.origin&&(t=this.origin[0],e=this.origin[1],i=1),P(this,t,e,i))}fill(t,e,i){U.isActive&&(a(),this.origin&&(t=this.origin[0],e=this.origin[1],i=1),this.pol=this.genPol(t,e,i),this.pol.fill())}hatch(t,e,i){D.isActive&&(a(),this.origin&&(t=this.origin[0],e=this.origin[1],i=1),this.pol=this.genPol(t,e,i,!0),this.pol.hatch())}erase(t,i,s){if(N.isActive){this.origin&&(t=this.origin[0],i=this.origin[1],s=1),this.pol=this.genPol(t,i,s,!0),v.masks[2].push(),v.masks[2].noStroke();let n=e.color(N.c);n.setAlpha(N.a),v.masks[2].fill(n),v.masks[2].beginShape();for(let t of this.pol.vertices)v.masks[2].vertex(t.x,t.y);v.masks[2].endShape(e.CLOSE),v.masks[2].pop()}}show(t,e,i=1){this.draw(t,e,i),this.fill(t,e,i),this.hatch(t,e,i),this.erase(t,e,i)}}let V,R=!1;function G(t=0){V=l.constrain(t,0,1),R=[]}function L(t,e,i){R.push([t,e,i])}function H(t){t===e.CLOSE&&(R.push(R[0]),R.push(R[1])),(0!=V||w.isActive?O(R,V,t===e.CLOSE):new E(R)).show(),R=!1}function O(t,e=.5,i=!1){let s=new F(0===e?"segments":"curve");if(t&&t.length>0){let n,r,o,a=0;for(let h=0;h<t.length-1;h++)if(e>0&&h<t.length-2){let d=t[h],u=t[h+1],p=t[h+2],f=l.dist(d[0],d[1],u[0],u[1]),v=l.dist(u[0],u[1],p[0],p[1]),g=m(d[0],d[1],u[0],u[1]),x=m(u[0],u[1],p[0],p[1]),y=e*Math.min(Math.min(f,v),.5*Math.min(f,v)),w=Math.max(f,v),k=f-y,_=v-y;if(Math.floor(g)===Math.floor(x)){let e=i&&0===h?0:f-a,l=i?0===h?0:v-o:v;s.addSegment(g,e,d[2],!0),h===t.length-3&&s.addSegment(x,l,u[2],!0),a=0,0===h&&(n=f,o=y,r=t[1],a=0)}else{let e={x:u[0]-y*l.cos(-g),y:u[1]-y*l.sin(-g)},m={x:e.x+w*l.cos(90-g),y:e.y+w*l.sin(90-g)},p={x:u[0]+y*l.cos(-x),y:u[1]+y*l.sin(-x)},f=c(e,m,p,{x:p.x+w*l.cos(90-x),y:p.y+w*l.sin(90-x)},!0),v=l.dist(e.x,e.y,f.x,f.y),z=l.dist(e.x,e.y,p.x,p.y)/2,A=2*Math.asin(z/v)*(180/Math.PI),b=2*Math.PI*v*A/360,M=i&&0===h?0:k-a,C=h===t.length-3?i?n-y:_:0;s.addSegment(g,M,d[2],!0),s.addSegment(g,isNaN(b)?0:b,d[2],!0),s.addSegment(x,C,u[2],!0),a=y,0===h&&(n=k,o=y,r=[e.x,e.y])}h==t.length-3&&s.endPlot(x,u[2],!0)}else if(0===e){0===h&&i&&t.pop();let e=t[h],n=t[h+1],r=l.dist(e[0],e[1],n[0],n[1]),o=m(e[0],e[1],n[0],n[1]);s.addSegment(o,r,1,!0),h==t.length-2&&s.endPlot(o,1,!0)}s.origin=i&&0!==e?r:t[0]}return s}const N={};function W(t,i,s,n){a(),U.opacity=arguments.length<4?arguments.length<3?i:1:n,U.color=arguments.length<3?e.color(t):e.color(t,i,s),U.isActive=!0}function q(t,e="out"){a(),U.bleed_strength=l.constrain(t,0,.6),U.direction=e}function j(t=.4,e=.4){a(),U.texture_strength=l.constrain(t,0,1),U.border_strength=l.constrain(e,0,1)}const U={isActive:!1,isAnimated:!1,color:"#002185",opacity:80,bleed_strength:.07,texture_strength:.4,border_strength:.4,fill(t){this.polygon=t,this.v=[...t.vertices];const e=this.v.length*l.random(.4);U.m=this.v.map(((t,i)=>{let s=l.random(.8,1.2)*this.bleed_strength;return i<e?l.constrain(2*s,0,.9):s}));let i=l.randInt(0,this.v.length);if(U.light_source)for(let t=0;t<this.v.length;t++)l.dist(this.v[t].x,this.v[t].y,U.light_source.x,U.light_source.y)<l.dist(this.v[i].x,this.v[i].y,U.light_source.x,U.light_source.y)&&(i=t);this.v=[...this.v.slice(i),...this.v.slice(0,i)],new K(this.v,this.m,this.calcCenter(),[],!0).fill(this.color,Math.floor(l.map(this.opacity,0,155,0,20,!0)),this.texture_strength)},calcCenter(){let t=0,e=0;for(let i=0;i<this.v.length;++i)t+=this.v[i].x,e+=this.v[i].y;return t/=this.v.length,e/=this.v.length,{x:t,y:e}}};class K{constructor(t,e,i,s,n=!1){this.pol=new E(t,!0),this.v=t,this.dir=s,this.m=e,this.midP=i,this.size=-1/0;for(let t of this.v){let e=l.dist(this.midP.x,this.midP.y,t.x,t.y);e>this.size&&(this.size=e)}if(n)for(let t=0;t<this.v.length;t++){const e=this.v[t],i=this.v[(t+1)%this.v.length],s={x:i.x-e.x,y:i.y-e.y},n=_rotate(0,0,s.x,s.y,90);let r={point1:{x:e.x+s.x/2,y:e.y+s.y/2},point2:{x:e.x+s.x/2+n.x,y:e.y+s.y/2+n.y}};const o=(t,e,i)=>(e.x-t.x)*(i.y-t.y)-(e.y-t.y)*(i.x-t.x)>.01;let a=0;for(let t of U.polygon.intersect(r))o(e,i,t)&&a++;this.dir[t]=a%2==0}}trim(t){let e=[...this.v],i=[...this.m],s=[...this.dir];if(this.v.length>10&&t>=.2){let n=~~((1-t)*this.v.length),r=~~this.v.length/2-~~n/2;e.splice(r,n),i.splice(r,n),s.splice(r,n)}return{v:e,m:i,dir:s}}grow(t,e=!1){const i=[],s=[],n=[];let r=this.trim(t);const o=e?-.5:1,a=t=>t+.1*(l.gaussian(.5,.1)-.5);for(let e=0;e<r.v.length;e++){const h=r.v[e],c=r.v[(e+1)%r.v.length];let m=.1===t?U.bleed_strength<=.1?.25:.75:r.m[e];m*=o,i.push(h),s.push(a(m));let d={x:c.x-h.x,y:c.y-h.y},u=r.dir[e],p="out"==U.direction?-90:90,f=(u?p:-p)+45*l.gaussian(0,.4),v=l.constrain(l.gaussian(.5,.2),.1,.9),g={x:h.x+d.x*v,y:h.y+d.y*v},x=l.gaussian(.5,.2)*l.random(.6,1.4)*m,y=_rotate(0,0,d.x,d.y,f);g.x+=y.x*x,g.y+=y.y*x,i.push(g),s.push(a(m)),n.push(u,u)}return new K(i,s,this.midP,n)}fill(t,i,s){let n=l.map(U.bleed_strength,0,.15,.6,1,!0);const r=24*n,o=i/5+s*i/6,a=i/4+s*i/3,h=i/7+s*i/3,c=i/5,m=3*s;v.watercolor=!0,u.trans(),v.blend(t,!1,!1,!0),v.masks[0].push(),v.masks[0].noStroke(),v.masks[0].translate(u.translation[0]+e.width/2,u.translation[1]+e.height/2),v.masks[0].rotate(u.rotation),v.masks[0].scale(p);let d=this.grow(),f=d.grow().grow(.9),g=f.grow(.75),x=this.grow(.6);for(let t=0;t<r;t++)t!==Math.floor(r/4)&&t!==Math.floor(r/2)&&t!==Math.floor(3*r/4)||(d=d.grow(),1!==n&&t!==Math.floor(r/2)||(f=f.grow(.75),g=g.grow(.75),x=x.grow(.1,!0))),d.grow().layer(t,c),x.grow(.1,!0).grow(.1).layer(t,h,!1),f.grow(.1).grow(.1).layer(t,a,!1),g.grow(.8).grow(.1).layer(t,o,!1),0!==m&&d.erase(m,i);v.masks[0].pop()}layer(t,i,s=!0){v.masks[0].fill(255,0,0,i),s?(v.masks[0].stroke(255,0,0,.5+1.5*U.border_strength),v.masks[0].strokeWeight(l.map(t,0,24,6,.5))):v.masks[0].noStroke(),v.masks[0].beginShape();for(let t of this.v)v.masks[0].vertex(t.x,t.y);v.masks[0].endShape(e.CLOSE)}erase(t,e){const i=l.random(130,200),s=this.size/2,n=.025*this.size,r=.19*this.size;v.masks[0].erase(3.5*t-l.map(e,80,120,.3,1,!0),0);for(let t=0;t<i;t++){const t=this.midP.x+l.gaussian(0,s),e=this.midP.y+l.gaussian(0,s),i=l.random(n,r);v.masks[0].circle(t,e,i)}v.masks[0].noErase()}}const $=["weight","vibration","definition","quality","opacity","spacing","pressure","type","tip","rotate"],J=[["pen",[.35,.12,.5,8,200,.3,{curve:[.15,.2],min_max:[1.4,.9]}]],["rotring",[.2,.05,1,3,250,.15,{curve:[.05,.2],min_max:[1.7,.8]}]],["2B",[.35,.5,.1,8,180,.2,{curve:[.15,.2],min_max:[1.3,1]}]],["HB",[.3,.5,.4,4,180,.25,{curve:[.15,.2],min_max:[1.2,.9]}]],["2H",[.2,.4,.3,2,150,.2,{curve:[.15,.2],min_max:[1.2,.9]}]],["cpencil",[.4,.6,.8,7,120,.15,{curve:[.15,.2],min_max:[.95,1.2]}]],["charcoal",[.5,2,.8,300,110,.06,{curve:[.15,.2],min_max:[1.3,.8]}]],["hatch_brush",[.2,.4,.3,2,150,.15,{curve:[.5,.7],min_max:[1,1.5]}]],["spray",[.3,12,15,40,80,.65,{curve:[0,.1],min_max:[.15,1.2]},"spray"]],["marker",[2.5,.12,null,null,25,.4,{curve:[.35,.25],min_max:[1.5,1]},"marker"]],["marker2",[2.5,.12,null,null,25,.35,{curve:[.35,.25],min_max:[1.3,.95]},"custom",function(t){let e=z;t.rect(-1.5*e,-1.5*e,3*e,3*e),t.rect(1*e,1*e,1*e,1*e)},"natural"]]];for(let t of J){let e={};for(let i=0;i<t[1].length;i++)e[$[i]]=t[1][i];b(t[0],e)}t.Plot=F,t.Polygon=E,t.Position=k,t.add=b,t.addField=y,t.beginShape=G,t.beginStroke=function(t,e,i){V=[e,i],R=new F(t)},t.bleed=q,t.box=function(){return Array.from(A.list.keys())},t.circle=function(t,e,i,s=!1){let n=new F("curve"),r=Math.PI*i/2,o=l.random(0,360),a=()=>s?l.random(-1,1):0;n.addSegment(0+o+a(),r+a(),1,!0),n.addSegment(-90+o+a(),r+a(),1,!0),n.addSegment(-180+o+a(),r+a(),1,!0),n.addSegment(-270+o+a(),r+a(),1,!0);let h=s?l.randInt(-5,5):0;s&&n.addSegment(0+o,h*(Math.PI/180)*i,!0),n.endPlot(h+o,1,!0);let c=[t-i*l.sin(o),e-i*l.cos(-o)];n.show(c[0],c[1],1)},t.clip=function(t){A.cr=t},t.colorCache=function(t=!0){v.isCaching=t},t.endShape=H,t.endStroke=function(t,e){R.endPlot(t,e),R.draw(V[0],V[1],1),R=!1},t.erase=function(t="white",e=255){N.isActive=!0,N.c=t,N.a=e},t.field=function(t){a(),w.isActive=!0,w.current=t},t.fill=W,t.fillAnimatedMode=function(t){U.isAnimated=t},t.fillTexture=j,t.flowLine=function(t,e,i,s){a(),A.initializeDrawingState(t,e,i,!0,!1),A.draw(l.toDegrees(s),!1)},t.gravity=function(t,e){a(),U.light_source={x:t,y:e}},t.hatch=T,t.hatchArray=B,t.instance=function(t){s=!0,n=t,x(t)},t.line=S,t.listFields=function(){return Array.from(w.list.keys())},t.load=r,t.noClip=function(){A.cr=null},t.noErase=function(){N.isActive=!1},t.noField=function(){w.isActive=!1},t.noFill=function(){U.isActive=!1},t.noGravity=function(){U.light_source=!1},t.noHatch=function(){D.isActive=!1,D.hatchingBrush=!1},t.noStroke=function(){A.isActive=!1},t.pick=C,t.plot=P,t.polygon=function(t){new E(t).show()},t.pop=function(){w.isActive=d.field.isActive,w.current=d.field.current,A.isActive=d.stroke.isActive,A.name=d.stroke.name,A.c=d.stroke.color,A.w=d.stroke.weight,A.cr=d.stroke.clip,D.isActive=d.hatch.isActive,D.hatchingParams=d.hatch.hatchingParams,D.hatchingBrush=d.hatch.hatchingBrush,U.isActive=d.fill.isActive,U.color=d.fill.color,U.opacity=d.fill.opacity,U.bleed_strength=d.fill.bleed_strength,U.texture_strength=d.fill.texture_strength,U.border_strength=d.fill.border_strength,u.rotation=d.others.rotate},t.preload=function(){I.load()},t.push=function(){d.field.isActive=w.isActive,d.field.current=w.current,d.stroke.isActive=A.isActive,d.stroke.name=A.name,d.stroke.color=A.c,d.stroke.weight=A.w,d.stroke.clip=A.cr,d.hatch.isActive=D.isActive,d.hatch.hatchingParams=D.hatchingParams,d.hatch.hatchingBrush=D.hatchingBrush,d.fill.isActive=U.isActive,d.fill.color=U.color,d.fill.opacity=U.opacity,d.fill.bleed_strength=U.bleed_strength,d.fill.texture_strength=U.texture_strength,d.fill.border_strength=U.border_strength,d.others.rotate=u.rotation},t.reBlend=function(){e.push(),e.set("marker","white",1),e.line(-10,-10,-5,-5),e.pop()},t.reDraw=g,t.rect=function(t,i,s,n,r=e.CORNER){if(r==e.CENTER&&(t-=s/2,i-=n/2),w.isActive)G(0),L(t,i),L(t+s,i),L(t+s,i+n),L(t,i+n),H(e.CLOSE);else{new E([[t,i],[t+s,i],[t+s,i+n],[t,i+n]]).show()}},t.refreshField=function(t){w.refresh(t)},t.remove=o,t.rotate=function(t=0){u.rotation=l.toDegrees(t)},t.scale=f,t.scaleBrushes=_,t.seed=function(t){h=new Math.seedrandom(t)},t.segment=function(t,e,i){R.addSegment(t,e,i)},t.set=M,t.setHatch=function(t,e="black",i=1){D.hatchingBrush=[t,e,i]},t.spline=function(t,e=.5){O(t,e).draw()},t.stroke=function(t,e,i){arguments.length>0&&(A.c=arguments.length<2?t:[t,e,i]),A.isActive=!0},t.strokeWeight=function(t){A.w=t},t.vertex=L}));
