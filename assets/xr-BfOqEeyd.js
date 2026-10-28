import{A as e,B as t,D as n,F as r,G as i,K as a,L as o,N as s,O as c,P as l,R as u,V as d,W as f,X as p,Y as m,_ as h,a as g,at as _,b as v,c as y,d as b,et as x,f as S,g as C,h as w,i as T,it as E,l as D,m as O,o as k,ot as A,p as j,r as ee,rt as M,s as te,t as N,u as P,z as ne}from"./CosmicWormholeIdentity-FjrCRElH.js";import{l as re,n as ie,r as ae,t as F,u as oe}from"./CanvasVisualSource-zxPjYFNZ.js";var I=1e3,L=1001,se=1002,R=1003,ce=1004,le=1005,z=1006,ue=1007,de=1008,fe=1009,pe=1010,me=1011,he=1012,ge=1013,_e=1014,ve=1015,ye=1016,be=1017,xe=1018,Se=1020,Ce=35902,we=35899,Te=1021,B=1022,Ee=1023,De=1026,Oe=1027,V=1028,ke=1029,Ae=1030,je=1031,Me=1033,H=33776,Ne=33777,Pe=33778,Fe=33779,Ie=35840,Le=35841,Re=35842,ze=35843,Be=36196,Ve=37492,He=37496,Ue=37488,We=37489,Ge=37490,Ke=37491,qe=37808,Je=37809,Ye=37810,Xe=37811,Ze=37812,Qe=37813,$e=37814,et=37815,tt=37816,nt=37817,rt=37818,it=37819,at=37820,ot=37821,st=36492,ct=36494,lt=36495,ut=36283,dt=36284,ft=36285,pt=36286,mt=2300,ht=2301,gt=2302,_t=2303,vt=2400,yt=2401,bt=2402,xt=3200,St=`srgb`,Ct=`srgb-linear`,wt=`linear`,Tt=`srgb`,Et=7680,Dt=35044,Ot=35048,kt=`300 es`,At=2e3;function jt(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function Mt(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function Nt(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function Pt(){let e=Nt(`canvas`);return e.style.display=`block`,e}var Ft={},It=null;function Lt(...e){let t=`THREE.`+e.shift();It?It(`log`,t,...e):console.log(t,...e)}function Rt(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function U(...e){e=Rt(e);let t=`THREE.`+e.shift();if(It)It(`warn`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function W(...e){e=Rt(e);let t=`THREE.`+e.shift();if(It)It(`error`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function zt(...e){let t=e.join(` `);t in Ft||(Ft[t]=!0,U(...e))}function Bt(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var Vt={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},Ht=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},Ut=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),Wt=1234567,Gt=Math.PI/180,Kt=180/Math.PI;function qt(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(Ut[e&255]+Ut[e>>8&255]+Ut[e>>16&255]+Ut[e>>24&255]+`-`+Ut[t&255]+Ut[t>>8&255]+`-`+Ut[t>>16&15|64]+Ut[t>>24&255]+`-`+Ut[n&63|128]+Ut[n>>8&255]+`-`+Ut[n>>16&255]+Ut[n>>24&255]+Ut[r&255]+Ut[r>>8&255]+Ut[r>>16&255]+Ut[r>>24&255]).toLowerCase()}function G(e,t,n){return Math.max(t,Math.min(n,e))}function Jt(e,t){return(e%t+t)%t}function Yt(e,t,n,r,i){return r+(e-t)*(i-r)/(n-t)}function Xt(e,t,n){return e===t?0:(n-e)/(t-e)}function Zt(e,t,n){return(1-n)*e+n*t}function Qt(e,t,n,r){return Zt(e,t,1-Math.exp(-n*r))}function $t(e,t=1){return t-Math.abs(Jt(e,t*2)-t)}function en(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function tn(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function nn(e,t){return e+Math.floor(Math.random()*(t-e+1))}function rn(e,t){return e+Math.random()*(t-e)}function an(e){return e*(.5-Math.random())}function on(e){e!==void 0&&(Wt=e);let t=Wt+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function sn(e){return e*Gt}function cn(e){return e*Kt}function ln(e){return e>0&&Number.isInteger(e)&&2**Math.round(Math.log2(e))===e}function un(e){return 2**Math.ceil(Math.log(e)/Math.LN2)}function dn(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function fn(e,t,n,r,i){let a=Math.cos,o=Math.sin,s=a(n/2),c=o(n/2),l=a((t+r)/2),u=o((t+r)/2),d=a((t-r)/2),f=o((t-r)/2),p=a((r-t)/2),m=o((r-t)/2);switch(i){case`XYX`:e.set(s*u,c*d,c*f,s*l);break;case`YZY`:e.set(c*f,s*u,c*d,s*l);break;case`ZXZ`:e.set(c*d,c*f,s*u,s*l);break;case`XZX`:e.set(s*u,c*m,c*p,s*l);break;case`YXY`:e.set(c*p,s*u,c*m,s*l);break;case`ZYZ`:e.set(c*m,c*p,s*u,s*l);break;default:U(`MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: `+i)}}function pn(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:case Uint8ClampedArray:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}function mn(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`THREE.MathUtils: Invalid component type.`)}}var hn={DEG2RAD:Gt,RAD2DEG:Kt,generateUUID:qt,clamp:G,euclideanModulo:Jt,mapLinear:Yt,inverseLerp:Xt,lerp:Zt,damp:Qt,pingpong:$t,smoothstep:en,smootherstep:tn,randInt:nn,randFloat:rn,randFloatSpread:an,seededRandom:on,degToRad:sn,radToDeg:cn,isPowerOfTwo:ln,ceilPowerOfTwo:un,floorPowerOfTwo:dn,setQuaternionFromProperEuler:fn,normalize:mn,denormalize:pn},K=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`THREE.Vector2: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`THREE.Vector2: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=G(this.x,e.x,t.x),this.y=G(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=G(this.x,e,t),this.y=G(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(G(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(G(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},gn=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:U(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(G(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},q=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`THREE.Vector3: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`THREE.Vector3: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(vn.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(vn.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=G(this.x,e.x,t.x),this.y=G(this.y,e.y,t.y),this.z=G(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=G(this.x,e,t),this.y=G(this.y,e,t),this.z=G(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(G(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return _n.copy(this).projectOnVector(e),this.sub(_n)}reflect(e){return this.sub(_n.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(G(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},_n=new q,vn=new gn,J=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return zt(`Matrix3: .scale() is deprecated. Use .makeScale() instead.`),this.premultiply(yn.makeScale(e,t)),this}rotate(e){return zt(`Matrix3: .rotate() is deprecated. Use .makeRotation() instead.`),this.premultiply(yn.makeRotation(-e)),this}translate(e,t){return zt(`Matrix3: .translate() is deprecated. Use .makeTranslation() instead.`),this.premultiply(yn.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},yn=new J,bn=new J().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),xn=new J().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Sn(){let e={enabled:!0,workingColorSpace:Ct,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n?e:(this.spaces[t].transfer===`srgb`&&(e.r=wn(e.r),e.g=wn(e.g),e.b=wn(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=Tn(e.r),e.g=Tn(e.g),e.b=Tn(e.b)),e)},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?wt:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return zt(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return zt(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[Ct]:{primaries:t,whitePoint:r,transfer:wt,toXYZ:bn,fromXYZ:xn,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:St},outputColorSpaceConfig:{drawingBufferColorSpace:St}},[St]:{primaries:t,whitePoint:r,transfer:Tt,toXYZ:bn,fromXYZ:xn,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:St}}}),e}var Cn=Sn();function wn(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function Tn(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var En,Dn=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{En===void 0&&(En=Nt(`canvas`)),En.width=e.width,En.height=e.height;let t=En.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=En}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=Nt(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=wn(i[e]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(wn(t[e]/255)*255):t[e]=wn(t[e]);return{data:t,width:e.width,height:e.height}}else return U(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},On=0,kn=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:On++}),this.uuid=qt(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(An(r[t].image)):e.push(An(r[t]))}else e=An(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function An(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?Dn.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(U(`Texture: Unable to serialize Texture.`),{})}var jn=0,Mn=new q,Nn=class e extends Ht{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,r=L,i=L,a=z,o=de,s=Ee,c=fe,l=e.DEFAULT_ANISOTROPY,u=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:jn++}),this.uuid=qt(),this.name=``,this.source=new kn(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=r,this.wrapT=i,this.magFilter=a,this.minFilter=o,this.anisotropy=l,this.format=s,this.internalFormat=null,this.type=c,this.offset=new K(0,0),this.repeat=new K(1,1),this.center=new K(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new J,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Mn).x}get height(){return this.source.getSize(Mn).y}get depth(){return this.source.getSize(Mn).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){U(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){U(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case I:e.x-=Math.floor(e.x);break;case L:e.x=e.x<0?0:1;break;case se:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x-=Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case I:e.y-=Math.floor(e.y);break;case L:e.y=e.y<0?0:1;break;case se:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y-=Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Nn.DEFAULT_IMAGE=null,Nn.DEFAULT_MAPPING=300,Nn.DEFAULT_ANISOTROPY=1;var Pn=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`THREE.Vector4: index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`THREE.Vector4: index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=G(this.x,e.x,t.x),this.y=G(this.y,e.y,t.y),this.z=G(this.z,e.z,t.z),this.w=G(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=G(this.x,e,t),this.y=G(this.y,e,t),this.z=G(this.z,e,t),this.w=G(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(G(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Fn=class extends Ht{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:z,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Pn(0,0,e,t),this.scissorTest=!1,this.viewport=new Pn(0,0,e,t),this.textures=[];let r=new Nn({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:z,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new kn(n)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:`dispose`})}},In=class extends Fn{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Ln=class extends Nn{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=R,this.minFilter=R,this.wrapR=L,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},Rn=class extends Nn{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=R,this.minFilter=R,this.wrapR=L,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}},zn=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Bn.setFromMatrixColumn(e,0).length(),i=1/Bn.setFromMatrixColumn(e,1).length(),a=1/Bn.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Hn,e,Un)}lookAt(e,t,n){let r=this.elements;return Kn.subVectors(e,t),Kn.lengthSq()===0&&(Kn.z=1),Kn.normalize(),Wn.crossVectors(n,Kn),Wn.lengthSq()===0&&(Math.abs(n.z)===1?Kn.x+=1e-4:Kn.z+=1e-4,Kn.normalize(),Wn.crossVectors(n,Kn)),Wn.normalize(),Gn.crossVectors(Kn,Wn),r[0]=Wn.x,r[4]=Gn.x,r[8]=Kn.x,r[1]=Wn.y,r[5]=Gn.y,r[9]=Kn.y,r[2]=Wn.z,r[6]=Gn.z,r[10]=Kn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],j=r[10],ee=r[14],M=r[3],te=r[7],N=r[11],P=r[15];return i[0]=a*x+o*T+s*k+c*M,i[4]=a*S+o*E+s*A+c*te,i[8]=a*C+o*D+s*j+c*N,i[12]=a*w+o*O+s*ee+c*P,i[1]=l*x+u*T+d*k+f*M,i[5]=l*S+u*E+d*A+f*te,i[9]=l*C+u*D+d*j+f*N,i[13]=l*w+u*O+d*ee+f*P,i[2]=p*x+m*T+h*k+g*M,i[6]=p*S+m*E+h*A+g*te,i[10]=p*C+m*D+h*j+g*N,i[14]=p*w+m*O+h*ee+g*P,i[3]=_*x+v*T+y*k+b*M,i[7]=_*S+v*E+y*A+b*te,i[11]=_*C+v*D+y*j+b*N,i[15]=_*w+v*O+y*ee+b*P,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[1],a=e[5],o=e[9],s=e[2],c=e[6],l=e[10];return t*(a*l-o*c)-n*(i*l-o*s)+r*(i*c-a*s)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinantAffine();if(i===0)return n.set(1,1,1),t.identity(),this;let a=Bn.set(r[0],r[1],r[2]).length(),o=Bn.set(r[4],r[5],r[6]).length(),s=Bn.set(r[8],r[9],r[10]).length();i<0&&(a=-a),Vn.copy(this);let c=1/a,l=1/o,u=1/s;return Vn.elements[0]*=c,Vn.elements[1]*=c,Vn.elements[2]*=c,Vn.elements[4]*=l,Vn.elements[5]*=l,Vn.elements[6]*=l,Vn.elements[8]*=u,Vn.elements[9]*=u,Vn.elements[10]*=u,t.setFromRotationMatrix(Vn),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=At,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=At,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Bn=new q,Vn=new zn,Hn=new q(0,0,0),Un=new q(1,1,1),Wn=new q,Gn=new q,Kn=new q,qn=new zn,Jn=new gn,Yn=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(G(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-G(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(G(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-G(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(G(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-G(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:U(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return qn.makeRotationFromQuaternion(e),this.setFromRotationMatrix(qn,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Jn.setFromEuler(this),this.setFromQuaternion(Jn,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Yn.DEFAULT_ORDER=`XYZ`;var Xn=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!=0}},Zn=0,Qn=new q,$n=new gn,er=new zn,tr=new q,nr=new q,rr=new q,ir=new gn,ar=new q(1,0,0),or=new q(0,1,0),sr=new q(0,0,1),cr={type:`added`},lr={type:`removed`},ur={type:`childadded`,child:null},dr={type:`childremoved`,child:null},fr=class e extends Ht{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Zn++}),this.uuid=qt(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new q,n=new Yn,r=new gn,i=new q(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new zn},normalMatrix:{value:new J}}),this.matrix=new zn,this.matrixWorld=new zn,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Xn,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return $n.setFromAxisAngle(e,t),this.quaternion.multiply($n),this}rotateOnWorldAxis(e,t){return $n.setFromAxisAngle(e,t),this.quaternion.premultiply($n),this}rotateX(e){return this.rotateOnAxis(ar,e)}rotateY(e){return this.rotateOnAxis(or,e)}rotateZ(e){return this.rotateOnAxis(sr,e)}translateOnAxis(e,t){return Qn.copy(e).applyQuaternion(this.quaternion),this.position.add(Qn.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(ar,e)}translateY(e){return this.translateOnAxis(or,e)}translateZ(e){return this.translateOnAxis(sr,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(er.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?tr.copy(e):tr.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),nr.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?er.lookAt(nr,tr,this.up):er.lookAt(tr,nr,this.up),this.quaternion.setFromRotationMatrix(er),r&&(er.extractRotation(r.matrixWorld),$n.setFromRotationMatrix(er),this.quaternion.premultiply($n.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(W(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(cr),ur.child=e,this.dispatchEvent(ur),ur.child=null):W(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(lr),dr.child=e,this.dispatchEvent(dr),dr.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),er.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),er.multiply(e.parent.matrixWorld)),e.applyMatrix4(er),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(cr),ur.child=e,this.dispatchEvent(ur),ur.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(nr,e,rr),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(nr,ir,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let e=this.children;for(let t=0,r=e.length;t<r;t++)e[t].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material);if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:`dispose`})}};fr.DEFAULT_UP=new q(0,1,0),fr.DEFAULT_MATRIX_AUTO_UPDATE=!0,fr.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var pr=class extends fr{constructor(){super(),this.isGroup=!0,this.type=`Group`}},mr={type:`move`},hr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new pr,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new pr,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new q,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new q),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new pr,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new q,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new q,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(mr)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new pr;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},gr={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},_r={h:0,s:0,l:0},vr={h:0,s:0,l:0};function yr(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var Y=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=St){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Cn.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=Cn.workingColorSpace){return this.r=e,this.g=t,this.b=n,Cn.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=Cn.workingColorSpace){if(e=Jt(e,1),t=G(t,0,1),n=G(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=yr(i,r,e+1/3),this.g=yr(i,r,e),this.b=yr(i,r,e-1/3)}return Cn.colorSpaceToWorking(this,r),this}setStyle(e,t=St){function n(t){t!==void 0&&parseFloat(t)<1&&U(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:U(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);U(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=St){let n=gr[e.toLowerCase()];return n===void 0?U(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=wn(e.r),this.g=wn(e.g),this.b=wn(e.b),this}copyLinearToSRGB(e){return this.r=Tn(e.r),this.g=Tn(e.g),this.b=Tn(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=St){return Cn.workingToColorSpace(br.copy(this),e),Math.round(G(br.r*255,0,255))*65536+Math.round(G(br.g*255,0,255))*256+Math.round(G(br.b*255,0,255))}getHexString(e=St){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Cn.workingColorSpace){Cn.workingToColorSpace(br.copy(this),t);let n=br.r,r=br.g,i=br.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4;break}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=Cn.workingColorSpace){return Cn.workingToColorSpace(br.copy(this),t),e.r=br.r,e.g=br.g,e.b=br.b,e}getStyle(e=St){Cn.workingToColorSpace(br.copy(this),e);let t=br.r,n=br.g,r=br.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(_r),this.setHSL(_r.h+e,_r.s+t,_r.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(_r),e.getHSL(vr);let n=Zt(_r.h,vr.h,t),r=Zt(_r.s,vr.s,t),i=Zt(_r.l,vr.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},br=new Y;Y.NAMES=gr;var xr=class extends fr{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Yn,this.environmentIntensity=1,this.environmentRotation=new Yn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Sr=new q,Cr=new q,wr=new q,Tr=new q,Er=new q,Dr=new q,Or=new q,kr=new q,Ar=new q,jr=new q,Mr=new Pn,Nr=new Pn,Pr=new Pn,Fr=class e{constructor(e=new q,t=new q,n=new q){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),Sr.subVectors(e,t),r.cross(Sr);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){Sr.subVectors(r,t),Cr.subVectors(n,t),wr.subVectors(e,t);let a=Sr.dot(Sr),o=Sr.dot(Cr),s=Sr.dot(wr),c=Cr.dot(Cr),l=Cr.dot(wr),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,Tr)===null?!1:Tr.x>=0&&Tr.y>=0&&Tr.x+Tr.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,Tr)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,Tr.x),s.addScaledVector(a,Tr.y),s.addScaledVector(o,Tr.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return Mr.setScalar(0),Nr.setScalar(0),Pr.setScalar(0),Mr.fromBufferAttribute(e,t),Nr.fromBufferAttribute(e,n),Pr.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(Mr,i.x),a.addScaledVector(Nr,i.y),a.addScaledVector(Pr,i.z),a}static isFrontFacing(e,t,n,r){return Sr.subVectors(n,t),Cr.subVectors(e,t),Sr.cross(Cr).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Sr.subVectors(this.c,this.b),Cr.subVectors(this.a,this.b),Sr.cross(Cr).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;Er.subVectors(r,n),Dr.subVectors(i,n),kr.subVectors(e,n);let s=Er.dot(kr),c=Dr.dot(kr);if(s<=0&&c<=0)return t.copy(n);Ar.subVectors(e,r);let l=Er.dot(Ar),u=Dr.dot(Ar);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector(Er,a);jr.subVectors(e,i);let f=Er.dot(jr),p=Dr.dot(jr);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(Dr,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return Or.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(Or,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(Er,a).addScaledVector(Dr,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Ir=class{constructor(e=new q(1/0,1/0,1/0),t=new q(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Rr.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Rr.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Rr.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,Rr):Rr.fromBufferAttribute(r,t),Rr.applyMatrix4(e.matrixWorld),this.expandByPoint(Rr);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),zr.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),zr.copy(e.boundingBox)),zr.applyMatrix4(e.matrixWorld),this.union(zr)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Rr),Rr.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Kr),qr.subVectors(this.max,Kr),Br.subVectors(e.a,Kr),Vr.subVectors(e.b,Kr),Hr.subVectors(e.c,Kr),Ur.subVectors(Vr,Br),Wr.subVectors(Hr,Vr),Gr.subVectors(Br,Hr);let t=[0,-Ur.z,Ur.y,0,-Wr.z,Wr.y,0,-Gr.z,Gr.y,Ur.z,0,-Ur.x,Wr.z,0,-Wr.x,Gr.z,0,-Gr.x,-Ur.y,Ur.x,0,-Wr.y,Wr.x,0,-Gr.y,Gr.x,0];return!Xr(t,Br,Vr,Hr,qr)||(t=[1,0,0,0,1,0,0,0,1],!Xr(t,Br,Vr,Hr,qr))?!1:(Jr.crossVectors(Ur,Wr),t=[Jr.x,Jr.y,Jr.z],Xr(t,Br,Vr,Hr,qr))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Rr).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Rr).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Lr[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Lr[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Lr[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Lr[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Lr[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Lr[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Lr[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Lr[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Lr),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Lr=[new q,new q,new q,new q,new q,new q,new q,new q],Rr=new q,zr=new Ir,Br=new q,Vr=new q,Hr=new q,Ur=new q,Wr=new q,Gr=new q,Kr=new q,qr=new q,Jr=new q,Yr=new q;function Xr(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){Yr.fromArray(e,a);let o=i.x*Math.abs(Yr.x)+i.y*Math.abs(Yr.y)+i.z*Math.abs(Yr.z),s=t.dot(Yr),c=n.dot(Yr),l=r.dot(Yr);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var Zr=new q,Qr=new K,$r=0,ei=class extends Ht{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:$r++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=Dt,this.updateRanges=[],this.gpuType=ve,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Qr.fromBufferAttribute(this,t),Qr.applyMatrix3(e),this.setXY(t,Qr.x,Qr.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Zr.fromBufferAttribute(this,t),Zr.applyMatrix3(e),this.setXYZ(t,Zr.x,Zr.y,Zr.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Zr.fromBufferAttribute(this,t),Zr.applyMatrix4(e),this.setXYZ(t,Zr.x,Zr.y,Zr.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Zr.fromBufferAttribute(this,t),Zr.applyNormalMatrix(e),this.setXYZ(t,Zr.x,Zr.y,Zr.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Zr.fromBufferAttribute(this,t),Zr.transformDirection(e),this.setXYZ(t,Zr.x,Zr.y,Zr.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=pn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=mn(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=pn(t,this.array)),t}setX(e,t){return this.normalized&&(t=mn(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=pn(t,this.array)),t}setY(e,t){return this.normalized&&(t=mn(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=pn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=mn(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=pn(t,this.array)),t}setW(e,t){return this.normalized&&(t=mn(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=mn(t,this.array),n=mn(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=mn(t,this.array),n=mn(n,this.array),r=mn(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=mn(t,this.array),n=mn(n,this.array),r=mn(r,this.array),i=mn(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:`dispose`})}},ti=class extends ei{constructor(e,t,n){super(new Uint16Array(e),t,n)}},ni=class extends ei{constructor(e,t,n){super(new Uint32Array(e),t,n)}},ri=class extends ei{constructor(e,t,n){super(new Float32Array(e),t,n)}},ii=new Ir,ai=new q,oi=new q,si=class{constructor(e=new q,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?ii.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;ai.subVectors(e,this.center);let t=ai.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(ai,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(oi.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(ai.copy(e.center).add(oi)),this.expandByPoint(ai.copy(e.center).sub(oi))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},ci=0,li=new zn,ui=new fr,di=new q,fi=new Ir,pi=new Ir,mi=new q,hi=class e extends Ht{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:ci++}),this.uuid=qt(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(jt(e)?ni:ti)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new J().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return li.makeRotationFromQuaternion(e),this.applyMatrix4(li),this}rotateX(e){return li.makeRotationX(e),this.applyMatrix4(li),this}rotateY(e){return li.makeRotationY(e),this.applyMatrix4(li),this}rotateZ(e){return li.makeRotationZ(e),this.applyMatrix4(li),this}translate(e,t,n){return li.makeTranslation(e,t,n),this.applyMatrix4(li),this}scale(e,t,n){return li.makeScale(e,t,n),this.applyMatrix4(li),this}lookAt(e){return ui.lookAt(e),ui.updateMatrix(),this.applyMatrix4(ui.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(di).negate(),this.translate(di.x,di.y,di.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new ri(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&U(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ir);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){W(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new q(-1/0,-1/0,-1/0),new q(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];fi.setFromBufferAttribute(n),this.morphTargetsRelative?(mi.addVectors(this.boundingBox.min,fi.min),this.boundingBox.expandByPoint(mi),mi.addVectors(this.boundingBox.max,fi.max),this.boundingBox.expandByPoint(mi)):(this.boundingBox.expandByPoint(fi.min),this.boundingBox.expandByPoint(fi.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&W(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new si);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){W(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new q,1/0);return}if(e){let n=this.boundingSphere.center;if(fi.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];pi.setFromBufferAttribute(n),this.morphTargetsRelative?(mi.addVectors(fi.min,pi.min),fi.expandByPoint(mi),mi.addVectors(fi.max,pi.max),fi.expandByPoint(mi)):(fi.expandByPoint(pi.min),fi.expandByPoint(pi.max))}fi.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)mi.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(mi));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)mi.fromBufferAttribute(a,t),o&&(di.fromBufferAttribute(e,t),mi.add(di)),r=Math.max(r,n.distanceToSquared(mi))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&W(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){W(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv,a=this.getAttribute(`tangent`);(a===void 0||a.count!==n.count)&&(a=new ei(new Float32Array(4*n.count),4),this.setAttribute(`tangent`,a));let o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new q,s[e]=new q;let c=new q,l=new q,u=new q,d=new K,f=new K,p=new K,m=new q,h=new q;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new q,y=new q,b=new q,x=new q;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0||n.count!==t.count)n=new ei(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new q,i=new q,a=new q,o=new q,s=new q,c=new q,l=new q,u=new q;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)mi.fromBufferAttribute(e,t),mi.normalize(),e.setXYZ(t,mi.x,mi.y,mi.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new ei(a,r,i)}if(this.index===null)return U(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?`BufferGeometry`:this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:`dispose`})}},gi=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e===void 0?0:e.length/t,this.usage=Dt,this.updateRanges=[],this.version=0,this.uuid=qt()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let r=0,i=this.stride;r<i;r++)this.array[e+r]=t.array[n+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=qt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=qt()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}},_i=new q,vi=class e{constructor(e,t,n,r=!1){this.isInterleavedBufferAttribute=!0,this.name=``,this.data=e,this.itemSize=t,this.offset=n,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)_i.fromBufferAttribute(this,t),_i.applyMatrix4(e),this.setXYZ(t,_i.x,_i.y,_i.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)_i.fromBufferAttribute(this,t),_i.applyNormalMatrix(e),this.setXYZ(t,_i.x,_i.y,_i.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)_i.fromBufferAttribute(this,t),_i.transformDirection(e),this.setXYZ(t,_i.x,_i.y,_i.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=pn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=mn(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=mn(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=mn(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=mn(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=mn(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=pn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=pn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=pn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=pn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=mn(t,this.array),n=mn(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=mn(t,this.array),n=mn(n,this.array),r=mn(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=mn(t,this.array),n=mn(n,this.array),r=mn(r,this.array),i=mn(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this.data.array[e+3]=i,this}clone(t){if(t===void 0){Lt(`InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.`);let e=[];for(let t=0;t<this.count;t++){let n=t*this.data.stride+this.offset;for(let t=0;t<this.itemSize;t++)e.push(this.data.array[n+t])}return new ei(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new e(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Lt(`InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.`);let e=[];for(let t=0;t<this.count;t++){let n=t*this.data.stride+this.offset;for(let t=0;t<this.itemSize;t++)e.push(this.data.array[n+t])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},yi=new q,bi=new q,xi=new J,Si=class{constructor(e=new q(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=yi.subVectors(n,t).cross(bi.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(yi),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||xi.getNormalMatrix(e),r=this.coplanarPoint(yi).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},Ci=0,wi=class extends Ht{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Ci++}),this.uuid=qt(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Y(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Et,this.stencilZFail=Et,this.stencilZPass=Et,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){U(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){U(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(e=>e.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Y().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(e=>new Si().fromJSON(e))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors==`number`?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let t=e.normalScale;Array.isArray(t)===!1&&(t=[t,t]),this.normalScale=new K().fromArray(t)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new K().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},Ti=new q,Ei=new q,Di=new q,Oi=new q,ki=class{constructor(e=new q,t=new q(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Ti)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=Ti.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Ti.copy(this.origin).addScaledVector(this.direction,t),Ti.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){Ei.copy(e).add(t).multiplyScalar(.5),Di.copy(t).sub(e).normalize(),Oi.copy(this.origin).sub(Ei);let i=e.distanceTo(t)*.5,a=-this.direction.dot(Di),o=Oi.dot(this.direction),s=-Oi.dot(Di),c=Oi.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0)if(u=a*s-o,d=a*o-s,p=i*l,u>=0)if(d>=-p)if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c);else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(Ei).addScaledVector(Di,d),f}intersectSphere(e,t){if(e.radius<0)return null;Ti.subVectors(e.center,this.origin);let n=Ti.dot(this.direction),r=Ti.dot(Ti)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,Ti)!==null}intersectTriangle(e,t,n,r,i){let a=this.origin,o=this.direction,s=o.x,c=o.y,l=o.z,u=e.x-a.x,d=e.y-a.y,f=e.z-a.z,p=t.x-a.x,m=t.y-a.y,h=t.z-a.z,g=n.x-a.x,_=n.y-a.y,v=n.z-a.z,y=Math.abs(s),b=Math.abs(c),x=Math.abs(l),S,C,w,T,E,D,O,k,A,j,ee,M;if(y>=b&&y>=x?(w=s,D=u,A=p,M=g,s>=0?(S=c,C=l,T=d,E=f,O=m,k=h,j=_,ee=v):(S=l,C=c,T=f,E=d,O=h,k=m,j=v,ee=_)):b>=x?(w=c,D=d,A=m,M=_,c>=0?(S=l,C=s,T=f,E=u,O=h,k=p,j=v,ee=g):(S=s,C=l,T=u,E=f,O=p,k=h,j=g,ee=v)):(w=l,D=f,A=h,M=v,l>=0?(S=s,C=c,T=u,E=d,O=p,k=m,j=g,ee=_):(S=c,C=s,T=d,E=u,O=m,k=p,j=_,ee=g)),w===0)return null;let te=S/w,N=C/w,P=1/w,ne=T-te*D,re=E-N*D,ie=O-te*A,ae=k-N*A,F=j-te*M,oe=ee-N*M,I=F*ae-oe*ie,L=ne*oe-re*F,se=ie*re-ae*ne;if(r){if(I<0||L<0||se<0)return null}else if((I<0||L<0||se<0)&&(I>0||L>0||se>0))return null;let R=I+L+se;if(R===0)return null;let ce=P*(I*D+L*A+se*M);return(R>0?ce<0:ce>0)?null:this.at(ce/R,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Ai=class extends wi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new Y(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},ji=new zn,Mi=new ki,Ni=new si,Pi=new q,Fi=new q,Ii=new q,Li=new q,Ri=new q,zi=new q,Bi=new q,Vi=new q,X=class extends fr{constructor(e=new hi,t=new Ai){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){zi.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(Ri.fromBufferAttribute(s,e),a?zi.addScaledVector(Ri,r):zi.addScaledVector(Ri.sub(t),r))}t.add(zi)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Ni.copy(n.boundingSphere),Ni.applyMatrix4(i),Mi.copy(e.ray).recast(e.near),!(Ni.containsPoint(Mi.origin)===!1&&(Mi.intersectSphere(Ni,Pi)===null||Mi.origin.distanceToSquared(Pi)>(e.far-e.near)**2))&&(ji.copy(i).invert(),Mi.copy(e.ray).applyMatrix4(ji),!(n.boundingBox!==null&&Mi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,Mi)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null)if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=Ui(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=Ui(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}else if(s!==void 0)if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=Ui(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=Ui(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}};function Hi(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;Vi.copy(s),Vi.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(Vi);return l<n.near||l>n.far?null:{distance:l,point:Vi.clone(),object:e}}function Ui(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,Fi),e.getVertexPosition(c,Ii),e.getVertexPosition(l,Li);let u=Hi(e,t,n,r,Fi,Ii,Li,Bi);if(u){let e=new q;Fr.getBarycoord(Bi,Fi,Ii,Li,e),i&&(u.uv=Fr.getInterpolatedAttribute(i,s,c,l,e,new K)),a&&(u.uv1=Fr.getInterpolatedAttribute(a,s,c,l,e,new K)),o&&(u.normal=Fr.getInterpolatedAttribute(o,s,c,l,e,new q),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new q,materialIndex:0};Fr.getNormal(Fi,Ii,Li,t.normal),u.face=t,u.barycoord=e}return u}var Wi=class extends Nn{constructor(e=null,t=1,n=1,r,i,a,o,s,c=R,l=R,u,d){super(null,a,o,s,c,l,r,i,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Gi=class extends ei{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Ki=new zn,qi=new zn,Ji=[],Yi=new Ir,Xi=new zn,Zi=new X,Qi=new si,$i=class extends X{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Gi(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,Xi)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Ir),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ki),Yi.copy(e.boundingBox).applyMatrix4(Ki),this.boundingBox.union(Yi)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new si),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ki),Qi.copy(e.boundingSphere).applyMatrix4(Ki),this.boundingSphere.union(Qi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Zi.geometry=this.geometry,Zi.material=this.material,Zi.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Qi.copy(this.boundingSphere),Qi.applyMatrix4(n),e.ray.intersectsSphere(Qi)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,Ki),qi.multiplyMatrices(n,Ki),Zi.matrixWorld=qi,Zi.raycast(e,Ji);for(let e=0,n=Ji.length;e<n;e++){let n=Ji[e];n.instanceId=i,n.object=this,t.push(n)}Ji.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Gi(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new Wi(new Float32Array(r*this.count),r,this.count,V,ve));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},ea=new si,ta=new K(.5,.5),na=new q,ra=class{constructor(e=new Si,t=new Si,n=new Si,r=new Si,i=new Si,a=new Si){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=At,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ea.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ea.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ea)}intersectsSprite(e){return ea.center.set(0,0,0),ea.radius=.7071067811865476+ta.distanceTo(e.center),ea.applyMatrix4(e.matrixWorld),this.intersectsSphere(ea)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(na.x=r.normal.x>0?e.max.x:e.min.x,na.y=r.normal.y>0?e.max.y:e.min.y,na.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(na)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},ia=class extends wi{constructor(e){super(),this.isPointsMaterial=!0,this.type=`PointsMaterial`,this.color=new Y(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},aa=new zn,oa=new ki,sa=new si,ca=new q,la=class extends fr{constructor(e=new hi,t=new ia){super(),this.isPoints=!0,this.type=`Points`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),sa.copy(n.boundingSphere),sa.applyMatrix4(r),sa.radius+=i,e.ray.intersectsSphere(sa)===!1)return;aa.copy(r).invert(),oa.copy(e.ray).applyMatrix4(aa);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=n.index,l=n.attributes.position;if(c!==null){let n=Math.max(0,a.start),i=Math.min(c.count,a.start+a.count);for(let a=n,o=i;a<o;a++){let n=c.getX(a);ca.fromBufferAttribute(l,n),ua(ca,n,s,r,e,t,this)}}else{let n=Math.max(0,a.start),i=Math.min(l.count,a.start+a.count);for(let a=n,o=i;a<o;a++)ca.fromBufferAttribute(l,a),ua(ca,a,s,r,e,t,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function ua(e,t,n,r,i,a,o){let s=oa.distanceSqToPoint(e);if(s<n){let n=new q;oa.closestPointToPoint(e,n),n.applyMatrix4(r);let c=i.ray.origin.distanceTo(n);if(c<i.near||c>i.far)return;a.push({distance:c,distanceToRay:Math.sqrt(s),point:n,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var da=class extends Nn{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},fa=class extends Nn{constructor(e,t,n,r,i,a,o,s,c){super(e,t,n,r,i,a,o,s,c),this.isCanvasTexture=!0,this.needsUpdate=!0}},pa=class extends Nn{constructor(e,t,n=_e,r,i,a,o=R,s=R,c,l=De,u=1){if(l!==1026&&l!==1027)throw Error(`THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:u},r,i,a,o,s,l,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new kn(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},ma=class extends pa{constructor(e,t=_e,n=301,r,i,a=R,o=R,s,c=De){let l={width:e,height:e,depth:1},u=[l,l,l,l,l,l];super(e,e,t,n,r,i,a,o,s,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},ha=class extends Nn{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},ga=class e extends hi{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new ri(c,3)),this.setAttribute(`normal`,new ri(l,3)),this.setAttribute(`uv`,new ri(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new q;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},_a=class e extends hi{constructor(e=1,t=32,n=0,r=Math.PI*2){super(),this.type=`CircleGeometry`,this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let i=[],a=[],o=[],s=[],c=new q,l=new K;a.push(0,0,0),o.push(0,0,1),s.push(.5,.5);for(let i=0,u=3;i<=t;i++,u+=3){let d=n+i/t*r;c.x=e*Math.cos(d),c.y=e*Math.sin(d),a.push(c.x,c.y,c.z),o.push(0,0,1),l.x=(a[u]/e+1)/2,l.y=(a[u+1]/e+1)/2,s.push(l.x,l.y)}for(let e=1;e<=t;e++)i.push(e,e+1,0);this.setIndex(i),this.setAttribute(`position`,new ri(a,3)),this.setAttribute(`normal`,new ri(o,3)),this.setAttribute(`uv`,new ri(s,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radius,t.segments,t.thetaStart,t.thetaLength)}},va=class e extends hi{constructor(e=1,t=1,n=1,r=32,i=1,a=!1,o=0,s=Math.PI*2){super(),this.type=`CylinderGeometry`,this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:r,heightSegments:i,openEnded:a,thetaStart:o,thetaLength:s};let c=this;r=Math.floor(r),i=Math.floor(i);let l=[],u=[],d=[],f=[],p=0,m=[],h=n/2,g=0;_(),a===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(l),this.setAttribute(`position`,new ri(u,3)),this.setAttribute(`normal`,new ri(d,3)),this.setAttribute(`uv`,new ri(f,2));function _(){let a=new q,_=new q,v=0,y=(t-e)/n;for(let c=0;c<=i;c++){let l=[],g=c/i,v=g*(t-e)+e;for(let e=0;e<=r;e++){let t=e/r,i=t*s+o,c=Math.sin(i),m=Math.cos(i);_.x=v*c,_.y=-g*n+h,_.z=v*m,u.push(_.x,_.y,_.z),a.set(c,y,m).normalize(),d.push(a.x,a.y,a.z),f.push(t,1-g),l.push(p++)}m.push(l)}for(let n=0;n<r;n++)for(let r=0;r<i;r++){let a=m[r][n],o=m[r+1][n],s=m[r+1][n+1],c=m[r][n+1];(e>0||r!==0)&&(l.push(a,o,c),v+=3),(t>0||r!==i-1)&&(l.push(o,s,c),v+=3)}c.addGroup(g,v,0),g+=v}function v(n){let i=p,a=new K,m=new q,_=0,v=n===!0?e:t,y=n===!0?1:-1;for(let e=1;e<=r;e++)u.push(0,h*y,0),d.push(0,y,0),f.push(.5,.5),p++;let b=p;for(let e=0;e<=r;e++){let t=e/r*s+o,n=Math.cos(t),i=Math.sin(t);m.x=v*i,m.y=h*y,m.z=v*n,u.push(m.x,m.y,m.z),d.push(0,y,0),a.x=n*.5+.5,a.y=i*.5*y+.5,f.push(a.x,a.y),p++}for(let e=0;e<r;e++){let t=i+e,r=b+e;n===!0?l.push(r,r+1,t):l.push(r+1,r,t),_+=3}c.addGroup(g,_,n===!0?1:2),g+=_}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}},ya=class e extends hi{constructor(e=[],t=[],n=1,r=0){super(),this.type=`PolyhedronGeometry`,this.parameters={vertices:e,indices:t,radius:n,detail:r};let i=[],a=[];o(r),c(n),l(),this.setAttribute(`position`,new ri(i,3)),this.setAttribute(`normal`,new ri(i.slice(),3)),this.setAttribute(`uv`,new ri(a,2)),r===0?this.computeVertexNormals():this.normalizeNormals();function o(e){let n=new q,r=new q,i=new q;for(let a=0;a<t.length;a+=3)f(t[a+0],n),f(t[a+1],r),f(t[a+2],i),s(n,r,i,e)}function s(e,t,n,r){let i=r+1,a=[];for(let r=0;r<=i;r++){a[r]=[];let o=e.clone().lerp(n,r/i),s=t.clone().lerp(n,r/i),c=i-r;for(let e=0;e<=c;e++)e===0&&r===i?a[r][e]=o:a[r][e]=o.clone().lerp(s,e/c)}for(let e=0;e<i;e++)for(let t=0;t<2*(i-e)-1;t++){let n=Math.floor(t/2);t%2==0?(d(a[e][n+1]),d(a[e+1][n]),d(a[e][n])):(d(a[e][n+1]),d(a[e+1][n+1]),d(a[e+1][n]))}}function c(e){let t=new q;for(let n=0;n<i.length;n+=3)t.x=i[n+0],t.y=i[n+1],t.z=i[n+2],t.normalize().multiplyScalar(e),i[n+0]=t.x,i[n+1]=t.y,i[n+2]=t.z}function l(){let e=new q;for(let t=0;t<i.length;t+=3){e.x=i[t+0],e.y=i[t+1],e.z=i[t+2];let n=h(e)/2/Math.PI+.5,r=g(e)/Math.PI+.5;a.push(n,1-r)}p(),u()}function u(){for(let e=0;e<a.length;e+=6){let t=a[e+0],n=a[e+2],r=a[e+4];Math.max(t,n,r)>.9&&Math.min(t,n,r)<.1&&(t<.2&&(a[e+0]+=1),n<.2&&(a[e+2]+=1),r<.2&&(a[e+4]+=1))}}function d(e){i.push(e.x,e.y,e.z)}function f(t,n){let r=t*3;n.x=e[r+0],n.y=e[r+1],n.z=e[r+2]}function p(){let e=new q,t=new q,n=new q,r=new q,o=new K,s=new K,c=new K;for(let l=0,u=0;l<i.length;l+=9,u+=6){e.set(i[l+0],i[l+1],i[l+2]),t.set(i[l+3],i[l+4],i[l+5]),n.set(i[l+6],i[l+7],i[l+8]),o.set(a[u+0],a[u+1]),s.set(a[u+2],a[u+3]),c.set(a[u+4],a[u+5]),r.copy(e).add(t).add(n).divideScalar(3);let d=h(r);m(o,u+0,e,d),m(s,u+2,t,d),m(c,u+4,n,d)}}function m(e,t,n,r){r<0&&e.x===1&&(a[t]=e.x-1),n.x===0&&n.z===0&&(a[t]=r/2/Math.PI+.5)}function h(e){return Math.atan2(e.z,-e.x)}function g(e){return Math.atan2(-e.y,Math.sqrt(e.x*e.x+e.z*e.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.vertices,t.indices,t.radius,t.detail)}},ba=class{constructor(){this.type=`Curve`,this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){U(`Curve: .getPoint() not implemented.`)}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,r=this.getPoint(0),i=0;t.push(0);for(let a=1;a<=e;a++)n=this.getPoint(a/e),i+=n.distanceTo(r),t.push(i),r=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),r=0,i=n.length,a;a=t||e*n[i-1];let o=0,s=i-1,c;for(;o<=s;)if(r=Math.floor(o+(s-o)/2),c=n[r]-a,c<0)o=r+1;else if(c>0)s=r-1;else{s=r;break}if(r=s,n[r]===a)return r/(i-1);let l=n[r],u=n[r+1]-l,d=(a-l)/u;return(r+d)/(i-1)}getTangent(e,t){let n=1e-4,r=e-n,i=e+n;r<0&&(r=0),i>1&&(i=1);let a=this.getPoint(r),o=this.getPoint(i),s=t||(a.isVector2?new K:new q);return s.copy(o).sub(a).normalize(),s}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new q,r=[],i=[],a=[],o=new q,s=new zn;for(let t=0;t<=e;t++){let n=t/e;r[t]=this.getTangentAt(n,new q)}i[0]=new q,a[0]=new q;let c=Number.MAX_VALUE,l=Math.abs(r[0].x),u=Math.abs(r[0].y),d=Math.abs(r[0].z);l<=c&&(c=l,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),o.crossVectors(r[0],n).normalize(),i[0].crossVectors(r[0],o),a[0].crossVectors(r[0],i[0]);for(let t=1;t<=e;t++){if(i[t]=i[t-1].clone(),a[t]=a[t-1].clone(),o.crossVectors(r[t-1],r[t]),o.length()>2**-52){o.normalize();let e=Math.acos(G(r[t-1].dot(r[t]),-1,1));i[t].applyMatrix4(s.makeRotationAxis(o,e))}a[t].crossVectors(r[t],i[t])}if(t===!0){let t=Math.acos(G(i[0].dot(i[e]),-1,1));t/=e,r[0].dot(o.crossVectors(i[0],i[e]))>0&&(t=-t);for(let n=1;n<=e;n++)i[n].applyMatrix4(s.makeRotationAxis(r[n],t*n)),a[n].crossVectors(r[n],i[n])}return{tangents:r,normals:i,binormals:a}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:`Curve`,generator:`Curve.toJSON`}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},xa=class extends ba{constructor(e=0,t=0,n=1,r=1,i=0,a=Math.PI*2,o=!1,s=0){super(),this.isEllipseCurve=!0,this.type=`EllipseCurve`,this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=r,this.aStartAngle=i,this.aEndAngle=a,this.aClockwise=o,this.aRotation=s}getPoint(e,t=new K){let n=t,r=Math.PI*2,i=this.aEndAngle-this.aStartAngle,a=Math.abs(i)<2**-52;for(;i<0;)i+=r;for(;i>r;)i-=r;i<2**-52&&(i=a?0:r),this.aClockwise===!0&&!a&&(i===r?i=-r:i-=r);let o=this.aStartAngle+e*i,s=this.aX+this.xRadius*Math.cos(o),c=this.aY+this.yRadius*Math.sin(o);if(this.aRotation!==0){let e=Math.cos(this.aRotation),t=Math.sin(this.aRotation),n=s-this.aX,r=c-this.aY;s=n*e-r*t+this.aX,c=n*t+r*e+this.aY}return n.set(s,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},Sa=class extends xa{constructor(e,t,n,r,i,a){super(e,t,n,n,r,i,a),this.isArcCurve=!0,this.type=`ArcCurve`}};function Ca(){let e=0,t=0,n=0,r=0;function i(i,a,o,s){e=i,t=o,n=-3*i+3*a-2*o-s,r=2*i-2*a+o+s}return{initCatmullRom:function(e,t,n,r,a){i(t,n,a*(n-e),a*(r-t))},initNonuniformCatmullRom:function(e,t,n,r,a,o,s){let c=(t-e)/a-(n-e)/(a+o)+(n-t)/o,l=(n-t)/o-(r-t)/(o+s)+(r-n)/s;c*=o,l*=o,i(t,n,c,l)},calc:function(i){let a=i*i,o=a*i;return e+t*i+n*a+r*o}}}var wa=new q,Ta=new q,Ea=new Ca,Da=new Ca,Oa=new Ca,ka=class extends ba{constructor(e=[],t=!1,n=`centripetal`,r=.5){super(),this.isCatmullRomCurve3=!0,this.type=`CatmullRomCurve3`,this.points=e,this.closed=t,this.curveType=n,this.tension=r}getPoint(e,t=new q){let n=t,r=this.points,i=r.length,a=(i-+!this.closed)*e,o=Math.floor(a),s=a-o;this.closed?o+=o>0?0:(Math.floor(Math.abs(o)/i)+1)*i:s===0&&o===i-1&&(o=i-2,s=1);let c,l;this.closed||o>0?c=r[(o-1)%i]:(Ta.subVectors(r[0],r[1]).add(r[0]),c=Ta);let u=r[o%i],d=r[(o+1)%i];if(this.closed||o+2<i?l=r[(o+2)%i]:(wa.subVectors(r[i-1],r[i-2]).add(r[i-1]),l=wa),this.curveType===`centripetal`||this.curveType===`chordal`){let e=this.curveType===`chordal`?.5:.25,t=c.distanceToSquared(u)**+e,n=u.distanceToSquared(d)**+e,r=d.distanceToSquared(l)**+e;n<1e-4&&(n=1),t<1e-4&&(t=n),r<1e-4&&(r=n),Ea.initNonuniformCatmullRom(c.x,u.x,d.x,l.x,t,n,r),Da.initNonuniformCatmullRom(c.y,u.y,d.y,l.y,t,n,r),Oa.initNonuniformCatmullRom(c.z,u.z,d.z,l.z,t,n,r)}else this.curveType===`catmullrom`&&(Ea.initCatmullRom(c.x,u.x,d.x,l.x,this.tension),Da.initCatmullRom(c.y,u.y,d.y,l.y,this.tension),Oa.initCatmullRom(c.z,u.z,d.z,l.z,this.tension));return n.set(Ea.calc(s),Da.calc(s),Oa.calc(s)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new q().fromArray(n))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function Aa(e,t,n,r,i){let a=(r-t)*.5,o=(i-n)*.5,s=e*e,c=e*s;return(2*n-2*r+a+o)*c+(-3*n+3*r-2*a-o)*s+a*e+n}function ja(e,t){let n=1-e;return n*n*t}function Ma(e,t){return 2*(1-e)*e*t}function Na(e,t){return e*e*t}function Pa(e,t,n,r){return ja(e,t)+Ma(e,n)+Na(e,r)}function Fa(e,t){let n=1-e;return n*n*n*t}function Ia(e,t){let n=1-e;return 3*n*n*e*t}function La(e,t){return 3*(1-e)*e*e*t}function Ra(e,t){return e*e*e*t}function za(e,t,n,r,i){return Fa(e,t)+Ia(e,n)+La(e,r)+Ra(e,i)}var Ba=class extends ba{constructor(e=new K,t=new K,n=new K,r=new K){super(),this.isCubicBezierCurve=!0,this.type=`CubicBezierCurve`,this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new K){let n=t,r=this.v0,i=this.v1,a=this.v2,o=this.v3;return n.set(za(e,r.x,i.x,a.x,o.x),za(e,r.y,i.y,a.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Va=class extends ba{constructor(e=new q,t=new q,n=new q,r=new q){super(),this.isCubicBezierCurve3=!0,this.type=`CubicBezierCurve3`,this.v0=e,this.v1=t,this.v2=n,this.v3=r}getPoint(e,t=new q){let n=t,r=this.v0,i=this.v1,a=this.v2,o=this.v3;return n.set(za(e,r.x,i.x,a.x,o.x),za(e,r.y,i.y,a.y,o.y),za(e,r.z,i.z,a.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},Ha=class extends ba{constructor(e=new K,t=new K){super(),this.isLineCurve=!0,this.type=`LineCurve`,this.v1=e,this.v2=t}getPoint(e,t=new K){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new K){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ua=class extends ba{constructor(e=new q,t=new q){super(),this.isLineCurve3=!0,this.type=`LineCurve3`,this.v1=e,this.v2=t}getPoint(e,t=new q){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new q){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Wa=class extends ba{constructor(e=new K,t=new K,n=new K){super(),this.isQuadraticBezierCurve=!0,this.type=`QuadraticBezierCurve`,this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new K){let n=t,r=this.v0,i=this.v1,a=this.v2;return n.set(Pa(e,r.x,i.x,a.x),Pa(e,r.y,i.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ga=class extends ba{constructor(e=new q,t=new q,n=new q){super(),this.isQuadraticBezierCurve3=!0,this.type=`QuadraticBezierCurve3`,this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new q){let n=t,r=this.v0,i=this.v1,a=this.v2;return n.set(Pa(e,r.x,i.x,a.x),Pa(e,r.y,i.y,a.y),Pa(e,r.z,i.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},Ka=class extends ba{constructor(e=[]){super(),this.isSplineCurve=!0,this.type=`SplineCurve`,this.points=e}getPoint(e,t=new K){let n=t,r=this.points,i=(r.length-1)*e,a=Math.floor(i),o=i-a,s=r[a===0?a:a-1],c=r[a],l=r[a>r.length-2?r.length-1:a+1],u=r[a>r.length-3?r.length-1:a+2];return n.set(Aa(o,s.x,c.x,l.x,u.x),Aa(o,s.y,c.y,l.y,u.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let n=this.points[t];e.points.push(n.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let n=e.points[t];this.points.push(new K().fromArray(n))}return this}},qa=Object.freeze({__proto__:null,ArcCurve:Sa,CatmullRomCurve3:ka,CubicBezierCurve:Ba,CubicBezierCurve3:Va,EllipseCurve:xa,LineCurve:Ha,LineCurve3:Ua,QuadraticBezierCurve:Wa,QuadraticBezierCurve3:Ga,SplineCurve:Ka}),Ja=class extends ba{constructor(){super(),this.type=`CurvePath`,this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?`LineCurve`:`LineCurve3`;this.curves.push(new qa[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),r=this.getCurveLengths(),i=0;for(;i<r.length;){if(r[i]>=n){let e=r[i]-n,a=this.curves[i],o=a.getLength(),s=o===0?0:1-e/o;return a.getPointAt(s,t)}i++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,r=this.curves.length;n<r;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let r=0,i=this.curves;r<i.length;r++){let a=i[r],o=a.isEllipseCurve?e*2:a.isLineCurve||a.isLineCurve3?1:a.isSplineCurve?e*a.points.length:e,s=a.getPoints(o);for(let e=0;e<s.length;e++){let r=s[e];n&&n.equals(r)||(t.push(r),n=r)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let n=e.curves[t];this.curves.push(n.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let n=this.curves[t];e.curves.push(n.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let n=e.curves[t];this.curves.push(new qa[n.type]().fromJSON(n))}return this}},Ya=class extends Ja{constructor(e){super(),this.type=`Path`,this.currentPoint=new K,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new Ha(this.currentPoint.clone(),new K(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,r){let i=new Wa(this.currentPoint.clone(),new K(e,t),new K(n,r));return this.curves.push(i),this.currentPoint.set(n,r),this}bezierCurveTo(e,t,n,r,i,a){let o=new Ba(this.currentPoint.clone(),new K(e,t),new K(n,r),new K(i,a));return this.curves.push(o),this.currentPoint.set(i,a),this}splineThru(e){let t=new Ka([this.currentPoint.clone()].concat(e));return this.curves.push(t),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,r,i,a){let o=this.currentPoint.x,s=this.currentPoint.y;return this.absarc(e+o,t+s,n,r,i,a),this}absarc(e,t,n,r,i,a){return this.absellipse(e,t,n,n,r,i,a),this}ellipse(e,t,n,r,i,a,o,s){let c=this.currentPoint.x,l=this.currentPoint.y;return this.absellipse(e+c,t+l,n,r,i,a,o,s),this}absellipse(e,t,n,r,i,a,o,s){let c=new xa(e,t,n,r,i,a,o,s);if(this.curves.length>0){let e=c.getPoint(0);e.equals(this.currentPoint)||this.lineTo(e.x,e.y)}this.curves.push(c);let l=c.getPoint(1);return this.currentPoint.copy(l),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},Xa=class extends Ya{constructor(e){super(e),this.uuid=qt(),this.type=`Shape`,this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,r=this.holes.length;n<r;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let n=e.holes[t];this.holes.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let n=this.holes[t];e.holes.push(n.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let n=e.holes[t];this.holes.push(new Ya().fromJSON(n))}return this}};function Za(e,t,n=2){let r=t&&t.length,i=r?t[0]*n:e.length,a=Qa(e,0,i,n,!0),o=[];if(!a||a.next===a.prev)return o;let s,c,l;if(r&&(a=ao(e,t,a,n)),e.length>80*n){s=e[0],c=e[1];let t=s,r=c;for(let a=n;a<i;a+=n){let n=e[a],i=e[a+1];n<s&&(s=n),i<c&&(c=i),n>t&&(t=n),i>r&&(r=i)}l=Math.max(t-s,r-c),l=l===0?0:32767/l}return eo(a,o,n,s,c,l,0),o}function Qa(e,t,n,r,i){let a;if(i===Ao(e,t,n,r)>0)for(let i=t;i<n;i+=r)a=Do(i/r|0,e[i],e[i+1],a);else for(let i=n-r;i>=t;i-=r)a=Do(i/r|0,e[i],e[i+1],a);return a&&yo(a,a.next)&&(Oo(a),a=a.next),a}function $a(e,t){if(!e)return e;t||=e;let n=e,r;do if(r=!1,!n.steiner&&(yo(n,n.next)||vo(n.prev,n,n.next)===0)){if(Oo(n),n=t=n.prev,n===n.next)break;r=!0}else n=n.next;while(r||n!==t);return t}function eo(e,t,n,r,i,a,o){if(!e)return;!o&&a&&uo(e,r,i,a);let s=e;for(;e.prev!==e.next;){let c=e.prev,l=e.next;if(a?no(e,r,i,a):to(e)){t.push(c.i,e.i,l.i),Oo(e),e=l.next,s=l.next;continue}if(e=l,e===s){o?o===1?(e=ro($a(e),t),eo(e,t,n,r,i,a,2)):o===2&&io(e,t,n,r,i,a):eo($a(e),t,n,r,i,a,1);break}}}function to(e){let t=e.prev,n=e,r=e.next;if(vo(t,n,r)>=0)return!1;let i=t.x,a=n.x,o=r.x,s=t.y,c=n.y,l=r.y,u=Math.min(i,a,o),d=Math.min(s,c,l),f=Math.max(i,a,o),p=Math.max(s,c,l),m=r.next;for(;m!==t;){if(m.x>=u&&m.x<=f&&m.y>=d&&m.y<=p&&go(i,s,a,c,o,l,m.x,m.y)&&vo(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function no(e,t,n,r){let i=e.prev,a=e,o=e.next;if(vo(i,a,o)>=0)return!1;let s=i.x,c=a.x,l=o.x,u=i.y,d=a.y,f=o.y,p=Math.min(s,c,l),m=Math.min(u,d,f),h=Math.max(s,c,l),g=Math.max(u,d,f),_=po(p,m,t,n,r),v=po(h,g,t,n,r),y=e.prevZ,b=e.nextZ;for(;y&&y.z>=_&&b&&b.z<=v;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&go(s,u,c,d,l,f,y.x,y.y)&&vo(y.prev,y,y.next)>=0||(y=y.prevZ,b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&go(s,u,c,d,l,f,b.x,b.y)&&vo(b.prev,b,b.next)>=0))return!1;b=b.nextZ}for(;y&&y.z>=_;){if(y.x>=p&&y.x<=h&&y.y>=m&&y.y<=g&&y!==i&&y!==o&&go(s,u,c,d,l,f,y.x,y.y)&&vo(y.prev,y,y.next)>=0)return!1;y=y.prevZ}for(;b&&b.z<=v;){if(b.x>=p&&b.x<=h&&b.y>=m&&b.y<=g&&b!==i&&b!==o&&go(s,u,c,d,l,f,b.x,b.y)&&vo(b.prev,b,b.next)>=0)return!1;b=b.nextZ}return!0}function ro(e,t){let n=e;do{let r=n.prev,i=n.next.next;!yo(r,i)&&bo(r,n,n.next,i)&&wo(r,i)&&wo(i,r)&&(t.push(r.i,n.i,i.i),Oo(n),Oo(n.next),n=e=i),n=n.next}while(n!==e);return $a(n)}function io(e,t,n,r,i,a){let o=e;do{let e=o.next.next;for(;e!==o.prev;){if(o.i!==e.i&&_o(o,e)){let s=Eo(o,e);o=$a(o,o.next),s=$a(s,s.next),eo(o,t,n,r,i,a,0),eo(s,t,n,r,i,a,0);return}e=e.next}o=o.next}while(o!==e)}function ao(e,t,n,r){let i=[];for(let n=0,a=t.length;n<a;n++){let o=Qa(e,t[n]*r,n<a-1?t[n+1]*r:e.length,r,!1);o===o.next&&(o.steiner=!0),i.push(mo(o))}i.sort(oo);for(let e=0;e<i.length;e++)n=so(i[e],n);return n}function oo(e,t){let n=e.x-t.x;return n===0&&(n=e.y-t.y,n===0&&(n=(e.next.y-e.y)/(e.next.x-e.x)-(t.next.y-t.y)/(t.next.x-t.x))),n}function so(e,t){let n=co(e,t);if(!n)return t;let r=Eo(n,e);return $a(r,r.next),$a(n,n.next)}function co(e,t){let n=t,r=e.x,i=e.y,a=-1/0,o;if(yo(e,n))return n;do{if(yo(e,n.next))return n.next;if(i<=n.y&&i>=n.next.y&&n.next.y!==n.y){let e=n.x+(i-n.y)*(n.next.x-n.x)/(n.next.y-n.y);if(e<=r&&e>a&&(a=e,o=n.x<n.next.x?n:n.next,e===r))return o}n=n.next}while(n!==t);if(!o)return null;let s=o,c=o.x,l=o.y,u=1/0;n=o;do{if(r>=n.x&&n.x>=c&&r!==n.x&&ho(i<l?r:a,i,c,l,i<l?a:r,i,n.x,n.y)){let t=Math.abs(i-n.y)/(r-n.x);wo(n,e)&&(t<u||t===u&&(n.x>o.x||n.x===o.x&&lo(o,n)))&&(o=n,u=t)}n=n.next}while(n!==s);return o}function lo(e,t){return vo(e.prev,e,t.prev)<0&&vo(t.next,e,e.next)<0}function uo(e,t,n,r){let i=e;do i.z===0&&(i.z=po(i.x,i.y,t,n,r)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==e);i.prevZ.nextZ=null,i.prevZ=null,fo(i)}function fo(e){let t,n=1;do{let r=e,i;e=null;let a=null;for(t=0;r;){t++;let o=r,s=0;for(let e=0;e<n&&(s++,o=o.nextZ,o);e++);let c=n;for(;s>0||c>0&&o;)s!==0&&(c===0||!o||r.z<=o.z)?(i=r,r=r.nextZ,s--):(i=o,o=o.nextZ,c--),a?a.nextZ=i:e=i,i.prevZ=a,a=i;r=o}a.nextZ=null,n*=2}while(t>1);return e}function po(e,t,n,r,i){return e=(e-n)*i|0,t=(t-r)*i|0,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,e|t<<1}function mo(e){let t=e,n=e;do(t.x<n.x||t.x===n.x&&t.y<n.y)&&(n=t),t=t.next;while(t!==e);return n}function ho(e,t,n,r,i,a,o,s){return(i-o)*(t-s)>=(e-o)*(a-s)&&(e-o)*(r-s)>=(n-o)*(t-s)&&(n-o)*(a-s)>=(i-o)*(r-s)}function go(e,t,n,r,i,a,o,s){return!(e===o&&t===s)&&ho(e,t,n,r,i,a,o,s)}function _o(e,t){return e.next.i!==t.i&&e.prev.i!==t.i&&!Co(e,t)&&(wo(e,t)&&wo(t,e)&&To(e,t)&&(vo(e.prev,e,t.prev)||vo(e,t.prev,t))||yo(e,t)&&vo(e.prev,e,e.next)>0&&vo(t.prev,t,t.next)>0)}function vo(e,t,n){return(t.y-e.y)*(n.x-t.x)-(t.x-e.x)*(n.y-t.y)}function yo(e,t){return e.x===t.x&&e.y===t.y}function bo(e,t,n,r){let i=So(vo(e,t,n)),a=So(vo(e,t,r)),o=So(vo(n,r,e)),s=So(vo(n,r,t));return!!(i!==a&&o!==s||i===0&&xo(e,n,t)||a===0&&xo(e,r,t)||o===0&&xo(n,e,r)||s===0&&xo(n,t,r))}function xo(e,t,n){return t.x<=Math.max(e.x,n.x)&&t.x>=Math.min(e.x,n.x)&&t.y<=Math.max(e.y,n.y)&&t.y>=Math.min(e.y,n.y)}function So(e){return e>0?1:e<0?-1:0}function Co(e,t){let n=e;do{if(n.i!==e.i&&n.next.i!==e.i&&n.i!==t.i&&n.next.i!==t.i&&bo(n,n.next,e,t))return!0;n=n.next}while(n!==e);return!1}function wo(e,t){return vo(e.prev,e,e.next)<0?vo(e,t,e.next)>=0&&vo(e,e.prev,t)>=0:vo(e,t,e.prev)<0||vo(e,e.next,t)<0}function To(e,t){let n=e,r=!1,i=(e.x+t.x)/2,a=(e.y+t.y)/2;do n.y>a!=n.next.y>a&&n.next.y!==n.y&&i<(n.next.x-n.x)*(a-n.y)/(n.next.y-n.y)+n.x&&(r=!r),n=n.next;while(n!==e);return r}function Eo(e,t){let n=ko(e.i,e.x,e.y),r=ko(t.i,t.x,t.y),i=e.next,a=t.prev;return e.next=t,t.prev=e,n.next=i,i.prev=n,r.next=n,n.prev=r,a.next=r,r.prev=a,r}function Do(e,t,n,r){let i=ko(e,t,n);return r?(i.next=r.next,i.prev=r,r.next.prev=i,r.next=i):(i.prev=i,i.next=i),i}function Oo(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function ko(e,t,n){return{i:e,x:t,y:n,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Ao(e,t,n,r){let i=0;for(let a=t,o=n-r;a<n;a+=r)i+=(e[o]-e[a])*(e[a+1]+e[o+1]),o=a;return i}var jo=class{static triangulate(e,t,n=2){return Za(e,t,n)}},Mo=class e{static area(e){let t=e.length,n=0;for(let r=t-1,i=0;i<t;r=i++)n+=e[r].x*e[i].y-e[i].x*e[r].y;return n*.5}static isClockWise(t){return e.area(t)<0}static triangulateShape(e,t){let n=[],r=[],i=[];No(e),Po(n,e);let a=e.length;t.forEach(No);for(let e=0;e<t.length;e++)r.push(a),a+=t[e].length,Po(n,t[e]);let o=jo.triangulate(n,r);for(let e=0;e<o.length;e+=3)i.push(o.slice(e,e+3));return i}};function No(e){let t=e.length;t>2&&e[t-1].equals(e[0])&&e.pop()}function Po(e,t){for(let n=0;n<t.length;n++)e.push(t[n].x),e.push(t[n].y)}var Fo=class e extends hi{constructor(e=new Xa([new K(.5,.5),new K(-.5,.5),new K(-.5,-.5),new K(.5,-.5)]),t={}){super(),this.type=`ExtrudeGeometry`,this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,r=[],i=[];for(let t=0,n=e.length;t<n;t++){let n=e[t];a(n)}this.setAttribute(`position`,new ri(r,3)),this.setAttribute(`uv`,new ri(i,2)),this.computeVertexNormals();function a(e){let a=[],o=t.curveSegments===void 0?12:t.curveSegments,s=t.steps===void 0?1:t.steps,c=t.depth===void 0?1:t.depth,l=t.bevelEnabled===void 0?!0:t.bevelEnabled,u=t.bevelThickness===void 0?.2:t.bevelThickness,d=t.bevelSize===void 0?u-.1:t.bevelSize,f=t.bevelOffset===void 0?0:t.bevelOffset,p=t.bevelSegments===void 0?3:t.bevelSegments,m=t.extrudePath,h=t.UVGenerator===void 0?Io:t.UVGenerator,g,_=!1,v,y,b,x;if(m){g=m.getSpacedPoints(s),_=!0,l=!1;let e=m.isCatmullRomCurve3?m.closed:!1;v=m.computeFrenetFrames(s,e),y=new q,b=new q,x=new q}l||(p=0,u=0,d=0,f=0);let S=e.extractPoints(o),C=S.shape,w=S.holes;if(!Mo.isClockWise(C)){C=C.reverse();for(let e=0,t=w.length;e<t;e++){let t=w[e];Mo.isClockWise(t)&&(w[e]=t.reverse())}}function T(e){let t=e[0];for(let n=1;n<=e.length;n++){let r=n%e.length,i=e[r],a=i.x-t.x,o=i.y-t.y,s=a*a+o*o,c=Math.max(Math.abs(i.x),Math.abs(i.y),Math.abs(t.x),Math.abs(t.y));if(s<=10000000000000001e-36*c*c){e.splice(r,1),n--;continue}t=i}}T(C),w.forEach(T);let E=w.length,D=C;for(let e=0;e<E;e++){let t=w[e];C=C.concat(t)}function O(e,t,n){return t||W(`ExtrudeGeometry: vec does not exist`),e.clone().addScaledVector(t,n)}let k=C.length;function A(e,t,n){let r,i,a,o=e.x-t.x,s=e.y-t.y,c=n.x-e.x,l=n.y-e.y,u=o*o+s*s,d=o*l-s*c;if(Math.abs(d)>2**-52){let d=Math.sqrt(u),f=Math.sqrt(c*c+l*l),p=t.x-s/d,m=t.y+o/d,h=n.x-l/f,g=n.y+c/f,_=((h-p)*l-(g-m)*c)/(o*l-s*c);r=p+o*_-e.x,i=m+s*_-e.y;let v=r*r+i*i;if(v<=2)return new K(r,i);a=Math.sqrt(v/2)}else{let e=!1;o>2**-52?c>2**-52&&(e=!0):o<-(2**-52)?c<-(2**-52)&&(e=!0):Math.sign(s)===Math.sign(l)&&(e=!0),e?(r=-s,i=o,a=Math.sqrt(u)):(r=o,i=s,a=Math.sqrt(u/2))}return new K(r/a,i/a)}let j=[];for(let e=0,t=D.length,n=t-1,r=e+1;e<t;e++,n++,r++)n===t&&(n=0),r===t&&(r=0),j[e]=A(D[e],D[n],D[r]);let ee=[],M,te=j.concat();for(let e=0,t=E;e<t;e++){let t=w[e];M=[];for(let e=0,n=t.length,r=n-1,i=e+1;e<n;e++,r++,i++)r===n&&(r=0),i===n&&(i=0),M[e]=A(t[e],t[r],t[i]);ee.push(M),te=te.concat(M)}let N;if(p===0)N=Mo.triangulateShape(D,w);else{let e=[],t=[];for(let n=0;n<p;n++){let r=n/p,i=u*Math.cos(r*Math.PI/2),a=d*Math.sin(r*Math.PI/2)+f;for(let t=0,n=D.length;t<n;t++){let n=O(D[t],j[t],a);F(n.x,n.y,-i),r===0&&e.push(n)}for(let e=0,n=E;e<n;e++){let n=w[e];M=ee[e];let o=[];for(let e=0,t=n.length;e<t;e++){let t=O(n[e],M[e],a);F(t.x,t.y,-i),r===0&&o.push(t)}r===0&&t.push(o)}}N=Mo.triangulateShape(e,t)}let P=N.length,ne=d+f;for(let e=0;e<k;e++){let t=l?O(C[e],te[e],ne):C[e];_?(b.copy(v.normals[0]).multiplyScalar(t.x),y.copy(v.binormals[0]).multiplyScalar(t.y),x.copy(g[0]).add(b).add(y),F(x.x,x.y,x.z)):F(t.x,t.y,0)}for(let e=1;e<=s;e++)for(let t=0;t<k;t++){let n=l?O(C[t],te[t],ne):C[t];_?(b.copy(v.normals[e]).multiplyScalar(n.x),y.copy(v.binormals[e]).multiplyScalar(n.y),x.copy(g[e]).add(b).add(y),F(x.x,x.y,x.z)):F(n.x,n.y,c/s*e)}for(let e=p-1;e>=0;e--){let t=e/p,n=u*Math.cos(t*Math.PI/2),r=d*Math.sin(t*Math.PI/2)+f;for(let e=0,t=D.length;e<t;e++){let t=O(D[e],j[e],r);F(t.x,t.y,c+n)}for(let e=0,t=w.length;e<t;e++){let t=w[e];M=ee[e];for(let e=0,i=t.length;e<i;e++){let i=O(t[e],M[e],r);_?F(i.x,i.y+g[s-1].y,g[s-1].x+n):F(i.x,i.y,c+n)}}}re(),ie();function re(){let e=r.length/3;if(l){let e=0,t=k*e;for(let e=0;e<P;e++){let n=N[e];oe(n[2]+t,n[1]+t,n[0]+t)}e=s+p*2,t=k*e;for(let e=0;e<P;e++){let n=N[e];oe(n[0]+t,n[1]+t,n[2]+t)}}else{for(let e=0;e<P;e++){let t=N[e];oe(t[2],t[1],t[0])}for(let e=0;e<P;e++){let t=N[e];oe(t[0]+k*s,t[1]+k*s,t[2]+k*s)}}n.addGroup(e,r.length/3-e,0)}function ie(){let e=r.length/3,t=0;ae(D,t),t+=D.length;for(let e=0,n=w.length;e<n;e++){let n=w[e];ae(n,t),t+=n.length}n.addGroup(e,r.length/3-e,1)}function ae(e,t){let n=e.length;for(;--n>=0;){let r=n,i=n-1;i<0&&(i=e.length-1);for(let e=0,n=s+p*2;e<n;e++){let n=k*e,a=k*(e+1);I(t+r+n,t+i+n,t+i+a,t+r+a)}}}function F(e,t,n){a.push(e),a.push(t),a.push(n)}function oe(e,t,i){L(e),L(t),L(i);let a=r.length/3,o=h.generateTopUV(n,r,a-3,a-2,a-1);se(o[0]),se(o[1]),se(o[2])}function I(e,t,i,a){L(e),L(t),L(a),L(t),L(i),L(a);let o=r.length/3,s=h.generateSideWallUV(n,r,o-6,o-3,o-2,o-1);se(s[0]),se(s[1]),se(s[3]),se(s[1]),se(s[2]),se(s[3])}function L(e){r.push(a[e*3+0]),r.push(a[e*3+1]),r.push(a[e*3+2])}function se(e){i.push(e.x),i.push(e.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return Lo(t,n,e)}static fromJSON(t,n){let r=[];for(let e=0,i=t.shapes.length;e<i;e++){let i=n[t.shapes[e]];r.push(i)}let i=t.options.extrudePath;return i!==void 0&&(t.options.extrudePath=new qa[i.type]().fromJSON(i)),new e(r,t.options)}},Io={generateTopUV:function(e,t,n,r,i){let a=t[n*3],o=t[n*3+1],s=t[r*3],c=t[r*3+1],l=t[i*3],u=t[i*3+1];return[new K(a,o),new K(s,c),new K(l,u)]},generateSideWallUV:function(e,t,n,r,i,a){let o=t[n*3],s=t[n*3+1],c=t[n*3+2],l=t[r*3],u=t[r*3+1],d=t[r*3+2],f=t[i*3],p=t[i*3+1],m=t[i*3+2],h=t[a*3],g=t[a*3+1],_=t[a*3+2];return Math.abs(s-u)<Math.abs(o-l)?[new K(o,1-c),new K(l,1-d),new K(f,1-m),new K(h,1-_)]:[new K(s,1-c),new K(u,1-d),new K(p,1-m),new K(g,1-_)]}};function Lo(e,t,n){if(n.shapes=[],Array.isArray(e))for(let t=0,r=e.length;t<r;t++){let r=e[t];n.shapes.push(r.uuid)}else n.shapes.push(e.uuid);return n.options=Object.assign({},t),t.extrudePath!==void 0&&(n.options.extrudePath=t.extrudePath.toJSON()),n}var Ro=class e extends ya{constructor(e=1,t=0){super([1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2],e,t),this.type=`OctahedronGeometry`,this.parameters={radius:e,detail:t}}static fromJSON(t){return new e(t.radius,t.detail)}},zo=class e extends hi{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new ri(p,3)),this.setAttribute(`normal`,new ri(m,3)),this.setAttribute(`uv`,new ri(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}},Bo=class e extends hi{constructor(e=.5,t=1,n=32,r=1,i=0,a=Math.PI*2){super(),this.type=`RingGeometry`,this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:r,thetaStart:i,thetaLength:a},n=Math.max(3,n),r=Math.max(1,r);let o=[],s=[],c=[],l=[],u=e,d=(t-e)/r,f=new q,p=new K;for(let e=0;e<=r;e++){for(let e=0;e<=n;e++){let r=i+e/n*a;f.x=u*Math.cos(r),f.y=u*Math.sin(r),s.push(f.x,f.y,f.z),c.push(0,0,1),p.x=(f.x/t+1)/2,p.y=(f.y/t+1)/2,l.push(p.x,p.y)}u+=d}for(let e=0;e<r;e++){let t=e*(n+1);for(let e=0;e<n;e++){let r=e+t,i=r,a=r+n+1,s=r+n+2,c=r+1;o.push(i,a,c),o.push(a,s,c)}}this.setIndex(o),this.setAttribute(`position`,new ri(s,3)),this.setAttribute(`normal`,new ri(c,3)),this.setAttribute(`uv`,new ri(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}},Vo=class e extends hi{constructor(e=new Xa([new K(0,.5),new K(-.5,-.5),new K(.5,-.5)]),t=12){super(),this.type=`ShapeGeometry`,this.parameters={shapes:e,curveSegments:t};let n=[],r=[],i=[],a=[],o=0,s=0;if(Array.isArray(e)===!1)c(e);else for(let t=0;t<e.length;t++)c(e[t]),this.addGroup(o,s,t),o+=s,s=0;this.setIndex(n),this.setAttribute(`position`,new ri(r,3)),this.setAttribute(`normal`,new ri(i,3)),this.setAttribute(`uv`,new ri(a,2));function c(e){let o=r.length/3,c=e.extractPoints(t),l=c.shape,u=c.holes;Mo.isClockWise(l)===!1&&(l=l.reverse());for(let e=0,t=u.length;e<t;e++){let t=u[e];Mo.isClockWise(t)===!0&&(u[e]=t.reverse())}let d=Mo.triangulateShape(l,u);for(let e=0,t=u.length;e<t;e++){let t=u[e];l=l.concat(t)}for(let e=0,t=l.length;e<t;e++){let t=l[e];r.push(t.x,t.y,0),i.push(0,0,1),a.push(t.x,t.y)}for(let e=0,t=d.length;e<t;e++){let t=d[e],r=t[0]+o,i=t[1]+o,a=t[2]+o;n.push(r,i,a),s+=3}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes;return Ho(t,e)}static fromJSON(t,n){let r=[];for(let e=0,i=t.shapes.length;e<i;e++){let i=n[t.shapes[e]];r.push(i)}return new e(r,t.curveSegments)}};function Ho(e,t){if(t.shapes=[],Array.isArray(e))for(let n=0,r=e.length;n<r;n++){let r=e[n];t.shapes.push(r.uuid)}else t.shapes.push(e.uuid);return t}function Uo(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(Go(i))i.isRenderTargetTexture?(U(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i))if(Go(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice();else t[n][r]=i}}return t}function Wo(e){let t={};for(let n=0;n<e.length;n++){let r=Uo(e[n]);for(let e in r)t[e]=r[e]}return t}function Go(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function Ko(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function qo(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Cn.workingColorSpace}var Jo={clone:Uo,merge:Wo},Yo=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Xo=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Zo=class extends wi{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Yo,this.fragmentShader=Xo,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Uo(e.uniforms),this.uniformsGroups=Ko(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case`t`:this.uniforms[n].value=t[r.value]||null;break;case`c`:this.uniforms[n].value=new Y().setHex(r.value);break;case`v2`:this.uniforms[n].value=new K().fromArray(r.value);break;case`v3`:this.uniforms[n].value=new q().fromArray(r.value);break;case`v4`:this.uniforms[n].value=new Pn().fromArray(r.value);break;case`m3`:this.uniforms[n].value=new J().fromArray(r.value);break;case`m4`:this.uniforms[n].value=new zn().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let t in e.extensions)this.extensions[t]=e.extensions[t];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},Qo=class extends Zo{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},$o=class extends wi{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type=`MeshStandardMaterial`,this.defines={STANDARD:``},this.color=new Y(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Y(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new K(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Yn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:``},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},es=class extends wi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=xt,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},ts=class extends wi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function ns(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}function rs(e){return e!==void 0&&e.inTangents!==void 0&&e.outTangents!==void 0}var is=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`THREE.Interpolant: Call to abstract method.`)}intervalChanged_(){}},as=class extends is{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:vt,endingEnd:vt}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case yt:i=e,o=2*t-n;break;case bt:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case yt:a=e,s=2*n-t;break;case bt:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},os=class extends is{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},ss=class extends is{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},cs=class extends is{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.inTangents,u=this.outTangents;if(!l||!u){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let d=o*2,f=e-1;for(let p=0;p!==o;++p){let o=a[c+p],m=a[s+p],h=f*d+p*2,g=u[h],_=u[h+1],v=e*d+p*2,y=l[v],b=l[v+1];i[p]=ls(ds(n,t,g,y,r),o,_,b,m)}return i}};function ls(e,t,n,r,i){let a=1-e;return a*a*a*t+3*a*a*e*n+3*a*e*e*r+e*e*e*i}function us(e,t,n,r,i){let a=1-e;return 3*a*a*(n-t)+6*a*e*(r-n)+3*e*e*(i-r)}function ds(e,t,n,r,i){let a=(e-t)/(i-t);for(let o=0;o<8;o++){let o=ls(a,t,n,r,i)-e;if(Math.abs(o)<1e-10)break;let s=us(a,t,n,r,i);if(Math.abs(s)<1e-10)break;a=Math.max(0,Math.min(1,a-o/s))}return a}var fs=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=ns(t,this.TimeBufferType),this.values=ns(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:ns(e.times,Array),values:ns(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t),rs(e.settings)&&(n.settings={inTangents:ns(e.settings.inTangents,Array),outTangents:ns(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new ss(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new os(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new as(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new cs(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case mt:t=this.InterpolantFactoryMethodDiscrete;break;case ht:t=this.InterpolantFactoryMethodLinear;break;case gt:t=this.InterpolantFactoryMethodSmooth;break;case _t:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t);return U(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return mt;case this.InterpolantFactoryMethodLinear:return ht;case this.InterpolantFactoryMethodSmooth:return gt;case this.InterpolantFactoryMethodBezier:return _t}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;rs(this.settings)&&(ps(this.settings.inTangents,e),ps(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(W(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(W(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){W(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){W(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&Mt(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){W(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===gt,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0]))if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,rs(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function ps(e,t){for(let n=0,r=e.length;n!==r;n+=2)e[n]*=t}fs.prototype.ValueTypeName=``,fs.prototype.TimeBufferType=Float32Array,fs.prototype.ValueBufferType=Float32Array,fs.prototype.DefaultInterpolation=ht;var ms=class extends fs{constructor(e,t,n){super(e,t,n)}};ms.prototype.ValueTypeName=`bool`,ms.prototype.ValueBufferType=Array,ms.prototype.DefaultInterpolation=mt,ms.prototype.InterpolantFactoryMethodLinear=void 0,ms.prototype.InterpolantFactoryMethodSmooth=void 0;var hs=class extends fs{constructor(e,t,n,r){super(e,t,n,r)}};hs.prototype.ValueTypeName=`color`;var gs=class extends fs{constructor(e,t,n,r){super(e,t,n,r)}};gs.prototype.ValueTypeName=`number`;var _s=class extends is{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)gn.slerpFlat(i,0,a,c-o,a,c,s);return i}},vs=class extends fs{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new _s(this.times,this.values,this.getValueSize(),e)}};vs.prototype.ValueTypeName=`quaternion`,vs.prototype.InterpolantFactoryMethodSmooth=void 0;var ys=class extends fs{constructor(e,t,n){super(e,t,n)}};ys.prototype.ValueTypeName=`string`,ys.prototype.ValueBufferType=Array,ys.prototype.DefaultInterpolation=mt,ys.prototype.InterpolantFactoryMethodLinear=void 0,ys.prototype.InterpolantFactoryMethodSmooth=void 0;var bs=class extends fs{constructor(e,t,n,r){super(e,t,n,r)}};bs.prototype.ValueTypeName=`vector`;var xs=new class{constructor(e,t,n){let r=this,i=!1,a=0,o=0,s,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(e){o++,i===!1&&r.onStart!==void 0&&r.onStart(e,a,o),i=!0},this.itemEnd=function(e){a++,r.onProgress!==void 0&&r.onProgress(e,a,o),a===o&&(i=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(e){r.onError!==void 0&&r.onError(e)},this.resolveURL=function(e){return e=e.normalize(`NFC`),s?s(e):e},this.setURLModifier=function(e){return s=e,this},this.addHandler=function(e,t){return c.push(e,t),this},this.removeHandler=function(e){let t=c.indexOf(e);return t!==-1&&c.splice(t,2),this},this.getHandler=function(e){for(let t=0,n=c.length;t<n;t+=2){let n=c[t],r=c[t+1];if(n.global&&(n.lastIndex=0),n.test(e))return r}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||=new AbortController,this._abortController}},Ss=class{constructor(e){this.manager=e===void 0?xs:e,this.crossOrigin=`anonymous`,this.withCredentials=!1,this.path=``,this.resourcePath=``,this.requestHeader={},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,i){n.load(e,r,t,i)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};Ss.DEFAULT_MATERIAL_NAME=`__DEFAULT`;var Cs=class extends fr{constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new Y(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},ws=class extends Cs{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type=`HemisphereLight`,this.position.copy(fr.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Y(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Ts=new zn,Es=new q,Ds=new q,Os=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new K(512,512),this.mapType=fe,this.map=null,this.mapPass=null,this.matrix=new zn,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new ra,this._frameExtents=new K(1,1),this._viewportCount=1,this._viewports=[new Pn(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;Es.setFromMatrixPosition(e.matrixWorld),t.position.copy(Es),Ds.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Ds),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,r){Ts.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(Ts,e.coordinateSystem,e.reversedDepth);let i=this._frameExtents,a=r?r.z/i.x:1,o=r?r.w/i.y:1,s=r?r.x/i.x:0,c=r?r.y/i.y:0;e.coordinateSystem===2001||e.reversedDepth?t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+s,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),t.multiply(Ts)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},ks=new q,As=new gn,js=new q,Ms=class extends fr{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new zn,this.projectionMatrix=new zn,this.projectionMatrixInverse=new zn,this.coordinateSystem=At,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(ks,As,js),js.x===1&&js.y===1&&js.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ks,As,js.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(ks,As,js),js.x===1&&js.y===1&&js.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(ks,As,js.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Ns=new q,Ps=new K,Fs=new K,Is=class extends Ms{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Kt*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Gt*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Kt*2*Math.atan(Math.tan(Gt*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Ns.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Ns.x,Ns.y).multiplyScalar(-e/Ns.z),Ns.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Ns.x,Ns.y).multiplyScalar(-e/Ns.z)}getViewSize(e,t){return this.getViewBounds(e,Ps,Fs),t.subVectors(Fs,Ps)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Gt*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Ls=class extends Ms{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Rs=class extends Os{constructor(){super(new Ls(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},zs=class extends Cs{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(fr.DEFAULT_UP),this.updateMatrix(),this.target=new fr,this.shadow=new Rs}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},Bs=class extends hi{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type=`InstancedBufferGeometry`,this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}},Vs=-90,Hs=1,Us=class extends fr{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Is(Vs,Hs,e,t);r.layers=this.layers,this.add(r);let i=new Is(Vs,Hs,e,t);i.layers=this.layers,this.add(i);let a=new Is(Vs,Hs,e,t);a.layers=this.layers,this.add(a);let o=new Is(Vs,Hs,e,t);o.layers=this.layers,this.add(o);let s=new Is(Vs,Hs,e,t);s.layers=this.layers,this.add(s);let c=new Is(Vs,Hs,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},Ws=class extends Is{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Gs=`\\[\\]\\.:\\/`,Ks=RegExp(`[\\[\\]\\.:\\/]`,`g`),qs=`[^\\[\\]\\.:\\/]`,Js=`[^`+Gs.replace(`\\.`,``)+`]`,Ys=`((?:WC+[\\/:])*)`.replace(`WC`,qs),Xs=`(WCOD+)?`.replace(`WCOD`,Js),Zs=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,qs),Qs=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,qs),$s=RegExp(`^`+Ys+Xs+Zs+Qs+`$`),ec=[`material`,`materials`,`bones`,`map`],tc=class{constructor(e,t,n){let r=n||nc.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},nc=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(Ks,``)}static parseTrackName(e){let t=$s.exec(e);if(t===null)throw Error(`THREE.PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);ec.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`THREE.PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){U(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){W(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){W(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){W(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){W(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){W(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){W(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){W(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;W(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){W(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){W(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};nc.Composite=tc,nc.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},nc.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},nc.prototype.GetterByBindingType=[nc.prototype._getValue_direct,nc.prototype._getValue_array,nc.prototype._getValue_arrayElement,nc.prototype._getValue_toArray],nc.prototype.SetterByBindingTypeAndVersioning=[[nc.prototype._setValue_direct,nc.prototype._setValue_direct_setNeedsUpdate,nc.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[nc.prototype._setValue_array,nc.prototype._setValue_array_setNeedsUpdate,nc.prototype._setValue_array_setMatrixWorldNeedsUpdate],[nc.prototype._setValue_arrayElement,nc.prototype._setValue_arrayElement_setNeedsUpdate,nc.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[nc.prototype._setValue_fromArray,nc.prototype._setValue_fromArray_setNeedsUpdate,nc.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var rc=class extends gi{constructor(e,t,n=1){super(e,t),this.isInstancedInterleavedBuffer=!0,this.meshPerAttribute=n}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}clone(e){let t=super.clone(e);return t.meshPerAttribute=this.meshPerAttribute,t}toJSON(e){let t=super.toJSON(e);return t.isInstancedInterleavedBuffer=!0,t.meshPerAttribute=this.meshPerAttribute,t}},ic=new zn,ac=class{constructor(e,t,n=0,r=1/0){this.ray=new ki(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new Xn,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):W(`Raycaster: Unsupported camera type: `+t.type)}setFromXRController(e){return ic.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(ic),this}intersectObject(e,t=!0,n=[]){return sc(e,this,n,t),n.sort(oc),n}intersectObjects(e,t=!0,n=[]){for(let r=0,i=e.length;r<i;r++)sc(e[r],this,n,t);return n.sort(oc),n}};function oc(e,t){return e.distance-t.distance}function sc(e,t,n,r){let i=!0;if(e.layers.test(t.layers)&&e.raycast(t,n)===!1&&(i=!1),i===!0&&r===!0){let r=e.children;for(let e=0,i=r.length;e<i;e++)sc(r[e],t,n,!0)}}(class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}});function cc(e,t,n,r){let i=lc(r);switch(n){case Te:return e*t;case V:return e*t/i.components*i.byteLength;case ke:return e*t/i.components*i.byteLength;case Ae:return e*t*2/i.components*i.byteLength;case je:return e*t*2/i.components*i.byteLength;case B:return e*t*3/i.components*i.byteLength;case Ee:return e*t*4/i.components*i.byteLength;case Me:return e*t*4/i.components*i.byteLength;case H:case Ne:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Pe:case Fe:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Le:case ze:return Math.max(e,16)*Math.max(t,8)/4;case Ie:case Re:return Math.max(e,8)*Math.max(t,8)/2;case Be:case Ve:case Ue:case We:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case He:case Ge:case Ke:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case qe:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Je:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case Ye:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case Xe:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case Ze:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Qe:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case $e:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case et:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case tt:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case nt:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case rt:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case it:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case at:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case ot:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case st:case ct:case lt:return Math.ceil(e/4)*Math.ceil(t/4)*16;case ut:case dt:return Math.ceil(e/4)*Math.ceil(t/4)*8;case ft:case pt:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function lc(e){switch(e){case fe:case pe:return{byteLength:1,components:1};case he:case me:case ye:return{byteLength:2,components:1};case be:case xe:return{byteLength:2,components:4};case _e:case ge:case ve:return{byteLength:4,components:1};case Ce:case we:return{byteLength:4,components:3}}throw Error(`THREE.TextureUtils: Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`186`}})),typeof window<`u`&&(window.__THREE__?U(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`186`);function uc(){let e=null,t=!1,n=null,r=null;function i(t,a){r=e.requestAnimationFrame(i),n(t,a)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function dc(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var Z={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Q={common:{diffuse:{value:new Y(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new J},alphaMap:{value:null},alphaMapTransform:{value:new J},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new J}},envmap:{envMap:{value:null},envMapRotation:{value:new J},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new J}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new J}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new J},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new J},normalScale:{value:new K(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new J},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new J}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new J}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new J}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Y(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new q},probesMax:{value:new q},probesResolution:{value:new q}},points:{diffuse:{value:new Y(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new J},alphaTest:{value:0},uvTransform:{value:new J}},sprite:{diffuse:{value:new Y(16777215)},opacity:{value:1},center:{value:new K(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new J},alphaMap:{value:null},alphaMapTransform:{value:new J},alphaTest:{value:0}}},fc={basic:{uniforms:Wo([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.fog]),vertexShader:Z.meshbasic_vert,fragmentShader:Z.meshbasic_frag},lambert:{uniforms:Wo([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,Q.lights,{emissive:{value:new Y(0)},envMapIntensity:{value:1}}]),vertexShader:Z.meshlambert_vert,fragmentShader:Z.meshlambert_frag},phong:{uniforms:Wo([Q.common,Q.specularmap,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,Q.lights,{emissive:{value:new Y(0)},specular:{value:new Y(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Z.meshphong_vert,fragmentShader:Z.meshphong_frag},standard:{uniforms:Wo([Q.common,Q.envmap,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.roughnessmap,Q.metalnessmap,Q.fog,Q.lights,{emissive:{value:new Y(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Z.meshphysical_vert,fragmentShader:Z.meshphysical_frag},toon:{uniforms:Wo([Q.common,Q.aomap,Q.lightmap,Q.emissivemap,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.gradientmap,Q.fog,Q.lights,{emissive:{value:new Y(0)}}]),vertexShader:Z.meshtoon_vert,fragmentShader:Z.meshtoon_frag},matcap:{uniforms:Wo([Q.common,Q.bumpmap,Q.normalmap,Q.displacementmap,Q.fog,{matcap:{value:null}}]),vertexShader:Z.meshmatcap_vert,fragmentShader:Z.meshmatcap_frag},points:{uniforms:Wo([Q.points,Q.fog]),vertexShader:Z.points_vert,fragmentShader:Z.points_frag},dashed:{uniforms:Wo([Q.common,Q.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Z.linedashed_vert,fragmentShader:Z.linedashed_frag},depth:{uniforms:Wo([Q.common,Q.displacementmap]),vertexShader:Z.depth_vert,fragmentShader:Z.depth_frag},normal:{uniforms:Wo([Q.common,Q.bumpmap,Q.normalmap,Q.displacementmap,{opacity:{value:1}}]),vertexShader:Z.meshnormal_vert,fragmentShader:Z.meshnormal_frag},sprite:{uniforms:Wo([Q.sprite,Q.fog]),vertexShader:Z.sprite_vert,fragmentShader:Z.sprite_frag},background:{uniforms:{uvTransform:{value:new J},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Z.background_vert,fragmentShader:Z.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new J}},vertexShader:Z.backgroundCube_vert,fragmentShader:Z.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Z.cube_vert,fragmentShader:Z.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Z.equirect_vert,fragmentShader:Z.equirect_frag},distance:{uniforms:Wo([Q.common,Q.displacementmap,{referencePosition:{value:new q},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Z.distance_vert,fragmentShader:Z.distance_frag},shadow:{uniforms:Wo([Q.lights,Q.fog,{color:{value:new Y(0)},opacity:{value:1}}]),vertexShader:Z.shadow_vert,fragmentShader:Z.shadow_frag}};fc.physical={uniforms:Wo([fc.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new J},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new J},clearcoatNormalScale:{value:new K(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new J},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new J},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new J},sheen:{value:0},sheenColor:{value:new Y(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new J},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new J},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new J},transmissionSamplerSize:{value:new K},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new J},attenuationDistance:{value:0},attenuationColor:{value:new Y(0)},specularColor:{value:new Y(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new J},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new J},anisotropyVector:{value:new K},anisotropyMap:{value:null},anisotropyMapTransform:{value:new J}}]),vertexShader:Z.meshphysical_vert,fragmentShader:Z.meshphysical_frag};var pc={r:0,b:0,g:0},mc=new zn,hc=new J;hc.set(-1,0,0,0,1,0,0,0,1);function gc(e,t,n,r,i,a){let o=new Y(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new X(new ga(1,1,1),new Zo({name:`BackgroundCubeMaterial`,uniforms:Uo(fc.backgroundCube.uniforms),vertexShader:fc.backgroundCube.vertexShader,fragmentShader:fc.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(mc.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(hc),l.material.toneMapped=Cn.getTransfer(i.colorSpace)!==Tt,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new X(new zo(2,2),new Zo({name:`BackgroundMaterial`,uniforms:Uo(fc.background.uniforms),vertexShader:fc.background.vertexShader,fragmentShader:fc.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=Cn.getTransfer(i.colorSpace)!==Tt,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(pc,qo(e)),n.buffers.color.setClear(pc.r,pc.g,pc.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function _c(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function vc(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function yc(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return!(t!==1023&&r.convert(t)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&n!==1015&&!i&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE))}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(U(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&U(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function bc(e){let t=this,n=null,r=0,i=!1,a=!1,o=new Si,s=new J,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var xc=4,Sc=6,Cc=20,wc=256,Tc=new Ls,Ec=new Y,Dc=null,Oc=0,kc=0,Ac=!1,jc=new q,Mc=new q,Nc=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=jc}=i;Dc=this._renderer.getRenderTarget(),Oc=this._renderer.getActiveCubeFace(),kc=this._renderer.getActiveMipmapLevel(),Ac=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Bc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=zc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Dc,Oc,kc),this._renderer.xr.enabled=Ac,e.scissorTest=!1,Ic(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Dc=this._renderer.getRenderTarget(),Oc=this._renderer.getActiveCubeFace(),kc=this._renderer.getActiveMipmapLevel(),Ac=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:z,minFilter:z,generateMipmaps:!1,type:ye,format:Ee,colorSpace:Ct,depthBuffer:!1},r=Fc(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Fc(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Pc(r)),this._blurMaterial=Rc(r,e,t),this._ggxMaterial=Lc(r,e,t)}return r}_compileMaterial(e){let t=new X(new hi,e);this._renderer.compile(t,Tc)}_sceneToCubeUV(e,t,n,r,i){let a=new Is(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(Ec),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new X(new ga,new Ai({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(Ec),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;Ic(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Bc()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=zc());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;Ic(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,Tc)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-xc?n-d+xc:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,Ic(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,Tc),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,Ic(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,Tc)}_blur(e,t,n,r){let i=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,i,t,n,a),this._blurPass(i,e,n,n,a)}_blurPass(e,t,n,r,i){let a=this._renderer,o=this._blurMaterial,s=this._lodMeshes[r];s.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=i,c.mipInt.value=this._lodMax-n;let l=this._sizeLods[r];Ic(t,3*l*(r>this._lodMax-xc?r-this._lodMax+xc:0),4*(this._cubeSize-l),3*l,2*l),a.setRenderTarget(t),a.render(s,Tc)}};function Pc(e){let t=[],n=[],r=e,i=e-xc+1+Sc;for(let e=0;e<i;e++){let e=2**r;t.push(e);let i=1/(e-2),a=-i,o=1+i,s=[a,a,o,a,o,o,a,a,o,o,a,o],c=new Float32Array(108),l=new Float32Array(108);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];c.set(r,18*e);for(let t=0;t<6;t++){let n=s[t*2]*2-1,r=s[t*2+1]*2-1;e===0?Mc.set(1,r,n):e===1?Mc.set(-n,1,-r):e===2?Mc.set(-n,r,1):e===3?Mc.set(-1,r,-n):e===4?Mc.set(-n,-1,r):Mc.set(n,r,-1),Mc.toArray(l,(e*6+t)*3)}}let u=new hi;u.setAttribute(`position`,new ei(c,3)),u.setAttribute(`outputDirection`,new ei(l,3)),n.push(new X(u,null)),r>xc&&r--}return{lodMeshes:n,sizeLods:t}}function Fc(e,t,n){let r=new In(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function Ic(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function Lc(e,t,n){return new Zo({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:wc,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Vc(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Rc(e,t,n){return new Zo({name:`SphericalGaussianBlur`,defines:{SAMPLES:Cc,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Vc(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function zc(){return new Zo({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:Vc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Bc(){return new Zo({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Vc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function Vc(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Hc=class extends In{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new da(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new ga(5,5,5),i=new Zo({name:`CubemapFromEquirect`,uniforms:Uo(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new X(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=z),new Us(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function Uc(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304)if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}else{let r=n.image;if(r&&r.height>0){let i=new Hc(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}else return null}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Nc(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Nc(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function Wc(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&zt(`WebGLRenderer: `+e+` extension not supported.`),t}}}function Gc(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?ni:ti)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function Kc(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function qc(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:W(`WebGLInfo: Unknown draw mode:`,r);break}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function Jc(e,t,n){let r=new WeakMap,i=new Pn;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new Ln(h,p,m,u);g.type=ve,g.needsUpdate=!0;let _=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*_;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new K(p,m)},r.set(o,d);function v(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,v)}o.addEventListener(`dispose`,v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function Yc(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var Xc={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function Zc(e,t,n,r,i,a){let o=new In(t,n,{type:e,depthBuffer:i,stencilBuffer:a,samples:r?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),s=null,c=null,l=new hi;l.setAttribute(`position`,new ri([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute(`uv`,new ri([0,2,0,0,2,0],2));let u=new Qo({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),d=new X(l,u),f=new Ls(-1,1,1,-1,0,1),p=null,m=null,h=!1,g,_=null,v=[],y=!1;this.setSize=function(e,t){o.setSize(e,t),s!==null&&s.setSize(e,t),c!==null&&c.setSize(e,t);for(let n=0;n<v.length;n++){let r=v[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){v=e,y=v.length>0&&v[0].isRenderPass===!0;let t=o.width,n=o.height;v.length>0&&s===null&&(s=new In(t,n,{type:ye,depthBuffer:!1,stencilBuffer:!1}),c=new In(t,n,{type:ye,depthBuffer:!1,stencilBuffer:!1}));for(let e=0;e<v.length;e++){let r=v[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(h||e.toneMapping===0&&v.length===0)return!1;if(_=t,t!==null){let e=t.width,n=t.height;(o.width!==e||o.height!==n)&&this.setSize(e,n)}return y===!1&&e.setRenderTarget(o),g=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return y},this.end=function(e,t){e.toneMapping=g,h=!0;let n=o,r=s;for(let i=0;i<v.length;i++){let a=v[i];a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1&&(n=r,r=r===s?c:s))}if(p!==e.outputColorSpace||m!==e.toneMapping){p=e.outputColorSpace,m=e.toneMapping,u.defines={},Cn.getTransfer(p)===`srgb`&&(u.defines.SRGB_TRANSFER=``);let t=Xc[m];t&&(u.defines[t]=``),u.needsUpdate=!0}u.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(_),e.render(d,f),_=null,h=!1},this.isCompositing=function(){return h},this.dispose=function(){o.dispose(),s!==null&&s.dispose(),c!==null&&c.dispose(),l.dispose(),u.dispose()}}var Qc=new Nn,$c=new pa(1,1),el=new Ln,tl=new Rn,nl=new da,rl=[],il=[],al=new Float32Array(16),ol=new Float32Array(9),sl=new Float32Array(4);function cl(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=rl[i];if(a===void 0&&(a=new Float32Array(i),rl[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function ll(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function ul(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function dl(e,t){let n=il[t];n===void 0&&(n=new Int32Array(t),il[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function fl(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function pl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ll(n,t))return;e.uniform2fv(this.addr,t),ul(n,t)}}function ml(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(ll(n,t))return;e.uniform3fv(this.addr,t),ul(n,t)}}function hl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ll(n,t))return;e.uniform4fv(this.addr,t),ul(n,t)}}function gl(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ll(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),ul(n,t)}else{if(ll(n,r))return;sl.set(r),e.uniformMatrix2fv(this.addr,!1,sl),ul(n,r)}}function _l(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ll(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),ul(n,t)}else{if(ll(n,r))return;ol.set(r),e.uniformMatrix3fv(this.addr,!1,ol),ul(n,r)}}function vl(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(ll(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),ul(n,t)}else{if(ll(n,r))return;al.set(r),e.uniformMatrix4fv(this.addr,!1,al),ul(n,r)}}function yl(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function bl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ll(n,t))return;e.uniform2iv(this.addr,t),ul(n,t)}}function xl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(ll(n,t))return;e.uniform3iv(this.addr,t),ul(n,t)}}function Sl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ll(n,t))return;e.uniform4iv(this.addr,t),ul(n,t)}}function Cl(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function wl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(ll(n,t))return;e.uniform2uiv(this.addr,t),ul(n,t)}}function Tl(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(ll(n,t))return;e.uniform3uiv(this.addr,t),ul(n,t)}}function El(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(ll(n,t))return;e.uniform4uiv(this.addr,t),ul(n,t)}}function Dl(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?($c.compareFunction=n.isReversedDepthBuffer()?518:515,a=$c):a=Qc,n.setTexture2D(t||a,i)}function Ol(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||tl,i)}function kl(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||nl,i)}function Al(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||el,i)}function jl(e){switch(e){case 5126:return fl;case 35664:return pl;case 35665:return ml;case 35666:return hl;case 35674:return gl;case 35675:return _l;case 35676:return vl;case 5124:case 35670:return yl;case 35667:case 35671:return bl;case 35668:case 35672:return xl;case 35669:case 35673:return Sl;case 5125:return Cl;case 36294:return wl;case 36295:return Tl;case 36296:return El;case 35678:case 36198:case 36298:case 36306:case 35682:return Dl;case 35679:case 36299:case 36307:return Ol;case 35680:case 36300:case 36308:case 36293:return kl;case 36289:case 36303:case 36311:case 36292:return Al}}function Ml(e,t){e.uniform1fv(this.addr,t)}function Nl(e,t){let n=cl(t,this.size,2);e.uniform2fv(this.addr,n)}function Pl(e,t){let n=cl(t,this.size,3);e.uniform3fv(this.addr,n)}function Fl(e,t){let n=cl(t,this.size,4);e.uniform4fv(this.addr,n)}function Il(e,t){let n=cl(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function Ll(e,t){let n=cl(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function Rl(e,t){let n=cl(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function zl(e,t){e.uniform1iv(this.addr,t)}function Bl(e,t){e.uniform2iv(this.addr,t)}function Vl(e,t){e.uniform3iv(this.addr,t)}function Hl(e,t){e.uniform4iv(this.addr,t)}function Ul(e,t){e.uniform1uiv(this.addr,t)}function Wl(e,t){e.uniform2uiv(this.addr,t)}function Gl(e,t){e.uniform3uiv(this.addr,t)}function Kl(e,t){e.uniform4uiv(this.addr,t)}function ql(e,t,n){let r=this.cache,i=t.length,a=dl(n,i);ll(r,a)||(e.uniform1iv(this.addr,a),ul(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?$c:Qc;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function Jl(e,t,n){let r=this.cache,i=t.length,a=dl(n,i);ll(r,a)||(e.uniform1iv(this.addr,a),ul(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||tl,a[e])}function Yl(e,t,n){let r=this.cache,i=t.length,a=dl(n,i);ll(r,a)||(e.uniform1iv(this.addr,a),ul(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||nl,a[e])}function Xl(e,t,n){let r=this.cache,i=t.length,a=dl(n,i);ll(r,a)||(e.uniform1iv(this.addr,a),ul(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||el,a[e])}function Zl(e){switch(e){case 5126:return Ml;case 35664:return Nl;case 35665:return Pl;case 35666:return Fl;case 35674:return Il;case 35675:return Ll;case 35676:return Rl;case 5124:case 35670:return zl;case 35667:case 35671:return Bl;case 35668:case 35672:return Vl;case 35669:case 35673:return Hl;case 5125:return Ul;case 36294:return Wl;case 36295:return Gl;case 36296:return Kl;case 35678:case 36198:case 36298:case 36306:case 35682:return ql;case 35679:case 36299:case 36307:return Jl;case 35680:case 36300:case 36308:case 36293:return Yl;case 36289:case 36303:case 36311:case 36292:return Xl}}var Ql=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=jl(t.type)}},$l=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Zl(t.type)}},eu=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},tu=/(\w+)(\])?(\[|\.)?/g;function nu(e,t){e.seq.push(t),e.map[t.id]=t}function ru(e,t,n){let r=e.name,i=r.length;for(tu.lastIndex=0;;){let a=tu.exec(r),o=tu.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){nu(n,l===void 0?new Ql(s,e,t):new $l(s,e,t));break}else{let e=n.map[s];e===void 0&&(e=new eu(s),nu(n,e)),n=e}}}var iu=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);ru(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function au(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var ou=37297,su=0;function cu(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var lu=new J;function uu(e){Cn._getMatrix(lu,Cn.workingColorSpace,e);let t=`mat3( ${lu.elements.map(e=>e.toFixed(4))} )`;switch(Cn.getTransfer(e)){case wt:return[t,`LinearTransferOETF`];case Tt:return[t,`sRGBTransferOETF`];default:return U(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function du(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+cu(e.getShaderSource(t),r)}else return i}function fu(e,t){let n=uu(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var pu={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function mu(e,t){let n=pu[t];return n===void 0?(U(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var hu=new q;function gu(){return Cn.getLuminanceCoefficients(hu),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${hu.x.toFixed(4)}, ${hu.y.toFixed(4)}, ${hu.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function _u(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(bu).join(`
`)}function vu(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function yu(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function bu(e){return e!==``}function xu(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Su(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Cu=/^[ \t]*#include +<([\w\d./]+)>/gm;function wu(e){return e.replace(Cu,Eu)}var Tu=new Map;function Eu(e,t){let n=Z[t];if(n===void 0){let e=Tu.get(t);if(e!==void 0)n=Z[e],U(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`THREE.WebGLProgram: Can not resolve #include <`+t+`>`)}return wu(n)}var Du=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Ou(e){return e.replace(Du,ku)}function ku(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function Au(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var ju={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function Mu(e){return ju[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var Nu={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function Pu(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:Nu[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var Fu={302:`ENVMAP_MODE_REFRACTION`};function Iu(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:Fu[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var Lu={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function Ru(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:Lu[e.combine]||`ENVMAP_BLENDING_NONE`}function zu(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function Bu(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=Mu(n),l=Pu(n),u=Iu(n),d=Ru(n),f=zu(n),p=_u(n),m=vu(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(bu).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(bu).join(`
`),_.length>0&&(_+=`
`)):(g=[Au(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(bu).join(`
`),_=[Au(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.retroreflection?`#define USE_RETROREFLECTION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:Z.tonemapping_pars_fragment,n.toneMapping===0?``:mu(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,Z.colorspace_pars_fragment,fu(`linearToOutputTexel`,n.outputColorSpace),gu(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(bu).join(`
`)),o=wu(o),o=xu(o,n),o=Su(o,n),s=wu(s),s=xu(s,n),s=Su(s,n),o=Ou(o),s=Ou(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=au(i,i.VERTEX_SHADER,y),S=au(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.hasPositionAttribute===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1)if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=du(i,x,`vertex`),n=du(i,S,`fragment`);W(`WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}else o===``?(s===``||c===``)&&(u=!1):U(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new iu(i,h),T=yu(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,ou)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=su++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var Vu=0,Hu=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Uu(e),t.set(e,n)),n}},Uu=class{constructor(e){this.id=Vu++,this.code=e,this.usedTimes=0}};function Wu(e){return e===1030||e===37490||e===36285}function Gu(e,t,n,r,i,a){let o=new Xn,s=new Hu,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&U(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=fc[C];D=e.vertexShader,O=e.fragmentShader}else{D=i.vertexShader,O=i.fragmentShader;let e=s.getVertexShaderStage(i),t=s.getFragmentShaderStage(i);s.update(i,e,t),k=e.id,A=t.id}let j=e.getRenderTarget(),ee=e.state.buffers.depth.getReversed(),M=h.isInstancedMesh===!0,te=h.isBatchedMesh===!0,N=!!i.map,P=!!i.matcap,ne=!!x,re=!!i.aoMap,ie=!!i.lightMap,ae=!!i.bumpMap&&i.wireframe===!1,F=!!i.normalMap,oe=!!i.displacementMap,I=!!i.emissiveMap,L=!!i.metalnessMap,se=!!i.roughnessMap,R=i.anisotropy>0,ce=i.clearcoat>0,le=i.dispersion>0,z=i.retroreflectivity>0,ue=i.iridescence>0,de=i.sheen>0,fe=i.transmission>0,pe=R&&!!i.anisotropyMap,me=ce&&!!i.clearcoatMap,he=ce&&!!i.clearcoatNormalMap,ge=ce&&!!i.clearcoatRoughnessMap,_e=ue&&!!i.iridescenceMap,ve=ue&&!!i.iridescenceThicknessMap,ye=de&&!!i.sheenColorMap,be=de&&!!i.sheenRoughnessMap,xe=!!i.specularMap,Se=!!i.specularColorMap,Ce=!!i.specularIntensityMap,we=fe&&!!i.transmissionMap,Te=fe&&!!i.thicknessMap,B=!!i.gradientMap,Ee=!!i.alphaMap,De=i.alphaTest>0,Oe=!!i.alphaHash,V=!!i.extensions,ke=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(ke=e.toneMapping);let Ae={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:te,batchingColor:te&&h._colorsTexture!==null,instancing:M,instancingColor:M&&h.instanceColor!==null,instancingMorph:M&&h.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Cn.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:N,matcap:P,envMap:ne,envMapMode:ne&&x.mapping,envMapCubeUVHeight:S,aoMap:re,lightMap:ie,bumpMap:ae,normalMap:F,displacementMap:oe,emissiveMap:I,normalMapObjectSpace:F&&i.normalMapType===1,normalMapTangentSpace:F&&i.normalMapType===0,packedNormalMap:F&&i.normalMapType===0&&Wu(i.normalMap.format),metalnessMap:L,roughnessMap:se,anisotropy:R,anisotropyMap:pe,clearcoat:ce,clearcoatMap:me,clearcoatNormalMap:he,clearcoatRoughnessMap:ge,dispersion:le,retroreflection:z,iridescence:ue,iridescenceMap:_e,iridescenceThicknessMap:ve,sheen:de,sheenColorMap:ye,sheenRoughnessMap:be,specularMap:xe,specularColorMap:Se,specularIntensityMap:Ce,transmission:fe,transmissionMap:we,thicknessMap:Te,gradientMap:B,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Ee,alphaTest:De,alphaHash:Oe,combine:i.combine,mapUv:N&&m(i.map.channel),aoMapUv:re&&m(i.aoMap.channel),lightMapUv:ie&&m(i.lightMap.channel),bumpMapUv:ae&&m(i.bumpMap.channel),normalMapUv:F&&m(i.normalMap.channel),displacementMapUv:oe&&m(i.displacementMap.channel),emissiveMapUv:I&&m(i.emissiveMap.channel),metalnessMapUv:L&&m(i.metalnessMap.channel),roughnessMapUv:se&&m(i.roughnessMap.channel),anisotropyMapUv:pe&&m(i.anisotropyMap.channel),clearcoatMapUv:me&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:he&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ge&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:_e&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:ve&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:ye&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:be&&m(i.sheenRoughnessMap.channel),specularMapUv:xe&&m(i.specularMap.channel),specularColorMapUv:Se&&m(i.specularColorMap.channel),specularIntensityMapUv:Ce&&m(i.specularIntensityMap.channel),transmissionMapUv:we&&m(i.transmissionMap.channel),thicknessMapUv:Te&&m(i.thicknessMap.channel),alphaMapUv:Ee&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(F||R),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(N||Ee),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&F===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:ee,skinning:h.isSkinnedMesh===!0,hasPositionAttribute:v.attributes.position!==void 0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numSunLights:o.sun.length,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numSunLightShadows:o.sunShadowMap.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:ke,decodeVideoTexture:N&&i.map.isVideoTexture===!0&&Cn.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:I&&i.emissiveMap.isVideoTexture===!0&&Cn.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:V&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(V&&i.extensions.multiDraw===!0||te)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Ae.vertexUv1s=c.has(1),Ae.vertexUv2s=c.has(2),Ae.vertexUv3s=c.has(3),c.clear(),Ae}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numSunLights),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numSunLightShadows),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.retroreflection&&o.enable(24),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),t.hasPositionAttribute&&o.enable(23),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=fc[t];n=Jo.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new Bu(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function Ku(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function qu(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Ju(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function Yu(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l,u){u.reversedDepth===!0&&(c=-c);let d=s(e,t,a,o,c,l);a.transmission>0?r.push(d):a.transparent===!0?i.push(d):n.push(d)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||qu),r.length>1&&r.sort(t||Ju),i.length>1&&i.sort(t||Ju)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function Xu(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new Yu,e.set(t,[i])):n>=r.length?(i=new Yu,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function Zu(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={direction:new q,color:new Y};break;case`SpotLight`:n={position:new q,direction:new q,color:new Y,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new q,color:new Y,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new q,skyColor:new Y,groundColor:new Y};break;case`RectAreaLight`:n={color:new Y,position:new q,halfWidth:new q,halfHeight:new q};break}return e[t.id]=n,n}}}function Qu(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`SunLight`:case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new K};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new K};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new K,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var $u=0;function ed(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function td(e){let t=new Zu,n=Qu(),r={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new q);let i=new q,a=new zn,o=new zn;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0,y=0,b=0,x=0;i.sort(ed);for(let e=0,S=i.length;e<S;e++){let S=i[e],C=S.color,w=S.intensity,T=S.distance,E=null;if(S.shadow&&S.shadow.map&&(E=S.shadow.map.texture.format===1030?S.shadow.map.texture:S.shadow.map.depthTexture||S.shadow.map.texture),S.isAmbientLight)a+=C.r*w,o+=C.g*w,s+=C.b*w;else if(S.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(S.sh.coefficients[e],w);x++}else if(S.isSunLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize.copy(e.mapSize).multiply(e.getFrameExtents()),r.sunShadow[l]=t,r.sunShadowMap[l]=E;let i=e.getViewportCount();for(let t=0;t<i;t++)r.sunShadowMatrix[u+t]=e.getMatrix(t),r.sunShadowCascade[u+t]=e._cascadeData[t];u+=i,l++}r.sun[c]=e,c++}else if(S.isDirectionalLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[d]=t,r.directionalShadowMap[d]=E,r.directionalShadowMatrix[d]=S.shadow.matrix,g++}r.directional[d]=e,d++}else if(S.isSpotLight){let e=t.get(S);e.position.setFromMatrixPosition(S.matrixWorld),e.color.copy(C).multiplyScalar(w),e.distance=T,e.coneCos=Math.cos(S.angle),e.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),e.decay=S.decay,r.spot[p]=e;let i=S.shadow;if(S.map&&(r.spotLightMap[y]=S.map,y++,i.updateMatrices(S),S.castShadow&&b++),r.spotLightMatrix[p]=i.matrix,S.castShadow){let e=n.get(S);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[p]=e,r.spotShadowMap[p]=E,v++}p++}else if(S.isRectAreaLight){let e=t.get(S);e.color.copy(C).multiplyScalar(w),e.halfWidth.set(S.width*.5,0,0),e.halfHeight.set(0,S.height*.5,0),r.rectArea[m]=e,m++}else if(S.isPointLight){let e=t.get(S);if(e.color.copy(S.color).multiplyScalar(S.intensity),e.distance=S.distance,e.decay=S.decay,S.castShadow){let e=S.shadow,t=n.get(S);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[f]=t,r.pointShadowMap[f]=E,r.pointShadowMatrix[f]=S.shadow.matrix,_++}r.point[f]=e,f++}else if(S.isHemisphereLight){let e=t.get(S);e.skyColor.copy(S.color).multiplyScalar(w),e.groundColor.copy(S.groundColor).multiplyScalar(w),r.hemi[h]=e,h++}}m>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Q.LTC_FLOAT_1,r.rectAreaLTC2=Q.LTC_FLOAT_2):(r.rectAreaLTC1=Q.LTC_HALF_1,r.rectAreaLTC2=Q.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let S=r.hash;(S.sunLength!==c||S.directionalLength!==d||S.pointLength!==f||S.spotLength!==p||S.rectAreaLength!==m||S.hemiLength!==h||S.numSunShadows!==l||S.numDirectionalShadows!==g||S.numPointShadows!==_||S.numSpotShadows!==v||S.numSpotMaps!==y||S.numLightProbes!==x)&&(r.sun.length=c,r.directional.length=d,r.spot.length=p,r.rectArea.length=m,r.point.length=f,r.hemi.length=h,r.sunShadow.length=l,r.sunShadowMap.length=l,r.sunShadowMatrix.length=u,r.sunShadowCascade.length=u,r.directionalShadow.length=g,r.directionalShadowMap.length=g,r.directionalShadowMatrix.length=g,r.pointShadow.length=_,r.pointShadowMap.length=_,r.pointShadowMatrix.length=_,r.spotShadow.length=v,r.spotShadowMap.length=v,r.spotLightMatrix.length=v+y-b,r.spotLightMap.length=y,r.numSpotLightShadowsWithMaps=b,r.numLightProbes=x,S.sunLength=c,S.directionalLength=d,S.pointLength=f,S.spotLength=p,S.rectAreaLength=m,S.hemiLength=h,S.numSunShadows=l,S.numDirectionalShadows=g,S.numPointShadows=_,S.numSpotShadows=v,S.numSpotMaps=y,S.numLightProbes=x,r.version=$u++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=0,f=t.matrixWorldInverse;for(let t=0,p=e.length;t<p;t++){let p=e[t];if(p.isSunLight){let e=r.sun[n];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),n++}else if(p.isDirectionalLight){let e=r.directional[s];e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),s++}else if(p.isSpotLight){let e=r.spot[l];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),e.direction.setFromMatrixPosition(p.matrixWorld),i.setFromMatrixPosition(p.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(f),l++}else if(p.isRectAreaLight){let e=r.rectArea[u];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),o.identity(),a.copy(p.matrixWorld),a.premultiply(f),o.extractRotation(a),e.halfWidth.set(p.width*.5,0,0),e.halfHeight.set(0,p.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),u++}else if(p.isPointLight){let e=r.point[c];e.position.setFromMatrixPosition(p.matrixWorld),e.position.applyMatrix4(f),c++}else if(p.isHemisphereLight){let e=r.hemi[d];e.direction.setFromMatrixPosition(p.matrixWorld),e.direction.transformDirection(f),d++}}}return{setup:s,setupView:c,state:r}}function nd(e){let t=new td(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function rd(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new nd(e),t.set(n,[a])):r>=i.length?(a=new nd(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var id=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,ad=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,od=[new q(1,0,0),new q(-1,0,0),new q(0,1,0),new q(0,-1,0),new q(0,0,1),new q(0,0,-1)],sd=[new q(0,-1,0),new q(0,-1,0),new q(0,0,1),new q(0,0,-1),new q(0,-1,0),new q(0,-1,0)],cd=new zn,ld=new q,ud=new q;function dd(e,t,n){let r=new ra,i=new K,a=new K,o=new Pn,s=new es,c=new ts,l={},u=n.maxTextureSize,d={0:1,1:0,2:2},f=new Zo({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new K},radius:{value:4}},vertexShader:id,fragmentShader:ad}),p=f.clone();p.defines.HORIZONTAL_PASS=1;let m=new hi;m.setAttribute(`position`,new ei(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let h=new X(m,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let _=this.type;this.render=function(t,n,s){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||t.length===0)return;this.type===2&&(U(`WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`),this.type=1);let c=e.getRenderTarget(),l=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),f=e.state;f.setBlending(0),f.buffers.depth.getReversed()===!0?f.buffers.color.setClear(0,0,0,0):f.buffers.color.setClear(1,1,1,1),f.buffers.depth.setTest(!0),f.setScissorTest(!1);let p=_!==this.type;p&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let c=0,l=t.length;c<l;c++){let l=t[c],d=l.shadow;if(d===void 0){U(`WebGLShadowMap:`,l,`has no shadow.`);continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;i.copy(d.mapSize);let m=d.getFrameExtents();i.multiply(m),a.copy(d.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(a.x=Math.floor(u/m.x),i.x=a.x*m.x,d.mapSize.x=a.x),i.y>u&&(a.y=Math.floor(u/m.y),i.y=a.y*m.y,d.mapSize.y=a.y));let h=e.state.buffers.depth.getReversed();if(d.camera._reversedDepth=h,d.map===null||p===!0){if(d.map!==null&&(d.map.depthTexture!==null&&(d.map.depthTexture.dispose(),d.map.depthTexture=null),d.map.dispose()),this.type===3){if(l.isPointLight){U(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}d.map=new In(i.x,i.y,{format:Ae,type:ye,minFilter:z,magFilter:z,generateMipmaps:!1}),d.map.texture.name=l.name+`.shadowMap`,d.map.depthTexture=new pa(i.x,i.y,ve),d.map.depthTexture.name=l.name+`.shadowMapDepth`,d.map.depthTexture.format=De,d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=R,d.map.depthTexture.magFilter=R}else l.isPointLight?(d.map=new Hc(i.x),d.map.depthTexture=new ma(i.x,_e)):(d.map=new In(i.x,i.y),d.map.depthTexture=new pa(i.x,i.y,_e)),d.map.depthTexture.name=l.name+`.shadowMap`,d.map.depthTexture.format=De,this.type===1?(d.map.depthTexture.compareFunction=h?518:515,d.map.depthTexture.minFilter=z,d.map.depthTexture.magFilter=z):(d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=R,d.map.depthTexture.magFilter=R);d.camera.updateProjectionMatrix()}d.map.isWebGLCubeRenderTarget!==!0&&(d.map.width!==i.x||d.map.height!==i.y)&&d.map.setSize(i.x,i.y);let g=d.map.isWebGLCubeRenderTarget?6:d.getViewportCount();l.isPointLight!==!0&&d.updateMatrices(l,s);for(let t=0;t<g;t++){let i=d.getCamera(t);if(l.isPointLight){let e=d.camera,n=d.matrix,r=l.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),ld.setFromMatrixPosition(l.matrixWorld),e.position.copy(ld),ud.copy(e.position),ud.add(od[t]),e.up.copy(sd[t]),e.lookAt(ud),e.updateMatrixWorld(),n.makeTranslation(-ld.x,-ld.y,-ld.z),cd.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),d._frustum.setFromProjectionMatrix(cd,e.coordinateSystem,e.reversedDepth)}if(d.map.isWebGLCubeRenderTarget)e.setRenderTarget(d.map,t),e.clear();else{t===0&&(e.setRenderTarget(d.map),e.clear());let n=d.getViewport(t);o.set(a.x*n.x,a.y*n.y,a.x*n.z,a.y*n.w),f.viewport(o)}r=d.getFrustum(t),b(n,s,i,l,this.type)}d.isPointLightShadow!==!0&&this.type===3&&v(d,s),d.needsUpdate=!1}_=this.type,g.needsUpdate=!1,e.setRenderTarget(c,l,d)};function v(n,r){let a=t.update(h);f.defines.VSM_SAMPLES!==n.blurSamples&&(f.defines.VSM_SAMPLES=n.blurSamples,p.defines.VSM_SAMPLES=n.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),n.mapPass===null?n.mapPass=new In(i.x,i.y,{format:Ae,type:ye}):(n.mapPass.width!==n.map.width||n.mapPass.height!==n.map.height)&&n.mapPass.setSize(n.map.width,n.map.height),f.uniforms.shadow_pass.value=n.map.depthTexture,f.uniforms.resolution.value.set(n.map.width,n.map.height),f.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,f,h,null),p.uniforms.shadow_pass.value=n.mapPass.texture,p.uniforms.resolution.value.set(n.map.width,n.map.height),p.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,p,h,null)}function y(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?c:s,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=l[e];r===void 0&&(r={},l[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,x)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?d[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function b(n,i,a,o,s){if(n.visible===!1)return;if(n.layers.test(i.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||n.intersectsFrustum(r))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),c=n.material;if(Array.isArray(c)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=y(n,d,o,s);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(c.visible){let t=y(n,c,o,s);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)b(c[e],i,a,o,s)}function x(e){e.target.removeEventListener(`dispose`,x);for(let t in l){let n=l[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function fd(e,t){function n(){let t=!1,n=new Pn,r=null,i=new Pn(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?L(e.DEPTH_TEST):se(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=Vt[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?L(e.STENCIL_TEST):se(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new Y(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ee=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),M=!1,te=0,N=e.getParameter(e.VERSION);N.indexOf(`WebGL`)===-1?N.indexOf(`OpenGL ES`)!==-1&&(te=parseFloat(/^OpenGL ES (\d)/.exec(N)[1]),M=te>=2):(te=parseFloat(/^WebGL (\d)/.exec(N)[1]),M=te>=1);let P=null,ne={},re=e.getParameter(e.SCISSOR_BOX),ie=e.getParameter(e.VIEWPORT),ae=new Pn().fromArray(re),F=new Pn().fromArray(ie);function oe(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let I={};I[e.TEXTURE_2D]=oe(e.TEXTURE_2D,e.TEXTURE_2D,1),I[e.TEXTURE_CUBE_MAP]=oe(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),I[e.TEXTURE_2D_ARRAY]=oe(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),I[e.TEXTURE_3D]=oe(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),L(e.DEPTH_TEST),o.setFunc(3),pe(!1),me(1),L(e.CULL_FACE),de(0);function L(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function se(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function R(t,n){return f[t]===n?!1:(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function ce(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function le(t){return h===t?!1:(e.useProgram(t),h=t,!0)}let z={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};z[103]=e.MIN,z[104]=e.MAX;let ue={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function de(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(se(e.BLEND),g=!1);return}if(g===!1&&(L(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:W(`WebGLState: Invalid blending: `,t);break}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:W(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:W(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:W(`WebGLState: Invalid blending: `,t);break}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}return}a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(z[n],z[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(ue[r],ue[i],ue[o],ue[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function fe(t,n){t.side===2?se(e.CULL_FACE):L(e.CULL_FACE);let r=t.side===1;n&&(r=!r),pe(r),t.blending===1&&t.transparent===!1?de(0):de(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),ge(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?L(e.SAMPLE_ALPHA_TO_COVERAGE):se(e.SAMPLE_ALPHA_TO_COVERAGE)}function pe(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function me(t){t===0?se(e.CULL_FACE):(L(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function he(t){t!==k&&(M&&e.lineWidth(t),k=t)}function ge(t,n,r){t?(L(e.POLYGON_OFFSET_FILL),(A!==n||j!==r)&&(A=n,j=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):se(e.POLYGON_OFFSET_FILL)}function _e(t){t?L(e.SCISSOR_TEST):se(e.SCISSOR_TEST)}function ve(t){t===void 0&&(t=e.TEXTURE0+ee-1),P!==t&&(e.activeTexture(t),P=t)}function ye(t,n,r){r===void 0&&(r=P===null?e.TEXTURE0+ee-1:P);let i=ne[r];i===void 0&&(i={type:void 0,texture:void 0},ne[r]=i),(i.type!==t||i.texture!==n)&&(P!==r&&(e.activeTexture(r),P=r),e.bindTexture(t,n||I[t]),i.type=t,i.texture=n)}function be(){let t=ne[P];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function xe(){try{e.compressedTexImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Se(){try{e.compressedTexImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Ce(){try{e.texSubImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function we(){try{e.texSubImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Te(){try{e.compressedTexSubImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function B(){try{e.compressedTexSubImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Ee(){try{e.texStorage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function De(){try{e.texStorage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function Oe(){try{e.texImage2D(...arguments)}catch(e){W(`WebGLState:`,e)}}function V(){try{e.texImage3D(...arguments)}catch(e){W(`WebGLState:`,e)}}function ke(t){return d[t]===void 0?e.getParameter(t):d[t]}function Ae(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function je(t){ae.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),ae.copy(t))}function Me(t){F.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),F.copy(t))}function H(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Ne(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Pe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},P=null,ne={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new Y(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,ae.set(0,0,e.canvas.width,e.canvas.height),F.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:L,disable:se,bindFramebuffer:R,drawBuffers:ce,useProgram:le,setBlending:de,setMaterial:fe,setFlipSided:pe,setCullFace:me,setLineWidth:he,setPolygonOffset:ge,setScissorTest:_e,activeTexture:ve,bindTexture:ye,unbindTexture:be,compressedTexImage2D:xe,compressedTexImage3D:Se,texImage2D:Oe,texImage3D:V,pixelStorei:Ae,getParameter:ke,updateUBOMapping:H,uniformBlockBinding:Ne,texStorage2D:Ee,texStorage3D:De,texSubImage2D:Ce,texSubImage3D:we,compressedTexSubImage2D:Te,compressedTexSubImage3D:B,scissor:je,viewport:Me,reset:Pe}}function pd(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new K,u=new WeakMap,d=new Set,f,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function h(e,t){return m?new OffscreenCanvas(e,t):Nt(`canvas`)}function g(e,t,n){let r=1,i=ke(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1)if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=h(n,a));let o=t?h(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),U(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}else return`data`in e&&U(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e;return e}function _(e){return e.generateMipmaps}function v(t){e.generateMipmap(t)}function y(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function b(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];U(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||U(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?wt:Cn.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function x(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,U(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function S(e,t){return _(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function C(e){let t=e.target;t.removeEventListener(`dispose`,C),T(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&d.delete(t)}function w(e){let t=e.target;t.removeEventListener(`dispose`,w),D(t)}function T(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&E(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function E(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function D(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let O=0;function k(){O=0}function A(){return O}function j(e){O=e}function ee(){let e=O;return e>=i.maxTextures&&U(`WebGLTextures: Trying to use `+(e+1)+` texture units while this GPU supports only `+i.maxTextures),O+=1,e}function M(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function te(t,i){let a=r.get(t);if(t.isVideoTexture&&De(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)U(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)U(`WebGLRenderer: Texture marked for update but image is incomplete`);else{me(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function N(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){me(a,t,i);return}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i)}function P(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){me(a,t,i);return}n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function ne(t,i){let a=r.get(t);if(t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version){he(a,t,i);return}n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let re={[I]:e.REPEAT,[L]:e.CLAMP_TO_EDGE,[se]:e.MIRRORED_REPEAT},ie={[R]:e.NEAREST,[ce]:e.NEAREST_MIPMAP_NEAREST,[le]:e.NEAREST_MIPMAP_LINEAR,[z]:e.LINEAR,[ue]:e.LINEAR_MIPMAP_NEAREST,[de]:e.LINEAR_MIPMAP_LINEAR},ae={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function F(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&U(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,re[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,re[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,re[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,ie[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,ie[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,ae[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function oe(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,C));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=M(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&E(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function fe(e,t,n){return Math.floor(Math.floor(e/n)/t)}function pe(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=fe(n.start,r.width,4),c=fe(t.start,r.width,4);n.start<=i+1&&a===c&&fe(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function me(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=oe(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=Cn.getPrimaries(Cn.workingColorSpace),r=o.colorSpace===``?null:Cn.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=g(o.image,!1,i.maxTextureSize);t=V(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=b(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);F(c,o);let h,y=o.mipmaps,C=o.isVideoTexture!==!0,w=f.__version===void 0||l===!0,T=u.dataReady,E=S(o,t);if(o.isDepthTexture)m=x(o.format===Oe,o.type),w&&(C?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture)if(y.length>0){C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else C?(w&&n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height),T&&pe(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data);else if(o.isCompressedTexture)if(o.isCompressedArrayTexture){C&&w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,y[0].width,y[0].height,t.depth);for(let i=0,a=y.length;i<a;i++)if(h=y[i],o.format!==1023)if(r!==null)if(C){if(T)if(o.layerUpdates.size>0){let t=cc(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0);else U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`);else C?T&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data);o.layerUpdates.size>0&&o.clearLayerUpdates()}else{C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],o.format===1023?C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):C?T&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}else if(o.isDataArrayTexture)if(C){if(w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,t.width,t.height,t.depth),T)if(o.layerUpdates.size>0){let i=cc(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isData3DTexture)C?(w&&n.texStorage3D(e.TEXTURE_3D,E,m,t.width,t.height,t.depth),T&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(w)if(C)n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<E;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}if(e.texElementImage2D.length===3)e.texElementImage2D(e.TEXTURE_2D,e.RGBA8,t);else{let n=e.RGBA,r=e.RGBA,i=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,n,r,i,t)}e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(y.length>0){if(C&&w){let t=ke(y[0]);n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height)}for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(C){if(w){let r=ke(t);n.texStorage2D(e.TEXTURE_2D,E,m,r.width,r.height)}T&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);_(o)&&v(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function he(t,o,s){if(o.image.length!==6)return;let c=oe(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=Cn.getPrimaries(Cn.workingColorSpace),r=o.colorSpace===``?null:Cn.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=g(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=V(o,m[e]);let h=m[0],y=a.convert(o.format,o.colorSpace),x=a.convert(o.type),C=b(o.internalFormat,y,x,o.normalized,o.colorSpace),w=o.isVideoTexture!==!0,T=u.__version===void 0||c===!0,E=l.dataReady,D=S(o,h);F(e.TEXTURE_CUBE_MAP,o);let O;if(f){w&&T&&n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,y,x,i.data):y===null?U(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):w?E&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,w&&T){O.length>0&&D++;let t=ke(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,t.width,t.height)}for(let t=0;t<6;t++)if(p){w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,y,x,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,m[t].width,m[t].height,0,y,x,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,i.width,i.height,0,y,x,i.data)}}else{w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,y,x,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,y,x,m[t]);for(let r=0;r<O.length;r++){let i=O[r];w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,y,x,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,y,x,i.image[t])}}}_(o)&&v(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function ge(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=b(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),Ee(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,B(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function _e(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=x(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;Ee(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,B(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,B(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=b(o.internalFormat,c,l,o.normalized,o.colorSpace);Ee(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,B(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,B(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function ve(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,(!l.__webglTexture||i.depthTexture.image.width!==i.width||i.depthTexture.image.height!==i.height)&&(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,C)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),F(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else te(i.depthTexture,0);let u=l.__webglTexture,d=B(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)Ee(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)Ee(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`THREE.WebGLTextures: Unknown depthTexture format.`)}function ye(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer)if(a)for(let e=0;e<6;e++)ve(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?ve(i.__webglFramebuffer[0],t,0):ve(i.__webglFramebuffer,t,0)}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),_e(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),_e(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function be(t,n,i){let a=r.get(t);n!==void 0&&ge(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&ye(t)}function xe(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,w);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&Ee(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=b(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=B(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),_e(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),F(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)ge(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else ge(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);_(i)&&v(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),F(c,a),ge(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),_(a)&&v(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),F(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)ge(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else ge(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);_(i)&&v(r),n.unbindTexture()}t.depthBuffer&&ye(t)}function Se(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(_(a)){let t=y(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),v(t),n.unbindTexture()}}}let Ce=[],we=[];function Te(t){if(t.samples>0){if(Ee(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(Ce.length=0,we.length=0,Ce.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&(Ce.push(l),we.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,we)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Ce))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.storeMultisampledDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function B(e){return Math.min(i.maxSamples,e.samples)}function Ee(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function De(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function V(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(Cn.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&U(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):W(`WebGLTextures: Unsupported texture color space:`,n)),t}function ke(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=ee,this.resetTextureUnits=k,this.getTextureUnits=A,this.setTextureUnits=j,this.setTexture2D=te,this.setTexture2DArray=N,this.setTexture3D=P,this.setTextureCube=ne,this.rebindTextures=be,this.setupRenderTarget=xe,this.updateRenderTargetMipmap=Se,this.updateMultisampleRenderTarget=Te,this.setupDepthRenderbuffer=ye,this.setupFrameBufferTexture=ge,this.useMultisampledRTT=Ee,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function md(e,t){function n(n,r=``){let i,a=Cn.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779)if(a===`srgb`)if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===35840||n===35841||n===35842||n===35843)if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491)if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821)if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===36492||n===36494||n===36495)if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===36283||n===36284||n===36285||n===36286)if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var hd=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,gd=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,_d=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new ha(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Zo({vertexShader:hd,fragmentShader:gd,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new X(new zo(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},vd=class extends Ht{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,d=null,f=null,p=null,m=typeof XRWebGLBinding<`u`,h=new _d,g={},_=t.getContextAttributes(),v=null,y=null,b=[],x=[],S=new K,C=null,w=null,T=new Is;T.viewport=new Pn;let E=new Is;E.viewport=new Pn;let D=[T,E],O=new Ws,k=null,A=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=b[e];return t===void 0&&(t=new hr,b[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=b[e];return t===void 0&&(t=new hr,b[e]=t),t.getGripSpace()},this.getHand=function(e){let t=b[e];return t===void 0&&(t=new hr,b[e]=t),t.getHandSpace()};function j(e){let t=x.indexOf(e.inputSource);if(t===-1)return;let n=b[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function ee(){r.removeEventListener(`select`,j),r.removeEventListener(`selectstart`,j),r.removeEventListener(`selectend`,j),r.removeEventListener(`squeeze`,j),r.removeEventListener(`squeezestart`,j),r.removeEventListener(`squeezeend`,j),r.removeEventListener(`end`,ee),r.removeEventListener(`inputsourceschange`,M);for(let e=0;e<b.length;e++){let t=x[e];t!==null&&(x[e]=null,b[e].disconnect(t))}k=null,A=null,h.reset();for(let e in g)delete g[e];if(e.setRenderTarget(v),f=null,d=null,u=null,r=null,y=null,F.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),w!==null){let e=w.camera;e.fov=w.fov,e.zoom=w.zoom,e.updateProjectionMatrix(),w=null}n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&U(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&U(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return d===null?f:d},this.getBinding=function(){return u===null&&m&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return p},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(v=e.getRenderTarget(),r.addEventListener(`select`,j),r.addEventListener(`selectstart`,j),r.addEventListener(`selectend`,j),r.addEventListener(`squeeze`,j),r.addEventListener(`squeezestart`,j),r.addEventListener(`squeezeend`,j),r.addEventListener(`end`,ee),r.addEventListener(`inputsourceschange`,M),_.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),m&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;_.depth&&(o=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=_.stencil?Oe:De,a=_.stencil?Se:_e);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),d=u.createProjectionLayer(s),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),y=new In(d.textureWidth,d.textureHeight,{format:Ee,type:fe,depthTexture:new pa(d.textureWidth,d.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let n={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:i};f=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new In(f.framebufferWidth,f.framebufferHeight,{format:Ee,type:fe,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),F.setContext(r),F.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function M(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=x.indexOf(n);r>=0&&(x[r]=null,b[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=x.indexOf(n);if(r===-1){for(let e=0;e<b.length;e++)if(e>=x.length){x.push(n),r=e;break}else if(x[e]===null){x[e]=n,r=e;break}if(r===-1)break}let i=b[r];i&&i.connect(n)}}let te=new q,N=new q;function P(e,t,n){te.setFromMatrixPosition(t.matrixWorld),N.setFromMatrixPosition(n.matrixWorld);let r=te.distanceTo(N),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function ne(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;h.texture!==null&&(h.depthNear>0&&(t=h.depthNear),h.depthFar>0&&(n=h.depthFar)),O.near=E.near=T.near=t,O.far=E.far=T.far=n,(k!==O.near||A!==O.far)&&(r.updateRenderState({depthNear:O.near,depthFar:O.far}),k=O.near,A=O.far),O.layers.mask=e.layers.mask|6,T.layers.mask=O.layers.mask&-5,E.layers.mask=O.layers.mask&-3;let i=e.parent,a=O.cameras;ne(O,i);for(let e=0;e<a.length;e++)ne(a[e],i);a.length===2?P(O,T,E):O.projectionMatrix.copy(T.projectionMatrix),w===null&&e.isPerspectiveCamera&&(w={camera:e,fov:e.fov,zoom:e.zoom}),re(e,O,i)};function re(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=Kt*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return O},this.getFoveation=function(){if(!(d===null&&f===null))return s},this.setFoveation=function(e){s=e,d!==null&&(d.fixedFoveation=e),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=e)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(O)},this.getCameraTexture=function(e){return g[e]};let ie=null;function ae(t,i){if(l=i.getViewerPose(c||a),p=i,l!==null){let t=l.views;f!==null&&(e.setRenderTargetFramebuffer(y,f.framebuffer),e.setRenderTarget(y));let i=!1;t.length!==O.cameras.length&&(O.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(f!==null)a=f.getViewport(r);else{let t=u.getViewSubImage(d,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(y,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(y))}let o=D[n];o===void 0&&(o=new Is,o.layers.enable(n),o.viewport=new Pn,D[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(O.matrix.copy(o.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale)),i===!0&&O.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&m){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&h.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&m){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=g[n];e||(e=new ha,g[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<b.length;e++){let t=x[e],n=b[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}ie&&ie(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),p=null}let F=new uc;F.setAnimationLoop(ae),this.setAnimationLoop=function(e){ie=e},this.dispose=function(){}}},yd=new zn,bd=new J;bd.set(-1,0,0,0,1,0,0,0,1);function xd(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,qo(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(yd.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(bd),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.retroreflectivity>0&&(e.retroreflectivity.value=t.retroreflectivity),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function Sd(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(g(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,v));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return W(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let e=0,t=r.length;e<t;e++){let t=r[e];if(Array.isArray(t))for(let n=0,r=t.length;n<r;n++)p(t[n],e,n,a);else p(t,e,0,a)}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(t,n,r,i){if(h(t,n,r,i)===!0){let n=t.__offset,r=t.value;if(Array.isArray(r)){let e=0;for(let n=0;n<r.length;n++){let i=r[n],a=_(i);m(i,t.__data,e),typeof i!=`number`&&typeof i!=`boolean`&&!i.isMatrix3&&!ArrayBuffer.isView(i)&&(e+=a.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(r,t.__data,0);e.bufferSubData(e.UNIFORM_BUFFER,n,t.__data)}}function m(e,t,n){typeof e==`number`||typeof e==`boolean`?t[0]=e:e.isMatrix3?(t[0]=e.elements[0],t[1]=e.elements[1],t[2]=e.elements[2],t[3]=0,t[4]=e.elements[3],t[5]=e.elements[4],t[6]=e.elements[5],t[7]=0,t[8]=e.elements[6],t[9]=e.elements[7],t[10]=e.elements[8],t[11]=0):ArrayBuffer.isView(e)?t.set(new e.constructor(e.buffer,e.byteOffset,t.length)):e.toArray(t,n)}function h(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return typeof i==`number`||typeof i==`boolean`?r[a]=i:ArrayBuffer.isView(i)?r[a]=i.slice():r[a]=i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function g(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=_(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function _(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?U(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):U(`WebGLRenderer: Unsupported uniform value type.`,e),t}function v(t){let n=t.target;n.removeEventListener(`dispose`,v);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function y(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:y}}var Cd=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),wd=null;function Td(){return wd===null&&(wd=new Wi(Cd,16,16,Ae,ye),wd.name=`DFG_LUT`,wd.minFilter=z,wd.magFilter=z,wd.wrapS=L,wd.wrapT=L,wd.generateMipmaps=!1,wd.needsUpdate=!0),wd}var Ed=class{constructor(e={}){let{canvas:t=Pt(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=fe}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);p=n.getContextAttributes().alpha}else p=a;let m=f,h=new Set([Me,je,ke]),g=new Set([fe,_e,he,Se,be,xe]),_=new Uint32Array(4),v=new Int32Array(4),y=new q,b=null,x=null,S=[],C=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,E=!1,D=null,O=null,k=null,A=null;this._outputColorSpace=St;let j=0,ee=0,M=null,te=-1,N=null,P=new Pn,ne=new Pn,re=null,ie=new Y(0),ae=0,F=t.width,oe=t.height,I=1,L=null,se=null,R=new Pn(0,0,F,oe),ce=new Pn(0,0,F,oe),le=!1,z=new ra,ue=!1,pe=!1,me=new zn,ge=new q,ve=new Pn,Ce={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},we=!1;function Te(){return M===null?I:1}let B=n;function Ee(e,n){return t.getContext(e,n)}let De,Oe,V,Ae,H,Ne,Pe,Fe,Ie,Le,Re,ze,Be,Ve,He,Ue,We,Ge,Ke,qe,Je,Ye,Xe;try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r186`),t.addEventListener(`webglcontextlost`,$e,!1),t.addEventListener(`webglcontextrestored`,et,!1),t.addEventListener(`webglcontextcreationerror`,tt,!1),B===null){let t=`webgl2`;if(B=Ee(t,e),B===null)throw Ee(t)?Error(`THREE.WebGLRenderer: Error creating WebGL context with your selected attributes.`):Error(`THREE.WebGLRenderer: Error creating WebGL context.`)}Ze()}catch(e){throw t.removeEventListener(`webglcontextlost`,$e,!1),t.removeEventListener(`webglcontextrestored`,et,!1),t.removeEventListener(`webglcontextcreationerror`,tt,!1),W(`WebGLRenderer: `+e.message),e}function Ze(){De=new Wc(B),De.init(),Je=new md(B,De),Oe=new yc(B,De,e,Je),V=new fd(B,De),Oe.reversedDepthBuffer&&d&&V.buffers.depth.setReversed(!0),O=B.createFramebuffer(),k=B.createFramebuffer(),A=B.createFramebuffer(),Ae=new qc(B),H=new Ku,Ne=new pd(B,De,V,H,Oe,Je,Ae),Pe=new Uc(T),Fe=new dc(B),Ye=new _c(B,Fe),Ie=new Gc(B,Fe,Ae,Ye),Le=new Yc(B,Ie,Fe,Ye,Ae),Ge=new Jc(B,Oe,Ne),He=new bc(H),Re=new Gu(T,Pe,De,Oe,Ye,He),ze=new xd(T,H),Be=new Xu,Ve=new rd(De),We=new gc(T,Pe,V,Le,p,s),Ue=new dd(T,Le,Oe),Xe=new Sd(B,Ae,Oe,V),Ke=new vc(B,De,Ae),qe=new Kc(B,De,Ae),Ae.programs=Re.programs,T.capabilities=Oe,T.extensions=De,T.properties=H,T.renderLists=Be,T.shadowMap=Ue,T.state=V,T.info=Ae}m!==1009&&(w=new Zc(m,t.width,t.height,o,r,i));let Qe=new vd(T,B);this.xr=Qe,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let e=De.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=De.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return I},this.setPixelRatio=function(e){e!==void 0&&(I=e,this.setSize(F,oe,!1))},this.getSize=function(e){return e.set(F,oe)},this.setSize=function(e,n,r=!0){if(Qe.isPresenting){U(`WebGLRenderer: Can't change size while VR device is presenting.`);return}F=e,oe=n,t.width=Math.floor(e*I),t.height=Math.floor(n*I),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(F*I,oe*I).floor()},this.setDrawingBufferSize=function(e,n,r){F=e,oe=n,I=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(m===1009){W(`WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){U(`WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}w.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(P)},this.getViewport=function(e){return e.copy(R)},this.setViewport=function(e,t,n,r){e.isVector4?R.set(e.x,e.y,e.z,e.w):R.set(e,t,n,r),V.viewport(P.copy(R).multiplyScalar(I).round())},this.getScissor=function(e){return e.copy(ce)},this.setScissor=function(e,t,n,r){e.isVector4?ce.set(e.x,e.y,e.z,e.w):ce.set(e,t,n,r),V.scissor(ne.copy(ce).multiplyScalar(I).round())},this.getScissorTest=function(){return le},this.setScissorTest=function(e){V.setScissorTest(le=e)},this.setOpaqueSort=function(e){L=e},this.setTransparentSort=function(e){se=e},this.getClearColor=function(e){return e.copy(We.getClearColor())},this.setClearColor=function(){We.setClearColor(...arguments)},this.getClearAlpha=function(){return We.getClearAlpha()},this.setClearAlpha=function(){We.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(M!==null){let t=M.texture.format;e=h.has(t)}if(e){let e=M.texture.type,t=g.has(e),n=We.getClearColor(),r=We.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(_[0]=i,_[1]=a,_[2]=o,_[3]=r,B.clearBufferuiv(B.COLOR,0,_)):(v[0]=i,v[1]=a,v[2]=o,v[3]=r,B.clearBufferiv(B.COLOR,0,v))}else r|=B.COLOR_BUFFER_BIT}t&&(r|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&B.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),D=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,$e,!1),t.removeEventListener(`webglcontextrestored`,et,!1),t.removeEventListener(`webglcontextcreationerror`,tt,!1),We.dispose(),Be.dispose(),Ve.dispose(),H.dispose(),Pe.dispose(),Le.dispose(),Ye.dispose(),Xe.dispose(),Re.dispose(),Qe.dispose(),Qe.removeEventListener(`sessionstart`,ct),Qe.removeEventListener(`sessionend`,lt),ut.stop()};function $e(e){e.preventDefault(),Lt(`WebGLRenderer: Context Lost.`),E=!0}function et(){Lt(`WebGLRenderer: Context Restored.`),E=!1;let e=Ae.autoReset,t=Ue.enabled,n=Ue.autoUpdate,r=Ue.needsUpdate,i=Ue.type;Ze(),Ae.autoReset=e,Ue.enabled=t,Ue.autoUpdate=n,Ue.needsUpdate=r,Ue.type=i}function tt(e){W(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function nt(e){let t=e.target;t.removeEventListener(`dispose`,nt),rt(t)}function rt(e){it(e),H.remove(e)}function it(e){let t=H.get(e).programs;t!==void 0&&(t.forEach(function(e){Re.releaseProgram(e)}),e.isShaderMaterial&&Re.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=Ce);let o=i.isMesh&&i.matrixWorld.determinantAffine()<0,s=bt(e,t,n,r,i);V.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Ie.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;Ye.setup(i,r,s,n,c);let h,g=Ke;if(c!==null&&(h=Fe.get(c),g=qe,g.setIndex(h)),i.isMesh)r.wireframe===!0?(V.setLineWidth(r.wireframeLinewidth*Te()),g.setMode(B.LINES)):g.setMode(B.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),V.setLineWidth(e*Te()),i.isLineSegments?g.setMode(B.LINES):i.isLineLoop?g.setMode(B.LINE_LOOP):g.setMode(B.LINE_STRIP)}else i.isPoints?g.setMode(B.POINTS):i.isSprite&&g.setMode(B.TRIANGLES);if(i.isBatchedMesh)if(De.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?Fe.get(c).bytesPerElement:1,o=H.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(B,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function at(e,t,n,r){D!==null&&e.isNodeMaterial&&D.setObject(r,e),ue===!0&&He.setState(e,n,!1),e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,gt(e,t,r),e.side=0,e.needsUpdate=!0,gt(e,t,r),e.side=2):gt(e,t,r)}this.compile=function(e,t,n=null){n===null&&(n=e),D!==null&&D.renderStart(e,t,n),x=Ve.get(n),x.init(t),C.push(x),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),x.setupLights(),D!==null&&D.updateLights(x.state.lightsArray),pe=this.localClippingEnabled,ue=He.init(this.clippingPlanes,pe),ue===!0&&He.setGlobalState(this.clippingPlanes,t),D!==null&&Ue.render(x.state.shadowsArray,n,t);let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let i=e.material;if(i)if(Array.isArray(i))for(let a=0;a<i.length;a++){let o=i[a];at(o,n,t,e),r.add(o)}else at(i,n,t,e),r.add(i)}),x=C.pop(),D!==null&&D.renderEnd(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){let t=H.get(e).currentProgram;(t===void 0||t.isReady())&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}De.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let ot=null;function st(e){ot&&ot(e)}function ct(){ut.stop()}function lt(){ut.start()}let ut=new uc;ut.setAnimationLoop(st),typeof self<`u`&&ut.setContext(self),this.setAnimationLoop=function(e){ot=e,Qe.setAnimationLoop(e),e===null?ut.stop():ut.start()},Qe.addEventListener(`sessionstart`,ct),Qe.addEventListener(`sessionend`,lt),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){W(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(E===!0)return;D!==null&&D.renderStart(e,t);let n=Qe.enabled===!0&&Qe.isPresenting===!0,r=w!==null&&(M===null||n)&&w.begin(T,M);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),Qe.enabled===!0&&Qe.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Qe.cameraAutoUpdate===!0&&Qe.updateCamera(t),t=Qe.getCamera()),e.isScene===!0&&e.onBeforeRender(T,e,t,M),x=Ve.get(e,C.length),x.init(t),x.state.textureUnits=Ne.getTextureUnits(),C.push(x),me.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),z.setFromProjectionMatrix(me,At,t.reversedDepth),pe=this.localClippingEnabled,ue=He.init(this.clippingPlanes,pe),b=Be.get(e,S.length),b.init(),S.push(b),Qe.enabled===!0&&Qe.isPresenting===!0){let e=T.xr.getDepthSensingMesh();e!==null&&dt(e,t,-1/0,T.sortObjects)}dt(e,t,0,T.sortObjects),b.finish(),D!==null&&D.updateLights(x.state.lightsArray),T.sortObjects===!0&&b.sort(L,se),we=Qe.enabled===!1||Qe.isPresenting===!1||Qe.hasDepthSensing()===!1,we&&We.addToRenderList(b,e),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ue===!0&&He.beginShadows();let i=x.state.shadowsArray;if(Ue.render(i,e,t),ue===!0&&He.endShadows(),(r&&w.hasRenderPass())===!1){let n=b.opaque,r=b.transmissive;if(x.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];pt(n,r,e,a)}we&&We.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];ft(b,e,n,n.viewport)}}else r.length>0&&pt(n,r,e,t),we&&We.render(e),ft(b,e,t)}M!==null&&ee===0&&(Ne.updateMultisampleRenderTarget(M),Ne.updateRenderTargetMipmap(M)),r&&w.end(T),e.isScene===!0&&e.onAfterRender(T,e,t),Ye.resetDefaultState(),te=-1,N=null,C.pop(),C.length>0?(x=C[C.length-1],Ne.setTextureUnits(x.state.textureUnits),ue===!0&&He.setGlobalState(T.clippingPlanes,x.state.camera)):x=null,S.pop(),b=S.length>0?S[S.length-1]:null,D!==null&&D.renderEnd()};function dt(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)x.pushLightProbeGrid(e);else if(e.isLight)x.pushLight(e),e.castShadow&&x.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||e.intersectsFrustum(z)){r&&ve.setFromMatrixPosition(e.matrixWorld).applyMatrix4(me);let i=Le.update(e),a=e.material;a.visible&&b.push(e,i,a,n,ve.z,null,t)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||e.intersectsFrustum(z))){let i=Le.update(e),a=e.material;if(r&&(e.boundingSphere===void 0?(i.boundingSphere===null&&i.computeBoundingSphere(),ve.copy(i.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),ve.copy(e.boundingSphere.center)),ve.applyMatrix4(e.matrixWorld).applyMatrix4(me)),Array.isArray(a)){let r=i.groups;for(let o=0,s=r.length;o<s;o++){let s=r[o],c=a[s.materialIndex];c&&c.visible&&b.push(e,i,c,n,ve.z,s,t)}}else a.visible&&b.push(e,i,a,n,ve.z,null,t)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)dt(i[e],t,n,r)}function ft(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;x.setupLightsView(n),ue===!0&&He.setGlobalState(T.clippingPlanes,n),r&&V.viewport(P.copy(r)),i.length>0&&mt(i,t,n),a.length>0&&mt(a,t,n),o.length>0&&mt(o,t,n),V.buffers.depth.setTest(!0),V.buffers.depth.setMask(!0),V.buffers.color.setMask(!0),V.setPolygonOffset(!1)}function pt(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[r.id]===void 0){let e=De.has(`EXT_color_buffer_half_float`)||De.has(`EXT_color_buffer_float`);x.state.transmissionRenderTarget[r.id]=new In(1,1,{generateMipmaps:!0,type:e?ye:fe,minFilter:de,samples:Math.max(4,Oe.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Cn.workingColorSpace})}let a=x.state.transmissionRenderTarget[r.id],o=r.viewport||P;a.setSize(o.z*T.transmissionResolutionScale,o.w*T.transmissionResolutionScale);let s=T.getRenderTarget(),c=T.getActiveCubeFace(),l=T.getActiveMipmapLevel();T.setRenderTarget(a),T.getClearColor(ie),ae=T.getClearAlpha(),ae<1&&T.setClearColor(16777215,.5),T.clear(),we&&We.render(n);let u=T.toneMapping;T.toneMapping=0;let d=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),x.setupLightsView(r),ue===!0&&He.setGlobalState(T.clippingPlanes,r),mt(e,n,r),Ne.updateMultisampleRenderTarget(a),Ne.updateRenderTargetMipmap(a),De.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,ht(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(Ne.updateMultisampleRenderTarget(a),Ne.updateRenderTargetMipmap(a))}T.setRenderTarget(s,c,l),T.setClearColor(ie,ae),d!==void 0&&(r.viewport=d),T.toneMapping=u}function mt(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&ht(o,t,n,s,l,c)}}function ht(e,t,n,r,i,a){D!==null&&i.isNodeMaterial&&D.setObject(e,i),e.onBeforeRender(T,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(T,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=2):T.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(T,t,n,r,i,a)}function gt(e,t,n){t.isScene!==!0&&(t=Ce);let r=H.get(e),i=x.state.lights,a=x.state.shadowsArray,o=i.state.version,s=Re.getParameters(e,i.state,a,t,n,x.state.lightProbeGridArray),c=Re.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=Pe.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,nt),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return vt(e,s),d}else s.uniforms=Re.getUniforms(e),D!==null&&e.isNodeMaterial&&D.build(e,n,s),e.onBeforeCompile(s,T),d=Re.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=He.uniform),vt(e,s),r.needsLights=Ct(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.sunLights.value=i.state.sun,f.sunLightShadows.value=i.state.sunShadow,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.sunShadowMatrix.value=i.state.sunShadowMatrix,f.sunShadowCascade.value=i.state.sunShadowCascade,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=x.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function _t(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=iu.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function vt(e,t){let n=H.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function yt(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];y.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(y))return n}return null}function bt(e,t,n,r,i){t.isScene!==!0&&(t=Ce),Ne.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=M===null?T.outputColorSpace:M.isXRRenderTarget===!0?M.texture.colorSpace:Cn.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=Pe.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(M===null||M.isXRRenderTarget===!0)&&(h=T.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=H.get(r),y=x.state.lights;if(ue===!0&&(pe===!0||e!==N)){let t=e===N&&r.id===te;He.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i._colorsTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i._colorsTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==He.numPlanes||v.numIntersection!==He.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=x.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let S=v.currentProgram;b===!0&&(S=gt(r,t,i),D&&r.isNodeMaterial&&D.onUpdateProgram(r,S,v));let C=!1,w=!1,E=!1,O=S.getUniforms(),k=v.uniforms;if(V.useProgram(S.program)&&(C=!0,w=!0,E=!0),r.id!==te&&(te=r.id,w=!0),v.needsLights){let e=yt(x.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,w=!0)}if(C||N!==e){V.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),O.setValue(B,`projectionMatrix`,e.projectionMatrix),O.setValue(B,`viewMatrix`,e.matrixWorldInverse);let t=O.map.cameraPosition;t!==void 0&&t.setValue(B,ge.setFromMatrixPosition(e.matrixWorld)),Oe.logarithmicDepthBuffer&&O.setValue(B,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&O.setValue(B,`isOrthographic`,e.isOrthographicCamera===!0),N!==e&&(N=e,w=!0,E=!0)}if(v.needsLights&&(y.state.sunShadowMap.length>0&&O.setValue(B,`sunShadowMap`,y.state.sunShadowMap,Ne),y.state.directionalShadowMap.length>0&&O.setValue(B,`directionalShadowMap`,y.state.directionalShadowMap,Ne),y.state.spotShadowMap.length>0&&O.setValue(B,`spotShadowMap`,y.state.spotShadowMap,Ne),y.state.pointShadowMap.length>0&&O.setValue(B,`pointShadowMap`,y.state.pointShadowMap,Ne)),i.isSkinnedMesh){O.setOptional(B,i,`bindMatrix`),O.setOptional(B,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),O.setValue(B,`boneTexture`,e.boneTexture,Ne))}i.isBatchedMesh&&(O.setOptional(B,i,`batchingTexture`),O.setValue(B,`batchingTexture`,i._matricesTexture,Ne),O.setOptional(B,i,`batchingIdTexture`),O.setValue(B,`batchingIdTexture`,i._indirectTexture,Ne),O.setOptional(B,i,`batchingColorTexture`),i._colorsTexture!==null&&O.setValue(B,`batchingColorTexture`,i._colorsTexture,Ne));let A=n.morphAttributes;if((A.position!==void 0||A.normal!==void 0||A.color!==void 0)&&Ge.update(i,n,S),(w||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,O.setValue(B,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(k.envMapIntensity.value=t.environmentIntensity),k.dfgLUT!==void 0&&(k.dfgLUT.value=Td()),w){if(O.setValue(B,`toneMappingExposure`,T.toneMappingExposure),v.needsLights&&xt(k,E),a&&r.fog===!0&&ze.refreshFogUniforms(k,a),ze.refreshMaterialUniforms(k,r,I,oe,x.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;k.probesSH.value=e.texture,k.probesMin.value.copy(e.boundingBox.min),k.probesMax.value.copy(e.boundingBox.max),k.probesResolution.value.copy(e.resolution)}iu.upload(B,_t(v),k,Ne)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(iu.upload(B,_t(v),k,Ne),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&O.setValue(B,`center`,i.center),O.setValue(B,`modelViewMatrix`,i.modelViewMatrix),O.setValue(B,`normalMatrix`,i.normalMatrix),O.setValue(B,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];Xe.update(n,S),Xe.bind(n,S)}}return S}function xt(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.sunLights.needsUpdate=t,e.sunLightShadows.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function Ct(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return j},this.getActiveMipmapLevel=function(){return ee},this.getRenderTarget=function(){return M},this.setRenderTargetTextures=function(e,t,n){let r=H.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),H.get(e.texture).__webglTexture=t,H.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=H.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0},this.setRenderTarget=function(e,t=0,n=0){M=e,j=t,ee=n;let r=null,i=!1,a=!1;if(e){let o=H.get(e);if(o.__useDefaultFramebuffer!==void 0){V.bindFramebuffer(B.FRAMEBUFFER,o.__webglFramebuffer),P.copy(e.viewport),ne.copy(e.scissor),re=e.scissorTest,V.viewport(P),V.scissor(ne),V.setScissorTest(re),te=-1;return}else if(o.__webglFramebuffer===void 0)Ne.setupRenderTarget(e);else if(o.__hasExternalTextures)Ne.rebindTextures(e,H.get(e.texture).__webglTexture,H.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&H.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.`);Ne.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=H.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&Ne.useMultisampledRTT(e)===!1?H.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,P.copy(e.viewport),ne.copy(e.scissor),re=e.scissorTest}else P.copy(R).multiplyScalar(I).floor(),ne.copy(ce).multiplyScalar(I).floor(),re=le;if(n!==0&&(r=O),V.bindFramebuffer(B.FRAMEBUFFER,r)&&V.drawBuffers(e,r),V.viewport(P),V.scissor(ne),V.setScissorTest(re),i){let r=H.get(e.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=H.get(e.textures[t]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=H.get(e.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,t.__webglTexture,n)}te=-1};function wt(e){let t=H.get(e);return(t.__readFormat!==e.format||t.__readType!==e.type)&&(t.__readFormat=e.format,t.__readType=e.type,t.__formatReadable=Oe.textureFormatReadable(e.format),t.__typeReadable=Oe.textureTypeReadable(e.type)),t}this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){W(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=H.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){V.bindFramebuffer(B.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;e.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+s);let u=wt(o);if(u.__formatReadable===!1){W(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(u.__typeReadable===!1){W(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&B.readPixels(t,n,r,i,Je.convert(c),Je.convert(l),a)}finally{let e=M===null?null:H.get(M).__webglFramebuffer;V.bindFramebuffer(B.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=H.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c)if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){V.bindFramebuffer(B.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;e.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+s);let d=wt(o);if(d.__formatReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(d.__typeReadable===!1)throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let f=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,f),B.bufferData(B.PIXEL_PACK_BUFFER,a.byteLength,B.STREAM_READ),B.readPixels(t,n,r,i,Je.convert(l),Je.convert(u),0),B.bindBuffer(B.PIXEL_PACK_BUFFER,null);let p=M===null?null:H.get(M).__webglFramebuffer;V.bindFramebuffer(B.FRAMEBUFFER,p);let m=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await Bt(B,m,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,f),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,a),B.bindBuffer(B.PIXEL_PACK_BUFFER,null),B.deleteBuffer(f),B.deleteSync(m),a}else throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;Ne.setTexture2D(e,0),B.copyTexSubImage2D(B.TEXTURE_2D,n,0,0,o,s,i,a),V.unbindTexture()},this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=Je.convert(t.format),_=Je.convert(t.type),v;t.isData3DTexture?(Ne.setTexture3D(t,0),v=B.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(Ne.setTexture2DArray(t,0),v=B.TEXTURE_2D_ARRAY):(Ne.setTexture2D(t,0),v=B.TEXTURE_2D),V.activeTexture(B.TEXTURE0),V.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,t.flipY),V.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),V.pixelStorei(B.UNPACK_ALIGNMENT,t.unpackAlignment);let y=V.getParameter(B.UNPACK_ROW_LENGTH),b=V.getParameter(B.UNPACK_IMAGE_HEIGHT),x=V.getParameter(B.UNPACK_SKIP_PIXELS),S=V.getParameter(B.UNPACK_SKIP_ROWS),C=V.getParameter(B.UNPACK_SKIP_IMAGES);V.pixelStorei(B.UNPACK_ROW_LENGTH,h.width),V.pixelStorei(B.UNPACK_IMAGE_HEIGHT,h.height),V.pixelStorei(B.UNPACK_SKIP_PIXELS,l),V.pixelStorei(B.UNPACK_SKIP_ROWS,u),V.pixelStorei(B.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=H.get(e),r=H.get(t),h=H.get(n.__renderTarget),g=H.get(r.__renderTarget);V.bindFramebuffer(B.READ_FRAMEBUFFER,h.__webglFramebuffer),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,H.get(e).__webglTexture,i,d+n),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,H.get(t).__webglTexture,a,m+n)),B.blitFramebuffer(l,u,o,s,f,p,o,s,B.DEPTH_BUFFER_BIT,B.NEAREST);V.bindFramebuffer(B.READ_FRAMEBUFFER,null),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||H.has(e)){let n=H.get(e),r=H.get(t);V.bindFramebuffer(B.READ_FRAMEBUFFER,k),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,A);for(let e=0;e<c;e++)w?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,n.__webglTexture,i),T?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,r.__webglTexture,a),i===0?T?B.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):B.copyTexSubImage2D(v,a,f,p,l,u,o,s):B.blitFramebuffer(l,u,o,s,f,p,o,s,B.COLOR_BUFFER_BIT,B.NEAREST);V.bindFramebuffer(B.READ_FRAMEBUFFER,null),V.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?B.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?B.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):B.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):B.texSubImage2D(B.TEXTURE_2D,a,f,p,o,s,g,_,h);V.pixelStorei(B.UNPACK_ROW_LENGTH,y),V.pixelStorei(B.UNPACK_IMAGE_HEIGHT,b),V.pixelStorei(B.UNPACK_SKIP_PIXELS,x),V.pixelStorei(B.UNPACK_SKIP_ROWS,S),V.pixelStorei(B.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&B.generateMipmap(v),V.unbindTexture()},this.initRenderTarget=function(e){H.get(e).__webglFramebuffer===void 0&&Ne.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?Ne.setTextureCube(e,0):e.isData3DTexture?Ne.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?Ne.setTexture2DArray(e,0):Ne.setTexture2D(e,0),V.unbindTexture()},this.resetState=function(){j=0,ee=0,M=null,V.reset(),Ye.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return At}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Cn._getDrawingBufferColorSpace(e),t.unpackColorSpace=Cn._getUnpackColorSpace()}},Dd={laneCount:3,approachTimeSec:2,perfectWindowSec:.08,goodWindowSec:.11,earlyGoodWindowSec:.11,missWindowSec:.16,hitRadiusMeters:.22,minStrikeSpeedMps:.6,minCutSpeedMps:.2,cutConeDegrees:50,minGlobalNoteSpacingSec:.25,minSameHandSpacingSec:.4,intensityFloor:.12,maxActiveNotes:64,maxHandTravelMps:1.2,noteSpeedMps:4,noteSizeMeters:.32,rowSpacingMeters:.34,resolvedNoteLifetimeSec:.22},Od=[{lane:0,hand:`left`,xOffsetMeters:-.45},{lane:1,hand:`either`,xOffsetMeters:0},{lane:2,hand:`right`,xOffsetMeters:.45}],kd={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0],"up-left":[-Math.SQRT1_2,Math.SQRT1_2],"up-right":[Math.SQRT1_2,Math.SQRT1_2],"down-left":[-Math.SQRT1_2,-Math.SQRT1_2],"down-right":[Math.SQRT1_2,-Math.SQRT1_2]},Ad=new Set([`intro-establish`,`breakdown-long`,`transition-release`,`outro-dissolve`]),jd=new Set([`drop-short`,`drop-long`,`drop-after-build`,`peak-sustain`]),Md=new Set([`orbit`,`ripple`,`swarm`]),Nd=new Set([`drive`,`tunnel`,`slice`,`fragment`]);function Pd(e){if(!e)return`pulse`;let t=e.automationSituation,n=e.movementGesture;return e.variantRole===`release`||e.variantRole===`sparse`||e.globalArcRole===`resolution`||t!==void 0&&Ad.has(t)?`breath`:t===`buildup-ramp`?`build`:e.variantRole===`secondary`||n===`echo`?`echo`:t!==void 0&&jd.has(t)?`impact`:n!==void 0&&Md.has(n)||e.motif===`orbit-system`?`weave`:n!==void 0&&Nd.has(n)||e.motif===`tunnel-drive`?`drive`:`pulse`}var Fd={orbit:`weave`,ripple:`echo`,swarm:`weave`,drive:`drive`,tunnel:`drive`,slice:`drive`,fragment:`impact`,pulse:`pulse`,echo:`echo`,bloom:`weave`,expand:`impact`,collapse:`breath`,fade:`breath`,lock:`pulse`};function Id(e,t,n,r,i=Dd){if(!e||e===`any`)return!0;let a=kd[e],o=Math.hypot(t,n);return o>=Math.max(1e-5,r*i.minCutSpeedMps)&&(t*a[0]+n*a[1])/o>=Math.cos(i.cutConeDegrees*Math.PI/180)}var Ld=Object.freeze({difficulty:`normal`,activity:`balanced`,variation:`paired`,handPattern:`alternate`,handLead:`even`,zones:`split`,playSpace:`standard`}),Rd=[`macro`,`balanced`,`active`],zd=[`stable`,`paired`,`expressive`],Bd=[`alternate`,`call-response`,`together`,`independent`],Vd=[`left`,`even`,`right`],Hd=[`easy`,`normal`,`hard`,`expert`,`ultra`],Ud=[`split`,`shared`,`cross`],Wd=[`standard`,`tall`],Gd=.4;function Kd(e,t){return t===`tall`?{...e,rowSpacingMeters:Gd}:e}function qd(e,t=Ld){let n=(e,t,n)=>e!==void 0&&t.includes(e)?e:n,r=t;return{difficulty:n(e?.difficulty,Hd,r.difficulty),activity:n(e?.activity,Rd,r.activity),variation:n(e?.variation,zd,r.variation),handPattern:n(e?.handPattern,Bd,r.handPattern),handLead:n(e?.handLead,Vd,r.handLead),zones:n(e?.zones,Ud,r.zones),playSpace:n(e?.playSpace,Wd,r.playSpace),...e?.motionSafety===`guarded`||e?.chartProfile===`musical-v1`?{motionSafety:`guarded`}:{},...e?.chartProfile===`musical-v1`?{chartProfile:`musical-v1`}:{}}}var Jd={maxRunBeats:1/0,sectionSilenceBeats:0,directionalSingles:!1,extraPairs:!1,pairPrepSec:.8,pairClearSec:.75},Yd={easy:{globalSpacingScale:2,sameHandSpacingScale:2,travelScale:.75,ceilingScale:1.5,hardChain:0,crossRate:.4,crossClearSec:1,maxRowStep:1,freeCutsOnWeakOnsets:!0,strictSequences:!1,calmCeilingScale:1.5,...Jd},normal:{globalSpacingScale:1,sameHandSpacingScale:1,travelScale:1,ceilingScale:1,hardChain:1,crossRate:1,crossClearSec:.5,maxRowStep:2,freeCutsOnWeakOnsets:!1,strictSequences:!1,calmCeilingScale:1,...Jd},hard:{globalSpacingScale:.8,sameHandSpacingScale:.825,travelScale:4/3,ceilingScale:.7,hardChain:2,crossRate:1.6,crossClearSec:.4,maxRowStep:2,freeCutsOnWeakOnsets:!1,strictSequences:!0,calmCeilingScale:.7,...Jd},expert:{globalSpacingScale:.6,sameHandSpacingScale:.75,travelScale:5/3,ceilingScale:.5,hardChain:4,crossRate:2.4,crossClearSec:.35,maxRowStep:2,freeCutsOnWeakOnsets:!1,strictSequences:!0,calmCeilingScale:.5,...Jd},ultra:{globalSpacingScale:.45,sameHandSpacingScale:.55,travelScale:2.2,ceilingScale:.3,hardChain:6,crossRate:3,crossClearSec:.3,maxRowStep:2,freeCutsOnWeakOnsets:!1,strictSequences:!0,calmCeilingScale:1,maxRunBeats:16,sectionSilenceBeats:2,directionalSingles:!0,extraPairs:!0,pairPrepSec:.5,pairClearSec:.45}};function Xd(e){return Yd[e]}var Zd={macro:2,balanced:1,active:.5};function Qd(e){let t=Zd[e.activity];switch(e.variation){case`stable`:return{densityScale:t,textureVocabulary:2,phrasesPerTexture:2,phraseBeats:16,phraseMinSec:4,phraseMaxSec:12,cutDiversity:0};case`expressive`:return{densityScale:t,textureVocabulary:4,phrasesPerTexture:1,phraseBeats:8,phraseMinSec:3,phraseMaxSec:8,cutDiversity:2};default:return{densityScale:t,textureVocabulary:4,phrasesPerTexture:1,phraseBeats:16,phraseMinSec:4,phraseMaxSec:12,cutDiversity:1}}}var $d=e=>Math.max(0,Math.min(1,e)),ef=e=>typeof e==`number`&&Number.isFinite(e)&&e>=0,tf=e=>e.reduce((e,t)=>e+t,0);function nf(e,t,n,r,i){if(!Array.isArray(n)||!rf(t,n.length,r,i))return;let a=[];for(let t of e){let e=Math.floor(Math.round(t.time*r)/i),o=n[e],s=n[Math.max(0,e-1)];if(!o||!s||!ef(o.e)||!ef(s.e)||!Array.isArray(o.perceptualSpectrum)||!Array.isArray(s.perceptualSpectrum)||o.perceptualSpectrum.length!==24||s.perceptualSpectrum.length!==24||!o.perceptualSpectrum.every(ef)||!s.perceptualSpectrum.every(ef))return;let c=[0,0,0];for(let e=0;e<24;e++)c[Math.floor(e/8)]+=Math.max(0,o.perceptualSpectrum[e]-s.perceptualSpectrum[e])/8;a.push({time:t.time,intensity:t.intensity,type:t.type,frame:e,energy:o.e,change:c})}return{version:1,source:`published-frame-change`,sampleRate:r,hopSize:i,frameCount:n.length,records:a}}function rf(e,t,n,r){return Number.isFinite(e)&&e>0&&Number.isSafeInteger(t)&&t>0&&Number.isSafeInteger(n)&&n>=1e3&&n<=384e3&&Number.isSafeInteger(r)&&r>=4&&r<=65536&&Number.isInteger(Math.log2(r))&&Math.abs(t-Math.ceil(e*n/r))<=1}function af(e,t,n){return!!e&&e.version===1&&e.source===`published-frame-change`&&rf(n,e.frameCount,e.sampleRate,e.hopSize)&&Array.isArray(e.records)&&e.records.length===t.length&&e.records.every((n,r)=>n&&n.time===t[r].time&&n.intensity===t[r].intensity&&n.type===t[r].type&&n.frame===Math.floor(Math.round(n.time*e.sampleRate)/e.hopSize)&&n.frame>=0&&n.frame<e.frameCount&&ef(n.energy)&&Array.isArray(n.change)&&n.change.length===3&&n.change.every(ef))}function of(e,t,n,r,i,a,o,s,c,l,u){let d=af(l,t,n),f=u?new Map(t.map(e=>[e.time,e])):void 0,p=u?.every((e,t)=>ef(e.time)&&(t===0||e.time>u[t-1].time)&&f.get(e.time)?.intensity===e.intensity&&f.get(e.time)?.type===e.type),m=u?p?u.map(e=>e.time):[]:void 0,h=(e,t)=>{let n=0,r=e.length;for(;n<r;){let i=n+r>>>1;e[i]<t?n=i+1:r=i}return n},g=new Set,_=Array(t.length).fill(0),v=[],y={low:0,mid:0,high:0,mixed:0},b=(o.activity===`active`?.8:o.activity===`macro`?.5:2/3)*Math.min(1,1/c),x=0,S=0,C=-1/0;for(;x<e.length;){let c=e[x].event.time;for(;S+1<i.length&&i[S+1]<=c;)S++;let u=i[S+1]??(i[S]??0)+r*4,f=a&&i.length>0&&i[S]<=c&&c<u,p=a&&i.length&&c>=u?u:0,w=f?i[S]:p+Math.floor((c-p)/(r*4))*r*4,T=Math.min(n+1e-6,f?i[S+1]??w+r*4:Math.min(w+r*4,a&&i[S]>c?i[S]:1/0)),E=x+1;for(;E<e.length&&e[E].event.time<T;)E++;let D=e.slice(x,E),O=[0,0,0],k=D.map(e=>e.event.intensity),A=tf(k)/D.length;for(let e of D)if(d)for(let t=0;t<3;t++)O[t]+=l.records[e.index].change[t];let j=tf(O),ee=j/D.length;for(let e of D){let t=d?l.records[e.index]:void 0,n=t?tf(t.change):0,r=n>1e-9&&j>1e-9?tf(O.map((e,r)=>e/j*t.change[r]/n)):0;_[e.index]=.2+.5*Math.min(2,e.event.intensity/Math.max(1e-9,A))+(t?.6*Math.min(2,n/Math.max(1e-9,ee))+.5*r:0)}let M=Math.max(...O),te=j>1e-9&&M/j>=.5?O.indexOf(M):-1,N=[`low`,`mid`,`high`][te]??`mixed`;y[N]++;let P=D.slice(1).map((e,t)=>e.event.time-D[t].event.time),ne=P.length?tf(P)/P.length:r*4,re=$d(1-(P.length?Math.sqrt(tf(P.map(e=>(e-ne)**2))/P.length):0)/Math.max(.01,ne)),ie=d?D.map(e=>l.records[e.index].energy):k,ae=$d(tf(ie)/ie.length),F=ie.at(-1)-ie[0],oe=D.length*r/Math.max(r,T-w)<.7,I=k.reduce((e,t)=>Math.max(e,t),0)/Math.max(1e-9,A),L=oe&&ae<.4?`breath`:F>.18&&D.length>=4?`build`:I>1.45?`impact`:re>.8?`pulse`:te===1||te===2?`weave`:`drive`,se=L===`breath`?`calm`:L===`build`?`build`:L===`impact`?`peak`:`drive`,R=m?Math.max(1,h(m,T)-h(m,w)):D.length,ce=sf(D,_,Math.min(128,R<=2?R:Math.max(1,Math.ceil(R*b)),Math.max(1,Math.ceil((T-w)/s))),s);for(let e of ce)g.add(e);let le=ce.slice().sort((e,n)=>_[n]-_[e]||t[e].time-t[n].time),z=tf(D.map(e=>_[e.index]))/D.length,ue=o.handPattern===`together`,de=le.length?t[le[0]].time:-1/0,fe=le.length&&(ue?D.length>=3:_[le[0]]>z*1.15&&de-C>=r*8)?[de]:[];fe.length&&(C=de),v.push({start:w,end:T,texture:L,kind:se,energy:ae,primaryBand:N,accents:fe}),x=E}let w;for(let t of e)g.has(t.index)&&(w&&t.event.time-w.event.time<s-1e-9?_[t.index]>_[w.index]?(g.delete(w.index),w=t):g.delete(t.index):w=t);return{selected:g,scores:_,windows:v,summary:{version:1,mode:d?`frame-change`:`events-only`,...u?{budgetSource:p?`legacy-visual`:`invalid-budget`}:{},...d?{}:{fallbackReason:`missing-or-invalid-frame-evidence`},candidates:e.length,selected:g.size,windows:v.length,bands:y}}}function sf(e,t,n,r){let i=e.length+1,a=new Uint8Array((n+1)*i),o=new Int32Array(e.length);for(let t=0,n=-1;t<e.length;t++){for(;n+1<t&&e[n+1].event.time<=e[t].event.time-r+1e-9;)n++;o[t]=n}let s=new Float64Array(i),c=new Float64Array(i);for(let r=1;r<=n;r++){c[0]=0;for(let n=1;n<i;n++){let l=s[o[n-1]+1]+t[e[n-1].index];l>c[n-1]+1e-12?(c[n]=l,a[r*i+n]=1):c[n]=c[n-1]}[s,c]=[c,s]}let l=[];for(let t=e.length,r=n;t>0&&r>0;)a[r*i+t]?(l.push(e[t-1].index),t=o[t-1]+1,r--):t--;return l.reverse()}var cf=[`intro`,`verse`,`build`,`drop`,`break`,`peak`,`outro`];function lf(e,t){if(!e?.length)return[];let n=e.slice().sort((e,t)=>e.start-t.start);if(n[0].start!==0||Math.abs(n.at(-1).end-t)>.05)return[];for(let e=0;e<n.length;e++){let r=n[e];if(![r.start,r.end].every(Number.isFinite)||r.start<0||r.end<=r.start||r.end>t+.05||!cf.includes(r.label)||e>0&&Math.abs(r.start-n[e-1].end)>1e-6)return[]}return n}var uf={breath:[`breath`,`pulse`,`echo`,`weave`],pulse:[`pulse`,`weave`,`drive`,`echo`],drive:[`drive`,`weave`,`echo`,`pulse`],weave:[`weave`,`drive`,`pulse`,`echo`],build:[`build`,`pulse`,`weave`,`drive`],impact:[`impact`,`drive`,`weave`,`echo`],echo:[`echo`,`pulse`,`weave`,`drive`]};function df(e,t,n,r,i,a=Ld,o,s){let c=Qd(a),l=a.chartProfile===`musical-v1`?lf(o,n):[],u=(i>=.5?r.slice(1).map((e,t)=>e-r[t]):e.slice(1).map((t,n)=>t.time-e[n].time)).filter(e=>e>=.2&&e<=1.5).sort((e,t)=>e-t),d=Math.max(.25,Math.min(1,u[Math.floor(u.length/2)]??.5)),f=l.length?s??of(e.map((e,t)=>({event:e,index:t})),e,n,d,i>=.5?r.filter((e,t)=>t%4==0):[],i>=.5,a,Math.max(.01,Dd.minGlobalNoteSpacingSec*Xd(a.difficulty).globalSpacingScale*Math.max(1,c.densityScale)),Xd(a.difficulty).globalSpacingScale):void 0;if(f){let n=[],r;for(let i of f.windows){let a=n.at(-1);if(a&&a.end>=i.start-1e-7&&a.texture===i.texture&&r===i.primaryBand&&a.character?.kind===i.kind&&Math.abs(a.character.energy-i.energy)<=.2&&i.end-a.start<=c.phraseMaxSec){let e=(a.end-a.start)/(i.end-a.start);a.character.energy=a.character.energy*e+i.energy*(1-e),a.end=i.end,a.pairTimes.push(...i.accents),a.pairTime=a.pairTimes[0]}else{let r=e.find(e=>e.time>=i.start&&e.time<i.end)?.time??i.start;n.push({index:n.length,start:i.start,end:i.end,point:t.findLast(e=>e.time<=r),texture:i.texture,pairTime:i.accents[0],pairTimes:i.accents.slice(),beatSec:d,character:{kind:i.kind,energy:i.energy,densityScale:1}})}r=i.primaryBand}return n}let p=Math.max(c.phraseMinSec,Math.min(c.phraseMaxSec,d*c.phraseBeats)),m=[],h=0,g=-1,_,v=0;for(;h<e.length;){let r=e[h].time;for(;g+1<t.length&&t[g+1].time<=r;)g++;let i=t[g],o=Math.min(n+.001,r+p,t[g+1]?.time??1/0),s=h+1;for(;s<e.length&&e[s].time<o;)s++;let l=uf[Pd(i?.meta)],u=m.at(-1)?.point,f=u===i?m.length:0;v=u===i?v+1:0;let y=i?.meta?.movementGesture,b=y?Fd[y]:void 0,x=l[((b&&l.includes(b)?l.indexOf(b):0)+(c.phrasesPerTexture===1?f:Math.floor(v/c.phrasesPerTexture))%c.textureVocabulary)%l.length];x===_&&(c.phrasesPerTexture===1||v===0)&&(x=l[(l.indexOf(x)+1)%l.length]);let S;if(s-h>=6&&e[s-1].time-r>=2){let t=-1/0;for(let n=h;n<s;n++){let i=e[n];if(i.time<r+1||i.time>o-.5)continue;let a=i.intensity+(i.type===2?.1:0)-(i.time-r)*.002;a>t&&(t=a,S=i.time)}}let C=S===void 0?[]:[S];a.handPattern===`together`?ff(e,h,s,r,o,d,x,i,C):Xd(a.difficulty).extraPairs&&ff(e,h,s,r,o,d,x,i,C,2),m.push({index:m.length,start:r,end:o,texture:x,point:i,pairTime:S,pairTimes:C,beatSec:d}),_=x,h=s}return m}function ff(e,t,n,r,i,a,o,s,c,l=1){let u=s?.meta?.behaviour?.energy??Math.min(1,(s?.intensity??0)/3),d=(o===`impact`||o===`drive`||o===`build`&&u>=.65?1:o===`breath`?4:2)*l,f=a*4*d;for(let a=r+1;a<i-.5;a+=f){let o=-1/0,s,l=0;for(let c=t;c<n;c++){let t=e[c];if(t.time<a||t.time>=Math.min(a+f,i-.5))continue;l++;let n=t.intensity+(t.type===2?.1:0)-(t.time-r)*.002;n>o&&(o=n,s=t.time)}s!==void 0&&l>=3&&!c.includes(s)&&c.push(s)}c.sort((e,t)=>e-t)}var pf=.65,mf=e=>e===`left`?`right`:`left`;function hf(e,t){let n=Math.imul((e|0)^2654435769,2246822507)^Math.imul((t|0)+1663821227,3266489909);return n^=n>>>15,n=Math.imul(n,739982445),n^=n>>>12,n=Math.imul(n,695872825),n^=n>>>15,(n>>>0)/4294967296}function gf(e){let t=e-Math.floor(e);return t<.15||t>.85}var _f=class{pattern;lead;handOver;nextHand=`left`;balance=0;constructor(e,t,n=!1){this.pattern=e,this.lead=t,this.handOver=n}choose(e,t){switch(this.pattern){case`call-response`:return this.callResponse(e,t);case`independent`:return this.independent(e,t);default:return this.alternate(e,t)}}commit(e,t){this.nextHand=mf(e),!t&&this.lead!==`even`&&(this.balance+=pf-+(e===this.lead))}alternate(e,t){if(this.lead===`even`)return this.pattern===`alternate`&&!this.handOver?t.ready(this.nextHand)?this.nextHand:null:this.fallback(this.nextHand,t);let n=this.lead,r;return r=e.pointChanged||gf(e.beatPhase)&&e.beatPhase<1?n:this.balance+.65>=.5==hf(e.eventIndex,e.phraseIndex)<.1?mf(n):n,this.fallback(r,t)}callResponse(e,t){let n=e.texture===`impact`||e.texture===`drive`||e.texture===`build`&&e.energy>=.65?1:2,r=Math.max(0,e.time-e.phraseStart)/(e.beatSec*4)+1e-9,i;if(this.lead===`even`){let t=e.phraseIndex%2==0?`left`:`right`;i=Math.floor(r/n)%2==0?t:mf(t)}else{let e=n/2;i=Math.floor(r/e)%3<2?this.lead:mf(this.lead)}return t.ready(i)?i:null}independent(e,t){if(e.phrasePrimary===0||e.phraseSecondary===0)return this.fallback(this.nextHand,t);let n=e.primaryStream,r=e.phrasePrimary>=e.phraseSecondary,i=this.lead===`even`?`left`:r?this.lead:mf(this.lead),a=n?i:mf(i);return t.ready(a)?a:null}fallback(e,t){return t.ready(e)?e:t.ready(mf(e))?mf(e):null}},vf={breath:.15,echo:.45,pulse:.4,weave:.75,drive:.7,build:.4,impact:1},yf={slice:1.4,fragment:1.4,orbit:1.4,swarm:1.4,ripple:1.3,lock:.4,pulse:.5,fade:.4,collapse:.4},bf={tunnel:1.5,drive:1.5,lock:1.4,pulse:1.2,expand:.6,bloom:.6};function xf(e,t,n){let r=e===`build`?vf.build+.5*Math.min(1,Math.max(0,t)):vf[e];return Math.min(1,r)*(n?1:.55)}function Sf(e){if(e.zones===`split`||e.beatsIntoScene<4)return{cross:0,center:0};let t=xf(e.texture,e.energy,e.strong),n=e.gesture?yf[e.gesture]??1:1,r=e.gesture?bf[e.gesture]??1:1;return{cross:e.zones===`cross`?Math.min(.6,.3*e.crossRate*t*n*(e.fill?1.5:1)):0,center:Math.min(.5,.28*r*(.5+.5*t))}}function Cf(e){let{cross:t,center:n}=Sf(e);if(t===0&&n===0)return wf;let r=hf(e.eventIndex,7919);return r<t?Ef:r<t+n?Tf:wf}var wf=[`own`],Tf=[`center`,`own`],Ef=[`cross`,`center`,`own`],Df=.75,Of=.75,kf=8,Af=4,jf=new Set([`down`,`down-left`,`down-right`,`any`]),Mf=new Set([`up`,`up-left`,`up-right`]),Nf=e=>e.xOffsetMeters??Od[e.lane].xOffsetMeters;function Pf(e,t,n){let r=n?e.cutDirection!==void 0&&Mf.has(e.cutDirection):t.cutDirection!==void 0&&t.cutDirection!==`any`&&jf.has(t.cutDirection);return Math.max(0,3-e.row-!!r)}function Ff(e){let t=new Map;for(let n of e){let e=n.phrase??-1,r=t.get(e);r?r.push(n.intensity):t.set(e,[n.intensity])}let n=new Map;for(let[e,r]of t)r.sort((e,t)=>e-t),n.set(e,{median:r[Math.floor(r.length/2)],accent:r[Math.min(r.length-1,Math.floor(r.length*Of))]});return n}function If(e,t,n){if(!t.bigScene(e.time)||e.intensity<n.median)return!1;if(!t.reliable)return e.intensity>=n.accent;let r=t.beatPhase(e.time);return Math.abs(r-Math.round(r))<.15}function Lf(e,t,n){let r=e.slice(),i={left:[],right:[]};r.forEach((e,t)=>{(e.hand===`left`||e.hand===`right`)&&i[e.hand].push(t)});let a=new Map;for(let e of[`left`,`right`])i[e].forEach((e,t)=>a.set(e,t));let o=new Set,s=(e,t,n)=>{let r=i[e];for(let e=a.get(t)+n;e>=0&&e<r.length;e+=n)if(!o.has(r[e]))return r[e];return-1},c=Ff(e),l={left:-1/0,right:-1/0},u=-1/0,d=(e,n,r)=>{let i=Pf(e,n,r);return(Math.abs(n.time-e.time)>=1.499999999||i<=t.demand.maxRowStep)&&Math.hypot(Nf(e)-Nf(n),i*t.rowSpacingMeters)<=Math.abs(n.time-e.time)*t.maxHandTravelMps+1e-9},f=(e,t)=>{if(!e.cutDirection||!t.cutDirection||e.cutDirection===`any`||t.cutDirection===`any`||Math.abs(t.time-e.time)>=1.5)return!0;let n=kd[e.cutDirection],r=kd[t.cutDirection];return n[0]*r[0]+n[1]*r[1]<=.1},p=(e,n)=>{let i=r[e];if(Nf(i)===0||!i.cutDirection||!jf.has(i.cutDirection))return null;let a=t.beatSec(i.time);if(i.time-l[n]<kf*a-1e-9)return null;let o=s(n,e,-1);if(o>=0&&(i.time-r[o].time<Math.max(.5,t.minSameHandSpacingSec)-1e-9||!d(r[o],i,!0)))return null;let c=Math.max(Df,a,t.minSameHandSpacingSec),u=[],p=s(n,e,1);for(;p>=0&&(r[p].time-i.time<c-1e-9||u.length>0&&!f(i,r[p]));){if(u.length>=2||r[p].pairId||r[p].row===3)return null;u.push(p),p=s(n,p,1)}return p>=0&&!d(r[p],i,!1)?null:u},m=(e,t)=>{let n=r[e];for(let e of t)o.add(e);r[e]={...n,row:3},l[n.hand]=n.time,u=n.time};for(let e=0;e<r.length;e++){let n=r[e];if(n.hand!==`left`&&n.hand!==`right`)continue;let i=c.get(n.phrase??-1);if(!If(n,t,i)||n.time-u<Af*t.beatSec(n.time)-1e-9)continue;if(n.pairId){let a=r[e+1]?.pairId===n.pairId?e+1:-1;if(a<0)continue;let o=r[a];if(n.pairLayout===`horizontal`){if(t.demand.strictSequences&&n.intensity>=i.accent){let t=p(e,n.hand),r=t&&p(a,o.hand);t&&r&&(m(e,t),m(a,r))}}else if(t.demand.maxRowStep>=2){let t=n.row===2?e:o.row===2?a:-1,i=t>=0?p(t,r[t].hand):null;i&&m(t,i)}e=a;continue}let a=p(e,n.hand);a&&m(e,a)}return o.size&&n?.([...o].map(e=>r[e])),o.size?r.filter((e,t)=>!o.has(t)):r}var Rf={up:`down`,down:`up`,left:`right`,right:`left`,"up-left":`down-right`,"down-right":`up-left`,"up-right":`down-left`,"down-left":`up-right`},zf=e=>e<-.2?0:e>.2?2:1;function Bf(e,t){let n=0,r=e.length;for(;n<r;){let i=n+r>>>1;e[i]<=t?n=i+1:r=i}return n-1}var Vf=e=>e.xOffsetMeters??Od[e.lane].xOffsetMeters,Hf=.06;function Uf(e,t){let n=Bf(e,t);return e[n+1]-t<=Hf?n+1:Math.max(0,n)}function Wf(e,t,n=Ld,r){let i=Qd(n),a=Xd(n.difficulty),o=t.minGlobalNoteSpacingSec*a.globalSpacingScale,s=t.minSameHandSpacingSec*a.sameHandSpacingScale,c=t.maxHandTravelMps*a.travelScale,l=a.crossClearSec,u=e.events.map((e,t)=>({event:e,index:t})).filter(({event:n,index:i})=>{let a=Number.isFinite(n.time)?n.time<t.approachTimeSec?`before-approach`:n.time>e.durationSec?`after-duration`:Number.isFinite(n.intensity)?n.intensity<t.intensityFloor?`below-intensity-floor`:null:`invalid-intensity`:`invalid-time`;return a&&r?.reject(i,a),a===null}).sort((e,t)=>e.event.time-t.event.time||e.index-t.index),d=e.beats.filter(Number.isFinite).slice().sort((e,t)=>e-t),f=(e.barStarts??[]).filter(Number.isFinite).slice().sort((e,t)=>e-t),p=f.length?f:d.filter((e,t)=>t%4==0),m=(e.performancePlan?.points??[]).filter(e=>Number.isFinite(e.time)).slice().sort((e,t)=>e.time-t.time),h=m.map(e=>e.time),g=(e.timingConfidence??0)>=.5&&d.length>=2,_=a.sectionSilenceBeats>0?(e.sectionStarts??[]).filter(e=>Number.isFinite(e)&&e>0).slice().sort((e,t)=>e-t):[],v=-1/0,y=n.chartProfile===`musical-v1`&&lf(e.sections,e.durationSec).length>0,b=y?(g?d.slice(1).map((e,t)=>e-d[t]):u.slice(1).map((e,t)=>e.event.time-u[t].event.time)).filter(e=>e>=.2&&e<=1.5).sort((e,t)=>e-t):[],x=Math.max(.25,Math.min(1,b[Math.floor(b.length/2)]??.5)),S=y?of(u,e.events,e.durationSec,x,p.filter((t,n)=>t>=0&&t<e.durationSec&&(n===0||t>p[n-1])),g,n,Math.max(.01,o*Math.max(1,i.densityScale)),a.globalSpacingScale,e.attention,e.attentionBudgetEvents?.filter(n=>Number.isFinite(n.time)&&n.time>=t.approachTimeSec&&n.time<=e.durationSec&&Number.isFinite(n.intensity)&&n.intensity>=t.intensityFloor)):void 0;r&&(r.attention=S?.summary);let C=df(u.map(e=>e.event),m,e.durationSec,d,e.timingConfidence??0,n,e.sections,S),w=C.flatMap(e=>e.pairTimes),T=C.map(e=>e.start),E=[],D={},O={},k=new _f(n.handPattern,n.handLead,a.strictSequences),A=0,j=-1/0,ee=null,M=null,te={left:0,right:0},N=(e,t)=>{if(!g)return t.beatSec;let n=Math.max(0,Bf(d,e));return Math.max(.25,Math.min(1,(d[n+1]??d[n]+.5)-d[n]||.5))},P=(e,t,n)=>Math.max(0,(e-(g?p[Uf(p,e)]??0:t.start))/n)%4,ne=C.map(()=>[]);for(let e of u)ne[C[Bf(T,e.event.time)].index].push(e);let re=ne.map(e=>{let t=e.map(e=>e.event.intensity).sort((e,t)=>e-t);return t[Math.floor(t.length/2)]??0}),ie=new Set,ae=Array(C.length).fill(0),F=Array(C.length).fill(0);n.handPattern===`independent`&&ne.forEach((e,t)=>{let n=re[t];for(let{event:r,index:i}of e){let e=C[t],a=P(r.time,e,N(r.time,e));r.type===2||gf(a)&&Math.round(a)%2==0&&r.intensity>=n?(ie.add(i),ae[t]++):F[t]++}});for(let{event:e,index:f}of u){let u=e.time;if(S&&!S.selected.has(f)){r?.reject(f,`local-attention`);continue}let y=w[Bf(w,u)+1];if(!S&&y!==void 0&&y-u<Math.max(a.pairPrepSec,s)){r?.reject(f,`pair-preparation`);continue}let b=C[Bf(T,u)],x=S?m[Bf(h,u)]:b.point,N=b.texture,P=b.character?.energy??x?.meta?.behaviour?.energy??Math.min(1,(x?.intensity??0)/3),ne=b.character?.kind===`calm`,oe=Math.max(0,Bf(d,u)),I=g?Math.max(.25,Math.min(1,(d[oe+1]??d[oe]+.5)-d[oe]||.5)):b.beatSec,L=Uf(p,u),se=p[L]??0,R=Math.max(0,(u-(g?se:b.start))/I)%4,ce=b.index,le=b.pairTimes.includes(u);if(!S&&_.length){let e=_[Bf(_,u)+1],t=I*(I<=.5?a.sectionSilenceBeats:Math.max(1,a.sectionSilenceBeats-1));if(e!==void 0&&e-u<t-1e-7){r?.reject(f,`section-breath`);continue}}let z=u-(E.length?E[E.length-1].time:-1/0)<I*.9;if(z&&u-v>=a.maxRunBeats*I-1e-7){r?.reject(f,`dense-run-limit`);continue}if(!S&&!le&&N===`echo`&&(ce%2==0?R>=2:R<2)){r?.reject(f,`echo-window`);continue}if(!S&&!le&&g&&i.densityScale>=1&&L%4==3&&R>=3&&e.intensity<.85&&N!==`build`){r?.reject(f,`phrase-breath`);continue}let ue=N===`breath`?2:N===`pulse`||N===`build`&&P<.65?1:.5,de=(b.character?ne:Pd(x?.meta)===`breath`)?a.calmCeilingScale:a.ceilingScale,fe=S?o*Math.max(1,i.densityScale):Math.max(o*Math.max(1,i.densityScale),I*ue*i.densityScale*de*(b.character?.densityScale??1)),pe=E.length>0&&x?.id!==E.at(-1)?.automationId,me=S?fe:le||pe?s:fe;if(!le&&!pe&&u<A-1e-7||E.length&&u-E[E.length-1].time<me-1e-7){r?.reject(f,`spacing`,{earliestTime:Math.max(!le&&!pe?A:0,E.length?E[E.length-1].time+me:0),requiredGapSec:me});continue}let he=e=>(!D[e]||u-D[e].time>=s)&&!(ee&&ee.hand!==e&&u<ee.until),ge=e.intensity>=re[ce],_e=k.choose({time:u,eventIndex:f,eventType:e.type,beatPhase:R,beatSec:I,phraseIndex:ce,phraseStart:b.start,texture:N,energy:P,pointChanged:pe,primaryStream:ie.has(f),phrasePrimary:ae[ce],phraseSecondary:F[ce]},{ready:he});if(!_e){r?.reject(f,`hand-policy`);continue}let ve=_e,ye=(r,o)=>{let s=D[r],d=s?u-s.time:1/0,p=r===`left`?-1:1,m=O[r],h=m&&m!==`any`?kd[m]:null,g=d<1.5&&h?h[1]<0:!1,_=N===`weave`||N===`echo`||i.cutDiversity>=1&&N===`impact`&&ce%2==1||i.cutDiversity===2&&N===`drive`&&ce%2==1,v=N===`breath`&&f%4==0&&!a.directionalSingles?`any`:_?g?r===`left`?`up-right`:`up-left`:r===`left`?`down-left`:`down-right`:g?`up`:`down`,y=i.cutDiversity===0?!1:i.cutDiversity===2?N===`pulse`||N===`drive`||N===`build`||N===`impact`:N===`pulse`||N===`drive`;!o&&y&&Math.floor(R)%2==0&&(v=h?.[0]?h[0]>0?`left`:`right`:r===`left`?`left`:`right`);let S=N===`breath`?1:+!g;N===`weave`&&(S=[0,1,2,1][Math.floor(R)%4]),N===`build`&&!g&&P>.65&&(S=2),e.type===3&&e.intensity>=.65&&f%4==0&&(S=2),ne&&(S=1);let C=p*(ne?.35:.45);if(o===`horizontal`&&(S=1),(o===`vertical`||o===`diagonal`)&&(S=r===(L%2?`right`:`left`)?2:0,o===`vertical`&&(C=p*.22),v=S===2?r===`left`?`up-left`:`up-right`:r===`left`?`down-left`:`down-right`),!o){s&&Math.abs(S-s.row)>a.maxRowStep&&(S=s.row+Math.sign(S-s.row)*a.maxRowStep);let e=r===`left`?`right`:`left`,i=(e,n)=>!s||Math.hypot(e-Vf(s),(n-s.row)*t.rowSpacingMeters)<=d*c,o=Cf({zones:ne?`split`:n.zones,crossRate:a.crossRate,eventIndex:f,texture:N,energy:P,strong:ge,gesture:x?.meta?.movementGesture,beatsIntoScene:x?(u-x.time)/I:1/0,fill:b.end-u<=I*4});for(let t of o){if(t===`center`){let e=Math.min(S,1);if(M&&M.hand!==r&&u-M.time<l||!i(0,e))continue;C=0,S=e;break}if(t===`cross`){let t=-p*.45,n=s!==void 0&&Math.sign(Vf(s))===-p;if(te[r]>=a.hardChain||n||D[e]&&u-D[e].time<l||!i(t,S))continue;C=t,v=_?g?r===`left`?`up-right`:`up-left`:r===`left`?`down-right`:`down-left`:r===`left`?`right`:`left`;break}break}a.freeCutsOnWeakOnsets&&!ge&&(v=`any`)}if(h&&d<1.5&&v!==`any`){let e=kd[v];h[0]*e[0]+h[1]*e[1]>.1&&(v=a.strictSequences&&!o?Rf[v]:`any`)}if(!o&&s){let e=d*c;for(;S!==s.row&&Math.hypot(C-Vf(s),(S-s.row)*t.rowSpacingMeters)>e;)S+=Math.sign(s.row-S);Math.hypot(C-Vf(s),(S-s.row)*t.rowSpacingMeters)>e&&(C=Vf(s))}return{id:`note-${f}-${r}`,time:u,hand:r,lane:zf(C),row:S,xOffsetMeters:C,intensity:Math.min(1,e.intensity),sourceType:e.type,cutDirection:v,texture:N,phrase:ce,automationId:x?.id,...o?{pairId:`pair-${f}`,pairLayout:o}:{}}},be=n.handPattern===`together`||a.extraPairs?Math.max(1.5,I*2):Math.max(2,I*4),xe=le&&u-j>=be&&[`left`,`right`].every(e=>!D[e]||u-D[e].time>=Math.max(a.pairClearSec,s)),Se=ne?`horizontal`:[`horizontal`,`diagonal`,`vertical`][ce%3],Ce=xe?[ye(`left`,Se),ye(`right`,Se)]:null,we=Ce?.every(e=>!D[e.hand]||Math.hypot(Vf(e)-Vf(D[e.hand]),(e.row-D[e.hand].row)*t.rowSpacingMeters)<=(u-D[e.hand].time)*c),Te=Ce&&we?Ce:[ye(ve)];r?.retain(f,Te);for(let e of Te){let t=e.hand,n=D[t],r=Vf(e),i=Math.sign(r)===(t===`left`?1:-1),a=n!==void 0&&Math.abs(e.row-n.row)>=2;te[t]=i||a?te[t]+1:0,i&&(ee={hand:t,until:u+l}),r===0&&(M={hand:t,time:u}),E.push(e),D[t]=e,e.cutDirection!==`any`&&(O[t]=e.cutDirection)}k.commit(ve,Te.length===2),z||(v=u),A=u+(Te.length===2?S?s:Math.max(.5,s):fe),Te.length===2&&(j=u)}if(n.playSpace!==`tall`)return E;let oe=e=>C[Math.max(0,Bf(T,e))],I=C.map(e=>{let t=e.character?e.character.kind===`peak`?`impact`:e.character.kind:Pd(e.point?.meta),n=e.character?.energy??e.point?.meta?.behaviour?.energy??Math.min(1,(e.point?.intensity??0)/3);return t===`impact`||t===`build`&&n>.65});return Lf(E,{demand:a,minSameHandSpacingSec:s,maxHandTravelMps:c,rowSpacingMeters:t.rowSpacingMeters,reliable:g,bigScene:e=>I[oe(e).index],beatPhase:e=>{let t=oe(e);return P(e,t,N(e,t))},beatSec:e=>N(e,oe(e))},r?e=>r.overheadDropped(e):void 0)}function Gf(e,t,n,r=Dd){return n.x=e.xOffsetMeters??(Od[e.lane]??Od[1]).xOffsetMeters,n.y=((e.row??1)-1)*r.rowSpacingMeters,n.z=(t-e.time)*r.noteSpeedMps,n}var Kf=.1,qf=.08,Jf=.16,Yf=e=>e===`left`?`right`:`left`,Xf=1e-8,Zf=(e,t)=>Math.hypot(e.x-t.x,e.y-t.y),Qf=(e,t)=>Math.abs(e-t)<=Xf;function $f(e,t){let n=(t.entry.x+t.exit.x)/2;return(e===`left`?n>=-.05:n<=.05)||Math.min(Math.abs(t.entry.x),Math.abs(t.exit.x))<.16/2}function ep(e,t){let n=Gf(e,e.time,{x:0,y:0,z:0},t),r=e.cutDirection&&e.cutDirection!==`any`?kd[e.cutDirection]:[0,0];return{entry:{x:n.x-r[0]*qf,y:n.y-r[1]*qf},exit:{x:n.x+r[0]*qf,y:n.y+r[1]*qf}}}var tp=(e,t)=>{let n=e.end>e.start?(t-e.start)/(e.end-e.start):0;return{x:e.a.x+(e.b.x-e.a.x)*n,y:e.a.y+(e.b.y-e.a.y)*n}};function np(e,t){let n=Math.max(e.start,t.start),r=Math.min(e.end,t.end);if(r<n-Xf)return 1/0;let i=tp(e,n),a=tp(t,n),o=tp(e,r),s=tp(t,r),c=i.x-a.x,l=i.y-a.y,u=o.x-s.x-c,d=o.y-s.y-l,f=u*u+d*d,p=f?Math.max(0,Math.min(1,-(c*u+l*d)/f)):0;return Math.hypot(c+u*p,l+d*p)}var rp=class e{settings;config;last={};segments={left:[],right:[]};blockedUntil={left:-1/0,right:-1/0};lastTime=-1/0;ids=new Set;prefix;constructor(e,t,n=null){this.prefix=n,this.settings=qd(t),this.config=Kd(e,this.settings.playSpace)}fork(){let t=new e(this.config,this.settings,this);return Object.assign(t.last,this.last),Object.assign(t.blockedUntil,this.blockedUntil),t.lastTime=this.lastTime,t}hasId(e){for(let t=this;t;t=t.prefix)if(t.ids.has(e))return!0;return!1}revoice(e,t){return e.map(e=>{if(e.hand===`either`)return e;let n=e.hand===`left`?-1:1;return{...e,lane:n<0?0:2,xOffsetMeters:n*(e.pairLayout===`vertical`?.22:.45),row:t||e.pairId?e.row:Math.min(2,this.last[e.hand]?.row??1)}})}inspect(e){if(e.length<=2&&e.some(e=>e.hand===`either`)){let t=[[]];for(let n of e)t=t.flatMap(e=>n.hand===`either`?[`left`,`right`].map(t=>[...e,{...n,hand:t}]):[[...e,n]]);let n=t.map(e=>this.inspect(e));return n.find(e=>e.issues.length===0)??n.sort((e,t)=>e.issues.length-t.issues.length)[0]}let t=[],n=[],r=(e,n,r,i)=>t.push({code:e,noteIds:n,actual:r,limit:i}),i=this.config,a=Xd(this.settings.difficulty),o=e[0].time;o<this.lastTime&&r(`unordered`,[e[0].id],o,this.lastTime),o-this.lastTime<i.minGlobalNoteSpacingSec*a.globalSpacingScale-Xf&&r(`global-density`,[e[0].id],o-this.lastTime,i.minGlobalNoteSpacingSec*a.globalSpacingScale),(e.length>2||e.some(t=>t.pairId&&(e.length!==2||e.some(e=>e.pairId!==t.pairId))))&&r(`invalid-pair`,e.map(e=>e.id),e.length,2);let s=new Set,c=new Set;for(let l of e){if(!Number.isFinite(l.time)||l.time<0||!Number.isInteger(l.row)||!Number.isInteger(l.lane)||![`left`,`right`,`either`].includes(l.hand)||![`any`,...Object.keys(kd)].includes(l.cutDirection??`any`)||l.xOffsetMeters!==void 0&&!Number.isFinite(l.xOffsetMeters)){r(`invalid-target`,[l.id],0,1);continue}(this.hasId(l.id)||c.has(l.id))&&r(`duplicate-id`,[l.id],2,1),c.add(l.id);let e=Gf(l,o,{x:0,y:0,z:0},i);(l.lane<0||l.lane>=i.laneCount||l.row<0||l.row>(this.settings.playSpace===`tall`?3:2)||Math.abs(e.x)>.5500000100000001)&&r(`unreachable-target`,[l.id],Math.abs(e.x),.55);let u=l.hand===`either`?[`left`,`right`]:[l.hand],d=u.filter(e=>!s.has(e)).sort((e,t)=>(this.last[e]?.time??-1/0)-(this.last[t]?.time??-1/0))[0]??u[0];s.has(d)&&r(`same-hand-density`,[l.id],0,i.minSameHandSpacingSec*a.sameHandSpacingScale),s.add(d);let f=this.last[d],p=Yf(d),m=this.last[p],h=ep(l,i),g=$f(d,h);o<this.blockedUntil[d]-Xf&&r(`cross-clearance`,[l.id],o,this.blockedUntil[d]),g&&m&&o-m.time<a.crossClearSec-Xf&&r(`cross-clearance`,[m.id,l.id],o-m.time,a.crossClearSec);let _=[],v=[];if(f){let e=o-f.time,t=ep(f,i),n=i.minSameHandSpacingSec*a.sameHandSpacingScale;e<n-Xf&&r(`same-hand-density`,[f.id,l.id],e,n);let s=l.row===3?Math.max(.5,n):f.row===3?Math.max(.75,n):0;e<s-Xf&&r(`overhead-rest`,[f.id,l.id],e,s);let c=Math.abs(l.row-f.row);l.row!==3&&f.row!==3&&e<1.5&&c>a.maxRowStep&&r(`row-step`,[f.id,l.id],c,a.maxRowStep);let u=Zf(t.exit,h.entry),d=Math.max(0,e-Kf)*i.maxHandTravelMps*a.travelScale;if(u>d+Xf&&r(`return-speed`,[f.id,l.id],u,d),e>.1){let e=f.time+Kf/2,n=o-Kf/2;_.push({start:e,end:n,a:t.exit,b:h.entry,id:l.id});let r=u/(i.maxHandTravelMps*a.travelScale);Number.isFinite(r)&&r<n-e-Xf&&v.push([{start:e,end:e+r,a:t.exit,b:h.entry,id:l.id},{start:e+r,end:n,a:h.entry,b:h.entry,id:l.id}],[{start:e,end:n-r,a:t.exit,b:t.exit,id:l.id},{start:n-r,end:n,a:t.exit,b:h.entry,id:l.id}])}}let y={start:o-Kf/2,end:o+Kf/2,a:h.entry,b:h.exit,id:l.id};_.push(y);for(let e of v)e.push(y);let b=e=>{let t=[];for(let r of e){let e=e=>{let n=np(r,e);n<.16-Xf&&t.push({code:`hand-collision`,noteIds:[e.id,l.id],actual:n,limit:Jf})};for(let t=this;t;t=t.prefix){let n=t.segments[p],i=0,a=n.length;for(;i<a;){let e=i+a>>>1;n[e].end<r.start?i=e+1:a=e}for(let t=i;t<n.length&&n[t].start<=r.end;t++)e(n[t])}for(let t of n)if(t.hand===p)for(let n of t.segments)e(n)}return t},x=_,S=b(_);if(S.length)for(let e of v){let t=b(e);if(!t.length){x=e,S=t;break}}t.push(...S);let C=d===`left`?-.45:.45,w=Kf+Math.abs(h.exit.x-C)/(i.maxHandTravelMps*a.travelScale);n.push({note:l,hand:d,segments:x,clearUntil:g?o+Math.max(a.crossClearSec,w):-1/0})}return{issues:t,commit:()=>{this.lastTime=o;for(let e of n)this.last[e.hand]=e.note,this.ids.add(e.note.id),this.segments[e.hand].push(...e.segments),this.blockedUntil[Yf(e.hand)]=Math.max(this.blockedUntil[Yf(e.hand)],e.clearUntil)}}}};function ip(e){let t=[];for(let n of e){let e=t.at(-1);e&&Qf(e[0].time,n.time)?e.push(n):t.push([n])}return t}function ap(e,t=Dd,n={},r){let i=new rp(t,n),a=[],o=0,s=0,c=(e,t)=>{let n=t,r=e.inspect(t);if(r.issues.length&&r.issues.every(e=>[`return-speed`,`row-step`,`cross-clearance`,`hand-collision`].includes(e.code)))for(let i of[!0,!1]){let a=e.revoice(t,i),o=e.inspect(a);if(!o.issues.length){n=a,r=o;break}}return{selected:n,checked:r}},l=ip(e);for(let e=0;e<l.length;e++){let n=l[e],{selected:u,checked:d}=c(i,n);if(d.issues.length){o++,r?.(n,d.issues,!1);continue}if(u.some(e=>e.hand!==`either`&&$f(e.hand,ep(e,t)))){let t=l.slice(e+1,e+5),r=e=>{let n=i.fork(),r=n.inspect(e);if(r.issues.length)return-1;r.commit();let a=0;for(let e of t){let t=c(n,e);t.checked.issues.length||(t.checked.commit(),a++)}return a},a=r(u);for(let e of[!0,!1]){if(a===t.length)break;let o=i.revoice(n,e),s=r(o);s>a&&(u=o,d=i.inspect(o),a=s)}}u!==n&&(s+=n.length),r?.(u,d.issues,u!==n),d.commit(),a.push(...u)}return{chart:a,removedNotes:e.length-a.length,rejectedGroups:o,revoicedNotes:s}}var op={any:`any`,up:`up`,down:`down`,left:`right`,right:`left`,"up-left":`up-right`,"up-right":`up-left`,"down-left":`down-right`,"down-right":`down-left`};function sp(e){return e.map(e=>({...e,hand:e.hand===`either`?`either`:Yf(e.hand),lane:2-e.lane,...e.xOffsetMeters===void 0?{}:{xOffsetMeters:e.xOffsetMeters===0?0:-e.xOffsetMeters},...e.cutDirection?{cutDirection:op[e.cutDirection]}:{}}))}var cp=class{attention;decisions=new Map;noteSources=new Map;events;eventSource;constructor(e,t){this.events=e,this.eventSource=t}reject(e,t,n){this.record(e,t,[]),n&&this.decisions.set(e,{...this.decisions.get(e),spacing:n})}retain(e,t){this.record(e,`retained`,t.map(e=>e.id));for(let n of t)this.noteSources.set(n.id,e)}record(e,t,n){this.decisions.set(e,{sourceIndex:e,time:Number.isFinite(this.events[e].time)?this.events[e].time:null,outcome:t,proposedNoteIds:n,noteIds:n,hands:[],revoiced:!1,movementIssues:[]})}overheadDropped(e){for(let t of e){let e=this.noteSources.get(t.id);if(e===void 0)throw Error(`Missing overhead source provenance`);this.decisions.set(e,{...this.decisions.get(e),outcome:`overhead-rest`,noteIds:[]})}}movementDecision(e,t,n){if(!t.length&&!n)return;let r=[...new Set(t.map(e=>e.code))];for(let i of e){let e=this.noteSources.get(i.id);if(e===void 0)throw Error(`Missing chart source provenance`);let a=this.decisions.get(e);this.decisions.set(e,{...a,...t.length?{outcome:`movement-rejected`,noteIds:[]}:{},revoiced:n,movementIssues:r})}}finish(e,t){let n=new Map(e.map(e=>[e.id,e])),r={},i=0,a=this.events.map((e,t)=>{let a=this.decisions.get(t);if(!a)throw Error(`Missing chart decision for source ${t}`);let o=a.proposedNoteIds.filter(e=>n.has(e));if(a.outcome===`retained`!=o.length>0)throw Error(`Chart decision disagrees with final notes`);return o.length?i++:r[a.outcome]=(r[a.outcome]??0)+1,{...a,noteIds:o,hands:o.map(e=>n.get(e).hand)}});return{version:1,source:this.eventSource?.kind===`grid-independent-percussive`?`grid-independent-percussive`:`accepted-beat-events`,...this.eventSource?{eventSource:{...this.eventSource}}:{},...this.attention?{attention:this.attention}:{},sourceEvents:this.events.length,retainedEvents:i,skippedEvents:this.events.length-i,notes:e.length,hands:{left:e.filter(e=>e.hand===`left`).length,right:e.filter(e=>e.hand===`right`).length,either:e.filter(e=>e.hand===`either`).length},revoicedNotes:t,rejected:r,decisions:a}}};function lp(e,t=Dd,n){return dp(e,t,n).chart}function up(e,t=Dd,n){let r=new cp(e.events,e.eventSource),i=dp(e,t,n,r);return{chart:i.chart,diagnostics:r.finish(i.chart,i.revoicedNotes)}}function dp(e,t,n,r){if(!Number.isFinite(e.durationSec)||e.durationSec<=0)return r&&e.events.forEach((e,t)=>r.reject(t,`invalid-duration`)),{chart:[],revoicedNotes:0};let i=qd(n),a=i.motionSafety===`guarded`&&i.handLead===`right`,o=a?{...i,handLead:`left`}:i,s=Wf(e,Kd(t,i.playSpace),o,r);if(i.motionSafety!==`guarded`)return{chart:s,revoicedNotes:0};let c=ap(s,t,o,r?(e,t,n)=>r.movementDecision(e,t,n):void 0);return{chart:a?sp(c.chart):c.chart,revoicedNotes:c.revoicedNotes}}function fp(e){return Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.z)}function pp(e,t,n=Dd){if(!Number.isFinite(e.songTime)||!Number.isFinite(e.speed)||e.speed<n.minStrikeSpeedMps||!fp(e.position))return null;let r=e.previousPosition??e.position,i=e.basePosition??e.position,a=e.previousBasePosition??r,o=e.previousSongTime??e.songTime;if(![r,i,a].every(fp)||!Number.isFinite(o)||o>e.songTime||e.songTime-o>.1)return null;let s=null,c=1/0,l=0,u={x:0,y:0,z:0},d={x:0,y:0,z:0};for(let f of t)if(!(f.status!==`pending`||f.note.hand!==`either`&&f.note.hand!==e.hand)&&!(e.desktopTargetId&&e.desktopTargetId!==f.note.id)&&!(e.songTime<f.note.time-n.earlyGoodWindowSec||o>f.note.time+n.goodWindowSec)){Gf(f.note,e.songTime,u,n),Gf(f.note,o,d,n);for(let t=0;t<=8;t++){let p=t/8,m=a.x+(r.x-a.x)*p-d.x,h=a.y+(r.y-a.y)*p-d.y,g=a.z+(r.z-a.z)*p-d.z,_=i.x+(e.position.x-i.x)*p-u.x-m,v=i.y+(e.position.y-i.y)*p-u.y-h,y=i.z+(e.position.z-i.z)*p-u.z-g;if(!e.desktopTargetId&&!Id(f.note.cutDirection,_,v,e.songTime-o,n))continue;let b=_*_+v*v+y*y,x=b===0?1:Math.max(0,Math.min(1,-(m*_+h*v+g*y)/b));if((m+x*_)**2+(h+x*v)**2+(g+x*y)**2>n.hitRadiusMeters**2)continue;let S=o+(e.songTime-o)*x-f.note.time;S<-n.earlyGoodWindowSec||S>n.goodWindowSec||Math.abs(S)>=c||(s=f,c=Math.abs(S),l=S)}}if(!s)return null;let f=c<=n.perfectWindowSec?`perfect`:`good`;return s.status=`hit`,s.judgement=f,s.resolvedAt=e.songTime,{noteId:s.note.id,grade:f,timingErrorSec:l}}var mp={perfect:100,good:50},hp={intro:0,verse:.2,build:.4,drop:.8,break:0,peak:1,outro:0},gp=[1,2,4,8],_p=[2,4,8],vp=.25,yp=.25;function bp(){return{tier:0,progress:0}}function xp(e){return gp[e.tier]}function Sp(e){e.tier>=_p.length||++e.progress>=_p[e.tier]&&(e.tier++,e.progress=0)}function Cp(e){e.tier=Math.max(0,e.tier-1),e.progress=0}function wp(e,t,n){return Math.round(mp[e]*t*n)}var Tp=e=>Number.isFinite(e);function Ep(e,t){if(!e.length||!(t>0))return 0;let n=0,r=0,i=0,a=0,o={};for(let t of e){t.cutDirection&&t.cutDirection!==`any`&&n++,t.pairId&&r++;let e=t.xOffsetMeters??0;(t.hand===`left`&&e>.05||t.hand===`right`&&e<-.05)&&i++;let s=o[t.hand];s!==void 0&&Math.abs(t.row-s)>=2&&a++,o[t.hand]=t.row}let s=e.length;return s/t*(1+n/s*.5+r/s*.5+i/s*.5+a/s*.5)}function Dp(e,t=[]){let n=t.filter(e=>e&&Tp(e.start)&&Tp(e.end)&&e.end>e.start&&e.label in hp).slice().sort((e,t)=>e.start-t.start),r=n.length>0,i=r?n:[{start:e[0]?.time??0,end:(e.at(-1)?.time??0)+1,label:null}],a=new Int32Array(e.length),o=i.map(()=>[]),s=0;e.forEach((e,t)=>{for(;s+1<i.length&&i[s+1].start<=e.time;)s++;a[t]=s,o[s].push(e)});let c=i.map((e,t)=>Ep(o[t],e.end-e.start)),l=Math.max(0,...c),u=i.map((e,t)=>{let n=e.label?hp[e.label]:0,i=r&&l>0?c[t]/l:0,a=r?1+.5*n+.5*i:1,s=mp.perfect*o[t].length;return Object.freeze({index:t,start:e.start,end:e.end,label:e.label,labelFactor:n,demand:i,weight:a,noteCount:o[t].length,clearBonus:r?Math.round(s*vp*a):0,flawlessBonus:r?Math.round(s*yp*a):0})}),d=bp(),f=0;for(let t=0;t<e.length;t++)f+=wp(`perfect`,xp(d),u[a[t]].weight),Sp(d);for(let e of u)f+=e.clearBonus+e.flawlessBonus;return Object.freeze({sections:Object.freeze(u),noteSection:a,maxScore:f,bonuses:r})}function Op(e){return e>=0?e>=.95?`SS`:e>=.9?`S`:e>=.8?`A`:e>=.65?`B`:`C`:`C`}var kp=class{config;chart=[];scoring=Dp([]);sectionResults=[];multiplier=bp();noteIndex=new Map;noteStates=[];state=`idle`;score=0;combo=0;maxCombo=0;hitCount=0;missCount=0;missScanCursor=0;activeWindowStart=0;activeNotes=[];snapshot=null;resolutionObserver=null;observerFailure=null;notifying=!1;resetNotificationPending=!1;pendingResolutions=[];setResolutionObserver(e){this.assertNotNotifying(),this.resolutionObserver=e,this.observerFailure=null,this.resetNotificationPending=!1,this.pendingResolutions.length=0}getResolutionObserverFailure(){return this.observerFailure}clear(){this.assertNotNotifying(),this.chart=[],this.scoring=Dp([]),this.resetRuntimeState(),this.state=`idle`,this.flushNotifications()}constructor(e=Dd){this.config=e}setConfig(e){return this.assertNotNotifying(),this.state===`playing`?!1:(this.config=e,this.resetRuntimeState(),this.state!==`idle`&&(this.state=`ready`),this.flushNotifications(),!0)}loadChart(e,t=[]){this.assertNotNotifying(),this.chart=e,this.scoring=Dp(e,t),this.resetRuntimeState(),this.state=`ready`,this.flushNotifications()}resetRuntimeState(){this.noteStates=this.chart.map(e=>({note:e,status:`pending`,judgement:null})),this.noteIndex=new Map(this.chart.map((e,t)=>[e.id,t])),this.sectionResults=this.scoring.sections.map(e=>({index:e.index,hits:0,perfects:0,misses:0,resolved:0,points:0,bonus:0,completedAt:null})),this.multiplier.tier=0,this.multiplier.progress=0,this.score=0,this.combo=0,this.maxCombo=0,this.hitCount=0,this.missCount=0,this.missScanCursor=0,this.activeWindowStart=0,this.pendingResolutions.length=0,this.resetNotificationPending=this.resolutionObserver!==null}start(){this.assertNotNotifying(),!(this.state!==`ready`&&this.state!==`finished`)&&(this.resetRuntimeState(),this.state=`playing`,this.flushNotifications())}pause(){this.assertNotNotifying(),this.state===`playing`&&(this.state=`paused`)}resume(){this.assertNotNotifying(),this.state===`paused`&&(this.state=`playing`)}restart(){this.assertNotNotifying(),this.resetRuntimeState(),this.state=`playing`,this.flushNotifications()}finish(){if(this.assertNotNotifying(),!(this.state!==`playing`&&this.state!==`paused`)){for(let e of this.noteStates)e.status===`pending`&&(e.status=`missed`,this.missCount++,this.recordMiss(e,e.note.time));this.combo=0,this.state=`finished`,this.flushNotifications()}}getState(){return this.state}seek(e){if(this.assertNotNotifying(),!Number.isFinite(e))return;this.resetRuntimeState();let t=0;for(;t<this.noteStates.length&&this.noteStates[t].note.time+this.config.missWindowSec<e;)this.noteStates[t].status=`missed`,this.recordMiss(this.noteStates[t],e,!1),t++;this.missScanCursor=t,this.activeWindowStart=t,this.combo=0,this.missCount=t,this.flushNotifications()}update(e){if(this.assertNotNotifying(),this.state!==`playing`)return[];let t=[];for(;this.missScanCursor<this.noteStates.length;){let n=this.noteStates[this.missScanCursor];if(n.note.time+this.config.missWindowSec>=e)break;n.status===`pending`&&(n.status=`missed`,n.judgement=null,n.resolvedAt=e,this.missCount++,this.combo=0,this.recordMiss(n,e),t.push(n.note.id)),this.missScanCursor++}return this.flushNotifications(),t}attemptStrike(e){if(this.assertNotNotifying(),this.state!==`playing`)return null;let t=pp(e,this.getActiveNotes(e.songTime),this.config);return t&&(this.hitCount++,this.combo++,this.combo>this.maxCombo&&(this.maxCombo=this.combo),this.recordHit(t.noteId,t.grade,e.songTime)),this.flushNotifications(),t}getActiveNotes(e){this.assertNotNotifying();let t=e-this.config.missWindowSec-this.config.resolvedNoteLifetimeSec,n=e+this.config.approachTimeSec;for(;this.activeWindowStart<this.noteStates.length&&this.noteStates[this.activeWindowStart].note.time<t;)this.activeWindowStart++;let r=this.activeNotes;r.length=0;for(let e=this.activeWindowStart;e<this.noteStates.length;e++){let t=this.noteStates[e];if(t.note.time>n||(r.push(t),r.length>=this.config.maxActiveNotes))break}return r}getSnapshot(){let e=this.snapshot,t=xp(this.multiplier);return e&&e.state===this.state&&e.score===this.score&&e.combo===this.combo&&e.maxCombo===this.maxCombo&&e.hitCount===this.hitCount&&e.missCount===this.missCount&&e.totalNotes===this.chart.length&&e.multiplier===t&&e.maxScore===this.scoring.maxScore&&e.sections===this.sectionResults?e:(this.snapshot=Object.freeze({state:this.state,score:this.score,combo:this.combo,maxCombo:this.maxCombo,hitCount:this.hitCount,missCount:this.missCount,totalNotes:this.chart.length,multiplier:t,maxScore:this.scoring.maxScore,sections:this.sectionResults}),this.snapshot)}getScoringPlan(){return this.scoring}recordHit(e,t,n){let r=this.noteIndex.get(e);if(r===void 0)return;let i=this.scoring.sections[this.scoring.noteSection[r]],a=this.sectionResults[i.index],o=wp(t,xp(this.multiplier),i.weight);Sp(this.multiplier),this.score+=o,a.hits++,t===`perfect`&&a.perfects++,a.points+=o,this.resolve(a,n),this.queueResolution(this.chart[r],t,n,!1)}recordMiss(e,t,n=!0){let r=this.noteIndex.get(e.note.id);if(r===void 0)return;n&&Cp(this.multiplier);let i=this.sectionResults[this.scoring.noteSection[r]];i.misses++,this.resolve(i,t),this.queueResolution(e.note,null,t,!n)}assertNotNotifying(){if(this.notifying)throw Error(`Resolution observers cannot mutate or advance the session`)}queueResolution(e,t,n,r){this.resolutionObserver&&this.pendingResolutions.push({note:Object.freeze({...e}),grade:t,songTime:n,skipped:r})}flushNotifications(){let e=this.resolutionObserver;if(!e||!this.resetNotificationPending&&!this.pendingResolutions.length)return;let t=`reset`,n=`callback-threw`,r=e=>{if(e&&typeof e.then==`function`)throw n=`async-callback`,Promise.resolve(e).catch(()=>void 0),Error(`Resolution observers must be synchronous`)};this.notifying=!0;try{this.resetNotificationPending&&r(e.onRunReset()),t=`resolved`;for(let t of this.pendingResolutions)r(e.onNoteResolved(t.note,t.grade,t.songTime,t.skipped))}catch{this.resolutionObserver=null,this.observerFailure=Object.freeze({phase:t,reason:n})}finally{this.notifying=!1,this.resetNotificationPending=!1,this.pendingResolutions.length=0}}resolve(e,t){let n=this.scoring.sections[e.index];++e.resolved<n.noteCount||e.completedAt!==null||(e.completedAt=t,!(e.misses>0)&&(e.bonus=n.clearBonus+(e.perfects===n.noteCount?n.flawlessBonus:0),e.points+=e.bonus,this.score+=e.bonus))}},Ap=Object.freeze([`energy`,`signal`,`sync`,`stabilize`,`accent`,`phrase`,`section`]);function jp(e,t=[]){let n=new Set(e.map(e=>e.id)),r=new Map;for(let e of t)e&&n.has(e.noteId)&&!r.has(e.noteId)&&Ap.includes(e.role)&&r.set(e.noteId,e.role);let i=[];for(let t of e){let e=r.get(t.id);if(e&&(i.push(Object.freeze({noteId:t.id,role:e})),r.delete(t.id),i.length>=1024))break}return Object.freeze({version:1,roles:Object.freeze(i)})}function Mp(e,t=[]){let n=e.filter(e=>Number.isFinite(e.time)).slice().sort((e,t)=>e.time-t.time),r=[[],[],[]],i=new Map(n.map(e=>[e.id,e])),a=t.filter(e=>Number.isFinite(e.start)&&Number.isFinite(e.end)&&e.end>e.start).slice().sort((e,t)=>e.start-t.start),o=0;for(let e of a){for(;o<n.length&&n[o].time<e.start;)o++;let t=n[o];t&&t.time<e.end&&r[0].push({noteId:t.id,role:`section`})}let s=new Map;for(let e of n)if(Number.isInteger(e.phrase)&&e.phrase>=0){let t=s.get(e.phrase)??[];t.push(e),s.set(e.phrase,t)}for(let e of s.values()){r[1].push({noteId:e[0].id,role:`phrase`});let t=e.map(e=>e.intensity).filter(Number.isFinite).sort((e,t)=>e-t);if(!t.length)continue;let n=(t[Math.floor(t.length/2)]+t[Math.floor((t.length-1)/2)])/2,i=e.reduce((e,t)=>Number.isFinite(t.intensity)&&t.intensity>e.intensity?t:e,e.find(e=>Number.isFinite(e.intensity)));i.intensity>=.65&&i.intensity>=n+.1&&r[2].push({noteId:i.id,role:`accent`})}let c=[],l=[],u=new Set;for(let t of r)for(let n of t.sort((e,t)=>i.get(e.noteId).time-i.get(t.noteId).time)){let t=i.get(n.noteId).time;if(!(u.has(n.noteId)||l.some(e=>Math.abs(e-t)<1.5))&&(c.push(n),u.add(n.noteId),l.push(t),c.length===1024))return jp(e,c)}return jp(e,c)}function Np(e,t,n,r,i){let a=n===`musical-v1`?A(r,t,i,e):void 0;return a?{events:a.events,info:{kind:`grid-independent-percussive`,legacyEvents:e.length,addedEvents:a.events.length-e.length}}:{events:e,info:{kind:`legacy-visual`,legacyEvents:e.length,addedEvents:0,fallbackReason:n===`musical-v1`?`missing-or-invalid-pool`:`classic-profile`}}}async function Pp(){let e=navigator.xr;if(!e||typeof e.isSessionSupported!=`function`)return`no-webxr`;try{return await e.isSessionSupported(`immersive-vr`)?`supported`:`unsupported`}catch{return`unsupported`}}var Fp={bladeLengthMeters:.9,bladeBaseZMeters:-.1,bladeTipZMeters:-1,handleLengthMeters:.18,maxSampleGapSec:.1},Ip={left:5231103,right:16740270},Lp=class{controllers;bladeTipZ=Fp.bladeTipZMeters;onTriggerPress=null;onPausePress=null;pointerMode=!1;constructor(e,t){this.controllers=[0,1].map(n=>{let r=e.xr.getControllerGrip(n),i=e.xr.getController(n),a=new pr,o=new X(new va(.018,.025,Fp.bladeLengthMeters,8),new Ai({color:16777215}));o.rotation.x=-Math.PI/2,o.position.z=(Fp.bladeBaseZMeters+Fp.bladeTipZMeters)/2;let s=new X(new va(.032,.028,Fp.handleLengthMeters,8),new $o({color:2569031,metalness:.7,roughness:.3}));s.rotation.x=-Math.PI/2;let c=new X(new ga(.12,.035,.025),new Ai({color:11386064}));c.position.z=Fp.bladeBaseZMeters,a.add(o,s,c),r.add(a);let l=new X(new va(.0025,.0025,1,6).rotateX(-Math.PI/2).translate(0,0,-.5),new Ai({color:16777215,transparent:!0,opacity:.75,blending:2,depthWrite:!1,toneMapped:!1}));l.name=`menuPointer`,l.visible=!1,l.scale.z=2,i.add(l),t.add(r,i);let u={grip:r,targetRay:i,saber:a,blade:o,pointer:l,hand:null,source:null,tip:new q,previousTip:new q,base:new q,previousBase:new q,hasSample:!1,validStrike:!1,speed:0,previousSongTime:0,songTime:0,attempt:{hand:`left`,songTime:0,speed:0,position:new q,previousPosition:new q,basePosition:new q,previousBasePosition:new q},cleanup:()=>{}},d=e=>{u.source=e.data,u.hand=e.data.handedness===`left`||e.data.handedness===`right`?e.data.handedness:null,u.hand&&(o.material.color.setHex(Ip[u.hand]),l.material.color.setHex(Ip[u.hand])),this.resetState(u)},f=()=>{u.source=null,u.hand=null,this.resetState(u)},p=()=>{u.hand&&this.onTriggerPress?.(u.hand)},m=()=>{u.hand&&this.onPausePress?.()};return i.addEventListener(`connected`,d),i.addEventListener(`disconnected`,f),i.addEventListener(`selectstart`,p),i.addEventListener(`squeezestart`,m),u.cleanup=()=>{i.removeEventListener(`connected`,d),i.removeEventListener(`disconnected`,f),i.removeEventListener(`selectstart`,p),i.removeEventListener(`squeezestart`,m),r.remove(a),i.remove(l),l.geometry.dispose(),l.material.dispose(),t.remove(r,i),a.traverse(e=>{e instanceof X&&(e.geometry.dispose(),e.material.dispose())})},u})}resetState(e){e.hasSample=!1,e.validStrike=!1,e.speed=0}resetMotion(){for(let e of this.controllers)this.resetState(e)}update(e,t,n=!0){for(let r of this.controllers){if(!n||!r.source||!r.grip.visible||!(e>0&&e<=Fp.maxSampleGapSec)){this.resetState(r);continue}r.previousTip.copy(r.tip),r.previousBase.copy(r.base),r.previousSongTime=r.songTime,r.songTime=t,r.grip.updateWorldMatrix(!0,!1),r.tip.set(0,0,this.bladeTipZ).applyMatrix4(r.grip.matrixWorld),r.base.set(0,0,Fp.bladeBaseZMeters).applyMatrix4(r.grip.matrixWorld),r.validStrike=r.hasSample&&t>=r.previousSongTime&&t-r.previousSongTime<=.1,r.speed=r.validStrike?Math.max(r.tip.distanceTo(r.previousTip),r.base.distanceTo(r.previousBase))/e:0,r.hasSample=!0}}setBladeLength(e){if(!(!Number.isFinite(e)||e<=0)){this.bladeTipZ=Fp.bladeBaseZMeters-e;for(let t of this.controllers)t.blade.scale.y=e/Fp.bladeLengthMeters,t.blade.position.z=(Fp.bladeBaseZMeters+this.bladeTipZ)/2;this.resetMotion()}}getStrikeAttempt(e,t,n){let r;for(let t of this.controllers)if(t.hand===e&&t.validStrike){r=t;break}if(!r)return null;let i=r.attempt;return i.hand=e,i.songTime=t,i.previousSongTime=r.previousSongTime,i.speed=r.speed,i.position.copy(r.tip).applyMatrix4(n),i.previousPosition.copy(r.previousTip).applyMatrix4(n),i.basePosition.copy(r.base).applyMatrix4(n),i.previousBasePosition.copy(r.previousBase).applyMatrix4(n),i}setPointerMode(e){if(e!==this.pointerMode){this.pointerMode=e;for(let t of this.controllers)t.saber.visible=!e,t.pointer.visible=e,t.pointer.scale.z=2;this.resetMotion()}}get isPointerMode(){return this.pointerMode}getPointerRay(e,t){let n=this.controllers.find(t=>t.hand===e);return!n?.source||!n.targetRay.visible?!1:(n.targetRay.updateWorldMatrix(!0,!1),t.origin.setFromMatrixPosition(n.targetRay.matrixWorld),t.direction.set(0,0,-1).transformDirection(n.targetRay.matrixWorld),!0)}setPointerLength(e,t){let n=this.controllers.find(t=>t.hand===e);n&&(n.pointer.scale.z=t!==null&&Number.isFinite(t)&&t>0?t:2)}getThumbstickX(e){let t=this.controllers.find(t=>t.hand===e)?.source?.gamepad?.axes,n=t?t.length>=4?t[2]:t[0]:0;return Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0}pulseHaptics(e,t,n){let r=this.controllers.find(t=>t.hand===e)?.source?.gamepad?.hapticActuators?.[0];if(r?.pulse)try{r.pulse(t,n).catch(e=>console.debug(`XR haptic unavailable`,e))}catch(e){console.debug(`XR haptic unavailable`,e)}}dispose(){for(let e of this.controllers)e.cleanup()}},Rp=72,zp=.5;async function Bp(e){let t=e.supportedFrameRates;if(!(!t||typeof e.updateTargetFrameRate!=`function`)&&Array.from(t).includes(Rp))try{await e.updateTargetFrameRate(Rp)}catch{}}function Vp(e){if(typeof e.setFoveation==`function`)try{e.setFoveation(zp)}catch{}}function Hp(e){let t=e.map(e=>e.geometry.index?e.geometry.toNonIndexed():e.geometry),n=t.reduce((e,t)=>e+t.getAttribute(`position`).count,0),r=new Float32Array(n*3),i=new Float32Array(n*3),a=new Y,o=0;t.forEach((t,n)=>{let s=e[n],c=t.getAttribute(`position`);a.setHex(s.color);for(let e=0;e<c.count;e++,o++){let t=c.getX(e),n=c.getY(e),l=c.getZ(e),u=s.shade?s.shade(t,n,l):1,d=o*3;r[d]=t,r[d+1]=n,r[d+2]=l,i[d]=a.r*u,i[d+1]=a.g*u,i[d+2]=a.b*u}});for(let n=0;n<e.length;n++)t[n]!==e[n].geometry&&t[n].dispose(),e[n].geometry.dispose();let s=new hi;return s.setAttribute(`position`,new ei(r,3)),s.setAttribute(`color`,new ei(i,3)),s.computeBoundingSphere(),s}function Up(e,t,n,r,i,a){return new ga(e,t,n).translate(r,i,a)}function Wp(e,t,n,r,i){let a=hn.degToRad(n),o=(e+t)/2;return new zo(r,t-e).rotateZ(a-Math.PI/2).translate(Math.cos(a)*o,Math.sin(a)*o,0).rotateX(-Math.PI/2).translate(0,i,0)}function Gp(e,t){if(t>0)for(let n of e)n&&(n.clearUpdateRanges(),n.addUpdateRange(0,t*n.itemSize),n.needsUpdate=!0)}var $={playfieldForwardMeters:.85,defaultEyeHeightMeters:1.65,hitHeightBelowEyesMeters:.55,runwayWidthMeters:3.4,runwayFrontZMeters:-10,runwayBackZMeters:2,runwayTileLengthMeters:2,backdropWidthMeters:106,backdropHeightMeters:60,backdropCenterYMeters:1.65,backdropDistanceMeters:40,cameraFarMeters:1e3,backdropLayerDistancesMeters:[40,22,12],trackBendStartMeters:2.5,trackMaxLateralBendMeters:2.4,trackMaxVerticalBendMeters:1};function Kp(e){return Number.isFinite(e)&&e>0?e/$.backdropDistanceMeters:1}var qp=.8,Jp=Object.freeze({playfieldForwardMeters:$.playfieldForwardMeters,runwayFrontZMeters:$.runwayFrontZMeters,spawnFadeMeters:0,rowCount:3,frameCenterYMeters:0,frameHalfHeightMeters:.6,hudPlacement:`above`}),Yp=$.trackBendStartMeters,Xp=-Jp.runwayFrontZMeters;function Zp(e,t){return 1/(1+2*(t-e)/(e-Yp))}function Qp(e){return Number.isFinite(e)?e:0}function $p(e,t,n,r=Xp,i=$.backdropDistanceMeters){let a=Qp(e)*t*Zp(r,i);return n>0?n*Math.tanh(a/n):0}function em(e,t=Xp){let n=Math.min(1,Math.max(0,(-e-Yp)/(t-Yp)));return n*n}function tm(e,t=Xp){let n=Math.max(0,(-e-Yp)/(t-Yp));return n<=1?n*n:2*n-1}function nm(e,t,n){let r=n-t;if(!(r>0))return 0;let i=Math.max(0,(-e-t)/r);return i*i}function rm(e,t,n,r,i=Xp){let a=em(e,i);return r.x=t*a,r.y=n*a,r}function im(e,t=0,n=0,r=Xp){return e.x=t,e.y=n,e.z=Yp,e.w=r,e}var am=`
uniform vec4 uTrackBend;
vec2 xrTrackPathOffset( float rootZ ) {
    float u = clamp( ( -rootZ - uTrackBend.z ) / ( uTrackBend.w - uTrackBend.z ), 0.0, 1.0 );
    return uTrackBend.xy * ( u * u );
}`,om=`${am}
uniform vec4 uTrackFarAim;
vec2 xrTrackPathOffsetExtended( float rootZ ) {
    float u = max( ( -rootZ - uTrackBend.z ) / ( uTrackBend.w - uTrackBend.z ), 0.0 );
    float q = uTrackFarAim.z > uTrackBend.w ? max( ( -rootZ - uTrackBend.w ) / ( uTrackFarAim.z - uTrackBend.w ), 0.0 ) : 0.0;
    return uTrackBend.xy * ( u <= 1.0 ? u * u : 2.0 * u - 1.0 ) + uTrackFarAim.xy * ( q * q );
}`,sm=`transformed.xy += xrTrackPathOffset( transformed.z );`;function cm(e,t,n){e.onBeforeCompile=e=>{if(e.uniforms.uTrackBend=t,!e.vertexShader.includes(`#include <begin_vertex>`))throw Error(`Track bend: vertex shader has no begin_vertex chunk.`);e.vertexShader=`${am}\n${e.vertexShader}`.replace(`#include <begin_vertex>`,`#include <begin_vertex>\n\t${sm}`)},e.customProgramCacheKey=()=>n}var lm=class{revision=0;focusXValue=0;focusYValue=0;amplitudeXValue=0;amplitudeYValue=0;scratch={x:0,y:0};layout=Jp;bendEnd=Xp;farAimXValue=0;farAimYValue=0;backdropDistance=$.backdropDistanceMeters;get focusX(){return this.focusXValue}get focusY(){return this.focusYValue}get amplitudeX(){return this.amplitudeXValue}get amplitudeY(){return this.amplitudeYValue}setFocus(e,t){let n=Qp(e),r=Qp(t);return n===this.focusXValue&&r===this.focusYValue?!1:(this.focusXValue=n,this.focusYValue=r,this.recompute(),!0)}setLayout(e){if(e.playfieldForwardMeters===this.layout.playfieldForwardMeters&&e.runwayFrontZMeters===this.layout.runwayFrontZMeters){this.layout=e;return}this.layout=e,this.bendEnd=Math.max(Yp+1,-e.runwayFrontZMeters),this.recompute()}setBackdropDistance(e){let t=Number.isFinite(e)&&e>this.bendEnd?e:$.backdropDistanceMeters;return t===this.backdropDistance?!1:(this.backdropDistance=t,this.recompute(),!0)}get backdropDistanceMeters(){return this.backdropDistance}get bendEndMeters(){return this.bendEnd}get playfieldForwardMeters(){return this.layout.playfieldForwardMeters}writeBendUniform(e){return im(e,this.amplitudeXValue,this.amplitudeYValue,this.bendEnd)}writeFarAimUniform(e){return e.x=this.farAimXValue,e.y=this.farAimYValue,e.z=this.backdropDistance,e.w=0,e}offsetAtRootZ(e,t){return rm(e,this.amplitudeXValue,this.amplitudeYValue,t,this.bendEnd)}offsetAtRootZExtended(e,t){let n=tm(e,this.bendEnd),r=nm(e,this.bendEnd,this.backdropDistance);return t.x=this.amplitudeXValue*n+this.farAimXValue*r,t.y=this.amplitudeYValue*n+this.farAimYValue*r,t}projectPlayfieldPoint(e){return this.offsetAtRootZ(e.z-this.layout.playfieldForwardMeters,this.scratch),e.x+=this.scratch.x,e.y+=this.scratch.y,e}unprojectPlayfieldPoint(e){return this.offsetAtRootZ(e.z-this.layout.playfieldForwardMeters,this.scratch),e.x-=this.scratch.x,e.y-=this.scratch.y,e}recompute(){let e=Kp(this.backdropDistance);this.amplitudeXValue=$p(this.focusXValue,e*$.backdropWidthMeters/2,$.trackMaxLateralBendMeters,this.bendEnd,this.backdropDistance),this.amplitudeYValue=$p(this.focusYValue,e*$.backdropHeightMeters/2,$.trackMaxVerticalBendMeters,this.bendEnd,this.backdropDistance);let t=tm(-this.backdropDistance,this.bendEnd),n=this.backdropDistance>this.bendEnd;this.farAimXValue=n?this.focusXValue*e*$.backdropWidthMeters/2-this.amplitudeXValue*t:0,this.farAimYValue=n?this.focusYValue*e*$.backdropHeightMeters/2-this.amplitudeYValue*t:0,this.revision++}unprojectStrike(e){this.unprojectPlayfieldPoint(e.position),e.previousPosition&&this.unprojectPlayfieldPoint(e.previousPosition),e.basePosition&&this.unprojectPlayfieldPoint(e.basePosition),e.previousBasePosition&&this.unprojectPlayfieldPoint(e.previousBasePosition)}},um={left:new Y(3788799),right:new Y(16732078),either:new Y(16765788)},dm=um,fm=new Y(16777215),pm=new Y(3877959),mm=new Y(16769696),hm=new Y(6120568),gm=.6,_m=.12;function vm(e){let t=e*.11,n=e/2-t,r=n*.36,i=new Xa;i.moveTo(-n+r,-n),i.lineTo(n-r,-n),i.lineTo(n,-n+r),i.lineTo(n,n-r),i.lineTo(n-r,n),i.lineTo(-n+r,n),i.lineTo(-n,n-r),i.lineTo(-n,-n+r),i.closePath();let a=e-2*t,o=new Fo(i,{depth:a,bevelEnabled:!0,bevelThickness:t,bevelSize:t,bevelOffset:0,bevelSegments:1,curveSegments:1}).translate(0,0,-a/2),s=o.index?o.toNonIndexed():o;s!==o&&o.dispose(),s.deleteAttribute(`uv`);let c=s.getAttribute(`position`),l=new Float32Array(c.count*3),u=new q,d=new q,f=new q;for(let e=0;e<c.count;e+=3){u.fromBufferAttribute(c,e),d.fromBufferAttribute(c,e+1),f.fromBufferAttribute(c,e+2);let t=f.sub(d).cross(u.sub(d)).normalize(),n=t.z>.95?.1:t.z>.3?1:t.z<-.3?.08:Math.max(.06,.2+.18*t.y+.05*Math.abs(t.x));l.fill(n,e*3,e*3+9)}return s.setAttribute(`color`,new ei(l,3)),s.computeVertexNormals(),s.computeBoundingBox(),s.computeBoundingSphere(),s}function ym(e,t){let n=e.index?e.toNonIndexed():e;n!==e&&e.dispose(),n.deleteAttribute(`uv`),n.deleteAttribute(`normal`);let r=n.getAttribute(`position`),i=new Float32Array(r.count*3),a=new q,o=new q,s=new q,c=new q;for(let e=0;e<r.count;e+=3){a.fromBufferAttribute(r,e),o.fromBufferAttribute(r,e+1),s.fromBufferAttribute(r,e+2),c.copy(a).add(o).add(s).divideScalar(3);let n=s.clone().sub(o).cross(a.clone().sub(o)).normalize();n.dot(c)<0&&(r.setXYZ(e+1,s.x,s.y,s.z),r.setXYZ(e+2,o.x,o.y,o.z),n.negate()),i.fill(t(n),e*3,e*3+9)}return n.setAttribute(`color`,new ei(i,3)),n.computeVertexNormals(),n.computeBoundingBox(),n.computeBoundingSphere(),n}var bm={tip:.64,tail:.3,halfWidth:.36,halfDepth:.2};function xm(e){return e.z<-.2?.12:(e.y>0?1:.78)*(e.x>=0?1:.86)*(.75+.25*Math.max(0,e.z))}function Sm(e){let{tip:t,tail:n,halfWidth:r,halfDepth:i}=bm,a=new q(0,t*e,0),o=new q(0,-n*e,0),s=[new q(r*e,0,0),new q(0,0,i*e),new q(-r*e,0,0),new q(0,0,-i*e)],c=[];for(let e=0;e<s.length;e++){let t=s[e],n=s[(e+1)%s.length];for(let e of[a,t,n,o,n,t])c.push(e.x,e.y,e.z)}let l=new hi;return l.setAttribute(`position`,new ei(new Float32Array(c),3)),ym(l,xm)}function Cm(e){return ym(new Ro(e*.4,0),xm)}function wm(e){let{tip:t,tail:n,halfDepth:r}=bm,i=(t,n,r,i)=>{let a=r-t,o=i-n,s=Math.hypot(a,o),c=-o/s,l=a/s,u=.004*Math.sign(l||1);return new ga(e*.035,s,e*.02).rotateX(Math.atan2(o,a)).translate(0,(t+r)/2+c*u,(n+i)/2+Math.abs(l)*Math.abs(u))};return Hp([{geometry:i(-n*e,0,0,r*e),color:16777215,shade:()=>.7},{geometry:i(0,r*e,t*e,0),color:16777215}])}function Tm(e){let t=new Xa;return t.moveTo(-e*.085,-e*.3),t.lineTo(e*.085,-e*.3),t.lineTo(e*.085,-e*.02),t.lineTo(e*.3,-e*.02),t.lineTo(0,e*.32),t.lineTo(-e*.3,-e*.02),t.lineTo(-e*.085,-e*.02),t.closePath(),new Vo(t)}function Em(e){return Hp([{geometry:new _a(e*.1,16),color:16777215},{geometry:new Bo(e*.19,e*.235,24),color:16777215}])}var Dm=e=>Number.isInteger(e)?`${e}.0`:String(e),Om=Math.PI*2,km=1.6,Am=0,jm=1,Mm=2,Nm=4,Pm=Object.fromEntries(Object.entries(kd).map(([e,[t,n]])=>[e,Math.atan2(n,t)-Math.PI/2])),Fm=`
attribute vec4 aNoteBase;
attribute vec4 aNoteStyle;
uniform float uNoteTime;
uniform float uNoteSpeed;
uniform float uNoteApproach;
uniform float uNoteSpawnFade;
uniform float uNoteSize;
uniform float uTrackForward;
varying vec3 vNoteColor;
${am}`,Im=`
	float noteEmergeOn = step( 3.5, aNoteStyle.w );
	float noteMode = aNoteStyle.w - 4.0 * noteEmergeOn;
	float noteAhead = aNoteBase.z - uNoteTime;
	float noteEmerge = ( noteEmergeOn > 0.5 && uNoteSpawnFade > 0.0 )
		? clamp( ( uNoteApproach - noteAhead ) * uNoteSpeed / uNoteSpawnFade, 0.0, 1.0 ) : 1.0;
	float noteScale = ${Dm(gm)} + ( 1.0 - ${Dm(gm)} ) * noteEmerge;
	vec3 noteCentre = vec3( aNoteBase.xy, ( uNoteTime - aNoteBase.z ) * uNoteSpeed );
	noteCentre.xy += xrTrackPathOffset( noteCentre.z - uTrackForward );
	vec3 noteLocal = transformed * noteScale;
	if ( noteMode > 1.5 ) {
		float noteSpin = aNoteBase.w + uNoteTime * ${Dm(km)};
		noteLocal = vec3( cos( noteSpin ) * noteLocal.x + sin( noteSpin ) * noteLocal.z, noteLocal.y, -sin( noteSpin ) * noteLocal.x + cos( noteSpin ) * noteLocal.z );
	} else {
		if ( noteMode > 0.5 ) noteCentre.z += uNoteSize * noteScale * 0.5 + 0.003;
		noteLocal = vec3( cos( aNoteBase.w ) * noteLocal.x - sin( aNoteBase.w ) * noteLocal.y, sin( aNoteBase.w ) * noteLocal.x + cos( aNoteBase.w ) * noteLocal.y, noteLocal.z );
	}
	transformed = noteCentre + noteLocal;
	vNoteColor = aNoteStyle.rgb * ( ${Dm(_m)} + ( 1.0 - ${Dm(_m)} ) * noteEmerge );`;function Lm(e,t,n){e.onBeforeCompile=e=>{if(Object.assign(e.uniforms,t),!e.vertexShader.includes(`#include <begin_vertex>`)||!e.fragmentShader.includes(`#include <color_fragment>`))throw Error(`Note field: unexpected built-in shader chunks.`);e.vertexShader=`${Fm}\n${e.vertexShader}`.replace(`#include <begin_vertex>`,`#include <begin_vertex>${Im}`),e.fragmentShader=`varying vec3 vNoteColor;\n${e.fragmentShader}`.replace(`#include <color_fragment>`,`#include <color_fragment>
	diffuseColor.rgb *= vNoteColor;`)},e.customProgramCacheKey=()=>n}var Rm=[`aNoteBase`,`aNoteStyle`];function zm(e){return Rm.map(()=>new Gi(new Float32Array(e*4),4).setUsage(Ot))}function Bm(e,t){return t.forEach((t,n)=>e.setAttribute(Rm[n],t)),e}function Vm(e,t){return!e||t}var Hm=class{mesh;markers;arrows;uniforms;capacity;size;designValue=`classic`;spawnFadeMeters=0;attributes=new Map;position={x:0,y:0,z:0};slotEntries=[];slotIds=[];slotStatus=[];slotCount=0;writtenConfig=null;writtenDesign=null;writtenPath;writtenPathRevision=-1;epoch=0;writes=0;constructor(e=Dd){this.capacity=e.maxActiveNotes;let t=e.noteSizeMeters;this.size=t,this.uniforms={uNoteTime:{value:0},uNoteSpeed:{value:e.noteSpeedMps},uNoteApproach:{value:e.approachTimeSec},uNoteSpawnFade:{value:0},uNoteSize:{value:t},uTrackBend:{value:im(new Pn)},uTrackForward:{value:0}};let n=(e,t)=>{let n=new Ai(e);return Lm(n,this.uniforms,t),n},r=(e,t,r)=>{let i=zm(this.capacity),a=new $i(Bm(e,i),n(t,r),this.capacity);return this.attributes.set(a,i),a};this.mesh=r(vm(t),{vertexColors:!0,toneMapped:!1},`xr-note-bodies`),this.markers=r(Em(t),{color:16777215,toneMapped:!1},`xr-note-markers`),this.arrows=r(Tm(t),{color:16777215,toneMapped:!1},`xr-note-arrows`);for(let e of[this.mesh,this.markers,this.arrows])e.count=0,e.frustumCulled=!1}get design(){return this.designValue}setDesign(e){if(e===this.designValue)return;this.designValue=e;let t=e===`shard`,n=this.size,r=(e,t)=>{e.geometry.dispose(),e.geometry=Bm(t,this.attributes.get(e))};r(this.mesh,t?Sm(n):vm(n)),r(this.markers,t?Cm(n):Em(n)),r(this.arrows,t?wm(n):Tm(n));let i=this.markers.material;i.vertexColors=t,i.needsUpdate=!0}setSpawnFade(e){this.spawnFadeMeters=Number.isFinite(e)&&e>0?e:0,this.uniforms.uNoteSpawnFade.value=this.spawnFadeMeters}update(e,t,n=Dd,r){let i=0,a=0,o=0,s=n!==this.writtenConfig||this.designValue!==this.writtenDesign||r!==this.writtenPath,c=this.designValue===`shard`;for(let r of e){if(i+a>=this.capacity)break;if(r.status===`hit`)continue;let e=t-(r.resolvedAt??r.note.time);if(r.status===`missed`&&e>n.resolvedNoteLifetimeSec)continue;(this.slotEntries[o]!==r||this.slotIds[o]!==r.note.id||this.slotStatus[o]!==r.status)&&(s=!0),this.slotEntries[o]=r,this.slotIds[o]=r.note.id,this.slotStatus[o]=r.status,o++;let l=r.note.cutDirection,u=!!l&&l!==`any`;Vm(c,u)?i++:a++,!c&&!u&&a++}o!==this.slotCount&&(s=!0),s&&this.write(o,t,n,r),r&&r.revision!==this.writtenPathRevision&&(this.writtenPathRevision=r.revision,r.writeBendUniform(this.uniforms.uTrackBend.value),this.uniforms.uTrackForward.value=r.playfieldForwardMeters);let l=this.uniforms;l.uNoteTime.value=t-this.epoch,l.uNoteSpeed.value=n.noteSpeedMps,l.uNoteApproach.value=n.approachTimeSec,l.uNoteSize.value=n.noteSizeMeters}dispose(){for(let e of[this.mesh,this.markers,this.arrows])e.dispose(),e.geometry.dispose(),e.material.dispose()}write(e,t,n,r){this.writes++,this.epoch=t,this.slotCount=e,this.writtenConfig=n,this.writtenDesign=this.designValue,r!==this.writtenPath&&(this.writtenPath=r,this.writtenPathRevision=-1,r||(im(this.uniforms.uTrackBend.value),this.uniforms.uTrackForward.value=0));let i=this.designValue===`shard`,[a,o]=this.attributes.get(this.mesh).map(e=>e.array),[s,c]=this.attributes.get(this.markers).map(e=>e.array),[l,u]=this.attributes.get(this.arrows).map(e=>e.array),d=0,f=0,p=0,m=this.position,h=0,g=(e,t,n,r,i,a)=>{let o=n*4;e[o]=m.x,e[o+1]=m.y,e[o+2]=h,e[o+3]=r,t[o]=i.r,t[o+1]=i.g,t[o+2]=i.b,t[o+3]=a};for(let t=0;t<e;t++){let e=this.slotEntries[t],r=e.note;Gf(r,r.time,m,n),h=r.time-this.epoch;let _=e.status===`pending`?Nm:0,v=r.cutDirection,y=!!v&&v!==`any`,b=y?Pm[v]:0,x=e.status===`missed`?pm:dm[r.hand],S=e.status===`missed`?hm:r.pairId?mm:fm;if(i){y?(g(a,o,d++,b,x,Am+_),g(l,u,p++,b,S,Am+_)):g(s,c,f++,(this.epoch*km+r.time)%Om,x,Mm+_);continue}g(a,o,d++,0,x,Am+_),y?g(l,u,p++,b,S,jm+_):g(s,c,f++,0,S,jm+_)}this.mesh.count=d,this.markers.count=f,this.arrows.count=p,Gp(this.attributes.get(this.mesh),d),Gp(this.attributes.get(this.markers),f),Gp(this.attributes.get(this.arrows),p)}},Um=`"Segoe UI", "Roboto", system-ui, sans-serif`,Wm=`#eef8ff`,Gm=768,Km=384,qm=Um,Jm=`#4fd8ff`,Ym=`#ff5fb4`,Xm=Wm,Zm=`#8ba6c4`,Qm={playing:Jm,paused:`#ffd37a`,finished:Ym,ready:`#bfefff`,idle:Zm};function $m(e,t,n,r,i,a,o){let s=t.split(` `),c=``,l=r,u=0;for(let t of s){let r=c?`${c} ${t}`:t;if(c&&e.measureText(r).width>i){if(e.fillText(c,n,l),c=t,l+=a,++u>=o)return}else c=r}c&&e.fillText(c,n,l)}var eh=class{mesh;canvas;ctx;texture;lastState=``;lastScore=NaN;lastCombo=NaN;lastMultiplier=NaN;lastInstruction=null;constructor(){this.canvas=document.createElement(`canvas`),this.canvas.width=Gm,this.canvas.height=Km;let e=this.canvas.getContext(`2d`);if(!e)throw Error(`2D canvas context unavailable for XR HUD`);this.ctx=e,this.texture=new fa(this.canvas),this.texture.colorSpace=St,this.texture.generateMipmaps=!1,this.texture.minFilter=z;let t=new zo(1.25,.625),n=new Ai({map:this.texture,transparent:!0,depthWrite:!1,toneMapped:!1});this.mesh=new X(t,n),this.draw(`idle`,0,0,`Select a track to begin.`)}update(e,t){let n=e.multiplier??1;e.state===this.lastState&&e.score===this.lastScore&&e.combo===this.lastCombo&&n===this.lastMultiplier&&t===this.lastInstruction||(this.lastState=e.state,this.lastScore=e.score,this.lastCombo=e.combo,this.lastInstruction=t,this.lastMultiplier=n,this.draw(e.state,e.score,e.combo,t,n))}rect(e,t,n,r,i){this.ctx.fillStyle=e,this.ctx.fillRect(t,n,r,i)}drawFrame(){let e=Gm-20,t=Km-20;this.rect(`rgba(2, 6, 16, 0.46)`,20,20,e-20,t-20);for(let n=23;n<t;n+=4)this.rect(`rgba(79, 216, 255, 0.035)`,20,n,e-20,1);this.rect(`rgba(79, 216, 255, 0.32)`,72,20,e-20-88-16,1),this.rect(`rgba(79, 216, 255, 0.22)`,72,t-1,e-20-88-16,1);for(let[n,r,i,a]of[[20,20,1,1],[e,20,-1,1],[20,t,1,-1],[e,t,-1,-1]])this.rect(Jm,i>0?n:n-44,a>0?r:r-3,44,3),this.rect(Jm,i>0?n:n-3,a>0?r:r-44,3,44);this.rect(Ym,e-44-96,19,64,3),this.rect(Ym,84,t-2,28,3);for(let e=0;e<5;e++)this.rect(`rgba(79, 216, 255, 0.5)`,28,116+e*16,e%2?6:12,2)}draw(e,t,n,r,i=1){let a=this.ctx;a.clearRect(0,0,Gm,Km),a.globalAlpha=1,this.drawFrame(),a.textBaseline=`top`,a.textAlign=`left`,a.fillStyle=Zm,a.font=`600 22px ${qm}`,a.fillText(`PLEXUS  //  XR`,44,38);let o=Qm[e]??Zm,s=e.toUpperCase();a.font=`700 24px ${qm}`;let c=Math.max(96,a.measureText(s).width+36),l=Gm-44-c;this.rect(o,l,34,6,32),this.rect(`rgba(79, 216, 255, 0.10)`,l+6,34,c-6,32),this.rect(o,l+6,65,c-6,1),a.fillStyle=o,a.fillText(s,l+22,38),a.fillStyle=Zm,a.font=`600 22px ${qm}`,a.fillText(`SCORE`,44,92);let u=`×${i}`;a.font=`700 24px ${qm}`,a.fillStyle=i>1?Jm:`rgba(139, 166, 196, 0.7)`,a.fillText(u,140,90),a.fillStyle=Xm;let d=String(t);a.font=`700 104px ${qm}`,a.measureText(d).width>420&&(a.font=`700 76px ${qm}`),a.fillText(d,40,116),this.rect(`rgba(79, 216, 255, 0.35)`,488,96,1,128);for(let e=0;e<5;e++)this.rect(`rgba(79, 216, 255, 0.55)`,484,96+e*32,9,1);a.fillStyle=Zm,a.font=`600 22px ${qm}`,a.fillText(`COMBO`,516,92),a.fillStyle=n>0?Jm:`rgba(139, 166, 196, 0.7)`,a.font=`700 72px ${qm}`,a.fillText(`×${n}`,512,124),this.rect(`rgba(79, 216, 255, 0.28)`,44,262,Gm-88,1),this.rect(Jm,44,260,36,3),this.rect(Ym,Gm-80,260,36,3),a.fillStyle=`#b4c8e2`,a.font=`500 28px ${qm}`,$m(a,r,44,280,Gm-88,34,2),this.texture.needsUpdate=!0}setPosition(e,t,n){this.setPose(e,t,n)}setPose(e,t,n,r=0,i=1){this.mesh.position.set(e,t,n),this.mesh.rotation.set(0,r,0),this.mesh.scale.setScalar(i)}dispose(){this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.texture.dispose()}},th={left:3788799,right:16732078,trace:9430783,dim:4034480,faint:2382448},nh=256,rh=128,ih=qp;function ah(e,t,n=$.runwayTileLengthMeters){if(!Number.isFinite(e)||!Number.isFinite(t)||!(n>0))return 0;let r=e*t/n;return r-Math.floor(r)}function oh(e,t,n){let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)}function sh(e,t,n){return Math.min(1,Math.max(0,.5+(t-Math.abs(e))/n))}function ch(e=nh,t=rh){let n=new Uint8Array(e*t*4),r=$.runwayWidthMeters,i=$.runwayTileLengthMeters,a=r/e,o=i/t,s=Math.max(a,o),c=[57,207,255],l=[255,79,174],u=[70,150,190];for(let a=0;a<t;a++){let t=(a+.5)*o;for(let o=0;o<e;o++){let d=(o+.5)/e*r-r/2,f=Math.abs(d),p=d<0?c:l,m=6,h=9,g=18,_=(e,t)=>{m+=e[0]*t,h+=e[1]*t,g+=e[2]*t};_(p,.16*oh(1.3,1.7,f)**2);for(let e of[.225,.675])_(u,.3*sh(f-e,.006,s));t%.5<.34&&_(u,.5*sh(f-.9,.008,s)),f<1.62&&f%.34>.06&&_(u,.55*sh(t-.03,.012,s)),f>1.28&&f<1.6&&_(p,.4*sh(t-i/2,.01,s));let v=Math.abs(f-1.18);if(v<.18)for(let e of[.55,.72])_(p,.42*sh((t-e-v*.65)/Math.hypot(1,.65),.013,s));let y=(a*e+o)*4;n[y]=Math.min(255,Math.round(m)),n[y+1]=Math.min(255,Math.round(h)),n[y+2]=Math.min(255,Math.round(g)),n[y+3]=255}}return n}function lh(e,t=Jp.runwayFrontZMeters){return .9*(1-oh(-2.5,t,e))*(1-.4*oh(.5,$.runwayBackZMeters,e))}function uh(e){let t=e.getAttribute(`position`),n=0;for(let e=0;e<t.count;e++)-t.getZ(e)>$.trackBendStartMeters-1e-6&&n++;return n}function dh(){return new Ai({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1})}var fh=class e{floor;linework;gate;texture;scrollSpeedMps;bendUniform={value:new Pn};bendable;appliedPathRevision=-1;lastSongTime=NaN;currentPhase=0;constructor(t,n=Jp){this.scrollSpeedMps=t.noteSpeedMps;let r=n.runwayFrontZMeters,i=$.runwayBackZMeters,a=i-r,o=$.runwayTileLengthMeters;this.texture=new Wi(ch(),nh,rh,Ee),this.texture.colorSpace=St,this.texture.wrapS=L,this.texture.wrapT=I,this.texture.magFilter=z,this.texture.minFilter=de,this.texture.generateMipmaps=!0,this.texture.anisotropy=4,this.texture.repeat.set(1,a/o),this.texture.needsUpdate=!0;let s=new zo($.runwayWidthMeters,a,1,Math.round(a*2)).rotateX(-Math.PI/2).translate(0,0,(r+i)/2),c=s.getAttribute(`position`),l=new Float32Array(c.count*4);for(let e=0;e<c.count;e++)l.set([1,1,1,lh(c.getZ(e),r)],e*4);s.setAttribute(`color`,new ei(l,4)),this.floor=new X(s,new Ai({map:this.texture,vertexColors:!0,transparent:!0,depthWrite:!1,toneMapped:!1})),this.floor.name=`runway`,this.floor.renderOrder=-10,this.floor.frustumCulled=!1,this.linework=new X(Hp(e.lineworkParts(n)),dh()),this.linework.name=`runwayLinework`,this.linework.renderOrder=-5,this.linework.frustumCulled=!1,im(this.bendUniform.value),cm(this.floor.material,this.bendUniform,`xr-track-bend`),cm(this.linework.material,this.bendUniform,`xr-track-bend`),this.bendable=uh(s)+uh(this.linework.geometry),this.gate=new X(Hp(e.gateParts(t.rowSpacingMeters,n)),dh()),this.gate.name=`hitGate`,this.gate.renderOrder=-5,this.update(0)}get phase(){return this.currentPhase}setScrollSpeed(e){!Number.isFinite(e)||e===this.scrollSpeedMps||(this.scrollSpeedMps=e,this.lastSongTime=NaN)}get bendableVertexCount(){return this.bendable}applyPath(e){return e.revision===this.appliedPathRevision?!1:(this.appliedPathRevision=e.revision,e.writeBendUniform(this.bendUniform.value),!0)}update(e){if(!Number.isFinite(e)||e===this.lastSongTime)return!1;this.lastSongTime=e;let t=ah(e,this.scrollSpeedMps);return t===this.currentPhase&&this.texture.offset.y===t?!1:(this.currentPhase=t,this.texture.offset.y=t,!0)}dispose(){for(let e of[this.floor,this.linework,this.gate])e.removeFromParent(),e.geometry.dispose(),e.material.dispose();this.texture.dispose()}static lineworkParts(e){let t=[],n=.006,r=t=>(1-oh(-2.5,e.runwayFrontZMeters,t))*(1-.45*oh(.5,$.runwayBackZMeters,t)),i=[$.runwayBackZMeters,.5];for(let t=-$.trackBendStartMeters;t>=e.runwayFrontZMeters-1e-9;t-=.5)i.push(t);i[i.length-1]>e.runwayFrontZMeters+1e-9&&i.push(e.runwayFrontZMeters);for(let e of[-1,1])for(let a=0;a<i.length-1;a++){let o=i[a],s=i[a+1];t.push({geometry:Up(.03,.01,o-s,e*$.runwayWidthMeters/2,n,(o+s)/2),color:e<0?th.left:th.right,shade:(e,t,n)=>r(n)})}let a=-e.playfieldForwardMeters;t.push({geometry:Up(1.5,.004,.022,0,.007,a),color:th.trace,shade:()=>.8});for(let e of[-1,1])t.push({geometry:Up(.05,.004,.05,e*.78,.007,a),color:e<0?th.left:th.right});for(let e of[0,90,180,270]){let r=e===90;t.push({geometry:Wp(.415,r?.46:.445,e,r?.018:.012,n),color:r?th.trace:th.dim,shade:()=>r?1:.7})}return t}static gateParts(e,t){let n=[],r=.14,i=.014,a=.01,o=t.frameCenterYMeters,s=t.frameHalfHeightMeters;for(let c of[-1,1]){let l=c<0?th.left:th.right;for(let e of[-1,1])n.push({geometry:Up(r,i,a,c*(ih-r/2),o+e*s,0),color:l}),n.push({geometry:Up(i,r,a,c*ih,o+e*(s-r/2),0),color:l});for(let r=-1;r<=t.rowCount-2;r++)n.push({geometry:Up(.06,.012,a,c*(ih-.045),r*e,0),color:l}),n.push({geometry:Up(.03,.008,a,c*(ih+.07),r*e,0),color:l,shade:()=>.5});n.push({geometry:Up(.008,2*s-.3,a,c*(ih+.1),o,0),color:l,shade:()=>.3})}return n.push({geometry:Up(.08,.01,a,0,o-(s+.04),0),color:th.trace,shade:()=>.6}),n}},ph={intro:{name:`INTRO`,color:4892927},verse:{name:`VERSE`,color:13625599},build:{name:`BUILD-UP`,color:16757575},drop:{name:`DROP`,color:16732078},break:{name:`BREAKDOWN`,color:10120191},peak:{name:`PEAK`,color:3794687},outro:{name:`OUTRO`,color:10135224}},mh=.6,hh=.45,gh=12,_h=4;function vh(e,t,n,r){let i=e.filter(e=>Number.isFinite(e.start)&&Number.isFinite(e.end)&&e.end>e.start&&ph[e.label]).slice().sort((e,t)=>e.start-t.start),a=new Map;for(let e of i)a.set(e.label,(a.get(e.label)??0)+1);let o=new Map,s=n>=.5&&t.length>=2;return i.map((e,n)=>{let c=(o.get(e.label)??0)+1;o.set(e.label,c);let l=s?yh(t,e.start):.5,u=i[n-1],d=u?Math.min(Math.max(1.2,Math.min(3,_h*l)),(e.start-u.start)*.5):0,f=ph[e.label].name;return{start:e.start,end:Math.min(e.end,r>0?r:e.end),label:e.label,title:(a.get(e.label)??0)>1?`${f} ${c}`:f,leadIn:d,beatSec:l}})}function yh(e,t){let n=0,r=e.length-1;for(;n<r;){let i=n+r+1>>>1;e[i]<=t?n=i:r=i-1}let i=Math.min(n,e.length-2),a=e[i+1]-e[i];return Number.isFinite(a)&&a>=.25&&a<=1.5?a:.5}function bh(){return{phase:`none`,current:-1,next:-1,progress:0,arrivalAge:0,beatsRemaining:0,beatFraction:0}}function xh(e,t,n){if(n.phase=`none`,n.current=-1,n.next=-1,n.progress=0,n.arrivalAge=0,n.beatsRemaining=0,n.beatFraction=0,!e.length||!Number.isFinite(t))return n;let r=0,i=e.length-1;for(;r<i;){let n=r+i+1>>>1;e[n].start<=t?r=n:i=n-1}let a=e[r].start<=t?r:0;n.current=a,n.phase=`steady`;let o=t-e[a].start;a>0&&o>=0&&o<mh&&(n.phase=`arrival`,n.arrivalAge=o,n.progress=o/mh);let s=e[a].start<=t?a+1:a,c=e[s];if(c&&s>0&&n.phase!==`arrival`){let e=c.start-t;if(e>0&&e<=c.leadIn){n.phase=`lead-in`,n.next=s,n.progress=1-e/c.leadIn;let t=e/c.beatSec;n.beatsRemaining=Math.max(1,Math.min(_h,Math.ceil(t-1e-9))),n.beatFraction=1-(t-Math.floor(t)),n.beatFraction>=1&&(n.beatFraction=0)}}return n}function Sh(e,t){let n=Math.imul(e^2654435769,2246822507)^Math.imul(t+1663821227,3266489909);return n^=n>>>15,n=Math.imul(n,739982445),n^=n>>>13,(n>>>0)/4294967296}var Ch=`#/\\<>=+*_01`,wh=768,Th=.84,Eh=Th*88/768,Dh=88,Oh=.6,kh=.32;function Ah(e){let t=e-1;return 1+2.70158*t*t*t+1.70158*t*t}var jh=class e{root=new pr;frame;caption;texture;canvas;ctx;timeline=[];cue=bh();colorA=new Y;colorB=new Y;lastKey=NaN;lastTime=NaN;redraws=0;frameCenterY=0;frameHalfHeight=Oh;constructor(t=document){this.canvas=t.createElement(`canvas`),this.canvas.width=wh,this.canvas.height=Dh;let n=this.canvas.getContext(`2d`);if(!n)throw Error(`2D canvas context unavailable for the section callout`);this.ctx=n,this.texture=new fa(this.canvas),this.texture.colorSpace=St,this.texture.generateMipmaps=!1,this.texture.minFilter=z,this.caption=new X(new zo(Th,Eh),new Ai({map:this.texture,transparent:!0,depthWrite:!1,toneMapped:!1})),this.caption.name=`sectionCaption`,this.caption.position.set(0,.688125,.004),this.caption.renderOrder=-4,this.frame=new X(Hp(e.frameParts(Oh)),new Ai({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1})),this.frame.name=`sectionFrame`,this.frame.renderOrder=-5,this.root.add(this.frame,this.caption),this.root.visible=!1}setFrame(t,n){!Number.isFinite(t)||!(n>0)||t===this.frameCenterY&&n===this.frameHalfHeight||(this.frameCenterY=t,this.frameHalfHeight=n,this.frame.geometry.dispose(),this.frame.geometry=Hp(e.frameParts(n)),this.caption.position.y=n+.04+Eh/2,this.root.position.y=t)}get redrawCount(){return this.redraws}setTimeline(e){this.timeline=e,this.lastKey=NaN,this.lastTime=NaN,this.root.visible=e.length>0}update(e){if(!this.timeline.length||!Number.isFinite(e)||e===this.lastTime)return;this.lastTime=e;let t=xh(this.timeline,e,this.cue);if(t.phase===`none`)return;let n=this.timeline[t.current],r=kh,i=1;if(this.colorA.setHex(ph[n.label].color),t.phase===`lead-in`){let e=this.timeline[t.next];this.colorB.setHex(ph[e.label].color),this.colorA.lerp(this.colorB,t.progress);let n=Math.exp(-t.beatFraction*6);r=kh+.4*n*(.5+.5*t.progress),i=1+.018*n}else if(t.phase===`arrival`){let e=t.progress;r=kh+(1-kh)*(1-e)*(1-e),i=1+.1*(1-Ah(Math.min(1,e*1.4)))}this.frame.material.color.copy(this.colorA).multiplyScalar(r),this.frame.scale.set(i,i,1);let a=this.displayKey(t);a!==this.lastKey&&(this.lastKey=a,this.draw(t))}dispose(){this.root.removeFromParent(),this.frame.geometry.dispose(),this.frame.material.dispose(),this.caption.geometry.dispose(),this.caption.material.dispose(),this.texture.dispose()}displayKey(e){let t=e.phase===`lead-in`?1:e.phase===`arrival`?2:0,n=e.phase===`lead-in`?Math.min(gh,Math.floor(e.progress*this.timeline[e.next].leadIn/hh*gh)):0,r=e.phase===`arrival`?Math.min(gh,Math.floor(e.arrivalAge/hh*gh)):0;return((e.current*3+t)*16+n+r)*8+e.beatsRemaining}draw(e){this.redraws++;let t=this.ctx,n=wh,r=Dh,i=this.timeline[e.current];t.clearRect(0,0,n,r),t.globalAlpha=1,t.fillStyle=`rgba(2, 6, 16, 0.55)`,t.fillRect(0,8,n,r-16),t.textBaseline=`middle`,t.textAlign=`left`;let a=`"Segoe UI", "Roboto", system-ui, sans-serif`;if(e.phase===`lead-in`){let o=this.timeline[e.next],s=Math.min(1,e.progress*o.leadIn/hh),c=Mh(ph[o.label].color);t.fillStyle=`rgba(139, 166, 196, 0.9)`,t.font=`600 26px ${a}`,t.fillText(i.title,18,r/2),t.fillStyle=c,t.font=`700 26px ${a}`;let l=`NEXT ▸`,u=18+t.measureText(i.title).width+26;t.fillText(l,u,r/2),t.font=`800 46px ${a}`,t.fillText(Nh(o.title,s,e.next),u+t.measureText(l).width+44,r/2);for(let i=0;i<_h;i++)t.fillStyle=i<e.beatsRemaining?c:`rgba(139, 166, 196, 0.25)`,t.fillRect(n-18-(_h-i)*30,r/2-11,22,22)}else{let o=Mh(ph[i.label].color),s=e.phase===`arrival`?Math.min(1,e.arrivalAge/hh):1;t.fillStyle=o,t.fillRect(18,r/2-17,6,34),t.font=`800 50px ${a}`;let c=Nh(i.title,s,e.current),l=t.measureText(i.title).width;t.fillText(c,(n-l)/2,45),t.fillStyle=`rgba(139, 166, 196, 0.85)`,t.font=`600 22px ${a}`,t.textAlign=`right`,t.fillText(`S${String(e.current+1).padStart(2,`0`)}`,n-18,r/2)}t.fillStyle=`rgba(79, 216, 255, 0.35)`,t.fillRect(0,8,n,1),t.fillRect(0,r-9,n,1),this.texture.needsUpdate=!0}static frameParts(e){let t=[],n=.8350000000000001,r=e+.035,i=.2,a=.008,o=.006;for(let e of[-1,1])for(let s of[-1,1])t.push({geometry:Up(i,a,o,e*(n-i/2),s*r,.002),color:16777215}),t.push({geometry:Up(a,i,o,e*n,s*(r-i/2),.002),color:16777215});return t.push({geometry:Up(.86,.005,o,0,e+.036,.002),color:16777215}),t}};function Mh(e){return`#${e.toString(16).padStart(6,`0`)}`}function Nh(e,t,n){if(t>=1)return e;let r=Math.floor(e.length*Math.max(0,t)),i=Math.floor(t*gh),a=e.slice(0,r);for(let t=r;t<e.length;t++)a+=e[t]===` `?` `:Ch[Math.floor(Sh(n*131+t,i)*11)];return a}var Ph=Object.freeze({TAIL_X:0,TAIL_Y:1,TANGENT_X:2,TANGENT_Y:3,LENGTH:4,RADIUS:5,CORE_RADIUS:6,FLUX_GAIN:7,COLOR_R:8,COLOR_G:9,COLOR_B:10,HALO_GAIN:11,IDENTITY_HI:12,IDENTITY_LO:13,PHASE:14,FILAMENT_PHASE:15,FIBRE_PHASE:16,FILAMENT_FREQUENCY:17,FIBRE_ACROSS:18,FIBRE_ALONG:19,FILAMENT_BIAS:20,FILAMENT_FLOOR:21,FLAGS:22,NEGLIGIBLE:23}),Fh=Math.sqrt(6*.5/.25),Ih=Math.sqrt(10*.6/.16),Lh=20,Rh=2048,zh=`
float hashUnit(uint a, uint b, uint c) {
    uint h = (a * 0x27d4eb2du) ^ (b * 0x165667b1u) ^ (c * 0x9e3779b1u);
    h = (h ^ (h >> 15u)) * 0x85ebca6bu;
    h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
    return float(h ^ (h >> 16u)) / 4294967296.0;
}
uint latticeIndex(float cell) { return uint(int(cell)); }
float valueNoise1(float x, uint identity) {
    float safeX = clamp(x, -1e6, 1e6);
    float cell = floor(safeX);
    float fraction = safeX - cell;
    float smoothed = fraction * fraction * (3.0 - 2.0 * fraction);
    uint c = latticeIndex(cell);
    float low = hashUnit(identity, c, 0u);
    float high = hashUnit(identity, c + 1u, 0u);
    return low + (high - low) * smoothed;
}
float valueNoise2(float x, float y, uint identity) {
    float safeX = clamp(x, -1e6, 1e6);
    float safeY = clamp(y, -1e6, 1e6);
    float cellX = floor(safeX);
    float cellY = floor(safeY);
    float fx = safeX - cellX;
    float fy = safeY - cellY;
    float sx = fx * fx * (3.0 - 2.0 * fx);
    float sy = fy * fy * (3.0 - 2.0 * fy);
    uint cx = latticeIndex(cellX);
    uint cy = latticeIndex(cellY);
    float lowLeft = hashUnit(identity, cx, cy);
    float lowRight = hashUnit(identity, cx + 1u, cy);
    float highLeft = hashUnit(identity, cx, cy + 1u);
    float highRight = hashUnit(identity, cx + 1u, cy + 1u);
    float low = lowLeft + (lowRight - lowLeft) * sx;
    float high = highLeft + (highRight - highLeft) * sx;
    return low + (high - low) * sy;
}`,Bh=`
in vec4 a0;
in vec4 a1;
in vec4 a2;
in vec4 a3;
in vec4 a4;
in vec4 a5;
uniform vec2 uSize;
flat out vec4 v0;
flat out vec4 v1;
flat out vec4 v2;
flat out vec4 v3;
flat out vec4 v4;
flat out vec4 v5;
void main() {
    // A quad covering the capsule (plus one pixel) in carrier-local along / across coordinates.
    vec2 tangent = a0.zw;
    vec2 normal = vec2(-tangent.y, tangent.x);
    float reach = a1.y + 1.0;
    float along = -reach + position.x * (a1.x + 2.0 * reach);
    float across = position.y * reach;
    vec2 p = a0.xy + tangent * along + normal * across;
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
    v0 = a0; v1 = a1; v2 = a2; v3 = a3; v4 = a4; v5 = a5;
}`,Vh=`
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform vec2 uSize;
uniform float uDetail;
flat in vec4 v0;
flat in vec4 v1;
flat in vec4 v2;
flat in vec4 v3;
flat in vec4 v4;
flat in vec4 v5;
${zh}
void main() {
    vec2 tail = v0.xy;
    vec2 tangent = v0.zw;
    vec2 normal = vec2(-tangent.y, tangent.x);
    float carrierLength = v1.x;
    float radius = v1.y;
    float coreRadius = v1.z;
    float fluxGain = v1.w;
    vec3 color = v2.xyz;
    float haloGain = v2.w;
    uint identity = (uint(v3.x) << 16u) | uint(v3.y);
    float phase = v3.z;
    float filamentPhase = v3.w;
    float fibrePhase = v4.x;
    float filamentFrequency = v4.y;
    float fibreAcross = v4.z;
    float fibreAlong = v4.w;
    float filamentBias = v5.x;
    float filamentFloor = v5.y;
    bool isWeave = mod(v5.z, 2.0) >= 0.5;
    bool filamented = v5.z >= 1.5;
    float negligible = v5.w;

    // Raster pixel centre, +y down from the top row (the CPU raster's convention).
    float relX = gl_FragCoord.x - tail.x;
    float relY = (uSize.y - gl_FragCoord.y) - tail.y;
    float along = relX * tangent.x + relY * tangent.y;
    float across = relX * normal.x + relY * normal.y;
    float beyond = along < 0.0 ? -along : (along > carrierLength ? along - carrierLength : 0.0);
    float distanceSq = across * across + beyond * beyond;
    float radiusSq = radius * radius;
    if (distanceSq > radiusSq) discard;

    float invCoreSq = 1.0 / max(1e-6, coreRadius * coreRadius);
    float invRadiusSq = 1.0 / max(1e-6, radiusSq);
    float coreFalloff = 1.0 - distanceSq * invCoreSq;
    float core = coreFalloff > 0.0 ? coreFalloff * coreFalloff : 0.0;
    float haloFalloff = 1.0 - distanceSq * invRadiusSq;
    float halo = haloFalloff * haloFalloff * haloFalloff * haloGain;
    float shape = core + halo;
    if (shape <= negligible) discard;

    float invLength = carrierLength > 1e-6 ? 1.0 / carrierLength : 0.0;
    float alongUnit = invLength > 0.0 ? clamp(along * invLength, 0.0, 1.0) : 1.0;
    float taper = filamented
        ? (isWeave ? 0.55 + 0.45 * sin(3.141592653589793 * alongUnit) : 0.24 + 0.76 * alongUnit * (0.42 + 0.58 * alongUnit))
        : 1.0;

    float filament = 1.0;
    if (filamented && !isWeave) {
        float coarse = valueNoise1(alongUnit * filamentFrequency + filamentPhase + phase * 0.31, identity);
        float fine = valueNoise1(alongUnit * filamentFrequency * 2.6 + filamentPhase * 1.7 + phase * 0.57, identity ^ 0x5bf03635u);
        float mixed = coarse * 0.63 + fine * 0.37;
        float shaped = clamp((mixed - filamentBias) * (0.9 + 1.15 * uDetail) + 0.5, 0.0, 1.0);
        filament = filamentFloor + (1.0 - filamentFloor) * shaped * shaped * (3.0 - 2.0 * shaped);
    }

    float fibreA = valueNoise2(along * fibreAlong + fibrePhase + phase * 0.44, across * fibreAcross, identity ^ 0x1b873593u);
    float textureValue;
    if (isWeave) {
        textureValue = 0.62 + 0.76 * fibreA;
    } else {
        float fibreB = valueNoise2(along * fibreAlong * 2.7 + fibrePhase * 1.3 + phase * 0.79, across * fibreAcross * 2.7, identity ^ 0x27d4eb2du);
        float micro = 0.86 + 0.28 * valueNoise2(along * 0.9 + phase * 1.13, across * 1.6, identity ^ 0x165667b1u);
        textureValue = (0.5 + 0.72 * (fibreA * 0.64 + fibreB * 0.36)) * micro;
    }

    float contribution = fluxGain * shape * taper * filament * textureValue;
    if (contribution <= 1e-6) discard;
    outColor = vec4(color * contribution, contribution);
}`,Hh=`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,Uh=`
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform float uAmount;
void main() {
    vec4 accumulated = texelFetch(uSource, ivec2(gl_FragCoord.xy), 0);
    float density = max(0.0, accumulated.a);
    if (density <= 1e-8 || uAmount <= 0.0) { outColor = vec4(0.0); return; }
    float invDensity = 1.0 / density;
    float emission = clamp(1.0 - exp(-density * 1.75), 0.0, 1.0);
    float heat = emission * emission * emission;
    float gain = 0.78 + 0.5 * emission;
    vec3 rgb = accumulated.rgb * invDensity * gain;
    float peak = max(rgb.r, max(rgb.g, rgb.b));
    float whiten = heat * 0.12;
    float lift = peak > 1e-6 ? (1.0 - whiten) + whiten * (1.0 / peak) : 1.0;
    vec3 resolved = clamp(rgb * lift, 0.0, 1.0);
    float alpha = clamp(emission * uAmount, 0.0, 1.0);
    outColor = vec4(resolved * alpha, alpha);
}`,Wh=`
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform ivec2 uSourceSize;
uniform ivec2 uTargetSize;
uniform float uGain;
uniform float uThreshold;
uniform bool uSourcePremultiplied;
void main() {
    // Work in top-down rows like the CPU raster, then read GL (bottom-up) rows.
    int x = int(gl_FragCoord.x);
    int y = uTargetSize.y - 1 - int(gl_FragCoord.y);
    int sx0 = (x * uSourceSize.x) / uTargetSize.x;
    int sx1 = max(sx0 + 1, ((x + 1) * uSourceSize.x + uTargetSize.x - 1) / uTargetSize.x);
    int sy0 = (y * uSourceSize.y) / uTargetSize.y;
    int sy1 = max(sy0 + 1, ((y + 1) * uSourceSize.y + uTargetSize.y - 1) / uTargetSize.y);
    vec3 weighted = vec3(0.0);
    float emissionSum = 0.0;
    float samples = 0.0;
    for (int dy = 0; dy < 8; dy++) {
        int sy = sy0 + dy;
        if (sy >= sy1 || sy >= uSourceSize.y) break;
        for (int dx = 0; dx < 8; dx++) {
            int sx = sx0 + dx;
            if (sx >= sx1 || sx >= uSourceSize.x) break;
            vec4 s = texelFetch(uSource, ivec2(sx, uSourceSize.y - 1 - sy), 0);
            float emission = clamp(s.a, 0.0, 1.0);
            samples += 1.0;
            if (emission <= 0.0) continue;
            weighted += uSourcePremultiplied ? s.rgb : s.rgb * emission;
            emissionSum += emission;
        }
    }
    if (emissionSum <= 0.0 || samples <= 0.0) { outColor = vec4(0.0); return; }
    float averageEmission = emissionSum / samples;
    if (averageEmission <= uThreshold) { outColor = vec4(0.0); return; }
    float bloomEmission = clamp((averageEmission - uThreshold) * uGain, 0.0, 1.0);
    outColor = vec4(clamp(weighted / emissionSum, 0.0, 1.0), bloomEmission);
}`,Gh=`
precision highp float;
precision highp int;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uSource;
uniform ivec2 uSize;
uniform ivec2 uDirection;
uniform float uSigma;
uniform int uRadius;
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 sum = vec4(0.0);
    float weightSum = 0.0;
    for (int i = -${Lh}; i <= ${Lh}; i++) {
        if (i < -uRadius || i > uRadius) continue;
        float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
        ivec2 q = clamp(p + uDirection * i, ivec2(0), uSize - 1);
        sum += w * texelFetch(uSource, q, 0);
        weightSum += w;
    }
    outColor = sum / weightSum;
}`;function Kh(e){return new In(1,1,{type:ye,format:Ee,minFilter:e,magFilter:e,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1})}function qh(e,t){return new Zo({glslVersion:kt,vertexShader:Hh,fragmentShader:e,uniforms:t,depthTest:!1,depthWrite:!1,blending:0})}function Jh(e){if(!e?.capabilities||!e.extensions||e.capabilities.isWebGL2===!1)return!1;try{return e.extensions.has(`EXT_color_buffer_float`)||e.extensions.has(`EXT_color_buffer_half_float`)}catch{return!1}}function Yh(){return{resolved:Kh(z),l1:[Kh(z),Kh(z)],l2:[Kh(z),Kh(z)]}}var Xh=class{get layer0(){return this.sets[this.front].resolved.texture}get layer1(){return this.sets[this.front].l1[0].texture}get layer2(){return this.sets[this.front].l2[0].texture}accum=Kh(R);sets;front=0;drawn=!1;cleared=!0;shownActive=!1;camera=new Ls(-1,1,1,-1,0,1);carrierScene=new xr;passScene=new xr;passMesh;carrierGeometry=new Bs;carrierBuffer;carrierMaterial;resolveMaterial;gatherMaterial;blurMaterial;clearColor=new Y;frame=null;dirty=!1;passes=0;constructor(e={}){this.sets=e.doubleBuffered===!0?[Yh(),Yh()]:[Yh()],this.carrierGeometry.setAttribute(`position`,new ri([0,-1,0,1,-1,0,0,1,0,1,1,0],3)),this.carrierGeometry.setIndex([0,1,2,2,1,3]),this.carrierBuffer=this.createCarrierBuffer(Rh),this.carrierMaterial=new Zo({glslVersion:kt,vertexShader:Bh,fragmentShader:Vh,uniforms:{uSize:{value:new K(1,1)},uDetail:{value:0}},depthTest:!1,depthWrite:!1,transparent:!0,side:2,blending:5,blendEquation:100,blendSrc:201,blendDst:201,blendEquationAlpha:100,blendSrcAlpha:201,blendDstAlpha:201});let t=new X(this.carrierGeometry,this.carrierMaterial);t.frustumCulled=!1,this.carrierScene.add(t),this.resolveMaterial=qh(Uh,{uSource:{value:null},uAmount:{value:0}}),this.gatherMaterial=qh(Wh,{uSource:{value:null},uSourceSize:{value:new K(1,1)},uTargetSize:{value:new K(1,1)},uGain:{value:1},uThreshold:{value:0},uSourcePremultiplied:{value:!0}}),this.blurMaterial=qh(Gh,{uSource:{value:null},uSize:{value:new K(1,1)},uDirection:{value:new K(1,0)},uSigma:{value:1},uRadius:{value:1}});let n=new hi;n.setAttribute(`position`,new ri([-1,-1,0,3,-1,0,-1,3,0],3)),this.passMesh=new X(n,this.resolveMaterial),this.passMesh.frustumCulled=!1,this.passScene.add(this.passMesh)}get active(){return this.sets.length>1?this.shownActive:this.frame!==null}present(){this.sets.length<2||(this.drawn?(this.front=1-this.front,this.shownActive=!0,this.drawn=!1):this.cleared&&(this.shownActive=!1))}get renderedFrames(){return this.passes}get carrierCount(){return this.frame?.count??0}setFrame(e){if(!e){this.frame=null,this.dirty=!1,this.drawn=!1,this.cleared=!0;return}this.cleared=!1;let t=Math.max(0,Math.min(e.count,Math.floor(e.data.length/24)));t*24>this.carrierBuffer.array.length&&(this.carrierBuffer=this.createCarrierBuffer(Math.max(t,this.carrierBuffer.count*2))),this.carrierBuffer.array.set(e.data.subarray(0,t*24)),this.carrierBuffer.clearUpdateRanges(),this.carrierBuffer.addUpdateRange(0,t*24),this.carrierBuffer.needsUpdate=!0,this.carrierGeometry.instanceCount=t,this.frame={cols:Math.max(1,Math.floor(e.cols)),rows:Math.max(1,Math.floor(e.rows)),amount:e.amount,bloom:e.bloom,detail:e.detail,count:t},this.dirty=!0}render(e,t){let n=this.frame;if(!this.dirty||!n)return!1;this.dirty=!1,this.passes++,this.drawn=!0;let r=this.sets[(this.front+1)%this.sets.length],i=r.resolved,a=r.l1,o=r.l2,s=Math.max(1,Math.round(n.cols/3)),c=Math.max(1,Math.round(n.rows/3)),l=Math.max(1,Math.round(n.cols/8)),u=Math.max(1,Math.round(n.rows/8));this.resize(this.accum,n.cols,n.rows),this.resize(i,n.cols,n.rows);for(let e of a)this.resize(e,s,c);for(let e of o)this.resize(e,l,u);let d=e.getRenderTarget(),f=e.xr.enabled,p=e.autoClear,m=e.getClearAlpha();e.getClearColor(this.clearColor),e.xr.enabled=!1,e.autoClear=!1,e.setClearColor(0,0);try{e.setRenderTarget(this.accum),e.clear(!0,!1,!1),this.carrierMaterial.uniforms.uSize.value.set(n.cols,n.rows),this.carrierMaterial.uniforms.uDetail.value=n.detail,n.count>0&&e.render(this.carrierScene,this.camera),this.resolveMaterial.uniforms.uSource.value=this.accum.texture,this.resolveMaterial.uniforms.uAmount.value=n.amount,this.pass(e,this.resolveMaterial,i);let t=Math.min(1,Math.max(0,n.bloom));if(Math.min(1,Math.max(0,n.amount))>0&&t>0)this.gather(e,i.texture,n.cols,n.rows,a[0],s,c,t*2.6,.004,!0),this.blur(e,a,s,c,Fh),this.gather(e,a[0].texture,s,c,o[0],l,u,1.5,0,!1),this.blur(e,o,l,u,Ih);else for(let t of[a[0],o[0]])e.setRenderTarget(t),e.clear(!0,!1,!1)}finally{e.setClearColor(this.clearColor,m),e.autoClear=p,e.xr.enabled=f,e.setRenderTarget(d);let n=t?.viewport;n&&e.state.viewport(n)}return!0}dispose(){this.accum.dispose();for(let e of this.sets)for(let t of[e.resolved,...e.l1,...e.l2])t.dispose();this.carrierGeometry.dispose(),this.passMesh.geometry.dispose();for(let e of[this.carrierMaterial,this.resolveMaterial,this.gatherMaterial,this.blurMaterial])e.dispose()}createCarrierBuffer(e){let t=new rc(new Float32Array(e*24),24,1);t.setUsage(Ot);for(let e=0;e<6;e++)this.carrierGeometry.setAttribute(`a${e}`,new vi(t,4,e*4));return t}resize(e,t,n){(e.width!==t||e.height!==n)&&e.setSize(t,n)}pass(e,t,n){this.passMesh.material=t,e.setRenderTarget(n),e.render(this.passScene,this.camera)}gather(e,t,n,r,i,a,o,s,c,l){let u=this.gatherMaterial.uniforms;u.uSource.value=t,u.uSourceSize.value.set(n,r),u.uTargetSize.value.set(a,o),u.uGain.value=s,u.uThreshold.value=c,u.uSourcePremultiplied.value=l,this.pass(e,this.gatherMaterial,i)}blur(e,t,n,r,i){let a=this.blurMaterial.uniforms;a.uSize.value.set(n,r),a.uSigma.value=i,a.uRadius.value=Math.min(Lh,Math.ceil(3*i)),a.uSource.value=t[0].texture,a.uDirection.value.set(1,0),this.pass(e,this.blurMaterial,t[1]),a.uSource.value=t[1].texture,a.uDirection.value.set(0,1),this.pass(e,this.blurMaterial,t[0])}},Zh=Object.freeze({X1:0,Y1:1,X2:2,Y2:3,WIDTH:4,R:5,G:6,B:7,A:8}),Qh=2048,$h=`
in vec4 aSegment;
in float aWidth;
in vec4 aColor;
uniform vec2 uSize;
out vec2 vLocal;
out float vHalfLength;
out float vHalfWidth;
out float vCoverage;
out vec4 vColor;
void main() {
    vec2 p1 = aSegment.xy, delta = aSegment.zw - aSegment.xy;
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 across = vec2(-dir.y, dir.x);
    // Sub-pixel strokes cover one pixel at proportionally lower opacity (like a hairline).
    float halfWidth = max(aWidth, 1.0) * 0.5;
    float reach = halfWidth + 1.0;
    float along = mix(-reach, len + reach, position.x);
    float side = position.y * reach;
    vec2 p = p1 + dir * along + across * side;
    vLocal = vec2(along - 0.5 * len, side);
    vHalfLength = 0.5 * len;
    vHalfWidth = halfWidth;
    vCoverage = min(aWidth, 1.0);
    vColor = aColor;
    // Raster pixels (+y down) to clip space; the target's top row is the canvas's top row.
    gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
}`,eg=`
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform float uSquare;
in vec2 vLocal;
in float vHalfLength;
in float vHalfWidth;
in float vCoverage;
in vec4 vColor;
void main() {
    float distanceOut;
    if (uSquare > 0.5) {
        vec2 q = abs(vLocal) - vec2(vHalfLength + vHalfWidth, vHalfWidth);
        distanceOut = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    } else {
        distanceOut = length(vec2(max(abs(vLocal.x) - vHalfLength, 0.0), vLocal.y)) - vHalfWidth;
    }
    float alpha = vColor.a * clamp(0.5 - distanceOut, 0.0, 1.0) * vCoverage;
    if (alpha <= 0.0) discard;
    outColor = vec4(vColor.rgb * alpha, alpha);
}`,tg=`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,ng=`
precision highp float;
layout(location = 0) out highp vec4 outColor;
uniform sampler2D uCanvas;
uniform sampler2D uLines;
uniform float uHasLines;
// 1: uCanvas is the worker's ImageBitmap uploaded ahead (ADR-009 Addendum AE): raw bytes (no sRGB
// decode), premultiplied, top row first (WebGL ignores the flip and premultiply unpack flags for
// ImageBitmaps). 0: the canvas texture (sRGB, straight alpha, bottom row first).
uniform float uCanvasAhead;
vec3 encodeSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 decodeSrgb(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec3 encoded;
    if (uCanvasAhead > 0.5) {
        // Exactly what the canvas texture holds: the same bytes, un-premultiplied, rows flipped.
        vec4 raw = texelFetch(uCanvas, ivec2(p.x, textureSize(uCanvas, 0).y - 1 - p.y), 0);
        encoded = raw.a > 0.0 ? min(raw.rgb / raw.a, vec3(1.0)) : vec3(0.0);
    } else {
        encoded = encodeSrgb(texelFetch(uCanvas, p, 0).rgb);
    }
    if (uHasLines > 0.5) {
        vec4 lines = texelFetch(uLines, p, 0);
        encoded = lines.rgb + encoded * (1.0 - lines.a);
    }
    outColor = vec4(decodeSrgb(clamp(encoded, 0.0, 1.0)), 1.0);
}`,rg=class{outputs;front=0;lines;camera=new Ls(-1,1,1,-1,0,1);lineScene=new xr;passScene=new xr;lineGeometry=new Bs;lineBuffer;lineMaterial;compositeMaterial;passGeometry;clearColor=new Y;count=0;dirty=!1;passes=0;constructor(e,t,n,r={}){let i=Math.max(1,Math.floor(t)),a=Math.max(1,Math.floor(n));this.lines=new In(i,a,{type:fe,format:Ee,minFilter:R,magFilter:R,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1});let o=r.mipmaps===!0,s=()=>new In(i,a,{type:fe,format:Ee,colorSpace:St,magFilter:z,minFilter:o?de:z,generateMipmaps:o,depthBuffer:!1,stencilBuffer:!1});this.outputs=r.doubleBuffered===!0?[s(),s()]:[s()],this.lineGeometry.setAttribute(`position`,new ri([0,-1,0,1,-1,0,0,1,0,1,1,0],3)),this.lineGeometry.setIndex([0,1,2,2,1,3]),this.lineBuffer=this.createLineBuffer(Qh),this.lineMaterial=new Zo({glslVersion:kt,vertexShader:$h,fragmentShader:eg,uniforms:{uSize:{value:new K(i,a)},uSquare:{value:0}},depthTest:!1,depthWrite:!1,transparent:!0,side:2,blending:5,blendEquation:100,blendSrc:201,blendDst:205,blendEquationAlpha:100,blendSrcAlpha:201,blendDstAlpha:205});let c=new X(this.lineGeometry,this.lineMaterial);c.frustumCulled=!1,this.lineScene.add(c),this.compositeMaterial=new Zo({glslVersion:kt,vertexShader:tg,fragmentShader:ng,uniforms:{uCanvas:{value:e},uLines:{value:this.lines.texture},uHasLines:{value:0},uCanvasAhead:{value:0}},depthTest:!1,depthWrite:!1,blending:0}),this.passGeometry=new hi,this.passGeometry.setAttribute(`position`,new ri([-1,-1,0,3,-1,0,-1,3,0],3));let l=new X(this.passGeometry,this.compositeMaterial);l.frustumCulled=!1,this.passScene.add(l)}get output(){return this.outputs[this.front]}get drawTarget(){return this.outputs[(this.front+1)%this.outputs.length]}present(){this.front=(this.front+1)%this.outputs.length}get lineCount(){return this.count}get renderedFrames(){return this.passes}setFrame(e){let t=e?Math.max(0,Math.min(e.count,Math.floor(e.data.length/9))):0;t*9>this.lineBuffer.array.length&&(this.lineBuffer=this.createLineBuffer(Math.max(t,this.lineBuffer.count*2))),e&&t>0&&(this.lineBuffer.array.set(e.data.subarray(0,t*9)),this.lineBuffer.clearUpdateRanges(),this.lineBuffer.addUpdateRange(0,t*9),this.lineBuffer.needsUpdate=!0,this.lineMaterial.uniforms.uSquare.value=+!!e.square),this.lineGeometry.instanceCount=t,this.count=t,this.dirty=!0}setCanvas(e,t){this.compositeMaterial.uniforms.uCanvas.value=e,this.compositeMaterial.uniforms.uCanvasAhead.value=+!!t}render(e,t){if(!this.dirty)return!1;this.dirty=!1,this.passes++;let n=e.getRenderTarget(),r=e.xr.enabled,i=e.autoClear,a=e.getClearAlpha();e.getClearColor(this.clearColor),e.xr.enabled=!1,e.autoClear=!1,e.setClearColor(0,0);try{this.count>0&&(e.setRenderTarget(this.lines),e.clear(!0,!1,!1),e.render(this.lineScene,this.camera)),this.compositeMaterial.uniforms.uHasLines.value=+(this.count>0),e.setRenderTarget(this.drawTarget),e.render(this.passScene,this.camera)}finally{e.setClearColor(this.clearColor,a),e.autoClear=i,e.xr.enabled=r,e.setRenderTarget(n);let o=t?.viewport;o&&e.state.viewport(o)}return!0}dispose(){this.lines.dispose();for(let e of this.outputs)e.dispose();this.lineGeometry.dispose(),this.passGeometry.dispose(),this.lineMaterial.dispose(),this.compositeMaterial.dispose()}createLineBuffer(e){let t=new rc(new Float32Array(e*9),9,1);return t.setUsage(Ot),this.lineGeometry.setAttribute(`aSegment`,new vi(t,4,0)),this.lineGeometry.setAttribute(`aWidth`,new vi(t,1,4)),this.lineGeometry.setAttribute(`aColor`,new vi(t,4,5)),t}},ig=typeof performance<`u`?performance:null,ag=2,og=.85,sg=`#ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D( map, vMapUv );
    if ( uSharpen > 0.0 ) {
        vec3 n = texture2D( map, vMapUv + vec2( 0.0, uTexel.y ) ).rgb;
        vec3 s = texture2D( map, vMapUv - vec2( 0.0, uTexel.y ) ).rgb;
        vec3 e = texture2D( map, vMapUv + vec2( uTexel.x, 0.0 ) ).rgb;
        vec3 w = texture2D( map, vMapUv - vec2( uTexel.x, 0.0 ) ).rgb;
        vec3 c = sampledDiffuseColor.rgb;
        vec3 lo = min( c, min( min( n, s ), min( e, w ) ) );
        vec3 hi = max( c, max( max( n, s ), max( e, w ) ) );
        sampledDiffuseColor.rgb = clamp( c + uSharpen * ( c - 0.25 * ( n + s + e + w ) ), lo, hi );
    }
    // GPU grain material (ADR-009 Addendum W): broad, medium and sharp layers added in sRGB space
    // and clamped, exactly what Canvas2D 'lighter' did when the worker composited them.
    if ( uMaterialOn > 0.5 ) {
        vec3 srgb = sRGBTransferOETF( vec4( sampledDiffuseColor.rgb, 1.0 ) ).rgb;
        vec4 broad = texture2D( uMaterial2, vMapUv );
        vec4 medium = texture2D( uMaterial1, vMapUv );
        vec3 sharp = texture2D( uMaterial0, vMapUv ).rgb;
        srgb = min( srgb + broad.rgb * broad.a + medium.rgb * medium.a + sharp, vec3( 1.0 ) );
        sampledDiffuseColor.rgb = sRGBTransferEOTF( vec4( srgb, 1.0 ) ).rgb;
    }
    diffuseColor *= sampledDiffuseColor;
#endif`;function cg(){let e=new Nn;return e.colorSpace=``,e.flipY=!1,e.premultiplyAlpha=!1,e.generateMipmaps=!1,e.minFilter=e.magFilter=R,e}function lg(e){return e/$.backdropDistanceMeters}var ug=class{root;source;textures;layerMeshes=[];ready=!1;revision=0;frameDivider=1;baseDivider=1;displayHz=0;framePhase=0;renderMs=0;shown=0;uploadPending=!1;sharpen={value:0};texel=new K;material;materialOn={value:0};lines;adaptive=!1;ahead;renderer=null;aheadMs=[];shownAhead=!1;aheadShownCount=0;plane;onFrameReady=null;onError=null;constructor(e,t={}){this.source=e;let n=!(e.layers&&e.layers.length>1),r=t.gpuMaterial===!0&&t.gpuLines===!0&&n&&typeof e.stagedSerial==`number`;this.material=t.gpuMaterial?new Xh({doubleBuffered:r}):null,e.onFrameReady=()=>{this.uploadAhead(),this.onFrameReady?.()},e.onError=e=>this.onError?.(e);let i=e.layers?.length?e.layers:[e.canvas];this.textures=i.map(e=>{let n=new fa(e);n.colorSpace=St;let r=t.mipmaps===!0&&!(t.gpuMaterial&&t.gpuLines);return n.generateMipmaps=r,n.minFilter=r?de:z,n}),this.lines=t.gpuMaterial&&t.gpuLines&&this.textures.length===1?new rg(this.textures[0],Number(i[0].width)||1,Number(i[0].height)||1,{mipmaps:t.mipmaps,doubleBuffered:r}):null,this.ahead=this.lines&&r?{textures:[cg(),cg()],front:0,frontSerial:0,backSerial:0}:null,this.texel.set(1/Math.max(1,Number(i[0].width)||1),1/Math.max(1,Number(i[0].height)||1));let a=new Ai({map:this.lines?this.lines.output.texture:this.textures[0],toneMapped:!1,depthWrite:!1});this.plane=a,this.installSharpening(a),this.root=new X(new zo($.backdropWidthMeters,$.backdropHeightMeters),a),this.root.position.set(0,$.backdropCenterYMeters,-$.backdropDistanceMeters),this.root.renderOrder=-100,(this.material||this.lines)&&(this.root.frustumCulled=!1,this.root.onBeforeRender=(e,t,n)=>this.runPasses(e,n));let o=$.backdropLayerDistancesMeters;for(let e=1;e<this.textures.length;e++){let t=o[Math.min(e,o.length-1)],n=lg(t),r=new X(new zo($.backdropWidthMeters*n,$.backdropHeightMeters*n),new Ai({map:this.textures[e],toneMapped:!1,depthWrite:!1,transparent:!0,blending:2}));r.name=`wormholeLayer${e}`,r.position.z=$.backdropDistanceMeters-t,r.renderOrder=-100+e,this.root.add(r),this.layerMeshes.push(r)}}setSharpness(e){this.sharpen.value=Number.isFinite(e)?Math.max(0,e):0}get sharpness(){return this.sharpen.value}get layerCount(){return this.textures.length}get focalPoint(){return this.ready&&this.root.visible?this.source.focalPoint??null:null}get spatialFrame(){return this.ready&&this.root.visible?this.source.spatialFrame??null:null}setDistance(e){let t=Number.isFinite(e)&&e>0?e:$.backdropDistanceMeters,n=Kp(t);this.root.position.z=-t,this.root.scale.setScalar(n);let r=$.backdropLayerDistancesMeters;for(let e=0;e<this.layerMeshes.length;e++){let i=this.layerMeshes[e];i.position.z=(t-r[Math.min(e+1,r.length-1)])/n,i.scale.setScalar(1/n)}}get distanceMeters(){return-this.root.position.z}setEyeHeight(e){Number.isFinite(e)&&(this.root.position.y=e)}get lastRenderMs(){return this.renderMs}get rasterKind(){return this.source.rasterKind??null}get framesShown(){return this.shown}get uploadedAhead(){return this.shownAhead}get aheadSamples(){return this.aheadMs}get framesUploadedAhead(){return this.aheadShownCount}get stageTimes(){return this.source.stageTimes??null}configure(e,t,n=0){this.source.setPresentation?.(e),this.baseDivider=this.frameDivider=Number.isFinite(t)?Math.max(1,Math.round(t)):1,this.displayHz=Number.isFinite(n)&&n>0?n:0,this.framePhase=0}setAdaptivePacing(e){this.adaptive=e===!0,this.adaptive||(this.frameDivider=this.baseDivider)}get redrawDivider(){return this.frameDivider}get frameLatencyMs(){return this.source.frameLatencyMs??0}fitDivider(){let e=this.source.frameLatencyMs??0;if(!(e>0)||!(this.displayHz>0))return;let t=1e3/this.displayHz,n=Math.max(this.baseDivider,Math.ceil((e+ag)/t));(n>this.frameDivider||n<this.frameDivider&&e+ag<(this.frameDivider-1)*t*og)&&(this.frameDivider=n)}async prepare(e){let t=++this.revision;this.ready=!1;try{await this.source.prepare(e)}catch(e){if(t===this.revision)throw e}t===this.revision&&(this.ready=!0)}update(e,t){if(!this.ready||!this.root.visible)return;if(!t)this.framePhase=0;else if(this.framePhase++%this.frameDivider!==0)return;let n=this.ahead,r=ig?ig.now():0;if(t&&this.adaptive&&this.fitDivider(),this.source.render(e,t))if(this.renderMs=this.source.lastRenderMs??(ig?ig.now()-r:0),this.shown++,n&&n.backSerial>0&&this.source.shownSerial===n.backSerial)n.front=1-n.front,n.frontSerial=n.backSerial,n.backSerial=0,this.lines&&(this.lines.present(),this.plane.map=this.lines.output.texture),this.material&&this.presentMaterial(),this.shownAhead=!0,this.aheadShownCount++;else{for(let e of this.textures)e.needsUpdate=!0;if(this.uploadPending=!0,this.lines?.setCanvas(this.textures[0],!1),this.shownAhead=!1,this.lines?.setFrame(this.source.lineFrame??null),this.material){let e=this.source.materialFrame??null;this.material.setFrame(e),e||this.presentMaterial()}}}prerender(e){if(this.renderer=e,!(!this.ready||!this.root.visible)){if(this.uploadPending){this.uploadPending=!1;for(let t of this.textures)e.initTexture(t)}this.runPasses(e)}}runPasses(e,t){this.lines?.render(e,t)&&(this.lines.present(),this.plane.map=this.lines.output.texture),this.material?.render(e,t)&&this.presentMaterial()}presentMaterial(){this.material&&(this.material.present(),this.materialOn.value=+!!this.material.active)}uploadAhead(){let e=this.ahead,t=this.renderer;if(!e||!t||!this.ready||!this.root.visible)return;let n=this.source.stagedImage??null,r=this.source.stagedSerial??0;if(!n||!(r>0)||r===e.backSerial||r===e.frontSerial)return;let i=ig?ig.now():0,a=e.textures[1-e.front];a.image=n,a.needsUpdate=!0,t.initTexture(a),this.lines&&(this.lines.setCanvas(a,!0),this.lines.setFrame(this.source.stagedLineFrame??null),this.lines.render(t)),this.material&&(this.material.setFrame(this.source.stagedMaterialFrame??null),this.material.render(t)),t.getContext().flush(),e.backSerial=r,ig&&this.aheadMs.length<32&&this.aheadMs.push(ig.now()-i)}installSharpening(e){e.onBeforeCompile=e=>{e.uniforms.uSharpen=this.sharpen,e.uniforms.uTexel={value:this.texel},e.uniforms.uMaterialOn=this.materialOn,e.uniforms.uMaterial0={get value(){return t?.layer0??null}},e.uniforms.uMaterial1={get value(){return t?.layer1??null}},e.uniforms.uMaterial2={get value(){return t?.layer2??null}},e.fragmentShader=`uniform float uSharpen;
uniform vec2 uTexel;
uniform float uMaterialOn;
`+`uniform sampler2D uMaterial0;\nuniform sampler2D uMaterial1;\nuniform sampler2D uMaterial2;\n${e.fragmentShader}`.replace(`#include <map_fragment>`,sg)};let t=this.material;e.customProgramCacheKey=()=>`wormhole-sharpen`}dispose(){++this.revision,this.ready=!1,this.onFrameReady=null,this.onError=null,this.source.dispose(),this.material?.dispose(),this.lines?.dispose();for(let e of this.textures)e.dispose();if(this.ahead)for(let e of this.ahead.textures)e.dispose();this.renderer=null;for(let e of this.layerMeshes)e.geometry.dispose(),e.material.dispose();this.root.geometry.dispose(),this.root.material.dispose(),this.root.removeFromParent()}},dg=1440,fg=dg*3,pg=.05,mg=4818,hg=1200,gg=3200,_g=`
attribute vec4 aHead; attribute vec3 aTail; attribute vec4 aColor; attribute float aKind;
uniform vec2 uViewport; varying vec4 vColor; varying vec2 vLocal; varying float vLength; varying float vKind;
void main(){
    vec3 head=(modelViewMatrix*vec4(aHead.xyz,1.0)).xyz;
    vec3 tail=(modelViewMatrix*vec4(aTail,1.0)).xyz;
    float scale=length(modelViewMatrix[0].xyz);
    vec2 delta=head.xy-tail.xy;float len=length(delta);
    vec2 dir=len>.00001?delta/len:vec2(0.,1.);vec2 side=vec2(-dir.y,dir.x);
    float pixels=.5*max(uViewport.y*abs(projectionMatrix[1][1]),uViewport.x*abs(projectionMatrix[0][0]))/max(.3,-head.z);
    float limit=aKind>.5&&aKind<1.5?96.:(aKind>2.5?5.:2.5);
    float radius=clamp(aHead.w*scale,.45/max(.001,pixels),limit/max(.001,pixels));
    // Fixed per-eye streak limit also protects oblique views of a long world-space trail.
    if(len*pixels>24.){tail.xy=head.xy-dir*24./pixels;len=24./pixels;}
    vec3 p=mix(tail,head,position.y);p.xy+=radius*(side*position.x+dir*(position.y*2.-1.));
    gl_Position=projectionMatrix*vec4(p,1.);
    vLocal=vec2(position.x,position.y*(len/radius+2.)-1.);vLength=len/radius;vColor=aColor;vKind=aKind;
}`,vg=`
varying vec4 vColor; varying vec2 vLocal; varying float vLength; varying float vKind;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){
    float end=max(-vLocal.y,max(0.,vLocal.y-vLength));float r2=vLocal.x*vLocal.x+end*end;
    if(r2>1.)discard;
    float soft=pow(max(0.,1.-r2),vKind>.5&&vKind<1.5?3.:1.6);
    float alpha=min(.7,vColor.a)*soft;if(alpha<.001)discard;
    gl_FragColor=vec4(linearColor(vColor.rgb),alpha);
    #include <colorspace_fragment>
}`,yg=class{root=new pr;mesh;heads=new Gi(new Float32Array(mg*4),4).setUsage(Ot);tails=new Gi(new Float32Array(mg*3),3).setUsage(Ot);colors=new Gi(new Float32Array(mg*4),4).setUsage(Ot);kinds=new Gi(new Float32Array(mg),1).setUsage(Ot);viewport=new Pn;viewportSize={value:new K(1,1)};distance=200;budget=1440;disposed=!1;constructor(){let e=new Bs;e.setAttribute(`position`,new ri([-1,0,0,1,0,0,-1,1,0,1,1,0],3)),e.setIndex([0,1,2,2,1,3]),e.setAttribute(`aHead`,this.heads),e.setAttribute(`aTail`,this.tails),e.setAttribute(`aColor`,this.colors),e.setAttribute(`aKind`,this.kinds),e.instanceCount=0;let t=new Zo({vertexShader:_g,fragmentShader:vg,uniforms:{uViewport:this.viewportSize},transparent:!1,blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:201,blendDstAlpha:205,depthTest:!0,depthWrite:!1,toneMapped:!1,side:2});this.mesh=new X(e,t),this.mesh.name=`wormhole-native-cosmos-v1`,this.mesh.frustumCulled=!1,this.mesh.renderOrder=-1002,this.root.renderOrder=-1002,this.root.add(this.mesh),this.setDistance(200),this.mesh.onBeforeRender=e=>{e.getCurrentViewport(this.viewport),this.viewportSize.value.set(Math.max(1,this.viewport.z),Math.max(1,this.viewport.w))}}setDistance(e){Number.isFinite(e)&&e>0&&(this.distance=e,this.root.scale.setScalar(e/hg))}setBudget(e){Number.isFinite(e)&&(this.budget=Math.max(1,Math.min(1440,Math.floor(e))))}clear(){this.mesh.geometry.instanceCount=0}setFrame(e){if(this.disposed)return;if(e&&(!Number.isSafeInteger(e.count)||e.count<0||e.count>4818||e.data.length<e.count*16))throw Error(`Invalid native cosmos frame.`);let t=0,n=Math.ceil(1440/this.budget),r=this.distance/hg;if(e)for(let i=0;i<e.count;i++){let a=i*16,o=e.data,s=o[a],c=o[a+15];if(!Number.isInteger(s)||!Number.isInteger(c)||c<0||c>3||c!==1&&(c>=2?s/6:s)%n!==0)continue;let l=o[a+1],u=o[a+2],d=o[a+3],f=o[a+4],p=o[a+5],m=o[a+6],h=o[a+7],g=o[a+11];if(!(!Number.isFinite(l+u+d+f+p+m+h+g+o[a+8]+o[a+9]+o[a+10])||h<=0||g<=.001||Math.min(-d,-m)*r<.3)){if(Math.min(-d,-m)*r<12){let e=f-l,t=p-u,n=e*e+t*t,i=n>0?Math.max(0,Math.min(1,-(l*e+u*t)/n)):0;if(Math.hypot(l+i*e,u+i*t)*r<2.52+h*r)continue}this.heads.setXYZW(t,l,u,d,h),this.tails.setXYZ(t,f,p,m),this.colors.setXYZW(t,o[a+8],o[a+9],o[a+10],Math.min(.7,Math.max(0,g))),this.kinds.setX(t,c),t++}}this.mesh.geometry.instanceCount=t,this.heads.needsUpdate=!0,this.tails.needsUpdate=!0,this.colors.needsUpdate=!0,this.kinds.needsUpdate=!0}dispose(){this.disposed||(this.disposed=!0,this.clear(),this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.root.removeFromParent())}},bg=`
attribute vec4 aHead;attribute vec3 aTail;attribute vec4 aColor;
uniform vec2 uViewport;uniform float uPixelLimit;
varying vec4 vColor;varying vec2 vLocal;varying float vLength;
void main(){
    vec3 head=(modelViewMatrix*vec4(aHead.xyz,1.)).xyz,tail=(modelViewMatrix*vec4(aTail,1.)).xyz;
    vec2 delta=head.xy-tail.xy;float len=length(delta);vec2 dir=len>.00001?delta/len:vec2(0.,1.);
    float pixels=.5*max(uViewport.y*abs(projectionMatrix[1][1]),uViewport.x*abs(projectionMatrix[0][0]))/max(.3,min(-head.z,-tail.z));
    float radius=clamp(aHead.w,.4/max(.001,pixels),uPixelLimit/max(.001,pixels));
    vec3 p=mix(tail,head,position.y);p.xy+=radius*(vec2(-dir.y,dir.x)*position.x+dir*(position.y*2.-1.));
    gl_Position=projectionMatrix*vec4(p,1.);vLocal=vec2(position.x,position.y*(len/radius+2.)-1.);vLength=len/radius;vColor=aColor;
}`,xg=`
varying vec4 vColor;varying vec2 vLocal;varying float vLength;
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
void main(){
    float end=max(-vLocal.y,max(0.,vLocal.y-vLength));float r2=vLocal.x*vLocal.x+end*end;
    if(r2>1.)discard;float alpha=vColor.a*pow(max(0.,1.-r2),1.5);if(alpha<.001)discard;
    gl_FragColor=vec4(linearColor(vColor.rgb),min(.7,alpha));
    #include <colorspace_fragment>
}`,Sg=class{mesh;heads=new Gi(new Float32Array(gg*4),4).setUsage(Ot);tails=new Gi(new Float32Array(gg*3),3).setUsage(Ot);colors=new Gi(new Float32Array(gg*4),4).setUsage(Ot);viewport=new Pn;viewportSize={value:new K(1,1)};pixelLimit={value:3};budget=1440;distance=200;disposed=!1;constructor(){let e=new Bs;e.setAttribute(`position`,new ri([-1,0,0,1,0,0,-1,1,0,1,1,0],3)),e.setIndex([0,1,2,2,1,3]),e.setAttribute(`aHead`,this.heads),e.setAttribute(`aTail`,this.tails),e.setAttribute(`aColor`,this.colors),e.instanceCount=0;let t=new Zo({vertexShader:bg,fragmentShader:xg,uniforms:{uViewport:this.viewportSize,uPixelLimit:this.pixelLimit},transparent:!1,blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:201,blendDstAlpha:205,depthTest:!0,depthWrite:!1,toneMapped:!1,side:2});this.mesh=new X(e,t),this.mesh.name=`wormhole-native-wall-v1`,this.mesh.frustumCulled=!1,this.mesh.renderOrder=-1001.5,this.mesh.onBeforeRender=e=>{e.getCurrentViewport(this.viewport),this.viewportSize.value.set(Math.max(1,this.viewport.z),Math.max(1,this.viewport.w))}}setDistance(e){Number.isFinite(e)&&e>0&&(this.distance=e)}setBudget(e){Number.isFinite(e)&&(this.budget=Math.max(1,Math.min(1440,Math.floor(e))),this.pixelLimit.value=this.budget<=720?2:3)}clear(){this.mesh.geometry.instanceCount=0}setFrame(e){if(this.disposed)return;if(e&&(!Number.isSafeInteger(e.count)||e.count<0||e.count>3200||e.data.length<e.count*16))throw Error(`Invalid native wall frame.`);let t=0,n=Math.ceil(1440/this.budget);if(e)for(let r=0;r<e.count;r++){let i=e.data,a=r*16,o=i[a],s=i[a+15],c=i[a+12];if(!Number.isSafeInteger(o)||o<0||!Number.isInteger(s)||s<0||s>3||c!==-1&&c!==0&&c!==1||o%n!==0)continue;let l=i[a+1],u=i[a+2],d=i[a+3],f=i[a+4],p=i[a+5],m=i[a+6],h=i[a+7],g=i[a+11];if(!(!Number.isFinite(l+u+d+f+p+m+h+g+i[a+8]+i[a+9]+i[a+10])||h<=0||g<=.001||Math.min(-d,-m)<.3||Math.max(-d,-m)>this.distance||Math.hypot(f-l,p-u,m-d)>24)){if(Math.min(-d,-m)<12){let e=f-l,t=p-u,n=e*e+t*t,r=n>0?Math.max(0,Math.min(1,-(l*e+u*t)/n)):0;if(Math.hypot(l+r*e,u+r*t)<2.52+Math.max(.08,h))continue}this.heads.setXYZW(t,l,u,d,Math.min(.08,h)),this.tails.setXYZ(t,f,p,m),this.colors.setXYZW(t,i[a+8],i[a+9],i[a+10],Math.max(0,Math.min(.7,g))),t++}}this.mesh.geometry.instanceCount=t,this.heads.needsUpdate=!0,this.tails.needsUpdate=!0,this.colors.needsUpdate=!0}dispose(){this.disposed||(this.disposed=!0,this.clear(),this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.mesh.removeFromParent())}},Cg=e=>Math.min(1,Math.max(0,e));function wg(e,t,n,r,i,a,o,s){if(n<=0){s.core=e,s.halo=e,s.support=e;return}let c=1-Cg(t),l=Cg((t-.55)/.45),u=Cg(o)*(.42+.58*Cg(a))*(1-.6*l*l*(3-2*l))*Math.exp(-2.5*Cg(t));s.core=Math.max(e*.85,Math.min(.1,(.006+.065*c*c)*(.55+.75*e/.02))),s.halo=Math.min(.24,s.core+(.5+3.4*Cg(r))*(.3+.7*Math.sqrt(u))*(.002+.035*c**2.2)),s.support=Math.min(.6,s.halo+Cg(i)*(.04+.32*c))}var Tg=`
attribute vec4 aHead; attribute vec3 aTail; attribute vec4 aColor;
attribute vec4 aSurface; attribute vec2 aIdentity; attribute vec4 aRadii;
uniform float uAmount; uniform float uViewportHeight; uniform float uViewportWidth; uniform float uPixelLimit;
varying vec2 vUv; varying vec4 vColor; varying vec4 vSurface; varying vec2 vIdentity;
varying vec4 vRadii; varying vec2 vLocal; varying float vLength;
void main(){
    vec3 head=(modelViewMatrix*vec4(aHead.xyz,1.0)).xyz;
    vec3 tail=(modelViewMatrix*vec4(aTail,1.0)).xyz;
    vec2 delta=head.xy-tail.xy;
    float len=length(delta);
    vec2 dir=len>0.00001?normalize(delta):vec2(0.0,1.0);
    vec2 side=vec2(-dir.y,dir.x);
    float pixelScale=0.5*max(uViewportHeight*abs(projectionMatrix[1][1]),uViewportWidth*abs(projectionMatrix[0][0]))/max(0.3,min(-head.z,-tail.z));
    float support=uAmount>0.0?max(0.0001,min(aRadii.w,uPixelLimit/max(0.001,pixelScale))):aHead.w;
    vec3 p=mix(tail,head,position.y);
    p.xy+=support*(side*position.x+dir*(position.y*2.0-1.0));
    gl_Position=projectionMatrix*vec4(p,1.0);
    vUv=vec2(position.x,position.y);vColor=aColor;vSurface=aSurface;vIdentity=aIdentity;
    vRadii=vec4(min(aHead.w,support),min(aRadii.y,support),min(aRadii.z,support),support);
    vLocal=vec2(position.x*support,position.y*(len+2.0*support)-support);vLength=len;
}`,Eg=`
uniform float uSharpness; uniform float uAmount; uniform float uDetail; uniform float uBloom; uniform float uWeave;
varying vec2 vUv; varying vec4 vColor; varying vec4 vSurface; varying vec2 vIdentity;
varying vec4 vRadii; varying vec2 vLocal; varying float vLength;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+dot(vIdentity,vec2(17.23,43.17)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
void main(){
    // Predecessor packet/Amount zero: exact old shader branch and support, no noise/glow work.
    if(uAmount<=0.0){
        float edge=1.0-smoothstep(mix(0.1,0.7,uSharpness),1.0,abs(vUv.x));
        float cap=smoothstep(0.0,0.12,vUv.y)*(1.0-smoothstep(0.88,1.0,vUv.y));
        float alpha=vColor.a*edge*cap;if(alpha<0.001)discard;
        gl_FragColor=vec4(linearColor(vColor.rgb),alpha);
        #include <colorspace_fragment>
        return;
    }
    float along=clamp(vLocal.y/max(0.000001,vLength),0.0,1.0);
    float beyond=max(-vLocal.y,max(0.0,vLocal.y-vLength));
    float d2=vLocal.x*vLocal.x+beyond*beyond;
    float near=1.0-clamp(vSurface.z,0.0,1.0);
    float throat=clamp((vSurface.z-0.55)/0.45,0.0,1.0);
    float flux=vSurface.w*(0.42+0.58*vSurface.y)*(1.0-0.6*throat*throat*(3.0-2.0*throat))*exp(-2.5*vSurface.z);
    float coreFall=max(0.0,1.0-d2/max(0.000001,vRadii.y*vRadii.y));
    float haloFall=max(0.0,1.0-d2/max(0.000001,vRadii.z*vRadii.z));
    float haloGain=(0.1+0.4*uDetail)*(0.15+0.85*near);
    float shape=coreFall*coreFall+pow(haloFall,3.0)*haloGain;
    float phase=vSurface.x;
    float frequency=(1.6+4.4*uDetail)*(0.7+1.6*vSurface.z);
    float filament=1.0;
    float taper=vLength>vRadii.x*2.0?(uWeave>0.5?0.55+0.45*sin(3.14159265*along):0.24+0.76*along*(0.42+0.58*along)):1.0;
    float across=vLocal.x/max(0.004,vRadii.y);
    // Noise lives in carrier-local coordinates and release phase; no eye/screen/wall-clock seed.
    float textureValue=1.0;
    if(shape>0.00001){
        float coarse=noise(vec2(along*frequency+phase*0.31,0.0));
        float fine=noise(vec2(along*frequency*2.6+phase*0.57,13.0));
        float shaped=clamp((coarse*0.63+fine*0.37-(0.28+0.22*uDetail))*(0.9+1.15*uDetail)+0.5,0.0,1.0);
        if(uWeave<0.5&&vLength>vRadii.x*2.0)filament=mix(0.6-0.3*uDetail,1.0,shaped*shaped*(3.0-2.0*shaped));
        float fibreA=noise(vec2(along*frequency*2.0+phase*0.44,across*(0.45+0.85*uDetail)*3.0));
        float fibreB=noise(vec2(along*frequency*5.4+phase*0.79,across*(0.45+0.85*uDetail)*8.1));
        textureValue=uWeave>0.5?0.62+0.76*fibreA:0.5+0.72*(fibreA*0.64+fibreB*0.36);
    }
    float gain=(uWeave>0.5?1.6:1.7)/(0.5+vRadii.z/0.02*0.34);
    float density=flux*gain*shape*taper*filament*textureValue;
    float emission=1.0-exp(-density*1.75);
    float bodyAlpha=emission*uAmount;
    float mediumRadius=mix(vRadii.z,vRadii.w,0.45);
    float mediumFall=max(0.0,1.0-d2/max(0.000001,mediumRadius*mediumRadius));
    float hazeFall=max(0.0,1.0-d2/max(0.000001,vRadii.w*vRadii.w));
    float glowAlpha=(1.0-exp(-flux*gain*1.75))*uAmount*uBloom*(0.15+0.85*near)
        *(0.32*pow(mediumFall,3.0)+0.16*pow(hazeFall,3.0));
    float lineEdge=1.0-smoothstep(mix(0.1,0.7,uSharpness),1.0,abs(vLocal.x)/vRadii.x);
    float lineCap=smoothstep(0.0,0.12,along)*(1.0-smoothstep(0.88,1.0,along));
    float legacyAlpha=uWeave>0.5?0.0:vColor.a*(1.0-uAmount)*lineEdge*lineCap;
    float total=legacyAlpha+bodyAlpha+glowAlpha;if(total<0.001)discard;
    vec3 tint=clamp(vColor.rgb*vec3(0.72+0.62*near,0.94-0.06*near,1.22-0.16*near),0.0,1.0);
    vec3 body=clamp(tint*(0.78+0.5*emission),0.0,1.0);
    vec3 color=(linearColor(vColor.rgb)*legacyAlpha+linearColor(body)*bodyAlpha+linearColor(tint)*glowAlpha)/total;
    gl_FragColor=vec4(color,min(0.85,total));
    #include <colorspace_fragment>
}`,Dg=class{surface;identity;radii;shape={core:0,halo:0,support:0};constructor(e){this.surface=new Gi(new Float32Array(e*4),4).setUsage(Ot),this.identity=new Gi(new Float32Array(e*2),2).setUsage(Ot),this.radii=new Gi(new Float32Array(e*4),4).setUsage(Ot)}install(e){e.setAttribute(`aSurface`,this.surface),e.setAttribute(`aIdentity`,this.identity),e.setAttribute(`aRadii`,this.radii)}write(e,t,n,r,i,a){let o=i*3,s=Math.min(.08,Math.max(.004,t[n+7])),c=r?.[o]??0,l=r?.[o+1]??0,u=r?.[o+2]??t[n+11],d=Cg(t[n+14]);return Number.isFinite(c+l+u+d+s+t[n+12]+t[n+13])?(wg(s,d,a?.amount??0,a?.detail??0,a?.bloom??0,l,u,this.shape),this.surface.setXYZW(e,c,Cg(l),d,Cg(u)),this.identity.setXY(e,t[n+13],t[n+12]),this.radii.setXYZW(e,s,this.shape.core,this.shape.halo,this.shape.support),this.shape.support):NaN}uploaded(){this.surface.needsUpdate=!0,this.identity.needsUpdate=!0,this.radii.needsUpdate=!0}},Og=class{amount={value:0};detail={value:0};bloom={value:0};viewportHeight={value:1};viewportWidth={value:1};pixelLimit={value:18};viewport=new Pn;sharp;constructor(e){this.sharp=e}create(e){return new Zo({vertexShader:Tg,fragmentShader:Eg,uniforms:{uSharpness:this.sharp,uAmount:this.amount,uDetail:this.detail,uBloom:this.bloom,uViewportHeight:this.viewportHeight,uViewportWidth:this.viewportWidth,uPixelLimit:this.pixelLimit,uWeave:{value:+!!e}},transparent:!1,blending:5,blendEquation:100,blendSrc:204,blendDst:205,blendSrcAlpha:201,blendDstAlpha:205,depthTest:!0,depthWrite:!1,toneMapped:!1,side:2})}beforeEye(e){e.getCurrentViewport(this.viewport),this.viewportHeight.value=Math.max(1,this.viewport.w),this.viewportWidth.value=Math.max(1,this.viewport.z)}configure(e){this.amount.value=e?.amount??0,this.detail.value=e?.detail??0,this.bloom.value=e?.bloom??0}},kg=class{root=new pr;mesh;weaveMesh;heads=new Float32Array(dg*4);tails=new Float32Array(dg*3);colors=new Float32Array(dg*4);headAttribute=new Gi(this.heads,4).setUsage(Ot);tailAttribute=new Gi(this.tails,3).setUsage(Ot);colorAttribute=new Gi(this.colors,4).setUsage(Ot);sharp={value:1};cosmos=new yg;wall=new Sg;surface=new Og(this.sharp);grainSurface=new Dg(dg);weaveSurface=new Dg(fg);weaveHeads=new Gi(new Float32Array(fg*4),4).setUsage(Ot);weaveTails=new Gi(new Float32Array(fg*3),3).setUsage(Ot);weaveColors=new Gi(new Float32Array(fg*4),4).setUsage(Ot);ready=!1;revision=0;disposed=!1;phase=0;divider=1;shown=0;distance=200;budget=dg;onFrameReady=null;onError=null;constructor(e){this.source=e,this.source.onFrameReady=()=>{!this.disposed&&this.root.visible&&this.onFrameReady?.()},this.source.onError=e=>{this.disposed||this.onError?.(e)};let t=new Bs;t.setAttribute(`position`,new ri([-1,0,0,1,0,0,-1,1,0,1,1,0],3)),t.setIndex([0,1,2,2,1,3]),t.setAttribute(`aHead`,this.headAttribute),t.setAttribute(`aTail`,this.tailAttribute),t.setAttribute(`aColor`,this.colorAttribute),this.grainSurface.install(t),t.instanceCount=0;let n=this.surface.create(!1);this.mesh=new X(t,n),this.mesh.name=`wormhole-native-grains-v1`,this.mesh.frustumCulled=!1,this.mesh.onBeforeRender=e=>this.surface.beforeEye(e),this.root.name=`wormhole-native-grains`,this.root.renderOrder=-1e3,this.mesh.renderOrder=-1e3;let r=new Bs;r.setAttribute(`position`,t.getAttribute(`position`).clone()),r.setIndex([0,1,2,2,1,3]),r.setAttribute(`aHead`,this.weaveHeads),r.setAttribute(`aTail`,this.weaveTails),r.setAttribute(`aColor`,this.weaveColors),this.weaveSurface.install(r),r.instanceCount=0,this.weaveMesh=new X(r,this.surface.create(!0)),this.weaveMesh.onBeforeRender=e=>this.surface.beforeEye(e),this.weaveMesh.name=`wormhole-native-weave-v1`,this.weaveMesh.frustumCulled=!1,this.weaveMesh.renderOrder=-1001,this.root.add(this.cosmos.root,this.wall.mesh,this.mesh,this.weaveMesh)}source;get focalPoint(){return this.ready&&this.root.visible?this.source.focalPoint:null}get spatialFrame(){return this.ready&&this.root.visible?this.source.spatialFrame:null}get lastRenderMs(){return this.source.lastRenderMs}get executionLabel(){return this.source.executionLabel??`main geometry; no canvas/worker`}get rasterKind(){return null}get framesShown(){return this.shown}get redrawDivider(){return this.divider}get frameLatencyMs(){return this.source.frameLatencyMs??0}get stageTimes(){return null}get aheadSamples(){return null}get uploadedAhead(){return!1}setAdaptivePacing(e){}setDistance(e){Number.isFinite(e)&&e>0&&(this.distance=e,this.cosmos.setDistance(e),this.wall.setDistance(e),this.source.frame&&this.cosmos.setFrame(this.source.frame.cosmos),this.source.frame&&this.wall.setFrame(this.source.frame.wall))}setQualityBudget(e){this.budget=Math.max(1,Math.min(dg,Math.floor(e))),this.cosmos.setBudget(this.budget),this.wall.setBudget(this.budget),this.surface.pixelLimit.value=this.budget<=360?12:this.budget<=720?14:this.budget<=1080?16:18}setEyeHeight(e){Number.isFinite(e)&&(this.root.position.y=e)}setSharpness(e){this.sharp.value=Math.min(1,Math.max(0,e/1.5))}configure(e,t,n=0){this.source.setPresentation(e),this.divider=Math.max(1,Math.round(t)),this.phase=0}async prepare(e){let t=++this.revision;this.ready=!1,this.mesh.geometry.instanceCount=0,this.weaveMesh.geometry.instanceCount=0,this.cosmos.clear(),this.wall.clear();try{await this.source.prepare(e)}catch(e){if(!this.disposed&&t===this.revision)throw e}!this.disposed&&t===this.revision&&(this.ready=!0)}update(e,t){if(!(!this.ready||this.disposed||!this.root.visible)){if(!t)this.phase=0;else if(this.phase++%this.divider!==0)return;this.source.render(e,t)&&this.source.frame&&(this.setFrame(this.source.frame),this.shown++)}}setFrame(e){if(this.disposed)return;if(e.version!==1||!Number.isSafeInteger(e.count)||e.count<0||e.count>1440||e.data.length<e.count*16)throw Error(`Invalid native Wormhole spatial frame.`);if(e.weave&&(!Number.isSafeInteger(e.weave.count)||e.weave.count<0||e.weave.count>4320||e.weave.data.length<e.weave.count*16))throw Error(`Invalid native Wormhole weave frame.`);let t=e.material;if(t&&(![t.amount,t.detail,t.bloom].every(e=>Number.isFinite(e)&&e>=0&&e<=1)||t.grains.length<e.count*3||t.weave.length<(e.weave?.count??0)*3))throw Error(`Invalid native Wormhole material frame.`);this.cosmos.setFrame(e.cosmos),this.wall.setFrame(e.wall),this.surface.configure(t);let n=e.data,r=0;for(let i=0;i<e.count&&r<this.budget;i++){let e=i*16,a=n[e+1],o=n[e+2],s=n[e+3],c=n[e+11];if(!Number.isFinite(a+o+s+c)||-s<.3||-s>this.distance||-s<12&&Math.hypot(a,o)<2.52||c<=.001)continue;let l=n[e+4],u=n[e+5],d=n[e+6];if(!Number.isFinite(l+u+d))continue;let f=this.grainSurface.write(r,n,e,t?.grains,i,t);if(!Number.isFinite(f)||-s<12&&Math.hypot(a,o)<2.4+Math.max(.12,f))continue;let p=l-a,m=u-o,h=d-s,g=Math.hypot(p,m,h),_=g>1.5?1.5/g:1,v=a+p*_,y=o+m*_,b=s+h*_;if(Math.min(-s,-b)<12){let e=v-a,t=y-o,n=e*e+t*t,r=n>0?Math.min(1,Math.max(0,-(a*e+o*t)/n)):0;Math.hypot(a+e*r,o+t*r)<2.4+Math.max(.12,f)&&(v=a,y=o,b=s)}let x=r*4,S=r*3;this.heads[x]=a,this.heads[x+1]=o,this.heads[x+2]=s,this.heads[x+3]=Math.min(.08,Math.max(.004,n[e+7])),this.tails[S]=v,this.tails[S+1]=y,this.tails[S+2]=b,this.colors[x]=n[e+8],this.colors[x+1]=n[e+9],this.colors[x+2]=n[e+10],this.colors[x+3]=Math.min(.7,c),r++}this.mesh.geometry.instanceCount=r,this.headAttribute.needsUpdate=!0,this.tailAttribute.needsUpdate=!0,this.colorAttribute.needsUpdate=!0,this.grainSurface.uploaded(),this.setWeave(e.weave,t)}setWeave(e,t){let n=0;if(e)for(let r=0;r<e.count&&n<this.budget*3;r++){let i=r*16,a=e.data,o=a[i+1],s=a[i+2],c=a[i+3],l=a[i+4],u=a[i+5],d=a[i+6],f=a[i+7],p=a[i+11];if(!Number.isFinite(o+s+c+l+u+d+f+p+a[i+8]+a[i+9]+a[i+10])||p<=.001||Math.min(-c,-d)<.3||Math.max(-c,-d)>this.distance||Math.hypot(l-o,u-s,d-c)>3)continue;let m=this.weaveSurface.write(n,a,i,t?.weave,r,t);if(Number.isFinite(m)){if(Math.min(-c,-d)<12){let e=l-o,t=u-s,n=e*e+t*t,r=n>0?Math.min(1,Math.max(0,-(o*e+s*t)/n)):0;if(Math.hypot(o+e*r,s+t*r)<2.4+Math.max(.12,m))continue}this.weaveHeads.setXYZW(n,o,s,c,Math.min(.08,Math.max(.004,f))),this.weaveTails.setXYZ(n,l,u,d),this.weaveColors.setXYZW(n,a[i+8],a[i+9],a[i+10],Math.min(.7,p)),n++}}this.weaveMesh.geometry.instanceCount=n,this.weaveHeads.needsUpdate=!0,this.weaveTails.needsUpdate=!0,this.weaveColors.needsUpdate=!0,this.weaveSurface.uploaded()}prerender(e){}dispose(){this.disposed||(this.disposed=!0,this.revision++,this.ready=!1,this.source.dispose(),this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.root.removeFromParent(),this.weaveMesh.geometry.dispose(),this.weaveMesh.material.dispose(),this.cosmos.dispose(),this.wall.dispose(),this.onFrameReady=null,this.onError=null)}},Ag=.1,jg=.06;function Mg(e){let t=Math.min(1,Math.max(0,e));return t*t*(3-2*t)}var Ng=class{frameTime=NaN;value=0;slope=0;prevFrameTime=NaN;prevValue=0;prevSlope=0;blendStart=NaN;lastSongTime=NaN;maxLeadSec;constructor(e=Ag){this.maxLeadSec=e}sample(e,t,n,r){if(!Number.isFinite(e)||!Number.isFinite(t)||!Number.isFinite(n))return this.reset(),Number.isFinite(n)?n:0;let i=!(e>=this.lastSongTime-1e-6)||Math.abs(e-t)>.5||t<this.frameTime-1e-6;if(t!==this.frameTime||i){let a=Number.isFinite(this.frameTime)&&!i,o=t-this.frameTime,s=Number.isFinite(r)?r:a&&o>1e-4?(n-this.value)/o:0;if(a){let t=this.output(e);this.prevFrameTime=e,this.prevValue=t,this.prevSlope=this.slope,this.blendStart=e}else this.blendStart=NaN;this.frameTime=t,this.value=n,this.slope=Number.isFinite(s)?s:0}this.lastSongTime=e;let a=this.output(e);return Number.isFinite(this.blendStart)&&e-this.blendStart>=.06&&(this.blendStart=NaN),a}output(e){let t=this.at(e,this.frameTime,this.value,this.slope);if(!Number.isFinite(this.blendStart))return t;let n=Mg((e-this.blendStart)/jg),r=this.at(e,this.prevFrameTime,this.prevValue,this.prevSlope);return r+(t-r)*n}reset(){this.frameTime=NaN,this.blendStart=NaN,this.lastSongTime=NaN}at(e,t,n,r){return n+r*Math.min(this.maxLeadSec,Math.max(-this.maxLeadSec,e-t))}},Pg=8,Fg=class{u;phase;start;span;constructor(e){this.phase=e,this.u=new Float64Array(e.length),this.start=new Float64Array(e.length),this.span=new Float64Array(e.length)}get count(){return this.u.length}advance(e,t,n){for(let r=0;r<this.u.length;r++){if(t){let t=this.safeSpan(n(r));this.span[r]=t,this.start[r]=e-this.phase[r]%1*t}else{let t=0;for(;e-this.start[r]>=this.span[r];){if(++t>Pg){this.start[r]=e,this.span[r]=this.safeSpan(n(r));break}this.start[r]+=this.span[r],this.span[r]=this.safeSpan(n(r))}}this.u[r]=1-(e-this.start[r])}}safeSpan(e){return Number.isFinite(e)&&e>.001?e:1}},Ig=$.backdropHeightMeters/$.backdropDistanceMeters,Lg=[.25,.8];function Rg(e){return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}function zg(e){return Number.isFinite(e)&&e>0?Ig*e:0}function Bg(e){let t=Number.isFinite(e)&&e>0?e:$.backdropDistanceMeters,n=Math.max(12,t*Lg[1]);return[Math.min(n,Math.max(12,t*Lg[0])),n]}function Vg(e,t,n,r,i,a,o){let[s,c]=n;if(!(t>0)||i/t>c)return o.distance=c,o.radius=i,o.shown=!1,o;let l=Math.max(s,i/t),u=Number.isFinite(r)&&r>0?r:0;return o.distance=l+(Math.max(l,Math.min(c,a/t,u>0?30/u:c))-l)*Rg(e),o.radius=t*o.distance,o.shown=!0,o}var Hg=`${om}
uniform float uCenterY;
uniform float uTwist;
vec3 xrSpatialPoint( vec4 release, float angleSeed, float u ) {
    float rootZ = -release.x * u;
    float progress = clamp( 1.0 - u, 0.0, 1.0 );
    float angle = -( angleSeed * 6.28318530718 + ( release.z + uTwist ) * progress );
    vec2 center = xrTrackPathOffsetExtended( rootZ ) + vec2( 0.0, uCenterY );
    return vec3( center + release.y * vec2( cos( angle ), sin( angle ) ), rootZ );
}`,Ug=[4.4,12],Wg=[1.3,2];Ug[0]-Wg[1];var Gg=.2,Kg=.12,qg=.45,Jg=.35,Yg=1.6;function Xg(e,t){let n=Math.imul(e+1,739982445)^Math.imul(t+1,695872825);return n=Math.imul(n^n>>>16,2146121005),n=Math.imul(n^n>>>15,2221713035),((n^n>>>16)>>>0)/4294967296}function Zg(e=8){let t=new Float32Array(e*4),n=new Float32Array(e*3);for(let r=0;r<e;r++)t[r*4]=((r*.381966+Xg(r,1)*.12)%1+1)%1,t[r*4+1]=Xg(r,2),t[r*4+2]=((r*.618034+Xg(r,3)*.08)%1+1)%1,t[r*4+3]=r,n[r*3]=Xg(r,4),n[r*3+1]=Xg(r,5),n[r*3+2]=Xg(r,6);return{wisp:t,shape:n}}var Qg=`${Hg}
attribute vec4 aWisp;
attribute vec3 aShape;
attribute vec4 aWispRelease;
attribute float aWispDepth;
uniform float uWispCount;
uniform float uWispPresence;
varying vec2 vUv;
varying float vAlpha;
varying float vPhase;
void main() {
    float u = aWispDepth;
    vec3 center = xrSpatialPoint( aWispRelease, aWisp.x, u );
    // Fades in on the circle, dissolves before the player, never shows under the floor.
    float fade = ( 1.0 - smoothstep( ${(1-Gg).toFixed(2)}, 1.0, u ) )
        * smoothstep( ${8 .toFixed(1)}, ${18 .toFixed(1)}, -center.z )
        * smoothstep( ${(-2).toFixed(1)}, 0.0, center.y );
    // Rank k shows once the count passes k; the last one fades in with the fraction (continuous).
    float shown = clamp( uWispCount - aWisp.w, 0.0, 1.0 ) * fade * uWispPresence * aWispRelease.w;
    vAlpha = ${Kg.toFixed(2)} * shown;
    // A hidden wisp collapses to a point: no fragments at all.
    float halfSize = shown > 0.0 ? mix( ${Wg[0].toFixed(2)}, ${Wg[1].toFixed(2)}, aShape.x ) : 0.0;
    vec4 mvPosition = modelViewMatrix * vec4( center, 1.0 );
    // Camera-facing in view space (each eye's view keeps the same orientation). The quad is the body's
    // own box: body space (unit circle = edge of the body) narrowed across the long axis, then turned
    // by the wisp's rotation.
    float a = aShape.y * 6.28318530718;
    vec2 local = vec2( position.x / ${Yg.toFixed(2)}, position.y );
    mvPosition.xy += mat2( cos( a ), -sin( a ), sin( a ), cos( a ) ) * local * halfSize;
    vUv = position.xy;
    vPhase = aShape.z;
    gl_Position = projectionMatrix * mvPosition;
}`,$g=`
uniform vec3 uHalo;
uniform vec3 uHaze;
uniform float uWispPhase;
varying vec2 vUv;
varying float vAlpha;
varying float vPhase;
void main() {
    // An elongated soft body (the quad carries its rotation and elongation, so here it is a disc in
    // body space), with a cheap two-wave breakup that drifts with the Wormhole's travel (no noise
    // texture, no octaves).
    vec2 p = vUv;
    float body = max( 1.0 - dot( p, p ), 0.0 );
    body *= body;
    float phase = 6.28318530718 * ( vPhase + uWispPhase );
    float breakup = 0.6 + 0.4 * sin( p.x * 3.1 + phase ) * sin( p.y * 2.3 - phase * 0.7 );
    gl_FragColor = vec4( mix( uHalo, uHaze, ${qg.toFixed(2)} ), vAlpha * body * breakup );
    #include <colorspace_fragment>
}`,e_=class{mesh;uniforms;seeds=Zg();flights;release;depth;fresh=!0;releaseFrame=null;releaseRange=[0,0];scratch={distance:0,radius:0,shown:!1};released=!1;releaseWisp=e=>this.releaseOne(e);constructor(e){this.uniforms={...e,uWispCount:{value:0},uWispPresence:{value:0},uWispPhase:{value:0}};let t=new Bs;t.setAttribute(`position`,new ei(new Float32Array([-1,-1,0,1,-1,0,1,1,0,-1,1,0]),3)),t.setIndex([0,1,2,0,2,3]),t.setAttribute(`aWisp`,new Gi(this.seeds.wisp,4)),t.setAttribute(`aShape`,new Gi(this.seeds.shape,3)),this.release=new Gi(new Float32Array(32),4).setUsage(Ot),this.depth=new Gi(new Float32Array(8),1).setUsage(Ot),t.setAttribute(`aWispRelease`,this.release),t.setAttribute(`aWispDepth`,this.depth),t.instanceCount=8;let n=new Float64Array(8);for(let e=0;e<8;e++)n[e]=this.seeds.wisp[e*4+2];this.flights=new Fg(n);let r=new Zo({vertexShader:Qg,fragmentShader:$g,uniforms:this.uniforms,transparent:!0,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1});this.mesh=new X(t,r),this.mesh.name=`wormholeSpatialWisps`,this.mesh.renderOrder=-22,this.mesh.frustumCulled=!1,this.mesh.visible=!1}get wispDepths(){return this.flights.u}update(e,t,n,r){let i=n.amount;if(!(i>0)||!Number.isFinite(e)){this.hide();return}this.mesh.visible=!0,this.releaseFrame=n,this.releaseRange=r,this.released=!1,this.flights.advance(e,t||this.fresh,this.releaseWisp),this.released&&(this.release.needsUpdate=!0),this.fresh=!1,this.releaseFrame=null;let a=this.depth.array;for(let e=0;e<8;e++)a[e]=this.flights.u[e];this.depth.needsUpdate=!0;let o=this.uniforms,s=e*.35;o.uWispPhase.value=s-Math.floor(s);let c=8*(Number.isFinite(n.wisp)?Math.min(1,Math.max(0,n.wisp)):0);o.uWispCount.value=c>.01?c:0,o.uWispPresence.value=Math.min(1,i)}hide(){this.mesh.visible=!1,this.fresh=!0}releaseOne(e){let t=this.releaseFrame,n=this.release.array;if(this.released=!0,!t)return n[e*4+3]=0,1;let r=Vg(this.seeds.wisp[e*4+1],zg(t.tubeSpread),this.releaseRange,t.travelRate,Ug[0],Ug[1],this.scratch),i=r.shown&&r.distance>18;return n[e*4]=r.distance,n[e*4+1]=r.radius,n[e*4+2]=Jg*(Xg(e,7)<.5?-1:1),n[e*4+3]=+!!i,i?1-8/r.distance:1}dispose(){this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.mesh.removeFromParent()}},t_=1,n_=.12,r_=2.4,i_=.25,a_=.16,o_=2.5,s_=22,c_=.6,l_=.55,u_=[.4,.75],d_=20,f_=9,p_=.35,m_=.35,h_=.9,g_=1,__=.25,v_=2/24,y_=.9,b_=40,x_=.7,S_=.3;function C_(e){return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}function w_(e,t){let n=Math.imul(e+1,2654435761)^Math.imul(t+1,2246822507);return n=Math.imul(n^n>>>16,2146121005),n=Math.imul(n^n>>>15,2221713035),((n^n>>>16)>>>0)/4294967296}function T_(e=80){let t=new Float32Array(e*3),n=new Float32Array(e*2),r=new Float64Array(e);for(let i=0;i<e;i++)t[i*3]=(.5+.7548776662466927*i)%1,t[i*3+1]=w_(i,1),t[i*3+2]=(.5+.5698402909980532*i)%1,n[i*2]=((i+.5)/e+w_(i,2)*.5/e)%1,n[i*2+1]=w_(i,3),r[i]=(.6+.4*w_(i,4))*(w_(i,5)<.5?-1:1);return{position:t,seed:n,flow:r}}var E_=`${Hg}
attribute vec2 aSeed;
attribute vec4 aRelease;
attribute float aDepth;
uniform float uFarRef;
uniform float uAmount;
uniform float uPixelScale;
uniform float uDepth;
uniform float uPulse;
uniform float uTrailDu;
varying float vAlpha;
varying float vFar;
varying vec2 vAxis;
varying vec2 vShape;
void main() {
    // position = (angle seed, release seed, flight phase); aDepth = the grains' normalized depth u.
    float u = aDepth;
    vec3 p = xrSpatialPoint( aRelease, position.x, u );
    vec4 mvPosition = modelViewMatrix * vec4( p, 1.0 );
    vec4 clipHead = projectionMatrix * mvPosition;
    // Emerges on the circle, stays until it has passed the player, fades out behind them.
    float fade = ( 1.0 - smoothstep( ${(1-n_).toFixed(2)}, 1.0, u ) )
        * ( 1.0 - smoothstep( ${t_.toFixed(1)}, ${6 .toFixed(1)}, p.z ) );
    float shown = aRelease.w * fade * uAmount;
    // 0 at the player, 1 at the farthest release (eased like the Wormhole's own depth cue).
    vFar = pow( clamp( -p.z / uFarRef, 0.0, 1.0 ), 1.5 );
    vAlpha = ${c_.toFixed(2)} * shown * ( 0.6 + 0.4 * aSeed.y ) * ( 1.0 - ${m_.toFixed(2)} * vFar )
        * ( 1.0 - ${g_.toFixed(2)} * ( 1.0 - uDepth ) * vFar ) * ( 1.0 + ${__.toFixed(2)} * uPulse );
    float depth = max( -mvPosition.z, 0.1 );
    float dotPx = clamp( ${a_.toFixed(3)} * ( 0.7 + 0.6 * aSeed.y ) * projectionMatrix[ 1 ][ 1 ] * uPixelScale / depth,
        ${o_.toFixed(1)}, ${s_.toFixed(1)} );
    // Streak: where the particle was one exposure ago (farther along its own flight), projected;
    // bounded in meters; screen pixels per NDC unit on each axis.
    vec2 pxPerNdc = vec2( uPixelScale * projectionMatrix[ 1 ][ 1 ] / projectionMatrix[ 0 ][ 0 ], uPixelScale );
    vec2 headNdc = clipHead.xy / clipHead.w;
    vec2 trail = vec2( 0.0 );
    if ( uTrailDu > 0.0 && clipHead.w > 0.1 ) {
        float du = min( uTrailDu, ${y_.toFixed(2)} / max( aRelease.x, 1.0 ) );
        vec4 clipTail = projectionMatrix * ( modelViewMatrix * vec4( xrSpatialPoint( aRelease, position.x, min( u + du, 1.0 ) ), 1.0 ) );
        if ( clipTail.w > 0.1 ) trail = ( headNdc - clipTail.xy / clipTail.w ) * pxPerNdc;
    }
    float trailPx = length( trail );
    // Bounded on screen: a near particle never becomes a long bar across the view.
    if ( trailPx > ${b_.toFixed(1)} ) { trail *= ${b_.toFixed(1)} / trailPx; trailPx = ${b_.toFixed(1)}; }
    float side = dotPx + trailPx;
    // Sprite space (gl_PointCoord, +y down): unit axis toward the head; trail half-length and dot
    // radius relative to the sprite half-side (a still particle is exactly the round sprite).
    vAxis = trailPx > 0.01 ? vec2( trail.x, -trail.y ) / trailPx : vec2( 1.0, 0.0 );
    vShape = vec2( trailPx / side, dotPx / side );
    // The same light spread along a streak: a restrained peak.
    vAlpha *= mix( 1.0, ${x_.toFixed(2)}, vShape.x );
    // Hidden or behind the eye: no fragments.
    gl_PointSize = shown > 0.0 && clipHead.w > 0.1 ? side : 0.0;
    // The sprite is centered between tail and head so it holds the whole capsule (depth stays the head's).
    vec2 centerNdc = headNdc - 0.5 * trail / pxPerNdc;
    gl_Position = vec4( vec3( centerNdc, clipHead.z / clipHead.w ) * clipHead.w, clipHead.w );
}`,D_=`
uniform vec3 uCore;
uniform vec3 uHalo;
uniform vec3 uHaze;
uniform float uHaloGain;
varying float vAlpha;
varying float vFar;
varying vec2 vAxis;
varying vec2 vShape;
void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    // Distance to the trail segment (a capsule), in dot radii: a point when the trail is empty.
    float along = clamp( dot( c, vAxis ), -vShape.x, vShape.x );
    vec2 q = ( c - vAxis * along ) / max( vShape.y, 0.001 );
    float r2 = dot( q, q );
    float halo = max( 1.0 - r2, 0.0 );
    halo *= halo * halo;
    float core = exp( -r2 * mix( ${d_.toFixed(1)}, ${f_.toFixed(1)}, vFar ) );
    // Bright head, fading tail: the streak reads as travel direction.
    float taper = vShape.x > 0.0 ? mix( ${S_.toFixed(2)}, 1.0, 0.5 + 0.5 * along / vShape.x ) : 1.0;
    vec3 haloColor = mix( uHalo, uHaze, ${p_.toFixed(2)} * vFar );
    gl_FragColor = vec4( ( uCore * core + haloColor * ( halo * uHaloGain ) ) * taper, vAlpha );
    #include <colorspace_fragment>
}`,O_=class{root=new pr;points;wisps;uniforms={uTrackBend:{value:im(new Pn)},uTrackFarAim:{value:new Pn},uCenterY:{value:0},uTwist:{value:0},uFarRef:{value:Bg(NaN)[1]},uAmount:{value:0},uPixelScale:{value:540},uDepth:{value:0},uPulse:{value:0},uTrailDu:{value:0},uHaloGain:{value:u_[0]},uCore:{value:new Y},uHalo:{value:new Y},uHaze:{value:new Y}};modeValue=`full`;pathRevision=-1;drawingBuffer=new K;seeds=T_();flights;release;depth;fresh=!0;lastSongTime=NaN;lastFrameTime=NaN;lastFrameTravel=NaN;travelSignal=new Ng(i_);twistSignal=new Ng;travel=0;emergeRange=Bg(NaN);releaseFrame=null;scratch={distance:0,radius:0,shown:!1};released=!1;releaseParticle=e=>this.releaseOne(e);constructor(){let e=new hi;e.setAttribute(`position`,new ei(this.seeds.position,3)),e.setAttribute(`aSeed`,new ei(this.seeds.seed,2)),this.release=new ei(new Float32Array(320),4).setUsage(Ot),e.setAttribute(`aRelease`,this.release),this.depth=new ei(new Float32Array(80),1).setUsage(Ot),e.setAttribute(`aDepth`,this.depth);let t=new Float64Array(80);for(let e=0;e<80;e++)t[e]=this.seeds.position[e*3+2];this.flights=new Fg(t);let n=new Zo({vertexShader:E_,fragmentShader:D_,uniforms:this.uniforms,transparent:!0,depthWrite:!1,depthTest:!0,blending:2,toneMapped:!1});this.points=new la(e,n),this.wisps=new e_(this.uniforms),this.root.name=`wormholeSpatial`,this.root.add(this.wisps.mesh,this.points),this.points.name=`wormholeSpatialField`,this.points.renderOrder=-20,this.points.frustumCulled=!1,this.points.visible=!1,this.points.onBeforeRender=e=>{let t=e.getDrawingBufferSize(this.drawingBuffer).y;t>0&&(this.uniforms.uPixelScale.value=t*.5)}}get mode(){return this.modeValue}setMode(e){this.modeValue=e===`off`||e===`particles`?e:`full`,this.modeValue===`off`&&this.hide()}setCenterHeight(e){Number.isFinite(e)&&(this.uniforms.uCenterY.value=e)}get particleDepths(){return this.flights.u}update(e,t,n){let r=t?t.amount:0;if(this.modeValue===`off`||!t||!(r>0)||!Number.isFinite(e)){this.hide();return}if(!Number.isFinite(t.travel)){this.hide();return}(t.time<this.lastFrameTime-1e-6||t.travel<this.lastFrameTravel-1.5)&&(this.fresh=!0,this.travelSignal.reset(),this.twistSignal.reset()),this.lastFrameTime=t.time,this.lastFrameTravel=t.travel;let i=Number.isFinite(t.travelRate)?t.travelRate:0,a=this.travelSignal.sample(e,t.time,t.travel,i),o=this.twistSignal.sample(e,t.time,Number.isFinite(t.spiralTurns)?t.spiralTurns:0),s=this.uniforms,c=Bg(n.backdropDistanceMeters);(c[0]!==this.emergeRange[0]||c[1]!==this.emergeRange[1])&&(this.emergeRange=c,this.fresh=!0),s.uFarRef.value=c[1],e>=this.lastSongTime-1e-6&&e<=this.lastSongTime+1||(this.fresh=!0),this.lastSongTime=e,!this.fresh&&a<this.travel&&(a=this.travel),this.travel=a;let l=this.fresh;this.releaseFrame=t,this.released=!1,this.flights.advance(a,l,this.releaseParticle),this.released&&(this.release.needsUpdate=!0);let u=this.depth.array,d=this.flights.u;for(let e=0;e<80;e++)u[e]=d[e];this.depth.needsUpdate=!0,this.fresh=!1,s.uTwist.value=2*Math.PI*o,s.uAmount.value=Math.min(1,r);let f=C_(t.depth);s.uDepth.value=f,s.uHaloGain.value=u_[0]+(u_[1]-u_[0])*f,s.uPulse.value=C_(.6*C_(t.pulse)+.6*C_(t.impact)),s.uTrailDu.value=C_(t.streak)*v_*Math.max(0,i);let p=C_(t.red),m=C_(t.green),h=C_(t.blue),g=l_;s.uHalo.value.setRGB(p,m,h,St),s.uCore.value.setRGB(p+(1-p)*g,m+(1-m)*g,h+(1-h)*g,St),s.uHaze.value.setRGB(C_(t.hazeRed),C_(t.hazeGreen),C_(t.hazeBlue),St),n.revision!==this.pathRevision&&(n.writeBendUniform(s.uTrackBend.value),n.writeFarAimUniform(s.uTrackFarAim.value),this.pathRevision=n.revision),this.points.visible=!0,this.modeValue===`full`?this.wisps.update(a,l,t,c):this.wisps.hide(),this.releaseFrame=null}releaseOne(e){let t=this.releaseFrame,n=this.release.array;if(this.released=!0,!t)return n[e*4+3]=0,1;let{position:r,seed:i,flow:a}=this.seeds,o=Vg(r[e*3+1],zg(t.tubeSpread),this.emergeRange,t.travelRate,r_,16,this.scratch);return n[e*4]=o.distance,n[e*4+1]=o.radius,n[e*4+2]=h_*C_(t.turbulence)*a[e],n[e*4+3]=o.shown&&i[e*2]<=C_(t.density)?1:0,1+6/o.distance}hide(){this.points.visible=!1,this.wisps.hide(),this.fresh=!0,this.lastFrameTime=NaN,this.lastFrameTravel=NaN,this.travelSignal.reset(),this.twistSignal.reset()}dispose(){this.points.geometry.dispose(),this.points.material.dispose(),this.wisps.dispose(),this.root.removeFromParent()}},k_=9430783,A_=16765788,j_=2.5;function M_(e,t){let n=new Map,r=new Map;for(let t of e.sections)t.label&&n.set(t.label,(n.get(t.label)??0)+1);let i=e.sections.reduce((e,t)=>Math.max(e,t.end),0);return{sections:e.sections.map(e=>{if(!e.label)return{start:e.start,end:e.end,label:null,title:`TRACK`,color:k_,weight:e.weight,noteCount:e.noteCount};let t=(r.get(e.label)??0)+1;r.set(e.label,t);let i=ph[e.label].name;return{start:e.start,end:e.end,label:e.label,title:(n.get(e.label)??0)>1?`${i} ${t}`:i,color:ph[e.label].color,weight:e.weight,noteCount:e.noteCount}}),durationSec:t>0&&Number.isFinite(t)?t:Math.max(1,i)}}function N_(e,t){return!t||t.completedAt===null||e.noteCount===0?`pending`:t.misses>0?`missed`:t.perfects===e.noteCount?`flawless`:`clean`}function P_(e,t){return!t||e.noteCount===0?0:Math.min(1,(t.perfects+.5*(t.hits-t.perfects))/e.noteCount)}function F_(){return{current:-1,progress:0,flawless:!0,flash:{index:-1,kind:`clear`,bonus:0,age:0},hasFlash:!1}}function I_(e,t,n,r){let i=Number.isFinite(n)?n:0;r.progress=Math.min(1,Math.max(0,i/e.durationSec)),r.current=-1;for(let t=0;t<e.sections.length&&e.sections[t].start<=i;t++)r.current=t;if(r.flawless=r.current<0||(t?.[r.current]?.misses??0)===0,r.hasFlash=!1,t)for(let n=t.length-1;n>=0;n--){let a=t[n];if(a.completedAt===null||a.bonus<=0)continue;let o=i-a.completedAt;if(!(o<0||o>=2.5)){r.hasFlash=!0,r.flash.index=n,r.flash.age=o,r.flash.bonus=a.bonus,r.flash.kind=N_(e.sections[n],a)===`flawless`?`flawless`:`clear`;break}}return r}function L_(e){return String(Math.round(e)).replace(/\B(?=(\d{3})+(?!\d))/g,` `)}var R_=1.6,z_=.024,B_=-.71,V_=.11,H_=768,U_=56,W_=.96,G_=W_*U_/H_,K_=1024,q_=5,J_=`"Segoe UI", "Roboto", system-ui, sans-serif`;function Y_(e,t=1){return`rgba(${e>>16&255}, ${e>>8&255}, ${e&255}, ${t})`}function X_(e){let t=new fa(e);return t.colorSpace=St,t.generateMipmaps=!1,t.minFilter=z,t.wrapS=L,t}function Z_(e,t=16777215){return new Ai({map:e,color:t,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1})}var Q_=class{root=new pr;strip;played;playhead;caption;dimCanvas;litCanvas;captionCanvas;dimTexture;litTexture;captionTexture;overview=null;state=F_();lastTime=NaN;lastScore=NaN;lastMisses=NaN;lastKey=NaN;redraws=0;constructor(e=document){let t=(t,n)=>{let r=e.createElement(`canvas`);return r.width=t,r.height=n,r};this.dimCanvas=t(K_,8),this.litCanvas=t(K_,8),this.captionCanvas=t(H_,U_),this.dimTexture=X_(this.dimCanvas),this.litTexture=X_(this.litCanvas),this.captionTexture=X_(this.captionCanvas),this.strip=new X(new zo(R_,z_),Z_(this.dimTexture)),this.strip.name=`songMapStrip`,this.played=new X(new zo(R_,z_).translate(R_/2,0,0),Z_(this.litTexture)),this.played.name=`songMapPlayed`,this.played.position.set(-1.6/2,0,.001),this.playhead=new X(new zo(.006,z_*2.2),Z_(null,16777215)),this.playhead.name=`songMapPlayhead`,this.playhead.position.z=.002,this.caption=new X(new zo(W_,G_),new Ai({map:this.captionTexture,transparent:!0,depthWrite:!1,toneMapped:!1})),this.caption.name=`songMapCaption`,this.caption.position.y=-.059,this.root.add(this.strip,this.played,this.playhead,this.caption),this.root.position.set(0,B_,.004);for(let e of[this.strip,this.played,this.playhead,this.caption])e.renderOrder=-4;this.root.visible=!1}setFrameBottom(e){Number.isFinite(e)&&(this.root.position.y=e-V_)}get redrawCount(){return this.redraws}setOverview(e){this.overview=e&&e.sections.length?e:null,this.root.visible=this.overview!==null,this.lastTime=NaN,this.lastKey=NaN,this.overview&&this.drawStrips(this.overview)}update(e,t){let n=this.overview;if(!n||e===this.lastTime&&t.score===this.lastScore&&t.missCount===this.lastMisses)return;this.lastTime=e,this.lastScore=t.score,this.lastMisses=t.missCount;let r=I_(n,t.sections,e,this.state),i=r.progress;this.played.scale.x=Math.max(1e-4,i),this.litTexture.repeat.x=Math.max(1e-4,i),this.playhead.position.x=-1.6/2+i*R_;let a=r.hasFlash?Math.min(q_-1,Math.floor(r.flash.age/j_*q_)):-1,o=r.hasFlash?-1-(r.flash.index*q_+a):(r.current+1)*2+ +!!r.flawless;o!==this.lastKey&&(this.lastKey=o,this.drawCaption(n,r,a))}dispose(){this.root.removeFromParent();for(let e of[this.strip,this.played,this.playhead,this.caption])e.geometry.dispose(),e.material.dispose();for(let e of[this.dimTexture,this.litTexture,this.captionTexture])e.dispose()}drawStrips(e){for(let[t,n,r]of[[this.dimCanvas,.28,this.dimTexture],[this.litCanvas,1,this.litTexture]]){let i=t.getContext(`2d`);if(i){i.clearRect(0,0,t.width,t.height),i.fillStyle=`rgba(79, 216, 255, 0.08)`,i.fillRect(0,3,t.width,2);for(let r of e.sections){let a=Math.round(r.start/e.durationSec*t.width)+1,o=Math.round(Math.min(r.end,e.durationSec)/e.durationSec*t.width)-1;if(o<=a)continue;let s=Math.round(4+4*(r.weight-1));i.fillStyle=Y_(r.color,n),i.fillRect(a,(t.height-s)/2,o-a,s)}r.needsUpdate=!0}}}drawCaption(e,t,n){this.redraws++;let r=this.captionCanvas.getContext(`2d`);if(!r)return;let i=H_,a=U_;if(r.clearRect(0,0,i,a),r.textBaseline=`middle`,t.hasFlash){let o=e.sections[t.flash.index],s=1-n/q_,c=t.flash.kind===`flawless`?A_:o.color;r.textAlign=`center`,r.font=`800 30px ${J_}`,r.fillStyle=Y_(c,.25+.75*s),r.fillText(`${o.title}  ${t.flash.kind===`flawless`?`FLAWLESS`:`CLEAR`}  +${L_(t.flash.bonus)}`,i/2,a/2)}else if(t.current>=0){let n=e.sections[t.current];r.textAlign=`left`,r.font=`600 22px ${J_}`,r.fillStyle=`rgba(139, 166, 196, 0.85)`,r.fillText(n.title,16,a/2),r.textAlign=`right`,r.font=`700 24px ${J_}`,r.fillStyle=Y_(n.color,.95),r.fillText(`×${n.weight.toFixed(1)}`,i-52,a/2),r.save(),r.translate(i-26,a/2),r.rotate(Math.PI/4),t.flawless?(r.fillStyle=Y_(A_,.95),r.fillRect(-7,-7,14,14)):(r.strokeStyle=`rgba(139, 166, 196, 0.6)`,r.lineWidth=2,r.strokeRect(-6,-6,12,12)),r.restore()}this.captionTexture.needsUpdate=!0}},$_={pending:0,missed:1,clean:2,flawless:3},ev=`
varying vec2 vPos;
void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,tv=`
#define MAX_SECTIONS 32
varying vec2 vPos;
uniform vec4 uSections[MAX_SECTIONS]; // start, end (song fractions), accuracy, outcome
uniform vec3 uColors[MAX_SECTIONS];
uniform int uCount;
uniform float uProgress;
uniform float uTier;
uniform vec3 uLeft;
uniform vec3 uRight;
uniform vec3 uGold;
const float TAU = 6.28318530718;

float band(float r, float inner, float outer) {
    return smoothstep(inner - 0.003, inner + 0.001, r) * (1.0 - smoothstep(outer - 0.001, outer + 0.003, r));
}

void main() {
    float r = length(vPos);
    // 0 straight ahead, increasing clockwise seen from above.
    float t = fract(atan(vPos.x, vPos.y) / TAU + 1.0);
    vec3 color = vec3(0.0);
    float timeline = band(r, 0.36, 0.40);
    float results = band(r, 0.22, 0.25);
    for (int i = 0; i < MAX_SECTIONS; i++) {
        if (i >= uCount) break;
        vec4 s = uSections[i];
        bool inside = t >= s.x + 0.0025 && t < s.y - 0.0025;
        if (!inside) continue;
        color += uColors[i] * timeline * (t < uProgress ? 0.95 : 0.2);
        float filled = step(t, s.x + (s.y - s.x) * s.z);
        if (s.w > 2.5) color += uGold * results * filled;
        else if (s.w > 1.5) color += uColors[i] * results * filled * 0.85;
        else if (s.w > 0.5) color += uColors[i] * results * filled * 0.18;
        else color += uColors[i] * results * 0.05;
    }
    float head = 1.0 - smoothstep(0.0015, 0.004, abs(t - uProgress));
    color += vec3(1.0) * head * band(r, 0.345, 0.415);
    // Multiplier steps: 4 per side around the left (270 deg) and right (90 deg), both lighting up
    // from the front toward the back.
    float sideArc = band(r, 0.47, 0.49);
    if (sideArc > 0.0) {
        float right = (t - 0.1667) / 0.1667; // 60..120 deg -> 0..1
        float left = (0.8333 - t) / 0.1667;  // 300..240 deg -> 0..1
        float u = right >= 0.0 && right < 1.0 ? right : left >= 0.0 && left < 1.0 ? left : -1.0;
        if (u >= 0.0) {
            float stepIndex = floor(u * 4.0);
            float gap = step(0.1, fract(u * 4.0)) * step(fract(u * 4.0), 0.9);
            float lit = stepIndex <= uTier ? 1.0 : 0.16;
            color += (right >= 0.0 && right < 1.0 ? uRight : uLeft) * sideArc * gap * lit;
        }
    }
    gl_FragColor = vec4(color, 1.0);
}`,nv=class{mesh;sections;colors;overview=null;count=0;lastResults=null;lastHits=-1;lastMisses=-1;constructor(){this.sections=Array.from({length:32},()=>new Pn),this.colors=Array.from({length:32},()=>new Y);let e=new Zo({vertexShader:ev,fragmentShader:tv,transparent:!0,depthWrite:!1,blending:2,toneMapped:!1,uniforms:{uSections:{value:this.sections},uColors:{value:this.colors},uCount:{value:0},uProgress:{value:0},uTier:{value:0},uLeft:{value:new Y(th.left)},uRight:{value:new Y(th.right)},uGold:{value:new Y(A_)}}});this.mesh=new X(new Bo(.2,.52,160,1),e),this.mesh.rotation.x=-Math.PI/2,this.mesh.position.y=.008,this.mesh.name=`progressRing`,this.mesh.renderOrder=-6,this.mesh.visible=!1}get uniforms(){return this.mesh.material.uniforms}setOverview(e){if(this.overview=e&&e.sections.length?e:null,this.mesh.visible=this.overview!==null,this.count=0,this.lastResults=null,!this.overview){this.uniforms.uCount.value=0;return}let{sections:t,durationSec:n}=this.overview;this.count=Math.min(32,t.length);for(let e=0;e<this.count;e++){let r=t[e],i=e===this.count-1?t[t.length-1].end:r.end;this.sections[e].set(r.start/n,Math.min(1,i/n),0,$_.pending),this.colors[e].setHex(r.color)}this.uniforms.uCount.value=this.count}update(e,t){let n=this.overview;if(!n)return;let r=Math.min(1,Math.max(0,(Number.isFinite(e)?e:0)/n.durationSec));this.uniforms.uProgress.value!==r&&(this.uniforms.uProgress.value=r);let i=Math.max(0,Math.log2(t.multiplier??1));this.uniforms.uTier.value!==i&&(this.uniforms.uTier.value=i);let a=t.sections;if(!(a===this.lastResults&&t.hitCount===this.lastHits&&t.missCount===this.lastMisses)){this.lastResults=a,this.lastHits=t.hitCount,this.lastMisses=t.missCount;for(let e=0;e<this.count;e++){let t=a?.[e],r=n.sections[e],i=$_[N_(r,t)],o=i===$_.pending?0:P_(r,t),s=this.sections[e];(s.w!==i||s.z!==o)&&(s.z=o,s.w=i)}}}dispose(){this.mesh.removeFromParent(),this.mesh.geometry.dispose(),this.mesh.material.dispose()}},rv=.835,iv=.635,av=.035,ov=1.2,sv=.62,cv=sv/8,lv=512,uv=64,dv=`"Segoe UI", "Roboto", system-ui, sans-serif`,fv=.12,pv=.85;function mv(e,t,n,r,i){let a=0;if(!Number.isFinite(t)||!(n>0)||!(r>0))return 0;for(let o=1;o<e.sections.length&&a<i.length;o++){let s=e.sections[o].start-t;if(s<=0)continue;if(s>r)break;let c=i[a++];c.section=o,c.z=-s*n,c.travelled=(r-s)*n}return a}function hv(e){let t=[],n=rv,r=e,i=.24,a=.012,o=.008;for(let e of[-1,1])for(let s of[-1,1])t.push({geometry:Up(i,a,o,e*(n-i/2),s*r,0),color:16777215}),t.push({geometry:Up(a,i,o,e*n,s*(r-i/2),0),color:16777215});for(let e of[-1,1])t.push({geometry:Up(.2,.006,o,e*.43,r,0),color:16777215,shade:()=>.6});return t.push({geometry:Up(.5,.004,o,0,-r,0),color:16777215,shade:()=>.35}),t}var gv=class{root=new pr;brackets;labels=[];atlasCanvas;atlas;gates=Array.from({length:2},()=>({section:-1,z:0,travelled:0}));dummy=new fr;color=new Y;point={x:0,y:0,z:0};overview=null;spawnFadeMeters=0;atlasDraws=0;centerY=0;halfHeight=iv;constructor(e=document){this.brackets=new $i(Hp(hv(iv)),new Ai({vertexColors:!0,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1}),2),this.brackets.name=`sectionGates`,this.brackets.count=0,this.brackets.frustumCulled=!1,this.brackets.setColorAt(0,this.color.setRGB(1,1,1)),this.brackets.renderOrder=-5,this.atlasCanvas=e.createElement(`canvas`),this.atlasCanvas.width=lv,this.atlasCanvas.height=uv*32,this.atlas=new fa(this.atlasCanvas),this.atlas.colorSpace=St,this.atlas.generateMipmaps=!1,this.atlas.minFilter=z,this.root.add(this.brackets);for(let e=0;e<2;e++){let t=new X(new zo(sv,cv),new Ai({map:this.atlas.clone(),transparent:!0,depthWrite:!1,toneMapped:!1}));t.name=`sectionGateLabel${e}`,t.visible=!1,t.renderOrder=-4,this.labels.push(t),this.root.add(t)}this.root.visible=!1}get atlasDrawCount(){return this.atlasDraws}setOverview(e){this.overview=e&&e.sections.length>1?e:null,this.root.visible=this.overview!==null,this.brackets.count=0;for(let e of this.labels)e.visible=!1;this.overview&&this.drawAtlas(this.overview)}setFrame(e,t){let n=t+av;!Number.isFinite(e)||!(t>0)||e===this.centerY&&n===this.halfHeight||(this.centerY=e,this.halfHeight=n,this.brackets.geometry.dispose(),this.brackets.geometry=Hp(hv(n)))}get halfHeightMeters(){return this.halfHeight}setSpawnFade(e){this.spawnFadeMeters=Number.isFinite(e)&&e>0?e:0}update(e,t,n){let r=this.overview;if(!r)return;let i=mv(r,e,t.noteSpeedMps,t.approachTimeSec,this.gates);for(let e=0;e<2;e++){let t=this.labels[e];if(e>=i){t.visible=!1;continue}let a=this.gates[e],o=r.sections[a.section],s=this.spawnFadeMeters>0?Math.min(1,a.travelled/this.spawnFadeMeters):1;this.point.x=0,this.point.y=0,this.point.z=a.z,n?.projectPlayfieldPoint(this.point),this.dummy.position.set(this.point.x,this.point.y+this.centerY,a.z),this.dummy.scale.setScalar(pv+(1-pv)*s),this.dummy.updateMatrix(),this.brackets.setMatrixAt(e,this.dummy.matrix),this.brackets.setColorAt(e,this.color.setHex(o.color).multiplyScalar(fv+(1-fv)*s));let c=this.dummy.scale.x;t.position.set(this.point.x,this.point.y+this.centerY+(this.halfHeight+cv/2+.012)*c,a.z),t.scale.setScalar(c),t.material.opacity=s*Math.min(1,-a.z/ov),t.visible=t.material.opacity>.01&&a.section<=32,t.material.map.offset.y=1-a.section/32}this.brackets.count=i,this.brackets.instanceMatrix.needsUpdate=!0,this.brackets.instanceColor&&(this.brackets.instanceColor.needsUpdate=!0)}dispose(){this.root.removeFromParent(),this.brackets.dispose(),this.brackets.geometry.dispose(),this.brackets.material.dispose();for(let e of this.labels)e.geometry.dispose(),e.material.map?.dispose(),e.material.dispose();this.atlas.dispose()}drawAtlas(e){this.atlasDraws++;let t=Math.min(32,e.sections.length-1),n=this.atlasCanvas.getContext(`2d`);if(n){n.clearRect(0,0,lv,uv*32),n.textBaseline=`middle`,n.textAlign=`center`;for(let r=0;r<t;r++){let t=e.sections[r+1],i=`#${t.color.toString(16).padStart(6,`0`)}`,a=r*uv+uv/2;n.fillStyle=`rgba(2, 6, 16, 0.5)`,n.fillRect(0,r*uv+8,lv,uv-16),n.fillStyle=i,n.font=`800 34px ${dv}`,n.fillText(`${t.title}  ×${t.weight.toFixed(1)}`,lv/2,a+1)}for(let e of this.labels){let t=e.material.map;t.repeat.set(1,1/32),t.needsUpdate=!0}this.atlas.needsUpdate=!0}}},_v=.32,vv=.9,yv=.5,bv=.35,xv=2.5,Sv=new Y(15924735);function Cv(e,t){let n=2166136261^Math.imul(t+1,2654435761);for(let t=0;t<e.length;t++)n=Math.imul(n^e.charCodeAt(t),16777619);return n^=n>>>15,n=Math.imul(n,739982445),n^=n>>>13,(n>>>0)/4294967296}var wv=e=>Number.isInteger(e)?`${e}.0`:String(e),Tv=`
attribute vec4 aSliceOrigin;
attribute vec4 aSliceMotion;
attribute vec3 aSliceHand;
uniform float uSliceTime;
uniform float uSliceCarry;
uniform float uSliceHalfOffset;
uniform vec3 uSliceHot;
varying vec3 vSliceColor;`,Ev=`
	float sliceAge = uSliceTime - aSliceOrigin.w;
	float sliceT = sliceAge / ${wv(_v)};
	float sliceLive = step( 0.0, sliceAge ) * ( 1.0 - step( ${wv(_v)}, sliceAge ) );
	vec2 sliceCut = aSliceMotion.xy;
	float sliceSide = aSliceMotion.z;
	float sliceAcross = sliceSide * ( uSliceHalfOffset + ${wv(vv)} * sliceAge );
	float sliceAlong = ${wv(yv)} * sliceAge;
	vec3 slicePosition = aSliceOrigin.xyz + vec3( vec2( sliceCut.y, -sliceCut.x ) * sliceAcross + sliceCut * sliceAlong, uSliceCarry * sliceAge );
	float sliceYaw = sliceSide * 6.0 * sliceAge;
	float sliceRoll = aSliceMotion.w + sliceSide * 2.5 * sliceAge;
	vec3 sliceLocal = transformed * ( 1.0 - 0.35 * sliceT );
	sliceLocal = vec3( cos( sliceRoll ) * sliceLocal.x - sin( sliceRoll ) * sliceLocal.y, sin( sliceRoll ) * sliceLocal.x + cos( sliceRoll ) * sliceLocal.y, sliceLocal.z );
	sliceLocal = vec3( cos( sliceYaw ) * sliceLocal.x + sin( sliceYaw ) * sliceLocal.z, sliceLocal.y, -sin( sliceYaw ) * sliceLocal.x + cos( sliceYaw ) * sliceLocal.z );
	transformed = mix( aSliceOrigin.xyz, slicePosition + sliceLocal, sliceLive );
	vSliceColor = mix( uSliceHot, aSliceHand, min( 1.0, sliceT * 2.5 ) ) * ( ( 1.0 - sliceT ) * ( 1.0 - sliceT ) );`,Dv=`
	float sliceAge = uSliceTime - aSliceOrigin.w;
	float sliceT = sliceAge / ${wv(_v)};
	float sliceLive = step( 0.0, sliceAge ) * ( 1.0 - step( ${wv(_v)}, sliceAge ) );
	vec2 sliceDirection = aSliceMotion.xy;
	float sliceSpeed = aSliceMotion.z;
	vec3 slicePosition = aSliceOrigin.xyz + vec3( sliceDirection * sliceSpeed * sliceAge, ( uSliceCarry + aSliceMotion.w ) * sliceAge );
	slicePosition.y -= 0.5 * ${wv(xv)} * sliceAge * sliceAge;
	float sliceRoll = atan( sliceDirection.y * sliceSpeed - ${wv(xv)} * sliceAge, sliceDirection.x * sliceSpeed ) - ${wv(Math.PI/2)};
	vec3 sliceLocal = transformed * vec3( 1.0, 0.6 + sliceSpeed * 0.4 * ( 1.0 - sliceT ), 1.0 );
	sliceLocal = vec3( cos( sliceRoll ) * sliceLocal.x - sin( sliceRoll ) * sliceLocal.y, sin( sliceRoll ) * sliceLocal.x + cos( sliceRoll ) * sliceLocal.y, sliceLocal.z );
	transformed = mix( aSliceOrigin.xyz, slicePosition + sliceLocal, sliceLive );
	vSliceColor = mix( aSliceHand, uSliceHot, 0.5 ) * ( ( 1.0 - sliceT ) * ( 1.0 - sliceT ) * ( 1.0 - sliceT ) );`;function Ov(e,t,n,r){let i=new Ai({vertexColors:e,transparent:!0,blending:2,depthWrite:!1,toneMapped:!1});return i.onBeforeCompile=e=>{if(Object.assign(e.uniforms,r),!e.vertexShader.includes(`#include <begin_vertex>`)||!e.fragmentShader.includes(`#include <color_fragment>`))throw Error(`Slice effect: unexpected built-in shader chunks.`);e.vertexShader=`${Tv}\n${e.vertexShader}`.replace(`#include <begin_vertex>`,`#include <begin_vertex>${t}`),e.fragmentShader=`varying vec3 vSliceColor;\n${e.fragmentShader}`.replace(`#include <color_fragment>`,`#include <color_fragment>
	diffuseColor.rgb *= vSliceColor;`)},i.customProgramCacheKey=()=>n,i}var kv=[[`aSliceOrigin`,4],[`aSliceMotion`,4],[`aSliceHand`,3]];function Av(e){return kv.map(([,t])=>new Gi(new Float32Array(e*t),t).setUsage(Ot))}function jv(e,t){return t.forEach((t,n)=>e.setAttribute(kv[n][0],t)),e}function Mv(e,t){return(e===`shard`?Sm(t):vm(t)).scale(.5,1,1)}var Nv=class{halves;sparks;uniforms;size;design=`classic`;halfAttributes;sparkAttributes;origin=new q;slotIds=[];slotHits=[];slotCount=0;writtenConfig=null;writtenPath;writtenPathRevision=-1;epoch=0;activeSlices=0;writes=0;constructor(e){this.size=e,this.uniforms={uSliceTime:{value:0},uSliceCarry:{value:0},uSliceHalfOffset:{value:e*.25},uSliceHot:{value:Sv.clone()}},this.halfAttributes=Av(24),this.sparkAttributes=Av(120),this.halves=new $i(jv(Mv(this.design,this.size),this.halfAttributes),Ov(!0,Ev,`xr-slice-halves`,this.uniforms),24),this.sparks=new $i(jv(new ga(.008,.05,.008),this.sparkAttributes),Ov(!1,Dv,`xr-slice-sparks`,this.uniforms),120);for(let e of[this.halves,this.sparks])e.count=0,e.frustumCulled=!1;this.halves.name=`sliceHalves`,this.sparks.name=`sliceSparks`}setDesign(e){e!==this.design&&(this.design=e,this.halves.geometry.dispose(),this.halves.geometry=jv(Mv(e,this.size),this.halfAttributes))}update(e,t,n,r){let i=0,a=n!==this.writtenConfig||r!==this.writtenPath;for(let n of e){if(i>=12)break;if(n.status!==`hit`||n.resolvedAt===void 0)continue;let e=t-n.resolvedAt;e>=0&&e<.32&&((this.slotIds[i]!==n.note.id||this.slotHits[i]!==n.resolvedAt)&&(a=!0),this.slotIds[i]=n.note.id,this.slotHits[i]=n.resolvedAt,i++)}i!==this.slotCount&&(a=!0),!a&&i>0&&r&&r.revision!==this.writtenPathRevision&&(a=this.originsMoved(e,i,n,r)),a&&this.write(e,i,t,n,r),this.uniforms.uSliceTime.value=t-this.epoch,this.uniforms.uSliceCarry.value=n.noteSpeedMps*bv,this.activeSlices=i,this.halves.count=i*2,this.sparks.count=i*10}dispose(){for(let e of[this.halves,this.sparks])e.removeFromParent(),e.dispose(),e.geometry.dispose(),e.material.dispose()}slotIndex(e,t,n){for(let r=t;r<e.length;r++){let t=e[r];if(t.status===`hit`&&t.note.id===this.slotIds[n]&&t.resolvedAt===this.slotHits[n])return r}return-1}originOf(e,t,n){return Gf(e.note,e.resolvedAt,this.origin,t),n?.projectPlayfieldPoint(this.origin),this.origin}originsMoved(e,t,n,r){this.writtenPathRevision=r.revision;let i=this.halfAttributes[0].array;for(let a=0,o=0;a<t&&!((o=this.slotIndex(e,o,a))<0);a++,o++){let t=this.originOf(e[o],n,r),s=a*8;if(Math.fround(t.x)!==i[s]||Math.fround(t.y)!==i[s+1]||Math.fround(t.z)!==i[s+2])return!0}return!1}write(e,t,n,r,i){this.writes++,this.epoch=n,this.slotCount=t,this.writtenConfig=r,this.writtenPath=i,this.writtenPathRevision=i?i.revision:-1;let[a,o,s]=this.halfAttributes.map(e=>e.array),[c,l,u]=this.sparkAttributes.map(e=>e.array);for(let n=0,d=0;n<t&&!((d=this.slotIndex(e,d,n))<0);n++,d++){let t=e[d],f=t.note,p=this.originOf(t,r,i),m=t.resolvedAt-this.epoch,[h,g]=kd[f.cutDirection&&f.cutDirection!==`any`?f.cutDirection:f.hand===`right`?`down-right`:`down-left`],_=Math.atan2(g,h)-Math.PI/2,v=g,y=-h,b=um[f.hand];for(let e=0;e<2;e++){let t=n*2+e;a[t*4]=p.x,a[t*4+1]=p.y,a[t*4+2]=p.z,a[t*4+3]=m,o[t*4]=h,o[t*4+1]=g,o[t*4+2]=e===0?-1:1,o[t*4+3]=_,s[t*3]=b.r,s[t*3+1]=b.g,s[t*3+2]=b.b}for(let e=0;e<10;e++){let t=(Cv(f.id,e)-.5)*2.4,r=1.5+2*Cv(f.id,e+31),i=n*10+e;c[i*4]=p.x,c[i*4+1]=p.y,c[i*4+2]=p.z,c[i*4+3]=m,l[i*4]=Math.cos(t)*h+Math.sin(t)*v,l[i*4+1]=Math.cos(t)*g+Math.sin(t)*y,l[i*4+2]=r,l[i*4+3]=Cv(f.id,e+67)-.3,u[i*3]=b.r,u[i*3+1]=b.g,u[i*3+2]=b.b}}Gp(this.halfAttributes,t*2),Gp(this.sparkAttributes,t*10)}},Pv=.45,Fv={energy:new Y(16761405),signal:new Y(15268863),sync:new Y(10976255),stabilize:new Y(16748512),accent:new Y(16767624),phrase:new Y(15268863),section:new Y(13351679)},Iv={energy:0,signal:0,sync:0,stabilize:0,accent:1,phrase:2,section:3},Lv=0,Rv=1,zv=2,Bv=`
${am}
attribute vec4 aHaloBase; // canonical x/y, epoch-relative note time and resolution time
attribute vec4 aHaloStyle; // role RGB, mode
attribute float aHaloRole;
attribute float aHaloPart;
uniform float uNoteTime;
uniform float uNoteSpeed;
uniform float uNoteApproach;
uniform float uNoteSize;
uniform float uNoteSpawnFade;
uniform float uTrackForward;
uniform float uSpin;
uniform float uPulse;
varying vec3 vColor;
varying vec2 vLocal;
varying float vRole;
varying float vPart;
void main() {
    bool burst = aHaloStyle.w > 0.5 && aHaloStyle.w < 1.5;
    float at = burst ? aHaloBase.w : uNoteTime;
    vec3 centre = vec3(aHaloBase.xy, (at - aHaloBase.z) * uNoteSpeed);
    centre.xy += xrTrackPathOffset(centre.z - uTrackForward);
    float ahead = aHaloBase.z - uNoteTime;
    float emerge = uNoteSpawnFade > 0.0 ? clamp((uNoteApproach - ahead) * uNoteSpeed / uNoteSpawnFade, 0.0, 1.0) : 1.0;
    float age = burst ? max(0.0, uNoteTime - aHaloBase.w) : 0.0;
    float scale = burst ? 1.0 + age * 4.5 : (0.7 + 0.3 * emerge) * uPulse;
    float spin = burst || aHaloRole > 0.5 ? 0.0 : uSpin;
    vLocal = position.xy; vRole = aHaloRole; vPart = aHaloPart;
    vec3 local = position * scale * uNoteSize;
    local.xy = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * local.xy;
    float strength = burst ? 1.8 * (1.0 - clamp(age / ${Pv.toFixed(2)}, 0.0, 1.0)) : aHaloStyle.w > 1.5 ? 0.2 : 0.25 + 0.75 * emerge;
    vColor = aHaloStyle.rgb * strength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(centre + local + vec3(0.0, 0.0, 0.004), 1.0);
}`,Vv=`
varying vec3 vColor;
varying vec2 vLocal;
varying float vRole;
varying float vPart;
void main() {
    // Outer silhouettes alone carry meaning: the hand colour/cut glyph stays untouched.
    if (vRole > 0.5 && vRole < 1.5 && (vPart > 0.5 || abs(vLocal.x) < 0.36)) discard;
    if (vRole > 1.5 && vRole < 2.5 && (vPart > 0.5 || min(abs(vLocal.x), abs(vLocal.y)) < 0.21)) discard;
    gl_FragColor = vec4(vColor, 1.0);
    #include <colorspace_fragment>
}`;function Hv(){let e=new Bo(.66,.72,40),t=[e.toNonIndexed()];e.dispose();for(let e=0;e<4;e++){let n=new zo(.035,.16).translate(0,.83,0).rotateZ(e*Math.PI/2);t.push(n.toNonIndexed()),n.dispose()}let n=new Float32Array(t.reduce((e,t)=>e+t.getAttribute(`position`).count*3,0)),r=new Float32Array(n.length/3),i=0;for(let e of t){let t=e.getAttribute(`position`).array;i>0&&r.fill(1,i/3,(i+t.length)/3),n.set(t,i),i+=t.length,e.dispose()}let a=new hi;return a.setAttribute(`position`,new ei(n,3)),a.setAttribute(`aHaloPart`,new ei(r,1)),a.computeBoundingSphere(),a}var Uv=class{mesh;uniforms={uNoteTime:{value:0},uNoteSpeed:{value:Dd.noteSpeedMps},uNoteApproach:{value:Dd.approachTimeSec},uNoteSize:{value:Dd.noteSizeMeters},uNoteSpawnFade:{value:0},uTrackBend:{value:im(new Pn)},uTrackForward:{value:0},uSpin:{value:0},uPulse:{value:1}};writes=0;overflow=0;roles=new Map;resolved=new Set;bursts=Array.from({length:16},()=>({note:null,time:0}));selected=Array(16).fill(null);modes=new Int8Array(16);times=new Float64Array(16);writtenIds=[];writtenModes=[];writtenTimes=[];base;style;glyph;position={x:0,y:0,z:0};slotCount=-1;epoch=0;writtenConfig=null;writtenPath;pathRevision=-1;disposed=!1;constructor(){let e=Hv();this.base=new Gi(new Float32Array(64),4).setUsage(Ot),this.style=new Gi(new Float32Array(64),4).setUsage(Ot),this.glyph=new Gi(new Float32Array(16),1).setUsage(Ot),e.setAttribute(`aHaloBase`,this.base),e.setAttribute(`aHaloStyle`,this.style),e.setAttribute(`aHaloRole`,this.glyph);let t=new Zo({uniforms:this.uniforms,vertexShader:Bv,fragmentShader:Vv,transparent:!0,depthWrite:!1,blending:2,side:2,toneMapped:!1});this.mesh=new $i(e,t,16),this.mesh.count=0,this.mesh.frustumCulled=!1,this.mesh.name=`xr-note-halos`}setPlan(e){if(!this.disposed){if(this.roles.clear(),e?.version===1){for(let t of e.roles)if(typeof t.noteId==`string`&&!this.roles.has(t.noteId)&&Ap.includes(t.role)&&this.roles.set(t.noteId,t.role),this.roles.size>=1024)break}this.reset()}}roleOf(e){return this.roles.get(e)??null}reset(){this.resolved.clear();for(let e of this.bursts)e.note=null;this.selected.fill(null),this.slotCount=-1,this.mesh.count=0,this.overflow=0}onNoteResolved(e,t,n,r){if(this.disposed||!this.roles.has(e.id)||this.resolved.has(e.id)||!Number.isFinite(n)||(this.resolved.add(e.id),r||t===null))return;let i=this.bursts[0];for(let e of this.bursts){if(!e.note||n-e.time>=.45){i=e;break}e.time<i.time&&(i=e)}i.note=e,i.time=n}setSpawnFade(e){this.uniforms.uNoteSpawnFade.value=Number.isFinite(e)&&e>0?e:0}update(e,t,n=Dd,r){if(this.disposed||!this.roles.size||!Number.isFinite(t))return;let i=0,a=0,o=(e,t,n)=>{a++,!(i>=16)&&(this.selected[i]=e,this.modes[i]=t,this.times[i]=n,i++)};for(let e of this.bursts)if(e.note){let n=t-e.time;if(n>=.45||n<0){e.note=null;continue}o(e.note,Rv,e.time)}for(let r=3;r>=0;r--)for(let i of e){let e=this.roles.get(i.note.id);!e||Iv[e]!==r||i.status===`hit`||i.status===`missed`&&t-(i.resolvedAt??i.note.time)>n.resolvedNoteLifetimeSec||o(i.note,i.status===`missed`?zv:Lv,i.resolvedAt??i.note.time)}this.overflow=Math.max(0,a-16);let s=i!==this.slotCount||n!==this.writtenConfig||r!==this.writtenPath;for(let e=0;e<i;e++)(this.writtenIds[e]!==this.selected[e].id||this.writtenModes[e]!==this.modes[e]||this.writtenTimes[e]!==this.times[e])&&(s=!0);s&&this.write(i,t,n,r),r&&r.revision!==this.pathRevision&&(this.pathRevision=r.revision,r.writeBendUniform(this.uniforms.uTrackBend.value),this.uniforms.uTrackForward.value=r.playfieldForwardMeters);let c=this.uniforms;c.uNoteTime.value=t-this.epoch,c.uNoteSpeed.value=n.noteSpeedMps,c.uNoteApproach.value=n.approachTimeSec,c.uNoteSize.value=n.noteSizeMeters,c.uSpin.value=t*1.4%(Math.PI*2),c.uPulse.value=1+.05*Math.sin(t*9)}dispose(){this.disposed||(this.disposed=!0,this.reset(),this.roles.clear(),this.mesh.removeFromParent(),this.mesh.dispose(),this.mesh.geometry.dispose(),this.mesh.material.dispose())}write(e,t,n,r){this.writes++,this.epoch=t,this.slotCount=e,this.writtenConfig=n,r!==this.writtenPath&&(this.writtenPath=r,this.pathRevision=-1,r||(im(this.uniforms.uTrackBend.value),this.uniforms.uTrackForward.value=0));let i=this.base.array,a=this.style.array;for(let t=0;t<e;t++){let e=this.selected[t],r=Fv[this.roles.get(e.id)],o=t*4;Gf(e,e.time,this.position,n),i[o]=this.position.x,i[o+1]=this.position.y,i[o+2]=e.time-this.epoch,i[o+3]=this.times[t]-this.epoch,a[o]=r.r,a[o+1]=r.g,a[o+2]=r.b,a[o+3]=this.modes[t],this.glyph.setX(t,Iv[this.roles.get(e.id)]),this.writtenIds[t]=e.id,this.writtenModes[t]=this.modes[t],this.writtenTimes[t]=this.times[t]}this.mesh.count=e,Gp([this.base,this.style,this.glyph],e)}},Wv=.22,Gv=2048,Kv=64,qv=8,Jv=512;function Yv(e){let t=e.replace(/[\u0000-\u001f\u007f]/g,` `).trim(),n=Array.from(t);return n.length>256?n.slice(0,255).join(``)+`…`:t}var Xv=class{mesh;texture=null;title=``;mode=`scroll`;dirty=!1;disposed=!1;period=Jv;atlasHeight=Kv;uploads=0;doc;constructor(e=document){this.doc=e;let t=new Zo({uniforms:{uAtlas:{value:null},uHeight:{value:Kv},uPeriod:{value:Jv},uOffset:{value:0},uInk:{value:new Y(Wm)}},vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;
                varying vec2 vUv; uniform sampler2D uAtlas; uniform float uHeight,uPeriod,uOffset; uniform vec3 uInk;
                void main(){
                    float sourceX=vUv.x*512.+uOffset;
                    float pixel=mod(sourceX,uPeriod);
                    float row=floor(pixel/2048.);
                    vec2 atlasUv=vec2(mod(pixel,2048.)/2048.,1.-(row*64.+(1.-vUv.y)*64.)/uHeight);
                    // Derive LOD from continuous coordinates, never from a wrapped row/period.
                    vec2 dx=vec2(dFdx(sourceX)/2048.,dFdx(vUv.y)*64./uHeight);
                    vec2 dy=vec2(dFdy(sourceX)/2048.,dFdy(vUv.y)*64./uHeight);
                    float alpha=textureGrad(uAtlas,atlasUv,dx,dy).a;
                    gl_FragColor=vec4(uInk,alpha);
                    #include <colorspace_fragment>
                }`,transparent:!0,depthTest:!0,depthWrite:!1,toneMapped:!1});this.mesh=new X(new zo(2,Wv),t),this.mesh.name=`cockpit-filename-marquee`,this.mesh.visible=!1}get text(){return this.title}get uploadCount(){return this.uploads}get atlasBytes(){return this.texture?Gv*this.atlasHeight*4:0}setTitle(e){if(this.disposed)return;let t=Yv(e);t!==this.title&&(this.title=t,this.dirty=!0,this.refresh())}setMode(e){this.disposed||(this.mode=e,this.refresh(),e!==`scroll`&&(this.mesh.material.uniforms.uOffset.value=0))}update(e){this.disposed||!this.mesh.visible||(this.mesh.material.uniforms.uOffset.value=this.mode===`scroll`&&Number.isFinite(e)?Math.max(0,e)*32%this.period:0)}refresh(){if(this.mesh.visible=this.mode!==`off`&&this.title.length>0,!this.mesh.visible||!this.dirty)return;let e=this.doc.createElement(`canvas`);e.width=Gv,e.height=Kv;let t=e.getContext(`2d`);if(!t){this.mesh.visible=!1;return}let n=`700 32px ${Um}`;t.font=n;let r=t.measureText(this.title).width,i=Number.isFinite(r)?Math.max(0,Math.min(Gv*qv-Jv,r)):0;this.period=Math.max(Jv,Math.ceil(i)+Jv*.5);let a=Math.max(1,Math.ceil(this.period/Gv));this.atlasHeight=Kv*2**Math.ceil(Math.log2(a)),e.height=this.atlasHeight,t.font=n,t.fillStyle=`#ffffff`,t.textBaseline=`middle`;for(let e=0;e<a;e++)t.save(),t.beginPath(),t.rect(0,e*Kv,Gv,Kv),t.clip(),t.fillText(this.title,12-e*Gv,e*Kv+Kv/2),t.restore();let o=new fa(e);o.colorSpace=``,o.generateMipmaps=!0,o.minFilter=de,o.magFilter=z,o.anisotropy=8,this.texture?.dispose(),this.texture=o;let s=this.mesh.material.uniforms;s.uAtlas.value=o,s.uHeight.value=this.atlasHeight,s.uPeriod.value=this.period,s.uOffset.value=0,this.uploads++,this.dirty=!1}dispose(){this.disposed||(this.disposed=!0,this.mesh.visible=!1,this.texture?.dispose(),this.texture=null,this.mesh.geometry.dispose(),this.mesh.material.dispose())}},Zv=new q(.16,.5,.85).normalize();function Qv(e,t=.22,n=3){if(e.length<3)return[...e];if(new q(...e[0]).distanceToSquared(new q(...e.at(-1)))<1e-12){let r=e.slice(0,-1),i=[];for(let e=0;e<r.length;e++){let a=Qv([r[(e+r.length-1)%r.length],r[e],r[(e+1)%r.length]],t,n);i.push(...a.slice(1,-1))}return i.push(i[0]),i}let r=[e[0]];for(let i=1;i<e.length-1;i++){let a=new q(...e[i-1]),o=new q(...e[i]),s=new q(...e[i+1]),c=o.clone().sub(a),l=s.clone().sub(o),u=Math.min(t,c.length()*.32,l.length()*.32);if(u<=1e-6||c.clone().normalize().dot(l.clone().normalize())>.9999){r.push(e[i]);continue}let d=o.clone().addScaledVector(c.normalize(),-u),f=o.clone().addScaledVector(l.normalize(),u);r.push([d.x,d.y,d.z]);for(let e=1;e<=n;e++){let t=e/n,i=1-t;r.push([i*i*d.x+2*i*t*o.x+t*t*f.x,i*i*d.y+2*i*t*o.y+t*t*f.y,i*i*d.z+2*i*t*o.z+t*t*f.z])}}return r.push(e.at(-1)),r}function $v(e,t,n,r,i,a){let o=n.p.map((e,n)=>e-t.p[n]),s=r.p.map((e,n)=>e-t.p[n]);[o[1]*s[2]-o[2]*s[1],o[2]*s[0]-o[0]*s[2],o[0]*s[1]-o[1]*s[0]].reduce((e,i,a)=>e+i*(t.n[a]+n.n[a]+r.n[a]),0)<0&&([n,r]=[r,n]);for(let o of[t,n,r]){e.positions.push(...o.p);let t=(a?.43+.57*Math.max(0,o.n[0]*Zv.x+o.n[1]*Zv.y+o.n[2]*Zv.z):1)*(o.gain??1);e.colors.push(i.r*t,i.g*t,i.b*t)}}function ey(e,t,n,r,i,a=!0,o=.22,s=3,c={}){let l=c.tangents?[...t]:Qv(t,o,s),u=new q(...l[0]).distanceToSquared(new q(...l.at(-1)))<1e-12,d=l.length-1,f=l.map((e,t)=>{if(c.tangents)return new q(...c.tangents[t]).normalize();let n=new q(...l[u?(t+d-1)%d:Math.max(0,t-1)]);return new q(...l[u?(t+1)%d:Math.min(d,t+1)]).sub(n).normalize()}),p=Math.abs(f[0].z)<.95?new q(0,0,1):new q(0,1,0),m=[new q().crossVectors(f[0],p).normalize()];for(let e=1;e<l.length;e++)m.push(m[e-1].clone().applyQuaternion(new gn().setFromUnitVectors(f[e-1],f[e])));if(u){let e=Math.atan2(new q().crossVectors(m[d],m[0]).dot(f[0]),m[d].dot(m[0]));for(let t=1;t<=d;t++)m[t].applyAxisAngle(f[t],e*t/d);m[d].copy(m[0])}let h=a?2:1,g=[];for(let e=0;e<l.length;e++){let t=(c.widthAt?.(l[e])??n)/2,i=(c.depthAt?.(l[e])??r)/2,a=Math.min(c.edgeRadius??.026,t*.48,i*.48),o=[[t-a,i-a],[-t+a,i-a],[-t+a,-i+a],[t-a,-i+a]],s=[];for(let e=0;e<4;e++)for(let t=0;t<=h;t++){let n=e*Math.PI/2+t*Math.PI/(2*h),r=Math.cos(n),i=Math.sin(n);s.push({u:o[e][0]+a*r,v:o[e][1]+a*i,nu:r,nv:i})}let u=m[e],d=new q().crossVectors(u,f[e]).normalize(),p=typeof c.normalOffset==`function`?c.normalOffset(l[e]):c.normalOffset??0;g.push(s.map(t=>({p:[l[e][0]+u.x*t.u+d.x*(t.v+p),l[e][1]+u.y*t.u+d.y*(t.v+p),l[e][2]+u.z*t.u+d.z*(t.v+p)],n:[u.x*t.nu+d.x*t.nv,u.y*t.nu+d.y*t.nv,u.z*t.nu+d.z*t.nv],gain:c.gainAt?.(l[e])})))}let _=g[0].length;for(let t=1;t<g.length;t++)for(let n=0;n<_;n++){let r=(n+1)%_;$v(e,g[t-1][n],g[t][n],g[t][r],i,a),$v(e,g[t-1][n],g[t][r],g[t-1][r],i,a)}for(let t of u?[]:[0,g.length-1]){let n=t===0?-1:1,r=f[t].toArray().map(e=>e*n),o=g[t][0].gain,s={p:[0,1,2].map(e=>g[t].reduce((t,n)=>t+n.p[e],0)/_),n:r,gain:o};for(let n=0;n<_;n++)$v(e,s,{p:g[t][n].p,n:r,gain:o},{p:g[t][(n+1)%_].p,n:r,gain:o},i,a)}}function ty(e,t,n,r,i,a=.06,o=.018){let s=new Xa;t.forEach((e,n)=>{let r=new K(...t[(n+t.length-1)%t.length]),i=new K(...t[(n+1)%t.length]),o=new K(...e),c=o.clone().sub(r),l=i.sub(o),u=Math.min(a,c.length()*.3,l.length()*.3),d=o.clone().addScaledVector(c.normalize(),-u),f=o.clone().addScaledVector(l.normalize(),u);n===0?s.moveTo(d.x,d.y):s.lineTo(d.x,d.y),s.quadraticCurveTo(o.x,o.y,f.x,f.y)}),s.closePath();let c=new Fo(s,{depth:r,steps:1,bevelEnabled:!0,bevelSize:o,bevelThickness:o,bevelSegments:2,curveSegments:3}),l=c.getAttribute(`position`),u=c.getAttribute(`normal`);for(let t=0;t<l.count;t+=3){let r=e=>({p:[l.getX(e),l.getY(e),l.getZ(e)+n],n:[u.getX(e),u.getY(e),u.getZ(e)]});$v(e,r(t),r(t+1),r(t+2),i,!0)}c.dispose()}var ny=.245,ry=.55;function iy(e,t,n){let r=Number.isFinite(n)?Math.max(.8,Math.min(2.5,n)):$.defaultEyeHeightMeters,i=Math.max(.7,r-$.hitHeightBelowEyesMeters),a=Math.max(r+1.3,i+t.frameCenterYMeters+t.frameHalfHeightMeters+.7);return{halfWidth:Math.max(2.7,$.runwayWidthMeters/2+e.noteSizeMeters+.7),top:a,bottom:.04,z:-Math.max(2.4,t.playfieldForwardMeters+1.1),floorGap:$.runwayWidthMeters/2+e.noteSizeMeters+.12}}function ay(e,t){return{points:[e],tangents:[new q(...t).normalize().toArray()]}}function oy(e,t,n=1){let r=new q(...e.points.at(-1)),i=new q(...t),a=i.clone().sub(r).normalize().toArray();for(let t=1;t<=n;t++)e.points.push(r.clone().lerp(i,t/n).toArray()),e.tangents.push(a)}function sy(e,t){let n=e.map(e=>e.clone());for(let e=n.length-1;e>0;e--)for(let r=0;r<e;r++)n[r].lerp(n[r+1],t);return n[0]}var cy=Math.PI/30;function ly(e,t,n){let r=new q(...e.points.at(-1)),i=new q(...t),a=new q(...e.tangents.at(-1)).normalize(),o=new q(...n).normalize(),s=r.distanceTo(i)*.22,c=[r,r.clone().addScaledVector(a,s),r.clone().addScaledVector(a,2*s),i.clone().addScaledVector(o,-2*s),i.clone().addScaledVector(o,-s),i],l=c.slice(1).map((e,t)=>e.clone().sub(c[t]).multiplyScalar(5)),u=e=>e===1?i.clone():sy(c,e),d=e=>e===1?o.clone():sy(l,e).normalize(),f=(e,t,n)=>{let r=n.clone().sub(t),i=hn.clamp(e.clone().sub(t).dot(r)/Math.max(1e-12,r.lengthSq()),0,1);return e.distanceTo(t.clone().addScaledVector(r,i))},p=(t,n,r,i,a,o,s)=>{let c=(t+n)/2,l=u(c),m=d(c),h=Math.max(f(l,r,i),f(u((t+c)/2),r,i),f(u((c+n)/2),r,i)),g=Math.max(a.angleTo(o),a.angleTo(m),m.angleTo(o));s<8&&(h>.0015||g>cy)?(p(t,c,r,l,a,m,s+1),p(c,n,l,i,m,o,s+1)):(e.points.push(i.toArray()),e.tangents.push(o.toArray()))};p(0,1,r,i,a,o,0)}function uy(e){let t=e.halfWidth,n=e.top,r=e.z,i=ay([0,n-.08,r],[-1,0,0]);oy(i,[-1.08,n-.08,r]),ly(i,[-1.92,n+.06,r],[-1,0,0]);let a=[-t,n-.7,r],o=[-t-.16,.7,r];ly(i,a,new q(...o).sub(new q(...a)).normalize().toArray()),oy(i,o),ly(i,[-1.96,-.25,r-.6],[1,0,-.18]),ly(i,[0,-.3,r-.92],[1,0,0]);let s=i.points.slice(0,-1).reverse().map(e=>[-e[0],e[1],e[2]]),c=i.tangents.slice(0,-1).reverse().map(e=>[e[0],-e[1],-e[2]]),l=[...i.points,...s],u=[...i.tangents,...c];return l[l.length-1]=l[0],u[u.length-1]=u[0],{points:l,tangents:u}}function dy(e,t){let n=new q(t*.16,.7-(e.top-.7),0).normalize().toArray(),r=ay([t*(e.halfWidth+.16),.7,e.z-.1],n);return ly(r,[t*(e.floorGap+.16),-.18,e.z+1.35],[0,0,1]),oy(r,[t*(e.floorGap+.16),-.18,1.8],5),r}var fy=class{root=new pr;title;body;trim;reduced=[];full=[];mode=`full`;layoutKey=``;disposed=!1;constructor(e=document){this.root.name=`xr-cockpit-v1`,this.body=new X(new hi,new Ai({vertexColors:!0,toneMapped:!1})),this.trim=new X(new hi,new Ai({vertexColors:!0,toneMapped:!1})),this.title=new Xv(e),this.root.add(this.body,this.trim,this.title.mesh)}setSettings(e,t){this.disposed||(this.mode=e,this.root.visible=e!==`off`,this.title.setMode(e===`off`?`off`:t),this.selectGeometry())}setTitle(e){this.disposed||this.title.setTitle(e)}setViewOrigin(e){!this.disposed&&Number.isFinite(e)&&(this.root.position.z=Math.max(0,Math.min(3,e)))}update(e){this.root.visible&&!this.disposed&&this.title.update(e)}fit(e,t,n){if(this.disposed)return;let r=iy(e,t,n),i=JSON.stringify(r);if(i!==this.layoutKey){this.layoutKey=i;for(let e of new Set([this.body.geometry,this.trim.geometry,...this.reduced,...this.full]))e.dispose();this.reduced=this.build(r,!1),this.full=this.build(r,!0),this.selectGeometry(),this.title.mesh.position.set(0,r.top+.075-ny,r.z+ry)}}selectGeometry(){let e=this.mode===`reduced`?this.reduced:this.full;e.length&&(this.body.geometry=e[0],this.trim.geometry=e[1])}build(e,t){let n={positions:[],colors:[]},r={positions:[],colors:[]},i=new Y(5232895),a=new Y(16736180),o=new Y(15661311),s=new Y(1516084),c=new Y(2504011),l=(e,t,r,i,a,o)=>ey(e,[t,r],i,a,o,e===n),u=uy(e),d=u.points;ey(n,d,.38,t?.28:.24,c,!0,.52,3,{edgeRadius:.06,widthAt:e=>.2+(t?.18:.14)*hn.smootherstep(e[1],-.24,.5),tangents:u.tangents});let f=r.positions.length;ey(r,d,.018,.012,o,!1,.52,2,{normalOffset:t?.16:.14,tangents:u.tangents});for(let e=f;e<r.positions.length;e+=3){let t=r.positions[e],n=t<-.18?i:t>.18?a:o;r.colors[e]=n.r,r.colors[e+1]=n.g,r.colors[e+2]=n.b}let p=e.z+.2;ty(n,[[-1.45,e.top+.12],[1.45,e.top+.12],[1.28,e.top-.36],[-1.28,e.top-.36]],p-.03,.26,s,.11,.022);let m=e.top-.17;ty(n,[[-1.18,m+.17],[1.18,m+.17],[1.22,m+.12],[1.22,m-.12],[1.16,m-.18],[-1.16,m-.18],[-1.22,m-.12],[-1.22,m+.12]],p+.26,.01,new Y(331036),.035,.004),ey(r,[[0,m+.18,p+.28],[1.15,m+.18,p+.28],[1.24,m+.1,p+.28],[1.24,m-.11,p+.28],[1.15,m-.2,p+.28],[-1.15,m-.2,p+.28],[-1.24,m-.11,p+.28],[-1.24,m+.1,p+.28],[-1.15,m+.18,p+.28],[0,m+.18,p+.28]],.012,.018,new Y(5268092),!1,.035,2);for(let t of[-1,1]){let n=t<0?i:a;for(let e of[-1,1])ey(r,[[t*.98,m+e*.146,p+.29],[t*1.11,m+e*.146,p+.29],[t*1.14,m+e*.115,p+.29],[t*1.14,m+e*.07,p+.29]],.012,.012,n,!1,.018,1);l(r,[t*.35,e.top-.377,p+.28],[t*.83,e.top-.377,p+.28],.012,.012,n)}if(l(r,[-.09,e.top-.377,p+.28],[.09,e.top-.377,p+.28],.009,.012,o),t)for(let t of[-1,1]){let o=t<0?i:a,c=dy(e,t),l=e=>1-.98*hn.smootherstep(e[2],.9,1.8);ey(n,c.points,.42,.18,s,!0,.44,3,{edgeRadius:.045,widthAt:t=>(.07+.35*hn.smootherstep(t[2],e.z-.1,e.z+.9))*l(t),depthAt:e=>.18*l(e),tangents:c.tangents});let u=t=>hn.smootherstep(t[2],e.z+.2,e.z+1);ey(r,c.points,.015,.012,o,!1,.44,3,{normalOffset:e=>.106*l(e),widthAt:e=>.015*l(e)*(.02+.98*u(e)),gainAt:u,depthAt:e=>.012*l(e),tangents:c.tangents})}return[n,r].map(e=>{let t=new hi;return t.setAttribute(`position`,new ri(e.positions,3)),t.setAttribute(`color`,new ri(e.colors,3)),t.computeBoundingBox(),t.computeBoundingSphere(),t})}dispose(){if(!this.disposed){this.disposed=!0,this.root.visible=!1;for(let e of new Set([this.body.geometry,this.trim.geometry,...this.reduced,...this.full]))e.dispose();this.body.material.dispose(),this.trim.material.dispose(),this.title.dispose(),this.root.removeFromParent()}}},py=Object.freeze({intensity:1,motion:1,depth:.3,detail:1}),my=Object.freeze({...re(),wormholeNebulaAmount:.3,wormholeNebulaDetail:1,wormholeNebulaBloom:1,wormholeNebulaWeave:1,wormholeSpiral:.3,wormholeSpiralArms:1,wormholeGrainDensity:1,postFxFragmentAmount:0,postFxFragmentDisplacement:0,postFxFragmentDensity:0,lineAlpha:1,lineWeight:.3,wormholeGrainShape:1}),hy=[`amount`,`fringe`,`caustics`,`waves`,`cracks`],gy=Object.freeze({mode:`off`,material:`preset`,amount:.5,fringe:.5,caustics:.5,waves:.5,cracks:.5}),_y=Object.freeze({amount:`wormholeNebulaAmount`,detail:`wormholeNebulaDetail`,bloom:`wormholeNebulaBloom`,weave:`wormholeNebulaWeave`,spiral:`wormholeSpiral`,arms:`wormholeSpiralArms`,density:`wormholeGrainDensity`});function vy(e){let t={};for(let[n,r]of Object.entries(_y))t[r]=e[n];return t}var yy=1.5,by=[`performance`,`balanced`,`high`,`ultra`,`crystal`,`max`,`4k`],xy=[24,36],Sy=[40,100,200,500],Cy=[`off`,`particles`,`full`],wy={performance:{width:640,height:360},balanced:{width:768,height:432},high:{width:960,height:540},ultra:{width:1280,height:720},crystal:{width:1920,height:1080},max:{width:2560,height:1440},"4k":{width:3840,height:2160}},Ty=new Set([`max`,`4k`]),Ey=Object.freeze({presentationMode:`hybrid`,wormhole:!0,quality:`max`,rateHz:36,distanceMeters:200,spatialField:`particles`,lineStroke:my.lineWeight,sharpness:1,character:Object.freeze({intensity:py.intensity,motion:py.motion,depth:py.depth,detail:py.detail}),grain:Object.freeze(Object.fromEntries(Object.entries(_y).map(([e,t])=>[e,my[t]]))),cosmos:Object.freeze({stars:1,galaxies:0,sky:0}),wall:gy});function Dy(e){let t=Ey,n=Number(e?.lineStroke),r=Number(e?.sharpness),i=(e,t)=>{let n=Number(e);return e!=null&&Number.isFinite(n)?Math.min(1,Math.max(0,n)):t},a=e?.character&&typeof e.character==`object`?e.character:void 0,o=e?.grain&&typeof e.grain==`object`?e.grain:void 0,s=e?.cosmos&&typeof e.cosmos==`object`?e.cosmos:void 0,c=e?.wall&&typeof e.wall==`object`?e.wall:void 0,l=(e,t,n=1)=>e==null||!Number.isFinite(Number(e))?n:Math.max(0,Math.min(t,Number(e)));return{presentationMode:e?.presentationMode===`native-grains`?`native-grains`:`hybrid`,wormhole:typeof e?.wormhole==`boolean`?e.wormhole:t.wormhole,quality:e?.quality&&by.includes(e.quality)?e.quality:t.quality,rateHz:e?.rateHz&&xy.includes(e.rateHz)?e.rateHz:t.rateHz,distanceMeters:e?.distanceMeters&&Sy.includes(e.distanceMeters)?e.distanceMeters:t.distanceMeters,spatialField:e?.spatialField&&Cy.includes(e.spatialField)?e.spatialField:t.spatialField,lineStroke:Number.isFinite(n)?Math.min(1,Math.max(0,n)):t.lineStroke,sharpness:e?.sharpness!==void 0&&Number.isFinite(r)?Math.min(1,Math.max(0,r)):t.sharpness,character:{intensity:i(a?.intensity,t.character.intensity),motion:i(a?.motion,t.character.motion),depth:i(a?.depth,t.character.depth),detail:i(a?.detail,t.character.detail)},grain:Object.fromEntries(Object.keys(_y).map(e=>[e,i(o?.[e],t.grain[e])])),cosmos:{stars:l(s?.stars,2,t.cosmos.stars),galaxies:l(s?.galaxies,2,t.cosmos.galaxies),sky:l(s?.sky,1,t.cosmos.sky)},wall:{mode:c?.mode===`preset`||c?.mode===`on`?c.mode:`off`,material:c?.material===`membrane`||c?.material===`mosaic`?c.material:`preset`,...Object.fromEntries(hy.map(e=>[e,i(c?.[e],.5)]))}}}function Oy(e,t){return!(e>0)||!(t>0)?1:Math.max(1,Math.ceil(e/t-1e-6))}var ky=60,Ay={x:-(qp+.75),yAboveFrameCenter:.05,z:-1,yaw:.55,scale:.72},jy=class{root=new pr;playfield=new pr;noteField;hud;runway;path=new lm;sectionCallout;songMap;progressRing;sectionGates;sliceEffect;noteHalos=new Uv;cockpit=new fy;resolutionObserver=Object.freeze({onRunReset:()=>this.noteHalos.reset(),onNoteResolved:(e,t,n,r)=>this.noteHalos.onNoteResolved(e,t,n,r)});spatialField=new O_;config;lights=new pr;wormhole=null;nativeWormholeFactory;nativeFallback=!1;disposed=!1;get nativeWormholeActive(){return this.wormhole instanceof kg}get nativeExecutionLabel(){return this.wormhole instanceof kg?this.wormhole.executionLabel:``}focusX=new Ng;focusY=new Ng;wormholeAnalysis=null;wormholeDirty=!0;wormholeFactory;background=Ey;spiralDirection=`auto`;onBackgroundFrame=null;onBackgroundError=null;displayHz=ky;gpuMaterial=!1;gpuLines=!1;softwareRaster=!1;webglRaster=!1;adaptivePacing=!1;profile=!1;lastNoteTime=NaN;lastNoteRevision=-1;lastNoteState=``;lastNoteScore=-1;lastNoteMisses=-1;lastNoteTotal=-1;eyeHeight=$.defaultEyeHeightMeters;layout=Jp;runwaySpacing;viewer={x:0,z:0,yaw:0};constructor(e,t=Dd,n,r){this.nativeWormholeFactory=r,this.wormholeFactory=n,this.config=t,this.noteField=new Hm(t),this.hud=new eh,this.runway=new fh(t),this.runwaySpacing=t.rowSpacingMeters,this.root.add(this.runway.floor,this.runway.linework),this.playfield.add(this.runway.gate),this.sectionCallout=new jh,this.playfield.add(this.sectionCallout.root),this.songMap=new Q_,this.playfield.add(this.songMap.root),this.progressRing=new nv,this.root.add(this.progressRing.mesh),this.sectionGates=new gv,this.playfield.add(this.sectionGates.root),this.playfield.add(this.noteField.mesh,this.noteField.markers,this.noteField.arrows,this.hud.mesh),this.sliceEffect=new Nv(t.noteSizeMeters),this.playfield.add(this.sliceEffect.halves,this.sliceEffect.sparks),this.playfield.add(this.noteHalos.mesh),this.root.add(this.playfield),this.root.add(this.spatialField.root),this.root.add(this.cockpit.root),this.lights.add(new ws(12902399,1582137,2.2));let i=new zs(16777215,2);i.position.set(1,3,1),this.lights.add(i),e.add(this.root,this.lights),this.path.setBackdropDistance(this.background.distanceMeters),this.spatialField.setMode(this.background.spatialField),this.placeForViewer(0,$.defaultEyeHeightMeters,0,0)}placeForViewer(e,t,n,r){if(![e,t,n,r].every(Number.isFinite))return;this.viewer={x:e,z:n,yaw:r},this.root.position.set(e,0,n),this.root.rotation.y=r;let i=Math.max(.7,t-$.hitHeightBelowEyesMeters);if(this.playfield.position.set(0,i,-this.layout.playfieldForwardMeters),this.spatialField.setCenterHeight(i),this.layout.hudPlacement===`side`){let e=Ay;this.hud.setPose(e.x,this.layout.frameCenterYMeters+e.yAboveFrameCenter,e.z,e.yaw,e.scale)}else this.hud.setPose(0,t-i+1.15,-2.8);this.eyeHeight=t,this.cockpit.fit(this.config,this.layout,t),this.wormhole?.setEyeHeight(t),this.root.updateMatrixWorld(!0)}getWorldToPlayfield(e){return this.playfield.updateWorldMatrix(!0,!1),e.copy(this.playfield.matrixWorld).invert()}update(e,t,n,r){this.cockpit.update(t),this.wormhole?.root.visible&&this.wormhole.update(t,n.state===`playing`);let i=this.wormhole?.focalPoint,a=this.wormhole?.spatialFrame??null;i&&a?this.path.setFocus(this.focusX.sample(t,a.time,i.x),this.focusY.sample(t,a.time,i.y)):(this.focusX.reset(),this.focusY.reset(),this.path.setFocus(i?i.x:0,i?i.y:0)),this.spatialField.update(t,a,this.path),this.runway.update(t),this.runway.applyPath(this.path),this.sectionCallout.update(t),this.songMap.update(t,n),this.sectionGates.update(t,this.config,this.path),this.progressRing.update(t,n),(t!==this.lastNoteTime||this.path.revision!==this.lastNoteRevision||n.state!==this.lastNoteState||n.score!==this.lastNoteScore||n.missCount!==this.lastNoteMisses||n.totalNotes!==this.lastNoteTotal)&&(this.noteField.update(e,t,this.config,this.path),this.sliceEffect.update(e,t,this.config,this.path),this.lastNoteTime=t,this.lastNoteRevision=this.path.revision,this.lastNoteState=n.state,this.lastNoteScore=n.score,this.lastNoteMisses=n.missCount,this.lastNoteTotal=n.totalNotes),this.hud.update(n,r),this.noteHalos.update(e,t,this.config,this.path)}setNoteRolePlan(e){this.noteHalos.setPlan(e)}setCockpitSettings(e,t){this.cockpit.setSettings(e,t)}setTrackTitle(e){this.cockpit.setTitle(e)}setCockpitViewOrigin(e){this.cockpit.setViewOrigin(e)}prerender(e){this.wormhole?.root.visible&&this.wormhole.prerender(e)}setScoreOverview(e){this.songMap.setOverview(e),this.progressRing.setOverview(e),this.sectionGates.setOverview(e)}setNoteDesign(e){this.noteField.setDesign(e),this.sliceEffect.setDesign(e),this.lastNoteTime=NaN}setSectionTimeline(e){this.sectionCallout.setTimeline(e)}async setWormholeEnabled(e){if(!this.disposed){if(e&&!this.wormhole){if(this.background.presentationMode===`native-grains`&&!this.nativeFallback)if(this.nativeWormholeFactory)try{let e=this.nativeWormholeFactory();try{this.wormhole=new kg(e)}catch(t){throw e.dispose(),t}}catch{this.nativeFallback=!0}else this.nativeFallback=!0;if(!this.wormhole){if(!this.wormholeFactory)throw Error(`Wormhole renderer is unavailable.`);let e=this.gpuMaterial;this.wormhole=new ug(this.wormholeFactory({...wy[this.background.quality],...e?{externalMaterial:!0}:{},...e&&this.gpuLines?{externalLines:!0}:{},...this.profile?{profile:!0}:{},...this.softwareRaster?{softwareRaster:!0}:{},...this.webglRaster?{webglRaster:!0}:{}}),{gpuMaterial:e,gpuLines:e&&this.gpuLines,mipmaps:Ty.has(this.background.quality)})}this.spatialField.setMode(this.nativeWormholeActive?`off`:this.background.spatialField),this.wormhole.setAdaptivePacing(this.adaptivePacing),this.root.add(this.wormhole.root),this.wormhole.onFrameReady=()=>this.onBackgroundFrame?.(),this.wormhole.onError=e=>this.onBackgroundError?.(e),this.configureWormhole(),this.wormhole.setDistance(this.background.distanceMeters),this.wormhole.setEyeHeight(this.eyeHeight),this.root.updateMatrixWorld(!0)}if(this.wormhole&&(this.wormhole.root.visible=e),e&&this.wormholeDirty&&this.wormhole){this.wormholeDirty=!1;let e=this.wormhole;try{await e.prepare(this.wormholeAnalysis)}catch(t){if(this.disposed||e!==this.wormhole)return;if(this.wormholeDirty=!0,e instanceof kg){let t=e.root.visible;this.nativeFallback=!0,e.dispose(),this.wormhole=null,await this.setWormholeEnabled(t)}else throw t}}}}setStageLayout(e){let t=this.layout;this.layout=e,this.noteField.setSpawnFade(e.spawnFadeMeters),this.noteHalos.setSpawnFade(e.spawnFadeMeters),this.sectionGates.setSpawnFade(e.spawnFadeMeters),this.path.setLayout(e),this.sectionCallout.setFrame(e.frameCenterYMeters,e.frameHalfHeightMeters),this.sectionGates.setFrame(e.frameCenterYMeters,e.frameHalfHeightMeters),this.songMap.setFrameBottom(e.frameCenterYMeters-e.frameHalfHeightMeters),(e.playfieldForwardMeters!==t.playfieldForwardMeters||e.runwayFrontZMeters!==t.runwayFrontZMeters||e.rowCount!==t.rowCount||e.frameCenterYMeters!==t.frameCenterYMeters||e.frameHalfHeightMeters!==t.frameHalfHeightMeters)&&this.rebuildRunway(),this.placeForViewer(this.viewer.x,this.eyeHeight,this.viewer.z,this.viewer.yaw),this.lastNoteTime=NaN}rebuildRunway(){this.runway.dispose(),this.runway=new fh(this.config,this.layout),this.runwaySpacing=this.config.rowSpacingMeters,this.root.add(this.runway.floor,this.runway.linework),this.playfield.add(this.runway.gate),this.runway.applyPath(this.path)}get stageLayout(){return this.layout}setGameConfig(e){this.config=e,this.cockpit.fit(e,this.layout,this.eyeHeight),e.rowSpacingMeters!==this.runwaySpacing&&this.rebuildRunway(),this.runway.setScrollSpeed(e.noteSpeedMps),this.lastNoteTime=NaN}get backgroundRenderMs(){return this.wormhole?.lastRenderMs??0}get displayFrameRate(){return this.displayHz}get backgroundPacedHz(){return this.wormhole?this.displayHz/this.wormhole.redrawDivider:0}get backgroundLatencyMs(){return this.wormhole?.frameLatencyMs??0}async setBackgroundPipeline(e){let t=e.gpuLines===!0,n=e.softwareRaster===!0,r=e.webglRaster===!0;e.gpuMaterial===this.gpuMaterial&&e.profile===this.profile&&t===this.gpuLines&&n===this.softwareRaster&&r===this.webglRaster||(this.gpuMaterial=e.gpuMaterial,this.profile=e.profile,this.gpuLines=t,this.softwareRaster=n,this.webglRaster=r,await this.rebuildWormhole())}get gpuMaterialEnabled(){return this.gpuMaterial}get gpuLinesEnabled(){return this.gpuMaterial&&this.gpuLines}get softwareRasterEnabled(){return this.softwareRaster}get backgroundRasterLabel(){if(this.nativeWormholeActive)return`Native grains (no canvas)`;if(this.nativeFallback)return`Hybrid (native unavailable)`;let e=this.wormhole?.rasterKind??null;if(e===`webgl`)return`WebGL`;let t=this.softwareRaster?`CPU`:`GPU`;return this.webglRaster&&e===`canvas2d`?`${t} (no WebGL)`:this.webglRaster?`WebGL (starting)`:t}setAdaptivePacing(e){this.adaptivePacing=e===!0,this.wormhole?.setAdaptivePacing(this.adaptivePacing)}get backgroundFramesShown(){return this.wormhole?.framesShown??0}get backgroundAheadSamples(){return this.wormhole?.aheadSamples??null}get backgroundUploadedAhead(){return this.wormhole?.uploadedAhead??!1}get backgroundStageTimes(){return this.wormhole?.root.visible?this.wormhole.stageTimes:null}async setBackgroundSettings(e){let t=(e.presentationMode??`hybrid`)!==(this.background.presentationMode??`hybrid`),n=(e.quality!==this.background.quality||t)&&this.wormhole!==null;t&&(this.nativeFallback=!1),this.background=e,this.wormhole?.setDistance(e.distanceMeters),this.spatialField.setMode(e.presentationMode===`native-grains`&&!this.nativeFallback?`off`:e.spatialField),this.path.setBackdropDistance(e.distanceMeters)&&(this.runway.applyPath(this.path),this.lastNoteTime=NaN),this.root.updateMatrixWorld(!0),n?await this.rebuildWormhole():this.configureWormhole()}async rebuildWormhole(){if(!this.wormhole)return;let e=this.wormhole.root.visible;this.wormhole.dispose(),this.wormhole=null,this.wormholeDirty=!0,e&&await this.setWormholeEnabled(!0)}setDisplayFrameRate(e){this.displayHz=e&&Number.isFinite(e)&&e>0?e:ky,this.configureWormhole()}setSpiralDirection(e){let t=e===`left`||e===`right`?e:`auto`;t!==this.spiralDirection&&(this.spiralDirection=t,this.configureWormhole(!0))}configureWormhole(e=!1){this.wormhole instanceof kg&&this.wormhole.setQualityBudget({performance:360,balanced:720,high:1080,ultra:1440,crystal:1440,max:1440,"4k":1440}[this.background.quality]),this.wormhole?.setSharpness(this.background.sharpness*yy);let t=Oy(this.displayHz,this.background.rateHz);this.wormhole?.configure({lineStroke:this.background.lineStroke,maxFrameRateHz:this.displayHz/t,...e||this.spiralDirection!==`auto`?{spiralDirection:this.spiralDirection}:{},...this.background.character?{macros:this.background.character}:{},...this.background.grain?{grainMaterial:vy(this.background.grain)}:{},...this.background.cosmos?{cosmos:this.background.cosmos}:{},...this.background.wall?{wall:this.background.wall}:{}},t,this.displayHz)}async setWormholeAnalysis(e){this.wormholeAnalysis=e,this.wormholeDirty=!0,this.lastNoteTime=NaN,this.wormhole?.root.visible&&await this.setWormholeEnabled(!0)}dispose(){this.disposed||(this.disposed=!0,this.cockpit.dispose(),this.noteHalos.dispose(),this.wormhole?.dispose(),this.noteField.dispose(),this.hud.dispose(),this.runway.dispose(),this.sectionCallout.dispose(),this.songMap.dispose(),this.progressRing.dispose(),this.sectionGates.dispose(),this.sliceEffect.dispose(),this.spatialField.dispose(),this.playfield.remove(this.noteField.mesh,this.noteField.markers,this.noteField.arrows,this.hud.mesh),this.root.traverse(e=>{e instanceof $i&&e.dispose(),e instanceof X&&(e.geometry.dispose(),e.material.dispose())}),this.root.removeFromParent(),this.lights.removeFromParent())}},My=[`classic`,`shard`],Ny=[`off`,`phrase`,`music`],Py=[`auto`,`left`,`right`],Fy=Object.freeze({noteDesign:`shard`,noteHalos:`off`,spiralDirection:`auto`,cockpit:`off`,cockpitTitle:`scroll`});function Iy(e){let t=e?.noteDesign,n=e?.noteHalos;return{noteDesign:t&&My.includes(t)?t:Fy.noteDesign,noteHalos:n&&Ny.includes(n)?n:Fy.noteHalos,spiralDirection:e?.spiralDirection&&Py.includes(e.spiralDirection)?e.spiralDirection:Fy.spiralDirection,cockpit:e?.cockpit===`off`||e?.cockpit===`reduced`||e?.cockpit===`full`?e.cockpit:Fy.cockpit,cockpitTitle:e?.cockpitTitle===`off`||e?.cockpitTitle===`static`?e.cockpitTitle:`scroll`}}var Ly=[`normal`,`fast`,`hyper`],Ry=[`short`,`normal`,`long`,`auto`],zy=Object.freeze({noteSpeed:`hyper`,saberLength:`auto`}),By={normal:{speedMps:4,approachSec:2},fast:{speedMps:7,approachSec:1.6},hyper:{speedMps:10,approachSec:1.4}},Vy={short:.9,normal:1,long:1.1},Hy={standard:1,tall:1.1};function Uy(e,t){return e===`auto`?Hy[t]:Vy[e]}var Wy={standard:{rowCount:3,frameCenterYMeters:0,frameHalfHeightMeters:.6,hudPlacement:`above`},tall:{rowCount:4,frameCenterYMeters:.2,frameHalfHeightMeters:.86,hudPlacement:`side`}},Gy={shoulderOffsetMeters:-.08,armMeters:.62,leanMeters:.1,minHitPlaneMeters:.85,maxHitPlaneMeters:1.2,runwayMarginMeters:2.5,maxRunwayLengthMeters:18,spawnFadeMeters:1.5};function Ky(e){let t=zy;return{noteSpeed:e?.noteSpeed&&Ly.includes(e.noteSpeed)?e.noteSpeed:t.noteSpeed,saberLength:e?.saberLength&&Ry.includes(e.saberLength)?e.saberLength:t.saberLength}}function qy(e){return Gy.shoulderOffsetMeters+Gy.armMeters+Math.abs(Fp.bladeBaseZMeters)+e+Gy.leanMeters}var Jy=new Map;function Yy(e,t){let n=Ky(e),r=t!==void 0&&Wd.includes(t)?t:`standard`,i=`${n.noteSpeed}|${n.saberLength}|${r}`,a=Jy.get(i);if(a)return a;let{speedMps:o,approachSec:s}=By[n.noteSpeed],c=Uy(n.saberLength,r),l=Kd(Dd,r),u=qy(c),d=u+l.noteSizeMeters/2,f=Math.min(Gy.maxHitPlaneMeters,Math.max(Gy.minHitPlaneMeters,d-l.goodWindowSec*o)),p=Math.max(l.goodWindowSec,(d-f)/o),m=$.runwayTileLengthMeters,h=Math.min(Gy.maxRunwayLengthMeters,Math.ceil((f+o*s+Gy.runwayMarginMeters)/m-1e-9)*m),g=Object.freeze({settings:n,playSpace:r,config:Object.freeze({...l,noteSpeedMps:o,approachTimeSec:s,earlyGoodWindowSec:p}),stage:Object.freeze({playfieldForwardMeters:f,runwayFrontZMeters:-h,spawnFadeMeters:Gy.spawnFadeMeters,...Wy[r]}),bladeLengthMeters:c,reachMeters:u});return Jy.set(i,g),g}var Xy=[`gpu`,`cpu`],Zy=[`canvas`,`gpu`],Qy=[`fixed`,`adaptive`],$y=[`gpu`,`cpu`,`webgl`],eb=Object.freeze({materialRenderer:`gpu`,diagnostics:!0,grainLines:`gpu`,backgroundPacing:`adaptive`,backgroundRaster:`webgl`});function tb(e){let t=eb,n=e?.materialRenderer;return{materialRenderer:n&&Xy.includes(n)?n:t.materialRenderer,diagnostics:typeof e?.diagnostics==`boolean`?e.diagnostics:t.diagnostics,grainLines:e?.grainLines&&Zy.includes(e.grainLines)?e.grainLines:t.grainLines,backgroundPacing:e?.backgroundPacing&&Qy.includes(e.backgroundPacing)?e.backgroundPacing:t.backgroundPacing,backgroundRaster:e?.backgroundRaster&&$y.includes(e.backgroundRaster)?e.backgroundRaster:t.backgroundRaster}}var nb=[`chart`,`session`,`presentation`],rb=[{id:`gameplay`,title:`Gameplay`,prefix:`xr-play`},{id:`choreography`,title:`Choreography`,prefix:`xr-generation`},{id:`background`,title:`Visuals`,prefix:`xr-background`},{id:`character`,title:`Character`,prefix:`xr-character`},{id:`material`,title:`Material`,prefix:`xr-material`},{id:`cosmos`,title:`Cosmos`,prefix:`xr-cosmos`},{id:`wall`,title:`Wall`,prefix:`xr-wall`},{id:`cockpit`,title:`Cockpit`,prefix:`xr-cockpit`},{id:`system`,title:`System`,prefix:`xr-system`}];function ib(e,t,n){return{id:e,section:`choreography`,label:t,scope:`chart`,kind:`choice`,choices:n,read:t=>String(t.generation[e]??(e===`motionSafety`||e===`chartProfile`?`legacy`:``)),write:(t,n)=>({...t,generation:qd({...t.generation,...e===`motionSafety`&&n===`legacy`?{chartProfile:`legacy`}:{},[e]:n},fb)})}}function ab(e,t,n){return{id:e,section:`gameplay`,label:t,scope:`session`,kind:`choice`,choices:n,read:t=>t.play[e],write:(t,n)=>({...t,play:Ky({...t.play,[e]:n})})}}function ob(e,t,n){return{id:e,section:`background`,label:t,scope:`presentation`,kind:`choice`,choices:n,read:t=>String(t.background[e]),write:(t,n)=>({...t,background:Dy({...t.background,[e]:e===`quality`?n:Number(n)})})}}function sb(e,t,n){return{id:`cosmos${e[0].toUpperCase()}${e.slice(1)}`,section:`cosmos`,label:t,scope:`presentation`,kind:`range`,min:0,max:n,step:5,hint:`User-global background amount (%). Zero hides this layer; preset motion and geometry stay authored. Applies to Hybrid and Native.`,read:t=>Math.round((t.background.cosmos?.[e]??(e===`sky`?0:1))*100),write:(t,n)=>({...t,background:Dy({...t.background,cosmos:{...t.background.cosmos,[e]:n/100}})})}}function cb(e,t,n){return{id:`grain${e[0].toUpperCase()}${e.slice(1)}`,section:`material`,label:t,scope:`presentation`,kind:`range`,min:0,max:100,step:1,hint:`${n} 50 is neutral (the presets as authored).`,read:t=>Math.round(t.background.grain[e]*100),write:(t,n)=>({...t,background:Dy({...t.background,grain:{...t.background.grain,[e]:n/100}})})}}function lb(e,t,n){return{id:`wall${e[0].toUpperCase()}${e.slice(1)}`,section:`wall`,label:t,scope:`presentation`,kind:`range`,min:0,max:100,step:1,hint:n+` 50 is neutral on the authored value; 0 removes it.`,read:t=>Math.round((t.background.wall?.[e]??.5)*100),write:(t,n)=>({...t,background:Dy({...t.background,wall:{...t.background.wall,[e]:n/100}})})}}function ub(e,t,n){return{id:e,section:`character`,label:t,scope:`presentation`,kind:`range`,min:0,max:100,step:1,hint:`${n} 50 is neutral (the presets as authored).`,read:t=>Math.round(t.background.character[e]*100),write:(t,n)=>({...t,background:Dy({...t.background,character:{...t.background.character,[e]:n/100}})})}}var db=[{id:`cockpit`,section:`cockpit`,label:`Cockpit`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`Open stage without the cabin frame or title.`},{value:`reduced`,label:`Reduced`,hint:`Panoramic frame and title; fewer ribs and floor returns.`},{value:`full`,label:`Full`,hint:`Panoramic cabin, side and overhead ribs, cyan/magenta light strips. Unlit materials.`}],read:e=>e.appearance.cockpit,write:(e,t)=>({...e,appearance:Iy({...e.appearance,cockpit:t})})},{id:`cockpitTitle`,section:`cockpit`,label:`Track title`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`Hide the filename caption.`},{value:`static`,label:`Static`,hint:`Filename stays in its fixed-width window; long text is clipped.`},{value:`scroll`,label:`Scroll`,hint:`Filename scrolls inside a fixed-width top panel, following song time. Pausing holds its position.`}],read:e=>e.appearance.cockpitTitle,write:(e,t)=>({...e,appearance:Iy({...e.appearance,cockpitTitle:t})})},{id:`wallMode`,section:`wall`,label:`Wall`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`Skip the wall completely. The legacy default.`},{value:`preset`,label:`Preset`,hint:`Follow the preset optics gate, wall amount and material. Presets with no wall stay empty.`},{value:`on`,label:`On`,hint:`Preview the wall even when the preset disables it. Uses authored amount, or unit base if zero. Lens is independent.`}],read:e=>e.background.wall?.mode??`off`,write:(e,t)=>({...e,background:Dy({...e.background,wall:{...e.background.wall,mode:t}})})},{id:`wallMaterial`,section:`wall`,label:`Wall material`,scope:`presentation`,kind:`choice`,choices:[{value:`preset`,label:`Preset`,hint:`The preset selects the original membrane or mosaic material.`},{value:`membrane`,label:`Membrane`,hint:`Rippled clumps of wall light and authored caustic helices.`},{value:`mosaic`,label:`Mosaic`,hint:`Discrete spectral ticks and pressure-wave shifts. No caustic helices in this material.`}],read:e=>e.background.wall?.material??`preset`,write:(e,t)=>({...e,background:Dy({...e.background,wall:{...e.background.wall,material:t}})})},lb(`amount`,`Wall amount`,`Gain on wall light. On mode supplies a unit base when the preset authors zero.`),lb(`fringe`,`Fringe`,`Coloured edge-light split, not background refraction.`),lb(`caustics`,`Caustics`,`Brighter analytic helices in Membrane material.`),lb(`waves`,`Pressure waves`,`Existing kick/LOW_DROP fronts deform the wall; no new beat detector.`),lb(`cracks`,`Cracks`,`Short flashes on the original fracture paths under qualifying fronts.`),sb(`stars`,`Stars`,200),sb(`galaxies`,`Galaxies`,200),sb(`sky`,`Sky`,100),{id:`playSpace`,section:`gameplay`,label:`Play space`,scope:`chart`,kind:`choice`,choices:[{value:`standard`,label:`Standard`,hint:`Three rows around chest height.`},{value:`tall`,label:`Tall`,hint:`Wider rows plus a rare overhead row on big moments: reach up and chop down. The start frame grows and the score moves beside the runway.`}],read:e=>e.generation.playSpace,write:(e,t)=>({...e,generation:qd({...e.generation,playSpace:t},fb)})},ab(`noteSpeed`,`Note speed`,[{value:`normal`,label:`Normal`,hint:`4 m/s from 8 m away: two seconds to read each target.`},{value:`fast`,label:`Fast`,hint:`7 m/s from 11 m away: 1.6 s to react, a longer runway.`},{value:`hyper`,label:`Hyper`,hint:`10 m/s from 14 m away: 1.4 s to react, the full-length runway.`}]),ab(`saberLength`,`Saber length`,[{value:`short`,label:`Short`,hint:`0.9 m blade (the original length).`},{value:`normal`,label:`Normal`,hint:`1.0 m blade. The start frame moves back so the whole reach is judged.`},{value:`long`,label:`Long`,hint:`1.1 m blade for long reaches; the stage adapts its distance.`},{value:`auto`,label:`Auto`,hint:`Follows the play space: 1.0 m, or 1.1 m in the Tall space.`}]),ib(`chartProfile`,`Chart profile`,[{value:`legacy`,label:`Classic`,hint:`The previous chart vocabulary; Movement chooses its motor policy.`},{value:`musical-v1`,label:`Musical`,hint:`Local rhythm and spectral changes select accepted events before Guarded movement. Section labels do not force calm patterns. Missing frame evidence uses event strengths; missing sections falls back to Classic / Guarded.`}]),ib(`difficulty`,`Difficulty`,[{value:`easy`,label:`Easy`,hint:`Slow and spacious: fewer targets, more free cuts, gentle moves.`},{value:`normal`,label:`Normal`,hint:`The standard challenge.`},{value:`hard`,label:`Hard`,hint:`Denser streams, faster hand moves, strictly directional cuts.`},{value:`expert`,label:`Expert`,hint:`Maximum density and speed, chains of hard moves on big moments.`},{value:`ultra`,label:`Ultra`,hint:`Beyond Expert: dense, fast, always directional runs where the music drives, with structured breathers in calm parts and before every section change.`}]),ib(`activity`,`Activity`,[{value:`macro`,label:`Calm`,hint:`Fewer targets, more room to breathe.`},{value:`balanced`,label:`Balanced`,hint:`Standard target density.`},{value:`active`,label:`Active`,hint:`As dense as the music and safe spacing allow.`}]),ib(`variation`,`Variation`,[{value:`stable`,label:`Stable`,hint:`Few repeating patterns, mostly vertical cuts.`},{value:`paired`,label:`Paired`,hint:`Two to three pattern families per scene.`},{value:`expressive`,label:`Expressive`,hint:`Shorter phrases and the widest cut vocabulary.`}]),ib(`handPattern`,`Hands`,[{value:`alternate`,label:`Alternate`,hint:`The hands take turns.`},{value:`call-response`,label:`Call & Response`,hint:`One hand calls a bar, the other answers.`},{value:`together`,label:`Together`,hint:`More two-hand accents on strong beats.`},{value:`independent`,label:`Independent`,hint:`Each hand follows its own musical stream.`}]),ib(`handLead`,`Lead`,[{value:`left`,label:`Left`,hint:`The left hand carries more primary beats.`},{value:`even`,label:`Even`,hint:`Both hands share the work evenly.`},{value:`right`,label:`Right`,hint:`The right hand carries more primary beats.`}]),ib(`motionSafety`,`Movement`,[{value:`legacy`,label:`Legacy`,hint:`The previous authored movement policy and note sequence. Also returns Chart profile to Classic.`},{value:`guarded`,label:`Guarded`,hint:`Reserve stroke recovery, hand clearance and overhead rest. Simplify unsafe placement, then omit infeasible groups. Regenerates the chart.`}]),ib(`zones`,`Zones`,[{value:`split`,label:`Own side`,hint:`Each saber stays in its own half.`},{value:`shared`,label:`Shared center`,hint:`Both sabers may also use the center lane.`},{value:`cross`,label:`Crossover`,hint:`On energetic moments a saber reaches into the other half.`}]),{id:`wormhole`,section:`background`,label:`Wormhole`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`Plain dark space: the lightest frame.`},{value:`on`,label:`On`,hint:`The music-driven Wormhole behind the runway (the heaviest part of the frame).`}],read:e=>e.background.wormhole?`on`:`off`,write:(e,t)=>({...e,background:Dy({...e.background,wormhole:t===`on`})})},{id:`noteDesign`,section:`background`,label:`Note design`,scope:`presentation`,kind:`choice`,choices:[{value:`classic`,label:`Classic`,hint:`Chamfered blocks with an arrow to follow; dots allow any direction.`},{value:`shard`,label:`Shard`,hint:`Crystals whose tip points the way to cut, with a glowing cut line; round gems allow any direction.`}],read:e=>e.appearance.noteDesign,write:(e,t)=>({...e,appearance:Iy({...e.appearance,noteDesign:t})})},{id:`noteHalos`,section:`background`,label:`Note halos`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`Keep targets without an extra ring.`},{value:`phrase`,label:`Phrase`,hint:`White rings mark phrase-start targets. Accepted hits briefly expand the ring; scoring stays the same.`},{value:`music`,label:`Music`,hint:`Gold arcs: accent. White brackets: phrase. Violet ring: section. Keep following the target hand and cut; no extra points.`}],read:e=>e.appearance.noteHalos,write:(e,t)=>({...e,appearance:Iy({...e.appearance,noteHalos:t})})},ob(`quality`,`Background quality`,[{value:`performance`,label:`Performance`,hint:`640 x 360 raster: lightest, softest image.`},{value:`balanced`,label:`Balanced`,hint:`768 x 432 raster: the recommended headset setting.`},{value:`high`,label:`High`,hint:`960 x 540 raster: sharper, heavier on the CPU.`},{value:`ultra`,label:`Ultra`,hint:`1280 x 720 raster: a sharp image in the headset, heavy on the CPU (drawn off the main thread).`},{value:`crystal`,label:`Crystal`,hint:`1920 x 1080 raster: crisp lines (1.5x Ultra) at almost the same headset cost.`},{value:`max`,label:`Max`,hint:`2560 x 1440 raster, mipmapped: fine lines (2x Ultra), with more GPU memory and upload per frame.`},{value:`4k`,label:`4K`,hint:`3840 x 2160 raster, mipmapped: the highest background resolution, with the most GPU memory and upload per frame.`}]),ob(`rateHz`,`Background update`,[{value:`24`,label:`24 Hz`,hint:`Every third headset frame: the lightest, steadiest load.`},{value:`36`,label:`36 Hz`,hint:`Every second headset frame: more fluid motion, higher cost.`}]),ob(`distanceMeters`,`Background distance`,[{value:`40`,label:`40 m`,hint:`The original distance: the image keeps a slight stereo depth and parallax.`},{value:`100`,label:`100 m`,hint:`Deep space: the image reads as far away, behind everything else.`},{value:`200`,label:`200 m`,hint:`Practically at infinity: no stereo depth or parallax left in the image.`},{value:`500`,label:`500 m`,hint:`The deepest background: the same image size and resolution, with even less head-motion parallax.`}]),{id:`lineStroke`,section:`background`,label:`Line stroke`,scope:`presentation`,kind:`range`,min:0,max:100,step:1,read:e=>Math.round(e.background.lineStroke*100),write:(e,t)=>({...e,background:Dy({...e.background,lineStroke:t/100})})},ub(`intensity`,`Intensity`,`How strongly the Wormhole reacts to and glows with the music.`),ub(`motion`,`Motion`,`Flight speed, warp and turbulence of the Wormhole.`),ub(`depth`,`Depth`,`Sense of distance: depth, galaxy, starfield and ring.`),ub(`detail`,`Detail`,`The grain material end to end: amount, detail, bloom, weave, spiral and density.`),cb(`amount`,`Grain material`,`Crossfades the grain trails from lines into continuous filament material; 0 skips the raster work.`),cb(`detail`,`Material detail`,`Carrier breakup, micro-detail, kernel character and the raster quality tier (the heaviest on the CPU).`),cb(`bloom`,`Material bloom`,`Strength of the bloom derived from the grain material.`),cb(`weave`,`Material weave`,`Connective filaments between neighbouring grains along a spiral arm and around a depth ring.`),cb(`spiral`,`Spiral twist`,`Coherent twist that organises the grains onto shared spiral arms.`),{id:`spiralDirection`,section:`material`,label:`Spiral direction`,scope:`presentation`,kind:`choice`,choices:[{value:`auto`,label:`Auto`,hint:`Follow the authored preset or automation pair direction.`},{value:`left`,label:`Left`,hint:`Left-handed grain and arm twist. Keeps the path and lens direction.`},{value:`right`,label:`Right`,hint:`Right-handed grain and arm twist. Keeps the path and lens direction.`}],read:e=>e.appearance.spiralDirection,write:(e,t)=>({...e,appearance:Iy({...e.appearance,spiralDirection:t})})},cb(`arms`,`Spiral arms`,`Number of density-wave arms brightening the grains on their crest.`),cb(`density`,`Grain density`,`Additional grain copies for a denser tunnel.`),{id:`presentationMode`,section:`system`,label:`Wormhole mode`,scope:`presentation`,kind:`choice`,choices:[{value:`hybrid`,label:`Hybrid`,hint:`Complete background image with the selected spatial field. Quality controls raster resolution; distance places the image.`},{value:`native-grains`,label:`Native grains (experimental)`,hint:`3D grains/weave/material, Cosmos and optional Wall light paths. Canvas-free geometry worker with native main fallback. Quality limits geometry/fill; distance bounds depth. Optical lens/refraction is a later feature.`}],read:e=>e.background.presentationMode,write:(e,t)=>({...e,background:Dy({...e.background,presentationMode:t})})},{id:`sharpness`,section:`background`,label:`Sharpness`,scope:`presentation`,kind:`range`,min:0,max:100,step:1,read:e=>Math.round(e.background.sharpness*100),write:(e,t)=>({...e,background:Dy({...e.background,sharpness:t/100})})},{id:`materialRenderer`,section:`system`,label:`Material renderer`,scope:`presentation`,kind:`choice`,choices:[{value:`gpu`,label:`GPU`,hint:`The headset GPU draws the grain material from the background's carrier list: full frame rate with any Material setting. Falls back to CPU where the GPU cannot.`},{value:`cpu`,label:`CPU`,hint:`The background thread rasterizes the grain material (the original path, heavy on the headset CPU). For comparison.`}],read:e=>e.system.materialRenderer,write:(e,t)=>({...e,system:tb({...e.system,materialRenderer:t})})},{id:`diagnostics`,section:`system`,label:`Diagnostics`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`No profiling: the background measures nothing.`},{value:`on`,label:`On`,hint:`Display fps, background fps and cost per stage, averaged over two seconds of play, on the main and pause screens.`}],read:e=>e.system.diagnostics?`on`:`off`,write:(e,t)=>({...e,system:tb({...e.system,diagnostics:t===`on`})})},{id:`grainLines`,section:`system`,label:`Grain lines`,scope:`presentation`,kind:`choice`,choices:[{value:`canvas`,label:`Canvas`,hint:`The background thread strokes the grain trails into its image (the original path).`},{value:`gpu`,label:`GPU`,hint:`The headset GPU draws the grain trails from a line list instead of the background thread. Needs the GPU material renderer.`}],read:e=>e.system.grainLines,write:(e,t)=>({...e,system:tb({...e.system,grainLines:t})})},{id:`backgroundPacing`,section:`system`,label:`Background pacing`,scope:`presentation`,kind:`choice`,choices:[{value:`fixed`,label:`Fixed`,hint:`Redraws on the requested whole-frame cadence; a late frame waits for the next one.`},{value:`adaptive`,label:`Adaptive`,hint:`Widens the cadence to fit late frames (24 Hz instead of 18): smoother, but more background work for the headset GPU.`}],read:e=>e.system.backgroundPacing,write:(e,t)=>({...e,system:tb({...e.system,backgroundPacing:t})})},{id:`backgroundRaster`,section:`system`,label:`Background raster`,scope:`presentation`,kind:`choice`,choices:[{value:`gpu`,label:`GPU`,hint:`The browser draws the background image on the GPU, stroke by stroke (Canvas2D, the original path).`},{value:`cpu`,label:`CPU`,hint:`The background thread draws its image in software, off the GPU. Busier on the headset CPU. For comparison.`},{value:`webgl`,label:`WebGL`,hint:`The background thread draws its image with WebGL in a few batched draw calls instead of thousands of strokes. Falls back to GPU where WebGL is unavailable.`}],read:e=>e.system.backgroundRaster,write:(e,t)=>({...e,system:tb({...e.system,backgroundRaster:t})})},{id:`spatialField`,section:`system`,label:`Spatial field`,scope:`presentation`,kind:`choice`,choices:[{value:`off`,label:`Off`,hint:`Only the background image: no Wormhole particles around the runway (the lightest).`},{value:`particles`,label:`Particles`,hint:`The Wormhole's particles stream past you around the runway (one light draw).`},{value:`full`,label:`Full`,hint:`Particles plus soft wisps of the Wormhole's nebula (two draws; the wisps cost the most fill).`}],read:e=>e.background.spatialField,write:(e,t)=>({...e,background:Dy({...e.background,spatialField:t})})}],fb=Object.freeze({difficulty:`ultra`,activity:`active`,variation:`expressive`,handPattern:`alternate`,handLead:`even`,zones:`cross`,playSpace:`tall`}),pb=Object.freeze({play:zy,generation:fb,background:Ey,appearance:Fy,system:eb});function mb(e){let t=e&&typeof e==`object`?e:{};return{play:Ky(t.play&&typeof t.play==`object`?t.play:void 0),generation:qd(t.generation&&typeof t.generation==`object`?t.generation:void 0,fb),background:Dy(t.background&&typeof t.background==`object`?t.background:void 0),appearance:Iy(t.appearance&&typeof t.appearance==`object`?t.appearance:void 0),system:tb(t.system&&typeof t.system==`object`?t.system:void 0)}}function hb(e,t,n){return e.read(t)!==e.read(n)}function gb(e,t){let n=null;for(let r of db)hb(r,e,t)&&(n===null||nb.indexOf(r.scope)<nb.indexOf(n))&&(n=r.scope);return n}function _b(e){return Yy(e.play,e.generation.playSpace)}var vb={width:1280,height:900},yb=40,bb=520,xb=72,Sb=66,Cb=52,wb=vb.height-122,Tb=wb-30,Eb=250,Db=170,Ob=210,kb=200,Ab=230,jb=8,Mb=10,Nb=Object.freeze({screen:`main`,tab:rb[0].id,hover:null});function Pb(e){return e===`paused`||e===`playing`?`pause`:e===`finished`?`results`:`main`}function Fb(e){if(!e.totalNotes)return null;let t=e.maxScore?e.score/e.maxScore:0,n=(e.sections??[]).filter(e=>e.completedAt!==null&&e.resolved>0);return{rank:Op(t),accuracy:t,score:e.score,maxCombo:e.maxCombo,hits:e.hitCount,misses:e.missCount,flawlessSections:n.filter(e=>e.misses===0&&e.perfects===e.resolved).length,sections:n.length}}function Ib(e,t,n,r,i,a,o,s={}){return{id:e,kind:t,label:n,x:r,y:i,w:a,h:o,selected:s.selected??!1,disabled:s.disabled??!1,primary:s.primary??!1,hint:s.hint??``}}function Lb(e,t,n,r,i,a=`left`,o=1){return{text:e,x:t,y:n,size:r,role:i,align:a,maxLines:o}}function Rb(e,t){let n=(vb.width-bb)/2;return t.map(([t,r,i],a)=>Ib(t,`button`,r,n,e+a*90,bb,xb,i))}function zb(e){let t=t=>{let n=db.find(e=>e.id===t);if(!n||n.kind!==`choice`)return``;let r=n.read(e);return n.choices.find(e=>e.value===r)?.label??r};return`${t(`difficulty`)} - ${t(`noteSpeed`)} speed - ${t(`playSpace`)} space`}function Bb(e){return e===`presentation`?``:` Changing it restarts the song.`}function Vb(e,t,n){let r=[],i=[],a=vb.width-yb-290,o=db.filter(e=>e.section===t),s=Math.max(Cb,Math.min(Sb,Math.floor((Tb-n+14)/Math.max(1,o.length)))),c=s-14,l=n;for(let t of o){if(i.push({...Lb(t.label,yb,l+s/2-4,24,`label`),width:Eb-16}),t.kind===`choice`){let n=t.read(e),i=t.choices.length,o=(a-(i-1)*jb)/i;t.choices.forEach((e,i)=>r.push(Ib(`opt:${t.id}:${e.value}`,`option`,e.label,290+i*(o+jb),l,o,c,{selected:e.value===n,hint:e.hint+Bb(t.scope)})))}else{let n=t.read(e),o=`${t.label}: ${n} (${t.min}-${t.max}).${t.hint?` ${t.hint}`:``}${Bb(t.scope)}`;r.push(Ib(`step:${t.id}:-1`,`step`,`-`,290,l,90,c,{disabled:n<=t.min,hint:o})),r.push(Ib(`step:${t.id}:1`,`step`,`+`,290+a-90,l,90,c,{disabled:n>=t.max,hint:o})),i.push(Lb(String(n),290+a/2,l+c/2+2,30,`value`,`center`))}l+=s}return{items:r,texts:i}}function Hb(e,t){let n=[],r=[],i=vb.width/2,a=vb.height-yb-8;if(e.screen===`settings`){r.push({...Lb(`SETTINGS`,yb,58,34,`title`),width:260}),r.push({...Lb(t.busy?t.status||`Updating...`:t.trackTitle,vb.width-yb,58,20,`muted`,`right`),width:vb.width-2*yb-292});let i=rb,a=(vb.width-2*yb-(i.length-1)*jb)/i.length,o=t.input===`desktop`?`Left / right arrow keys also switch tabs.`:`Thumbstick left / right also switches tabs.`;i.forEach((t,r)=>n.push(Ib(`tab:${t.id}`,`tab`,t.title,yb+r*(a+jb),92,a,56,{selected:t.id===e.tab,hint:o})));let s=Vb(t.settings,e.tab,164);n.push(...s.items),r.push(...s.texts);let c=vb.height-24-56;n.push(Ib(`action:back`,`button`,`Back`,yb,c,Db,56));let l=gb(t.settings,Yb())===null,u=Xb(e);n.push(Ib(`action:reset`,`button`,u?`Confirm reset`:`Reset defaults`,218,c,Ob,56,{disabled:l,primary:u,hint:l?`Every setting is at its default.`:u?`Click again: every setting returns to its default. Gameplay changes restart the song.`:`Returns every setting to its default, after a second click.`}));let d=vb.width-yb;n.push(Ib(`action:copy-diagnostics`,`button`,`Copy diagnostics`,d-Ab,c,Ab,56,{disabled:!t.diagnostics&&!t.chartDiagnostics,hint:t.diagnostics||t.chartDiagnostics?`Copies chart decisions, available performance diagnostics and every setting.`:`No diagnostics yet: switch on System > Diagnostics and play for two seconds.`})),n.push(Ib(`action:copy-settings`,`button`,`Copy settings`,d-Ab-jb-kb,c,kb,56,{hint:`Copies every setting of the menu to the clipboard as text.`}));let f=n.find(t=>t.id===e.hover);return r.push(t.notice?Lb(t.notice,yb,wb,21,`accent`,`left`,2):Lb(f?.hint??``,yb,wb,21,`muted`,`left`,2)),{items:n,texts:r}}if(e.screen===`results`&&t.results){let e=t.results;r.push(Lb(`RESULTS`,i,70,34,`title`,`center`)),r.push(Lb(t.trackTitle,i,108,22,`muted`,`center`)),r.push(Lb(e.rank,i,196,96,`accent`,`center`)),r.push(Lb(`${(e.accuracy*100).toFixed(1)}%`,i,268,34,`value`,`center`));let a=String(Math.round(e.score)).replace(/\B(?=(\d{3})+(?!\d))/g,` `);return r.push(Lb(`${a} pts  -  max combo ${e.maxCombo}  -  ${e.hits} hits, ${e.misses} misses`,i,312,22,`body`,`center`)),e.sections&&r.push(Lb(`${e.flawlessSections} / ${e.sections} sections flawless`,i,344,22,`body`,`center`)),n.push(...Rb(420,Ub(t,[[`action:restart`,`Play again`,{primary:!0}],[`action:settings`,`Settings`,{}]]))),{items:n,texts:r}}let o=e.screen===`pause`;r.push(Lb(o?`PAUSED`:`PLEXUS XR`,i,78,40,`title`,`center`)),r.push(Lb(t.trackTitle||`No track loaded`,i,122,24,`body`,`center`)),r.push(Lb(t.busy?t.status||`Updating choreography...`:zb(t.settings),i,160,20,`muted`,`center`));let s=t.canStart&&!t.busy;return n.push(...Rb(236,Ub(t,o?[[`action:resume`,`Resume`,{primary:!0}],[`action:restart`,`Restart`,{}],[`action:settings`,`Settings`,{}]]:[[`action:start`,`Start`,{primary:!0,disabled:!s}],[`action:settings`,`Settings`,{}]]))),t.chartDiagnostics&&r.push(Lb(t.chartDiagnostics,i,vb.height-224,20,`muted`,`center`,2)),t.diagnostics&&r.push(Lb(t.diagnostics,i,vb.height-166,17,`muted`,`center`,2)),r.push(Lb(t.input===`desktop`?`Mouse or arrow keys + Enter to choose. Esc: back / resume. Space: play / pause.`:`Point with a controller, pull the trigger to choose. Grip: pause / back.`,i,a,20,`muted`,`center`)),{items:n,texts:r}}function Ub(e,t){return e.input===`desktop`?t:[...t,[`action:exit`,`Exit VR`,{}]]}function Wb(e,t,n){let r=t.items.filter(e=>!e.disabled);if(!r.length)return e;let i=r.find(t=>t.id===e.hover);if(!i)return{...e,hover:r[0].id};if(n===`next`||n===`previous`){let t=r.indexOf(i),a=n===`next`?1:-1;return{...e,hover:r[(t+a+r.length)%r.length].id}}let a=i.x+i.w/2,o=i.y+i.h/2,s=n===`left`||n===`right`,c=n===`right`||n===`down`?1:-1,l=null,u=1/0,d=1/0,f=1/0;for(let e of r){if(e===i)continue;let t=e.x+e.w/2-a,n=e.y+e.h/2-o,r=s?t*c:n*c,p=Math.abs(s?n:t);if(r<=1||s&&p>i.h/2)continue;let m=r+p*3;(s?m<u:r<d-1||Math.abs(r-d)<=1&&p<f)&&(u=m,d=r,f=p,l=e)}if(l)return{...e,hover:l.id};if(s&&e.screen===`settings`){let t=Qb(e,c);return{...t,hover:`tab:${t.tab}`}}return e}function Gb(e,t,n){for(let r of e.items)if(t>=r.x&&t<=r.x+r.w&&n>=r.y&&n<=r.y+r.h)return r;return null}function Kb(e){return Math.max(e.step,(e.max-e.min)/Mb)}function qb(e,t,n,r){let i=n.items.find(e=>e.id===r);if(!i||i.disabled)return{state:e,command:null};if(r===`action:reset`){if(!Xb(e))return{state:{...e,confirm:`reset`},command:null};let n=Yb(),r=gb(t.settings,n);return{state:{...e,confirm:null},command:r?{type:`settings-changed`,settings:n,scope:r}:null}}e.confirm&&(e={...e,confirm:null});let[a,o,s]=r.split(`:`);if(a===`tab`)return{state:{...e,tab:o},command:null};if(a===`action`)switch(o){case`settings`:return{state:{...e,screen:`settings`},command:null};case`back`:return{state:{...e,screen:Pb(t.sessionState)},command:null};case`start`:return{state:e,command:{type:`start`}};case`resume`:return{state:e,command:{type:`resume`}};case`restart`:return{state:e,command:{type:`restart`}};case`exit`:return{state:e,command:{type:`exit-vr`}};case`copy-settings`:return{state:e,command:{type:`copy-settings`}};case`copy-diagnostics`:return{state:e,command:{type:`copy-diagnostics`}};default:return{state:e,command:null}}let c=db.find(e=>e.id===o);if(!c)return{state:e,command:null};let l=c.kind===`choice`?c.write(t.settings,s):c.write(t.settings,Math.min(c.max,Math.max(c.min,c.read(t.settings)+Number(s)*Kb(c)))),u=gb(t.settings,l);return{state:e,command:u?{type:`settings-changed`,settings:l,scope:u}:null}}function Jb(e,t=``){let n=[`Plexus XR settings`+(t?` - ${t}`:``)];for(let t of rb){n.push(``,`[${t.title}]`);for(let r of db.filter(e=>e.section===t.id))if(r.kind===`choice`){let t=r.read(e);n.push(`${r.label}: ${r.choices.find(e=>e.value===t)?.label??t}`)}else n.push(`${r.label}: ${r.read(e)}`)}return n.push(``,`JSON: ${JSON.stringify(e)}`),n.join(`
`)}function Yb(){return pb}function Xb(e){return e.confirm===`reset`&&(e.hover===null||e.hover===`action:reset`)}function Zb(e,t,n=``,r,i,a){return`Plexus XR diagnostics
${e}${r?`\nChart selection (v${r.version}, accepted BeatEvents (including FX transients))\n${r.retainedEvents}/${r.sourceEvents} events retained; ${r.notes} notes; left ${r.hands.left}, right ${r.hands.right}.\n${r.skippedEvents} events skipped; ${r.revoicedNotes} notes revoiced.\n${Object.entries(r.rejected).map(([e,t])=>`${e}: ${t}`).join(`; `)}\nFirst actual rejection reason per source event; intensity is not confidence.\nChart JSON: ${JSON.stringify(r)}\n`:``}${i?`\nMeasured structure v${i.version}: ${i.changedSections}/${i.decisions.length} labels updated.\nOriginal boundaries and accepted event times retained. Spectral shares are not instrument identity.\nStructure JSON: ${JSON.stringify(i)}\n`:``}${a?`
Automation: ${a.publishedPoints}/${a.proposedPoints} cue placements.
Manual/legacy cue times are morph starts, not target-arrival deadlines; eligible automatic preset bases arrive at cues.
Automation JSON: ${JSON.stringify(a)}
`:``}

${Jb(t,n)}`}function Qb(e,t){if(e.screen!==`settings`)return e;let n=rb,r=n.findIndex(t=>t.id===e.tab);return{...e,tab:n[(r+t+n.length)%n.length].id}}var $b=1.6,ex=$b*vb.height/vb.width,tx=1.3,nx=.12,rx=Um,ix=`#4fd8ff`,ax=`#ff5fb4`,ox={title:Wm,heading:Wm,label:`#cfe4f7`,body:`#dbeaf8`,muted:`#8ba6c4`,value:Wm,accent:`#ffd35c`},sx={title:800,heading:700,label:600,body:500,muted:500,value:700,accent:800},cx={Gameplay:`Play`,Character:`Char.`,Material:`Mat.`,Cockpit:`Cabin`,Performance:`Perf.`,Balanced:`Bal.`,Crystal:`Cryst.`,Choreography:`Choreo`,Expressive:`Expr.`,Alternate:`Alt.`,Crossover:`Cross`,"Background quality":`BG quality`,"Background update":`BG update`,"Background distance":`BG distance`,"Background pacing":`BG pacing`,"Background raster":`BG raster`,"Material renderer":`Renderer`,"Copy settings":`Copy config`,"Copy diagnostics":`Copy stats`,"Reset defaults":`Reset`,"Confirm reset?":`Reset?`};function lx(e,t,n){if(n(e)<=t)return e;let r=cx[e]??e;if(n(r)<=t)return r;if(n(`…`)>t)return``;let i=r.length;for(;i>0&&n(r.slice(0,i)+`…`)>t;)i--;return r.slice(0,i).trimEnd()+`…`}var ux=class{root=new pr;mesh;canvas;ctx;texture;layoutValue=null;key=``;lastState=null;lastContext=null;redraws=0;inverse=new zn;localRay=new ki;constructor(e=document){this.canvas=e.createElement(`canvas`),this.canvas.width=vb.width,this.canvas.height=vb.height;let t=this.canvas.getContext(`2d`);if(!t)throw Error(`2D canvas context unavailable for the XR menu`);this.ctx=t,this.texture=new fa(this.canvas),this.texture.colorSpace=St,this.texture.generateMipmaps=!1,this.texture.minFilter=z,this.mesh=new X(new zo($b,ex),new Ai({map:this.texture,transparent:!0,depthTest:!1,depthWrite:!1,toneMapped:!1})),this.mesh.name=`xrMenuPanel`,this.mesh.renderOrder=20,this.root.add(this.mesh),this.root.visible=!1}get layout(){return this.layoutValue}get redrawCount(){return this.redraws}get visible(){return this.root.visible}setVisible(e){this.root.visible=e}update(e,t){if(e===this.lastState&&t===this.lastContext&&this.layoutValue)return this.layoutValue;this.lastState=e,this.lastContext=t;let n=JSON.stringify([e,t]);return(n!==this.key||!this.layoutValue)&&(this.key=n,this.layoutValue=Hb(e,t),this.draw(this.layoutValue,e.hover)),this.layoutValue}placeFacing(e,t,n,r){[e,t,n,r].every(Number.isFinite)&&(this.root.position.set(e-Math.sin(r)*tx,t-nx,n-Math.cos(r)*tx),this.root.rotation.set(0,r,0),this.root.updateMatrixWorld(!0))}placeForCamera(e){let t=e.getEffectiveFOV()*Math.PI/360,n=Math.tan(t),r=e.aspect,i=Number.isFinite(n)&&n>0&&Number.isFinite(r)&&r>0?Math.max(tx,$b/(2*n*r*.9),(ex/2+nx)/(n*.9)):tx;this.root.position.set(0,-.12,-i).applyQuaternion(e.quaternion).add(e.position),this.root.quaternion.copy(e.quaternion),this.root.updateMatrixWorld(!0)}hitTest(e){if(!this.root.visible||!this.layoutValue)return null;this.mesh.updateWorldMatrix(!0,!1),this.localRay.copy(e).applyMatrix4(this.inverse.copy(this.mesh.matrixWorld).invert());let{origin:t,direction:n}=this.localRay;if(t.z<=0||n.z>=0)return null;let r=-t.z/n.z,i=t.x+n.x*r,a=t.y+n.y*r;if(Math.abs(i)>1.6/2||Math.abs(a)>ex/2)return null;let o=(i/$b+.5)*vb.width,s=(.5-a/ex)*vb.height;return{item:Gb(this.layoutValue,o,s),distance:r}}dispose(){this.root.removeFromParent(),this.mesh.geometry.dispose(),this.mesh.material.dispose(),this.texture.dispose()}draw(e,t){this.redraws++;let n=this.ctx,r=vb.width,i=vb.height;n.clearRect(0,0,r,i),n.fillStyle=`rgba(4, 10, 24, 0.94)`,n.fillRect(0,0,r,i),n.fillStyle=`rgba(79, 216, 255, 0.35)`,n.fillRect(0,0,r,2),n.fillRect(0,i-2,r,2),n.fillRect(0,0,2,i),n.fillRect(r-2,0,2,i),n.fillStyle=ix,n.fillRect(0,0,60,5),n.fillRect(0,0,5,60),n.fillStyle=ax,n.fillRect(r-60,i-5,60,5),n.fillRect(r-5,i-60,5,60);for(let n of e.items)this.drawItem(n,n.id===t);n.textBaseline=`middle`;for(let t of e.texts){if(!t.text)continue;n.fillStyle=ox[t.role],n.textAlign=t.align;let e=t.width??r-80;this.wrap(t.text,t.size,sx[t.role],e,t.maxLines).forEach((r,i)=>{let a=this.fitText(r,t.size,sx[t.role],e);n.fillText(a,t.x,t.y+i*t.size*1.2)})}this.texture.needsUpdate=!0}drawItem(e,t){let n=this.ctx,r=e.primary?ax:ix;n.globalAlpha=e.disabled?.35:1,n.fillStyle=e.selected?`rgba(79, 216, 255, 0.28)`:e.primary?`rgba(255, 95, 180, 0.22)`:t?`rgba(79, 216, 255, 0.16)`:`rgba(20, 34, 58, 0.9)`,n.fillRect(e.x,e.y,e.w,e.h),n.fillStyle=t&&!e.disabled?`#eef8ff`:`rgba(79, 216, 255, 0.35)`;let i=t&&!e.disabled?3:1;n.fillRect(e.x,e.y,e.w,i),n.fillRect(e.x,e.y+e.h-i,e.w,i),n.fillRect(e.x,e.y,i,e.h),n.fillRect(e.x+e.w-i,e.y,i,e.h),(e.selected||e.primary)&&(n.fillStyle=r,n.fillRect(e.x,e.y+e.h-4,e.w,4)),n.fillStyle=e.selected||t?`#ffffff`:`#dbeaf8`,n.textAlign=`center`,n.textBaseline=`middle`;let a=this.fitText(e.label,e.kind===`step`?34:e.kind===`button`?28:22,e.selected||e.primary?800:600,e.w-16);n.fillText(a,e.x+e.w/2,e.y+e.h/2+1),n.globalAlpha=1}wrap(e,t,n,r,i){if(i<=1)return[e];this.ctx.font=`${n} ${t}px ${rx}`;let a=[],o=``,s=e.split(` `);for(let e=0;e<s.length;e++){let t=o?`${o} ${s[e]}`:s[e];o&&this.ctx.measureText(t).width>r&&a.length<i-1?(a.push(o),o=s[e]):o=t}return a.push(o),a}fitText(e,t,n,r){return this.ctx.font=`${n} ${t}px ${rx}`,lx(e,r,e=>this.ctx.measureText(e).width)}};async function dx(e,t=globalThis.document){let n=globalThis.navigator?.clipboard;if(n?.writeText)try{return await n.writeText(e),!0}catch{}if(!t?.body)return!1;let r=t.createElement(`textarea`);try{return r.value=e,r.setAttribute(`readonly`,``),r.style.cssText=`position:fixed;left:-9999px;top:0;opacity:0`,t.body.appendChild(r),r.select(),t.execCommand(`copy`)}catch{return!1}finally{r.remove()}}var fx={tune:`tune`,background:`layers`,grains:`grains`,weave:`weave`,resolve:`blur`,composite:`comp`,transfer:`xfer`},px=new Set([`draw`]),mx=1.5,hx=class{count=0;sum=0;max=0;add(e){this.count++,this.sum+=e,this.max=Math.max(this.max,e)}clear(){this.count=0,this.sum=0,this.max=0}format(e){return`${e} ${(this.sum/this.count).toFixed(1)}/${this.max.toFixed(1)}`}},gx=class{elapsed=0;displayFrames=0;backgroundFrames=0;renderSum=0;stageSums=new Map;lastShown=null;line=``;backgroundCost=new hx;otherCost=new hx;lateFrames=0;lateAfterBackground=0;lateAfterOther=0;gpuCost=new hx;gpuTimer=null;aheadCost=new hx;longestFrameMs=0;previousShowedFrame=null;get summary(){return this.line}record(e,t,n,r,i,a=``,o){if(!t||!(e>0)||!Number.isFinite(e))return this.reset(n),this.previousShowedFrame=null,!1;this.elapsed+=e,this.displayFrames++,this.longestFrameMs=Math.max(this.longestFrameMs,e*1e3);let s=this.lastShown!==null&&n!==this.lastShown;if(o){let t=o.updateMs+o.renderMs;if(this.previousShowedFrame!==null&&Number.isFinite(t)&&(this.previousShowedFrame?this.backgroundCost:this.otherCost).add(t),o.displayHz>0&&e>mx/o.displayHz&&(this.lateFrames++,this.previousShowedFrame===!0?this.lateAfterBackground++:this.previousShowedFrame===!1&&this.lateAfterOther++),o.gpuTimer!==void 0&&(this.gpuTimer=o.gpuTimer),o.gpuSamples)for(let e of o.gpuSamples)Number.isFinite(e)&&this.gpuCost.add(e);if(o.aheadSamples)for(let e of o.aheadSamples)Number.isFinite(e)&&this.aheadCost.add(e)}if(this.previousShowedFrame=s,s&&(this.backgroundFrames++,this.renderSum+=Number.isFinite(r)?r:0,i))for(let[e,t]of Object.entries(i))Number.isFinite(t)&&this.stageSums.set(e,(this.stageSums.get(e)??0)+t);return this.lastShown=n,this.elapsed<1.999999?!1:(this.line=this.format(a),this.reset(n),!0)}format(e){let t=e=>(e/this.elapsed).toFixed(1),n=[`Display ${t(this.displayFrames)} fps`];if(this.backgroundCost.count||this.otherCost.count){let e=[this.backgroundCost.count?this.backgroundCost.format(`bg`):``,this.otherCost.count?this.otherCost.format(`other`):``].filter(Boolean).join(`, `),t=(e,t)=>`${Math.round(100*e/Math.max(1,t))}%`,r=this.lateFrames?` (bg ${t(this.lateAfterBackground,this.backgroundCost.count)}, other ${t(this.lateAfterOther,this.otherCost.count)})`:``;n[0]+=`, late ${Math.round(100*this.lateFrames/this.displayFrames)}%${r}, max ${this.longestFrameMs.toFixed(1)} ms`,n.push(`Main ms ${e}${this.aheadCost.count?`, ${this.aheadCost.format(`ahead`)}`:``}`),this.gpuCost.count?n.push(this.gpuCost.format(`GPU ms`)):this.gpuTimer===!1&&n.push(`GPU ms n/a (no timer)`)}if(this.backgroundFrames){let r=e=>(e/this.backgroundFrames).toFixed(1);n.push(`Background ${t(this.backgroundFrames)} fps, ${r(this.renderSum)} ms${e?` (${e})`:``}`);let i=[...Object.keys(fx),...[...this.stageSums.keys()].filter(e=>!(e in fx))].filter(e=>this.stageSums.has(e)&&!px.has(e));i.length&&n.push(i.map(e=>`${fx[e]??e} ${r(this.stageSums.get(e))}`).join(` `))}else n.push(`Background: no new frames`);return n.join(` | `)}clear(){this.reset(this.lastShown??0),this.lastShown=null,this.line=``}reset(e){this.elapsed=0,this.displayFrames=0,this.backgroundFrames=0,this.renderSum=0,this.stageSums.clear(),this.backgroundCost.clear(),this.otherCost.clear(),this.lateFrames=0,this.lateAfterBackground=0,this.lateAfterOther=0,this.gpuCost.clear(),this.aheadCost.clear(),this.longestFrameMs=0,this.lastShown=e}},_x=class{unsubscribe;constructor(e,t,n,r=()=>{}){this.unsubscribe=[e.addPlaybackStateListener((e,i)=>{n(),e===`seek`?t.seek(i):e===`pause`?t.pause():e===`play`&&(t.getState()===`ready`||t.getState()===`finished`?t.start():t.resume()),r()}),e.addPlaybackEndedListener(()=>{t.finish(),r()})]}dispose(){for(let e of this.unsubscribe)e()}};function vx(e,t,n,r,i,a=Dd){let o=new q,s=1/0,c=null,l;for(let r of t){if(r.status!==`pending`)continue;Gf(r.note,n,o,a),i?.projectPlayfieldPoint(o);let t=o.clone().sub(e.origin).dot(e.direction);if(t<0||t>=s)continue;let u=a.noteSizeMeters/2+.02,d=new Ir(o.clone().addScalar(-u),o.clone().addScalar(u));e.intersectsBox(d)&&(s=t,c=o.clone(),i?.unprojectPlayfieldPoint(c),l=r.note.id)}return c?{songTime:n,hand:r,position:c,speed:a.minStrikeSpeedMps,desktopTargetId:l}:null}var yx={Escape:`escape`,Enter:`enter`,NumpadEnter:`enter`,ArrowLeft:`left`,ArrowRight:`right`,ArrowUp:`up`,ArrowDown:`down`},bx=class{canvas;onStrike=null;onTogglePlayback=null;onPointerMove=null;onMenuKey=null;onLook=null;canLook=null;onGameplayPress=null;gesture=null;pointerMove=e=>{let t=this.canvas.getBoundingClientRect();if(!t.width||!t.height)return;let n=this.gesture;n&&e.pointerId!==n.id||(n&&(Math.hypot(e.clientX-n.startX,e.clientY-n.startY)>6&&(n.dragged=!0),n.dragged&&(e.preventDefault(),n.look&&this.canLook?.()!==!1&&this.onLook?.((e.clientX-n.x)/t.height,(e.clientY-n.y)/t.height),n.x=e.clientX,n.y=e.clientY)),this.onPointerMove?.((e.clientX-t.left)/t.width*2-1,-(e.clientY-t.top)/t.height*2+1))};pointerLeave=()=>this.onPointerMove?.(null,null);pointerDown=e=>{if(this.gesture||e.isPrimary===!1||e.button!==0&&e.button!==2)return;let t=this.canvas.getBoundingClientRect();if(!(!t.width||!t.height)){if(e.preventDefault(),e.button===0&&this.onLook){let n=this.onGameplayPress?.((e.clientX-t.left)/t.width*2-1,-(e.clientY-t.top)/t.height*2+1)??null;this.gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,dragged:!1,look:n!==!0&&this.canLook?.()!==!1,tap:n===null},this.canvas.setPointerCapture?.(e.pointerId);return}this.onStrike?.(e.button===0?`left`:`right`,(e.clientX-t.left)/t.width*2-1,-(e.clientY-t.top)/t.height*2+1)}};pointerUp=e=>{let t=this.gesture;if(!t||e.pointerId!==t.id||e.button!==0||(this.pointerMove(e),this.cancelGesture(),t.dragged||!t.tap))return;let n=this.canvas.getBoundingClientRect();!n.width||!n.height||this.onStrike?.(`left`,(e.clientX-n.left)/n.width*2-1,-(e.clientY-n.top)/n.height*2+1)};pointerCancel=e=>{this.gesture?.id===e.pointerId&&this.cancelGesture()};cancelGesture=()=>{let e=this.gesture;this.gesture=null,e&&this.canvas.hasPointerCapture?.(e.id)&&this.canvas.releasePointerCapture(e.id)};contextMenu=e=>e.preventDefault();keyDown=e=>{let t=e.target,n=typeof t?.closest==`function`&&!!t.closest(`input, button, select, textarea, [contenteditable="true"]`),r=yx[e.key];if(r&&!n&&!e.repeat){this.onMenuKey?.(r)&&e.preventDefault();return}e.code!==`Space`||e.repeat||n||(e.preventDefault(),this.onTogglePlayback?.())};constructor(e){this.canvas=e,e.addEventListener(`pointerdown`,this.pointerDown),e.addEventListener(`pointermove`,this.pointerMove),e.addEventListener(`pointerup`,this.pointerUp),e.addEventListener(`pointercancel`,this.pointerCancel),e.addEventListener(`lostpointercapture`,this.pointerCancel),e.addEventListener(`pointerleave`,this.pointerLeave),e.addEventListener(`contextmenu`,this.contextMenu),window.addEventListener(`keydown`,this.keyDown),window.addEventListener(`blur`,this.cancelGesture)}cancelPointerGesture(){this.cancelGesture()}dispose(){this.cancelGesture(),this.canvas.removeEventListener(`pointerdown`,this.pointerDown),this.canvas.removeEventListener(`pointermove`,this.pointerMove),this.canvas.removeEventListener(`pointerup`,this.pointerUp),this.canvas.removeEventListener(`pointercancel`,this.pointerCancel),this.canvas.removeEventListener(`lostpointercapture`,this.pointerCancel),this.canvas.removeEventListener(`pointerleave`,this.pointerLeave),this.canvas.removeEventListener(`contextmenu`,this.contextMenu),window.removeEventListener(`keydown`,this.keyDown),window.removeEventListener(`blur`,this.cancelGesture)}},xx=`xr-command-drawer`,Sx={idle:`no track loaded`,busy:`analyzing`,ready:`track ready`,error:`error`},Cx=class{root;menuButton;gameMenuButton;panel;fileInput;trackTitleEl;progressEl;errorEl;trackInfoEl;chartDiagnosticsEl;capabilityEl;enterVrButton;previewButton;onGameMenu=null;doc;opened=!1;status=`idle`;handleKeyDown=e=>{if(e.key!==`Escape`||!this.opened||this.root.hidden)return;let t=this.doc.activeElement;!t||!this.panel.contains(t)||(e.preventDefault(),this.close())};constructor(e=document){this.doc=e;let t=(t,n)=>{let r=e.createElement(t);return n&&(r.className=n),r};this.root=t(`div`,`xr-chrome`),this.menuButton=t(`button`,`xr-menu-button`),this.menuButton.type=`button`,this.menuButton.setAttribute(`aria-controls`,xx);let n=t(`span`,`xr-menu-icon`);n.setAttribute(`aria-hidden`,`true`),n.append(t(`span`),t(`span`),t(`span`));let r=t(`span`,`xr-menu-status`);r.setAttribute(`aria-hidden`,`true`),this.menuButton.append(n,r),this.menuButton.addEventListener(`click`,()=>this.toggle()),this.gameMenuButton=t(`button`,`xr-menu-button xr-game-menu-button`),this.gameMenuButton.type=`button`,this.gameMenuButton.title=`Game menu (Esc)`,this.gameMenuButton.setAttribute(`aria-label`,`Game menu: settings, pause and results (Escape)`),this.gameMenuButton.setAttribute(`aria-keyshortcuts`,`Escape`);let i=t(`span`,`xr-game-menu-icon`);i.setAttribute(`aria-hidden`,`true`),i.textContent=`⚙`,this.gameMenuButton.append(i),this.gameMenuButton.addEventListener(`click`,()=>{this.onGameMenu?.(),this.gameMenuButton.blur()}),this.panel=t(`div`,`xr-launch-overlay xr-drawer`),this.panel.id=xx,this.panel.setAttribute(`role`,`region`),this.panel.setAttribute(`aria-label`,`Plexus XR track`);let a=t(`h1`,`xr-launch-title`);a.textContent=`Plexus XR`,this.fileInput=t(`input`,`xr-file-input`),this.fileInput.type=`file`,this.fileInput.accept=`audio/*`,this.fileInput.setAttribute(`aria-label`,`Choose audio track`),this.trackTitleEl=t(`p`,`xr-track-title`),this.progressEl=t(`p`,`xr-progress`),this.progressEl.setAttribute(`aria-live`,`polite`),this.errorEl=t(`p`,`xr-error`),this.errorEl.setAttribute(`role`,`alert`),this.trackInfoEl=t(`p`,`xr-track-info`),this.chartDiagnosticsEl=t(`p`,`xr-chart-diagnostics`),this.capabilityEl=t(`p`,`xr-capability`),this.capabilityEl.textContent=`Checking WebXR support...`,this.enterVrButton=t(`button`,`xr-enter-button`),this.enterVrButton.type=`button`,this.enterVrButton.textContent=`Enter VR`,this.enterVrButton.disabled=!0,this.previewButton=t(`button`,`xr-preview-button`),this.previewButton.type=`button`,this.previewButton.textContent=`Play`,this.previewButton.disabled=!0;let o=t(`div`,`xr-actions`);o.append(this.previewButton,this.enterVrButton);let s=t(`p`,`xr-menu-hint`);s.textContent=`Settings, pause and results: game menu (⚙ or Esc). During play, drag with the mouse or swipe with one finger to look around.`,this.panel.append(a,this.fileInput,this.trackTitleEl,this.progressEl,this.errorEl,this.trackInfoEl,this.chartDiagnosticsEl,o,this.capabilityEl,s),this.root.append(this.menuButton,this.gameMenuButton,this.panel),e.addEventListener(`keydown`,this.handleKeyDown),this.setStatus(`idle`),this.open()}get isOpen(){return this.opened}open(){this.apply(!0)}close(){let e=this.doc.activeElement,t=!!e&&this.panel.contains(e);this.apply(!1),t&&this.menuButton.focus({preventScroll:!0})}toggle(){this.opened?this.close():this.open()}setGameMenuOpen(e){this.gameMenuButton.setAttribute(`aria-expanded`,String(e))}setStatus(e){this.status===e&&this.menuButton.dataset.status===e||(this.status=e,this.menuButton.dataset.status=e,this.menuButton.title=Sx[e],this.applyLabel())}setVisible(e){this.root.hidden=!e}dispose(){this.doc.removeEventListener(`keydown`,this.handleKeyDown),this.root.remove()}apply(e){this.opened=e,this.panel.dataset.open=String(e),this.panel.inert=!e,this.panel.setAttribute(`aria-hidden`,String(!e)),this.menuButton.setAttribute(`aria-expanded`,String(e)),this.applyLabel()}applyLabel(){this.menuButton.setAttribute(`aria-label`,`${this.opened?`Close`:`Open`} track panel, ${Sx[this.status]}`)}},wx=`plexus.xr.settings`,Tx=1,Ex=1,Dx={load:()=>pb,save:()=>{}};function Ox(e){if(!e)return Dx;let t=null;return{load(){try{let n=e.getItem(wx);if(!n)return pb;let r=JSON.parse(n);if(!r||typeof r!=`object`||r.version!==Tx)return pb;t=n;let i=r.system;if(i&&typeof i==`object`&&Object.hasOwn(i,`eventTiming`)){let{eventTiming:n,...a}=i,o=JSON.stringify({...r,system:a});try{e.setItem(wx,o),t=o}catch{}}let a=mb(r);return r.wallDefaultRevision===Ex?a:{...a,background:{...a.background,cosmos:{...a.background.cosmos,galaxies:a.background.cosmos.galaxies===1?0:a.background.cosmos.galaxies},wall:{...a.background.wall,mode:`off`}}}}catch{return pb}},save(n){let r=JSON.stringify({version:Tx,wallDefaultRevision:Ex,play:n.play,generation:n.generation,background:n.background,appearance:n.appearance,system:n.system});if(r!==t)try{e.setItem(wx,r),t=r}catch{}}}}async function kx(n,r,i={}){let a=E.forceLegacyDramaturgy?null:await e(n,{duration:r,stylePackId:`cosmic-wormhole`,activityLevel:i.activityLevel??`balanced`,variantMode:i.variantMode??`paired`});if(a?.points.length)return a;let o=await fetch(`/plexus-engine/visual-tuning-presets/index.json`);if(!o.ok)throw Error(`Could not load Wormhole presets.`);return t(n,((await o.json()).presets??[]).filter(e=>/^[\w .-]+\.json$/i.test(e)&&e!==`index.json`),r,{strategy:`dramaturgy`,presetMetadata:{},strictPresets:[],strictBars:8,strictMorph:1})}function Ax(e){let t=new Set,n=[],r=-1/0;for(let i of e)if(!(!Number.isInteger(i.phrase)||t.has(i.phrase)||!Number.isFinite(i.time))&&(t.add(i.phrase),!(i.time-r<1.5)&&(n.push({noteId:i.id,role:`signal`}),r=i.time,n.length>=1024)))break;return jp(e,n)}var jx=[`left`,`right`],Mx=.7,Nx=.3;function Px(e){if(!Number.isFinite(e)||e<0)return`0:00`;let t=Math.floor(e);return`${Math.floor(t/60)}:${(t%60).toString().padStart(2,`0`)}`}var Fx=[];function Ix(e,t){let n=Np(e.events,e.duration,t,e.trackAnalysis.rhythmOnsets,e.trackAnalysis.featureClock);return{events:n.events,eventSource:n.info,durationSec:e.duration,beats:e.trackAnalysis.beats,...n.info.kind===`grid-independent-percussive`?{attentionBudgetEvents:e.events}:{},barStarts:e.trackAnalysis.barStarts,timingConfidence:e.trackAnalysis.timingConfidence?.overall,performancePlan:e.performancePlan,sectionStarts:e.trackAnalysis.sections.map(e=>e.start),sections:e.trackAnalysis.sections,attention:nf(n.events,e.duration,e.frames,e.sampleRate,e.hopSize)}}var Lx=class{engine;runtime;scene;inputAdapter;session;haloChart=[];haloSections=[];haloMode=`off`;halosEnabled=!1;haloObserverFailed=!1;worldToPlayfield=new zn;viewerForward=new q;viewerRotation=new gn;playback;desktopInput;desktopRay=new ac;pointer=new K;loading=!1;loadGeneration=0;settings;gameConfig;playProfile;settingsStore;published=null;preparedPlan=null;chartDiagnostics=null;chartSummary=``;chartDetails=``;sectionTimelinePending=!1;disposed=!1;activeXrSession=null;referenceSpace=null;handleVisibility=()=>{this.activeXrSession?.visibilityState!==`visible`&&this.pauseGame()};handleReferenceReset=()=>{this.pauseGame(),this.headsetHeightSampled=!1};xrSupport=`unknown`;headsetHeightSampled=!1;menuPanel;menuState=Nb;menuOpen=!1;menuPlacementPending=!1;menuCameraAspect=0;menuCameraFov=0;menuCameraZoom=0;menuHand=`right`;menuHits={left:null,right:null};thumbArmed={left:!0,right:!0};pointerRay=new ki;menuRaycaster=new ac;desktopPointer=new K;desktopPointerInside=!1;desktopPointerMoved=!1;wormholeShown=!1;drawer;overlay;fileInput;trackTitleEl;progressEl;errorEl;trackInfoEl;capabilityEl;enterVrButton;previewButton;forcedDiagnostics;backgroundThread;frameCost={updateMs:0,renderMs:0,displayHz:0,gpuSamples:[],gpuTimer:!1,aheadSamples:[]};copyNotice=``;diagnosticsShown=!1;gpuMaterialSupported;diagnosticPathRevision=-1;diagnosticBackgroundMs=-1;backgroundDiagnostics=new gx;resultSnapshot=null;resultHint=``;resultText=``;constructor(e,t,n,r,i={}){this.forcedDiagnostics=i.diagnostics===!0,this.backgroundThread=i.backgroundThread??``,this.engine=e,this.runtime=t,this.settingsStore=i.settingsStore??Dx,this.settings=mb(this.settingsStore.load()),this.diagnosticsShown=this.diagnostics,this.runtime.measureFrameCost=this.diagnostics,this.playProfile=_b(this.settings),this.gameConfig=this.playProfile.config,this.session=new kp(this.gameConfig),this.scene=new jy(t.scene,this.gameConfig,r,i.nativeWormholeFactory),this.applyNoteHalos(!0),this.gpuMaterialSupported=i.gpuMaterial!==!1&&Jh(t.renderer),this.scene.setBackgroundPipeline(this.backgroundPipeline()),this.scene.setAdaptivePacing(this.settings.system.backgroundPacing===`adaptive`),this.scene.setStageLayout(this.playProfile.stage),this.scene.setBackgroundSettings(this.settings.background),this.scene.setNoteDesign(this.settings.appearance.noteDesign),this.scene.setCockpitSettings?.(this.settings.appearance.cockpit,this.settings.appearance.cockpitTitle),this.scene.setCockpitViewOrigin?.(t.isPresenting()?0:t.camera.position.z),this.scene.setSpiralDirection(this.settings.appearance.spiralDirection),this.inputAdapter=new Lp(t.renderer,t.scene),this.inputAdapter.setBladeLength(this.playProfile.bladeLengthMeters),this.menuPanel=new ux,t.scene.add(this.menuPanel.root),this.playback=new _x(e,this.session,()=>this.inputAdapter.resetMotion(),()=>this.handleTransportChanged()),this.desktopInput=new bx(t.renderer.domElement),this.desktopInput.canLook=()=>!this.runtime.isPresenting()&&!this.menuOpen,this.desktopInput.onLook=(e,t)=>this.runtime.rotateDesktopView(e,t),this.desktopInput.onGameplayPress=(e,t)=>this.runtime.isPresenting()||this.menuOpen||this.session.getState()!==`playing`?null:this.attemptDesktopStrike(`left`,e,t),this.desktopInput.onTogglePlayback=()=>this.toggleDesktopPlayback(),this.desktopInput.onPointerMove=(e,t)=>{this.desktopPointerInside=e!==null&&t!==null,e!==null&&t!==null&&this.desktopPointer.set(e,t),this.desktopPointerMoved=!0,this.menuOpen&&this.runtime.invalidate()},this.desktopInput.onMenuKey=e=>this.handleMenuKey(e),this.desktopInput.onStrike=(e,t,n)=>{if(!this.runtime.isPresenting()){if(this.menuOpen){this.desktopInput.onPointerMove?.(t,n),this.updateMenu(null),e===`left`&&this.menuState.hover&&this.activateMenu(this.menuState.hover);return}this.attemptDesktopStrike(e,t,n)}};let a=new Cx;this.drawer=a,this.overlay=a.panel,this.fileInput=a.fileInput,this.trackTitleEl=a.trackTitleEl,this.progressEl=a.progressEl,this.errorEl=a.errorEl,this.trackInfoEl=a.trackInfoEl,this.capabilityEl=a.capabilityEl,this.enterVrButton=a.enterVrButton,this.previewButton=a.previewButton,a.onGameMenu=()=>this.toggleGameMenu(),this.scene.onBackgroundFrame=()=>this.runtime.invalidate(),this.scene.onBackgroundError=e=>this.handleWormholeError(Error(e)),n.appendChild(a.root),this.wireAudioEngine(),this.wireInput(),this.wireDom(),this.runtime.setUpdateCallback((e,t)=>this.handleFrame(e,t)),this.runtime.onSessionStart=()=>this.handleSessionStart(),this.runtime.onSessionEnd=()=>this.handleSessionEnd(),this.refreshCapability(),this.refreshLaunchState(),this.applyWormholeSetting(),this.openMenu(`main`)}wireAudioEngine(){this.engine.onProgress=(e,t)=>{this.progressEl.textContent=`Analyzing: ${t} (${Math.round(e*100)}%)`,this.errorEl.textContent=``},this.engine.onAnalysisComplete=async()=>{this.disposed||!this.loading||(this.published={events:f.events,frames:f.frames,trackAnalysis:f.trackAnalysis,sampleRate:f.sampleRate,hopSize:f.hopSize,bpm:f.bpm,duration:f.duration},this.preparedPlan=null,this.clearChartDiagnostics(),this.sectionTimelinePending=!0,await this.composeChoreography(this.loadGeneration,!0))},this.engine.onAnalysisError=e=>{this.disposed||(this.clearChartDiagnostics(),this.loading=!1,this.showError(`Analysis failed: ${e}`),this.progressEl.textContent=``,this.refreshLaunchState())}}async composeChoreography(e,t){let n=this.published;if(!n)return;let r=this.settings.generation,i=`${r.activity}|${r.variation}`,a=this.preparedPlan,o=!a||a.key!==i;if(!a||o){this.progressEl.textContent=t?`Composing musical patterns...`:`Recomposing choreography...`;let o=!1,s;try{s=await kx(n.trackAnalysis,n.duration,{activityLevel:r.activity,variantMode:r.variation})}catch{o=!0,s={version:1,source:`auto`,points:[]}}if(this.disposed||e!==this.loadGeneration||!this.loading)return;a={key:i,plan:s,fallback:o}}if(this.disposed||e!==this.loadGeneration||!this.loading)return;let s={...n,performancePlan:a.plan},c=Ix(s,r.chartProfile),l=this.diagnostics?up(c,Dd,r):null,u=l?.chart??lp(c,Dd,r);this.setChartDiagnostics(l?.diagnostics??null,a.plan.cueAlignmentReport),this.preparedPlan=a,this.haloChart=u,this.haloSections=n.trackAnalysis.sections,this.applyNoteHalos(!0),this.session.loadChart(u,n.trackAnalysis.sections),this.scene.setScoreOverview(M_(this.session.getScoringPlan(),n.duration)),this.sectionTimelinePending&&(this.sectionTimelinePending=!1,this.scene.setSectionTimeline(vh(n.trackAnalysis.sections,n.trackAnalysis.beats,n.trackAnalysis.timingConfidence?.overall??0,n.duration))),(t||o)&&this.updateWormholeAnalysis(s),this.loading=!1;let d=a.fallback;this.progressEl.textContent=u.length?d?`Analysis complete. Basic patterns (visual plan unavailable).`:t?`Analysis complete. Musical choreography ready.`:`Choreography updated. Press Play to start.`:`No playable percussive events found. Choose another track.`;let p=s.trackAnalysis.eventTiming;if(p&&(this.progressEl.textContent+=` Experimental attack timing: ${p.observations.filter(e=>e.status===`refined`).length}/${p.observations.length} events localized.`),this.trackInfoEl.textContent=`BPM ${Math.round(f.bpm)} - Duration ${Px(f.duration)} - ${u.length} notes - ${u.filter(e=>e.cutDirection&&e.cutDirection!==`any`).length} arrows - ${u.filter(e=>e.pairId).length/2} pairs`,r.chartProfile===`musical-v1`){let e=lf(s.trackAnalysis.sections,s.duration).length>0;this.trackInfoEl.textContent+=e?` - Musical / Guarded`:` - Classic fallback / Guarded`,e||(this.progressEl.textContent+=` Musical profile needs complete sections; using Classic patterns with Guarded movement.`)}this.diagnostics&&(this.overlay.dataset.xrScore=JSON.stringify({confidence:s.trackAnalysis.timingConfidence,sections:s.trackAnalysis.sections.map(e=>[e.start,e.label]),cues:s.trackAnalysis.cues,points:s.performancePlan?.points,alignment:s.performancePlan?.cueAlignmentReport,...p?{eventTiming:p}:{},phrases:[...new Set(u.map(e=>e.phrase))].map(e=>{let t=u.filter(t=>t.phrase===e);return{phrase:e,start:t[0]?.time,end:t.at(-1)?.time,texture:t[0]?.texture,automationId:t[0]?.automationId,arrows:t.filter(e=>e.cutDirection!==`any`).length,pairs:t.filter(e=>e.pairId).length/2,rows:[...new Set(t.map(e=>e.row))]}})})),this.refreshLaunchState()}handleSettingsChange(e,t){this.disposed||(this.settings=e,this.settingsStore.save(e),t===`presentation`?this.applyPresentation():t===`session`?this.applySessionConfig():(this.applySessionConfig(),this.regenerateChart()))}applySessionConfig(){let e=_b(this.settings);e!==this.playProfile&&(this.pauseGame(),this.session.getState()!==`idle`&&this.engine.stop(!0),this.playProfile=e,this.gameConfig=e.config,this.scene.setGameConfig(e.config),this.scene.setStageLayout(e.stage),this.inputAdapter.setBladeLength(e.bladeLengthMeters),this.session.setConfig(e.config),this.refreshLaunchState(),this.runtime.invalidate())}regenerateChart(){if(this.clearChartDiagnostics(),!this.published)return;this.pauseGame(),this.engine.stop(!0);let e=++this.loadGeneration;this.loading=!0,this.haloChart=[],this.applyNoteHalos(!0),this.inputAdapter.resetMotion(),this.errorEl.textContent=``,this.refreshLaunchState(),this.composeChoreography(e,!1).catch(t=>{this.disposed||e!==this.loadGeneration||(this.loading=!1,this.showError(`Could not regenerate the chart: ${t instanceof Error?t.message:String(t)}`),this.refreshLaunchState())})}applyPresentation(){this.scene.setNoteDesign(this.settings.appearance.noteDesign),this.scene.setCockpitSettings?.(this.settings.appearance.cockpit,this.settings.appearance.cockpitTitle),this.scene.setSpiralDirection(this.settings.appearance.spiralDirection),this.applyNoteHalos(),this.applyDiagnosticsSetting();let e=this.scene.setBackgroundPipeline(this.backgroundPipeline());this.scene.setAdaptivePacing(this.settings.system.backgroundPacing===`adaptive`);let t=this.scene.setBackgroundSettings(this.settings.background);this.applyWormholeSetting(),Promise.all([e,t]).then(()=>this.runtime.invalidate()).catch(e=>this.handleWormholeError(e)),this.runtime.invalidate()}applyNoteHalos(e=!1){this.settings.appearance.noteHalos===`off`&&(this.haloObserverFailed=!1);let t=this.settings.appearance.noteHalos,n=t!==this.haloMode;this.haloMode=t;let r=t!==`off`&&!this.haloObserverFailed,i=r!==this.halosEnabled;i&&(this.halosEnabled=r,this.session.setResolutionObserver(r?this.scene.resolutionObserver:null)),(i||n||e)&&this.scene.setNoteRolePlan(r&&this.haloChart.length?t===`music`?Mp(this.haloChart,this.haloSections):Ax(this.haloChart):null)}get diagnostics(){return this.forcedDiagnostics||this.settings.system.diagnostics}backgroundPipeline(){let e=this.gpuMaterialSupported&&this.settings.system.materialRenderer===`gpu`;return{gpuMaterial:e,profile:this.diagnostics,gpuLines:e&&this.settings.system.grainLines===`gpu`,softwareRaster:this.settings.system.backgroundRaster===`cpu`,webglRaster:this.settings.system.backgroundRaster===`webgl`}}applyDiagnosticsSetting(){if(this.diagnostics!==this.diagnosticsShown&&(this.diagnosticsShown=this.diagnostics,this.runtime.measureFrameCost=this.diagnostics,this.diagnosticPathRevision=-1,this.diagnosticBackgroundMs=-1,delete this.overlay.dataset.xrTrackPath,delete this.overlay.dataset.xrBackgroundMs,this.clearChartDiagnostics(),this.diagnostics&&!this.loading&&this.published&&this.preparedPlan)){let e=up(Ix({...this.published,performancePlan:this.preparedPlan.plan},this.settings.generation.chartProfile),Dd,this.settings.generation);this.setChartDiagnostics(e.diagnostics)}}clearChartDiagnostics(){this.setChartDiagnostics(null),this.backgroundDiagnostics.clear(),delete this.overlay.dataset.xrBackgroundStages,delete this.overlay.dataset.xrScore}setChartDiagnostics(e,t=this.preparedPlan?.plan.cueAlignmentReport){this.chartDiagnostics=e;let n=e?this.published?.trackAnalysis.structureInterpretation:void 0;if(this.chartSummary=e?`Chart: ${e.retainedEvents}/${e.sourceEvents} events - ${e.notes} notes (L${e.hands.left}/R${e.hands.right})`:``,this.chartDetails=e?`${this.chartSummary}\nSkipped ${e.skippedEvents}; revoiced ${e.revoicedNotes} notes.\n`+Object.entries(e.rejected).map(([e,t])=>`${e}: ${t}`).join(` · `):``,e?.attention&&(this.chartDetails+=`\nLocal attention: ${e.attention.mode}; ${e.attention.selected}/${e.attention.candidates} candidates before movement${e.attention.budgetSource?`; budget: ${e.attention.budgetSource}`:``}.`),e?.eventSource&&(this.chartDetails+=`\nEvent source: ${e.eventSource.kind}; ${e.eventSource.addedEvents} additional measured peaks${e.eventSource.fallbackReason?`; ${e.eventSource.fallbackReason}`:``}.`),n){let e=`Structure: ${n.changedSections}/${n.decisions.length} labels updated from measured context`;this.chartSummary+=` - structure ${n.changedSections}/${n.decisions.length}`,this.chartDetails+=`\n${e}`,this.overlay.dataset.xrStructure=JSON.stringify({version:n.version,changedSections:n.changedSections,sections:n.decisions.length})}else delete this.overlay.dataset.xrStructure;e&&t?(this.chartDetails+=`
Automation: ${t.publishedPoints}/${t.proposedPoints} cue placements; automatic preset bases arrive at cues.`,this.overlay.dataset.xrAutomation=JSON.stringify({proposed:t.proposedPoints,published:t.publishedPoints})):delete this.overlay.dataset.xrAutomation,this.drawer.chartDiagnosticsEl.textContent=this.chartDetails,e?this.overlay.dataset.xrChartSelection=JSON.stringify({...e,decisions:void 0}):delete this.overlay.dataset.xrChartSelection}updateWormholeAnalysis(e){this.scene.setWormholeAnalysis(e).then(()=>this.runtime.invalidate()).catch(e=>this.handleWormholeError(e))}applyWormholeSetting(){let e=this.settings.background.wormhole;e!==this.wormholeShown&&(this.wormholeShown=e,this.scene.setWormholeEnabled(e).then(()=>this.runtime.invalidate()).catch(e=>this.handleWormholeError(e)),this.runtime.invalidate())}handleWormholeError(e){this.disposed||(this.showError(`Wormhole: ${e instanceof Error?e.message:String(e)}`),this.settings={...this.settings,background:{...this.settings.background,wormhole:!1}},this.settingsStore.save(this.settings),this.wormholeShown=!1,this.scene.setWormholeEnabled(!1),this.runtime.invalidate(),this.refreshLaunchState())}showError(e){this.errorEl.textContent=e,this.drawer.open()}handleTransportChanged(){let e=this.session.getState();if(this.runtime.setPlaying(e===`playing`),e===`playing`){this.closeMenu(),this.runtime.isPresenting()||this.drawer.close();return}(!this.menuOpen||e===`finished`&&this.menuState.screen!==`settings`)&&this.openMenu(Pb(e))}wireInput(){this.inputAdapter.onTriggerPress=e=>this.handleTriggerPress(e),this.inputAdapter.onPausePress=()=>this.handleGripPress()}wireDom(){this.fileInput.addEventListener(`change`,()=>{let e=this.fileInput.files?.[0];if(!e||this.loading)return;let t=++this.loadGeneration;this.loading=!0,this.published=null,this.preparedPlan=null,this.clearChartDiagnostics(),this.haloChart=[],this.applyNoteHalos(!0),this.session.clear(),this.scene.setSectionTimeline([]),this.scene.setScoreOverview(null),this.updateWormholeAnalysis(null),this.inputAdapter.resetMotion(),this.refreshLaunchState(),this.errorEl.textContent=``,this.progressEl.textContent=`Decoding audio...`,this.trackInfoEl.textContent=``,this.trackTitleEl.textContent=e.name.replace(/\.[^.]+$/,``),this.scene.setTrackTitle?.(e.name),this.engine.loadFile(e).catch(e=>{this.disposed||t!==this.loadGeneration||(this.loading=!1,this.showError(String(e)),this.refreshLaunchState())}),this.fileInput.value=``}),this.enterVrButton.addEventListener(`click`,()=>{this.enterVr()}),this.previewButton.addEventListener(`click`,()=>{this.toggleDesktopPlayback(),this.previewButton.blur()})}toggleDesktopPlayback(){this.runtime.isPresenting()||this.loading||this.session.getState()===`idle`||!this.session.getSnapshot().totalNotes||(this.session.getState()===`playing`?this.pauseGame():this.session.getState()===`paused`?this.engine.play():this.engine.play(0))}async refreshCapability(){if(this.xrSupport=await Pp(),!this.disposed){switch(this.xrSupport){case`supported`:this.capabilityEl.textContent=`WebXR immersive-vr: supported.`;break;case`unsupported`:this.capabilityEl.textContent=`WebXR immersive-vr is not supported on this device/browser.`;break;case`no-webxr`:this.capabilityEl.textContent=`WebXR is not available in this browser.`;break;default:this.capabilityEl.textContent=`Checking WebXR support...`}this.refreshLaunchState()}}refreshLaunchState(){this.runtime.setPlaying(this.session.getState()===`playing`);let e=this.session.getState()!==`idle`&&this.session.getSnapshot().totalNotes>0;this.fileInput.disabled=this.loading,this.previewButton.disabled=this.loading||!e,this.enterVrButton.disabled=this.loading||!(this.xrSupport===`supported`&&e),this.drawer.setStatus(this.loading?`busy`:this.errorEl.textContent?`error`:e?`ready`:`idle`)}async enterVr(){if(!(this.xrSupport!==`supported`||this.loading||this.runtime.isPresenting())){this.enterVrButton.disabled=!0;try{let e=await this.runtime.requestImmersiveSession();await Bp(e),Vp(this.runtime.renderer.xr),this.scene.setDisplayFrameRate(e.frameRate??72)}catch(e){this.showError(e instanceof Error?e.message:`Could not start the VR session.`)}finally{this.refreshLaunchState()}}}handleSessionStart(){this.scene.setCockpitViewOrigin?.(0),this.pauseGame(),this.headsetHeightSampled=!1,this.inputAdapter.resetMotion(),this.activeXrSession=this.runtime.renderer.xr.getSession(),this.activeXrSession?.addEventListener(`visibilitychange`,this.handleVisibility),this.referenceSpace=this.runtime.renderer.xr.getReferenceSpace(),this.referenceSpace?.addEventListener(`reset`,this.handleReferenceReset),this.drawer.setVisible(!1),this.openMenu(Pb(this.session.getState())),this.menuPlacementPending=!0}handleSessionEnd(){this.scene.setCockpitViewOrigin?.(this.runtime.camera.position.z),this.pauseGame(),this.scene.placeForViewer(0,1.65,0,0),this.scene.setDisplayFrameRate(null),this.activeXrSession?.removeEventListener(`visibilitychange`,this.handleVisibility),this.referenceSpace?.removeEventListener(`reset`,this.handleReferenceReset),this.activeXrSession=null,this.referenceSpace=null,this.drawer.setVisible(!0),this.headsetHeightSampled=!1,this.closeMenu(),this.disposed||this.openMenu(Pb(this.session.getState()))}handleTriggerPress(e){if(!this.runtime.isPresenting())return;if(!this.menuOpen){this.session.getState()!==`playing`&&this.openMenu(Pb(this.session.getState()));return}this.menuHand=e;let t=this.menuHits[e];!t||!this.headsetHeightSampled||(this.inputAdapter.pulseHaptics(e,.45,18),this.activateMenu(t))}activateMenu(e){let t=this.menuContext(),n=qb(this.menuState,t,this.menuPanel.update(this.menuState,t),e);this.menuState=n.state,this.copyNotice=``,n.command&&this.runMenuCommand(n.command),this.runtime.invalidate()}toggleGameMenu(){if(!this.runtime.isPresenting()){if(this.menuOpen){this.closeMenu(),this.runtime.invalidate();return}this.session.getState()===`playing`&&this.pauseGame(),this.openMenu(Pb(this.session.getState()))}}handleMenuKey(e){return this.runtime.isPresenting()?!1:(this.menuOpen&&this.desktopInput.cancelPointerGesture(),e===`escape`?(this.menuOpen?this.menuState.screen===`settings`?this.menuState={...this.menuState,screen:Pb(this.session.getState())}:this.menuState.screen===`pause`&&this.session.getState()===`paused`?this.runMenuCommand({type:`resume`}):this.closeMenu():this.toggleGameMenu(),this.runtime.invalidate(),!0):this.menuOpen?(e===`enter`?this.menuState.hover?this.activateMenu(this.menuState.hover):this.menuState=Wb(this.menuState,this.menuPanel.update(this.menuState,this.menuContext()),`next`):this.menuState=Wb(this.menuState,this.menuPanel.update(this.menuState,this.menuContext()),e),this.runtime.invalidate(),!0):!1)}handleGripPress(){if(!this.runtime.isPresenting()){this.pauseGame();return}this.session.getState()===`playing`?(this.pauseGame(),this.openMenu(`pause`)):this.menuOpen&&this.menuState.screen===`settings`?this.menuState={...this.menuState,screen:Pb(this.session.getState())}:this.menuOpen||this.openMenu(Pb(this.session.getState()))}runMenuCommand(e){switch(e.type){case`start`:if(this.loading||this.session.getState()!==`ready`)return;this.session.start(),this.engine.play(0);return;case`resume`:if(this.session.getState()!==`paused`)return;this.session.resume(),this.engine.play();return;case`restart`:if(this.loading||this.session.getState()===`idle`)return;this.session.getState()===`paused`&&this.engine.stop(!0),this.session.restart(),this.engine.play(0);return;case`exit-vr`:this.runtime.endActiveSession();return;case`settings-changed`:this.handleSettingsChange(e.settings,e.scope);return;case`copy-settings`:this.copyToClipboard(Jb(this.settings,this.trackTitleEl.textContent??``),`Settings`);return;case`copy-diagnostics`:this.diagnostics&&(this.backgroundDiagnostics.summary||this.chartDiagnostics)&&this.copyToClipboard(Zb(this.backgroundDiagnostics.summary,this.settings,this.trackTitleEl.textContent??``,this.chartDiagnostics??void 0,this.chartDiagnostics?this.published?.trackAnalysis.structureInterpretation:void 0,this.chartDiagnostics?this.preparedPlan?.plan.cueAlignmentReport:void 0),`Diagnostics + settings`);return}}copyToClipboard(e,t){dx(e).then(n=>{this.copyNotice=n?`${t} copied.`:`Clipboard blocked: try outside VR.`,n||console.info(e),this.runtime.invalidate()})}attemptDesktopStrike(e,t,n){if(this.session.getState()!==`playing`)return!1;let r=this.engine.getCurrentTime();this.pointer.set(t,n),this.desktopRay.setFromCamera(this.pointer,this.runtime.camera),this.desktopRay.ray.applyMatrix4(this.scene.getWorldToPlayfield(this.worldToPlayfield));let i=vx(this.desktopRay.ray,this.session.getActiveNotes(r),r,e,this.scene.path,this.gameConfig);return i!==null&&this.session.attemptStrike(i)!==null}openMenu(e){this.desktopInput.cancelPointerGesture(),this.menuState={...this.menuState,screen:e,hover:null},this.menuOpen||(this.menuPlacementPending=!0),this.menuOpen=!0,this.menuHits.left=null,this.menuHits.right=null,this.menuPanel.setVisible(!0),this.inputAdapter.setPointerMode(!0),this.drawer.setGameMenuOpen(!0),this.runtime.isPresenting()||this.placeMenuForDesktop(),this.runtime.invalidate()}closeMenu(){this.desktopInput.cancelPointerGesture(),this.menuOpen&&(this.menuOpen=!1,this.menuPanel.setVisible(!1),this.inputAdapter.setPointerMode(!1),this.drawer.setGameMenuOpen(!1),this.runtime.renderer.domElement.dataset.menuHover=`false`)}placeMenuForDesktop(){let e=this.runtime.camera;e.updateMatrixWorld(),this.menuPanel.placeForCamera(e),this.menuCameraAspect=e.aspect,this.menuCameraFov=e.fov,this.menuCameraZoom=e.zoom,this.menuPlacementPending=!1}menuContext(){let e=this.session.getState();return{settings:this.settings,sessionState:e,trackTitle:this.trackTitleEl.textContent??``,busy:this.loading,canStart:e!==`idle`&&this.session.getSnapshot().totalNotes>0,status:this.loading?this.progressEl.textContent??``:``,results:e===`finished`?Fb(this.session.getSnapshot()):null,input:this.runtime.isPresenting()?`vr`:`desktop`,...this.diagnostics&&this.backgroundDiagnostics.summary?{diagnostics:this.backgroundDiagnostics.summary}:{},...this.diagnostics&&this.chartSummary?{chartDiagnostics:this.chartSummary}:{},...this.copyNotice?{notice:this.copyNotice}:{}}}updateMenu(e){if(!this.runtime.isPresenting()){let e=this.runtime.camera;if((e.aspect!==this.menuCameraAspect||e.fov!==this.menuCameraFov||e.zoom!==this.menuCameraZoom)&&(this.placeMenuForDesktop(),this.desktopPointerMoved=!0),this.desktopPointerMoved){this.desktopPointerMoved=!1;let e=null;if(this.desktopPointerInside){this.menuRaycaster.setFromCamera(this.desktopPointer,this.runtime.camera);let t=this.menuPanel.hitTest(this.menuRaycaster.ray);e=t?.item&&!t.item.disabled?t.item.id:null}this.menuState={...this.menuState,hover:e},this.runtime.renderer.domElement.dataset.menuHover=String(e!==null)}this.menuPanel.update(this.menuState,this.menuContext());return}if(this.menuPlacementPending&&e){let t=this.runtime.renderer.xr.getReferenceSpace(),n=t?e.getViewerPose(t):null;if(n){let{position:e,orientation:t}=n.transform;this.viewerRotation.set(t.x,t.y,t.z,t.w),this.viewerForward.set(0,0,-1).applyQuaternion(this.viewerRotation),this.menuPanel.placeFacing(e.x,e.y,e.z,Math.atan2(-this.viewerForward.x,-this.viewerForward.z)),this.menuPlacementPending=!1}}let t=this.menuContext();for(let e of jx){let t=this.inputAdapter.getThumbstickX(e);Math.abs(t)<Nx?this.thumbArmed[e]=!0:Math.abs(t)>Mx&&this.thumbArmed[e]&&(this.thumbArmed[e]=!1,this.menuState=Qb(this.menuState,t>0?1:-1))}this.menuPanel.update(this.menuState,t);for(let e of jx){let t=this.inputAdapter.getPointerRay(e,this.pointerRay)?this.menuPanel.hitTest(this.pointerRay):null;this.menuHits[e]=t?.item&&!t.item.disabled?t.item.id:null,this.inputAdapter.setPointerLength(e,t?t.distance:null)}let n=this.menuHand===`left`?`right`:`left`,r=this.menuHits[this.menuHand]??this.menuHits[n];r!==this.menuState.hover&&(r&&this.inputAdapter.pulseHaptics(this.menuHits[this.menuHand]?this.menuHand:n,.15,10),this.menuState={...this.menuState,hover:r}),this.menuPanel.update(this.menuState,t)}pauseGame(){this.session.getState()===`playing`&&(this.session.pause(),this.engine.stop(!1)),this.inputAdapter.resetMotion()}sampleHeadsetHeightIfNeeded(e){if(this.headsetHeightSampled||!e)return;let t=this.runtime.renderer.xr.getReferenceSpace();if(!t)return;let n=e.getViewerPose(t);if(!n)return;let{position:r,orientation:i}=n.transform;this.viewerRotation.set(i.x,i.y,i.z,i.w),this.viewerForward.set(0,0,-1).applyQuaternion(this.viewerRotation);let a=Math.atan2(-this.viewerForward.x,-this.viewerForward.z);this.scene.placeForViewer(r.x,r.y,r.z,a),this.headsetHeightSampled=!0}currentInstruction(){if(!this.runtime.isPresenting()){if(this.session.getState()===`playing`)return`Blue: click / tap. Pink: right click. Drag empty space to look. Space: pause.`;if(this.session.getState()===`paused`)return`Paused. Space to resume.`;if(this.session.getState()===`ready`)return`Space or Play to start.`;if(this.session.getState()===`finished`)return this.resultInstruction(`Space to restart.`)}switch(this.session.getState()){case`idle`:return`Select a track to begin.`;case`ready`:return`Point at Start and pull a trigger.`;case`playing`:return`Cut along arrows. Dots: any direction. Grip: pause.`;case`paused`:return`Paused. Choose Resume in the menu.`;case`finished`:return this.resultInstruction(`Play again from the menu.`);default:return``}}resultInstruction(e){let t=this.session.getSnapshot();if(t!==this.resultSnapshot||e!==this.resultHint){let n=t.maxScore?t.score/t.maxScore:0;this.resultSnapshot=t,this.resultHint=e,this.resultText=`Rank ${Op(n)} - ${(n*100).toFixed(1)}%. ${e}`}return this.resultText}handleFrame(e,t){this.sampleHeadsetHeightIfNeeded(e);let n=this.engine.getCurrentTime(),r=this.session.getState()===`finished`?f.duration:n,i=this.runtime.renderer.xr.getReferenceSpace(),a=!!e&&!!i&&!!e.getViewerPose(i);e&&!a&&this.pauseGame(),this.inputAdapter.update(t,r,a&&!this.menuOpen),this.menuOpen&&this.updateMenu(e),this.scene.getWorldToPlayfield(this.worldToPlayfield);for(let e of jx){let t=this.inputAdapter.getStrikeAttempt(e,r,this.worldToPlayfield);if(!t)continue;this.scene.path.unprojectStrike(t);let n=this.session.attemptStrike(t);n&&this.inputAdapter.pulseHaptics(e,n.grade===`perfect`?1:.55,35)}this.session.update(r),!this.haloObserverFailed&&this.session.getResolutionObserverFailure()&&(this.haloObserverFailed=!0,this.applyNoteHalos(),this.showError(`Note halos unavailable. Gameplay continues.`));let o=this.session.getActiveNotes(r);if(this.scene.update(o,r,this.session.getSnapshot(),this.currentInstruction()),this.scene.prerender(this.runtime.renderer),this.diagnostics&&this.scene.path.revision!==this.diagnosticPathRevision){let e=this.scene.path;this.diagnosticPathRevision=e.revision,this.overlay.dataset.xrTrackPath=JSON.stringify({focusX:e.focusX,focusY:e.focusY,bendX:e.amplitudeX,bendY:e.amplitudeY})}if(this.diagnostics&&this.scene.backgroundRenderMs!==this.diagnosticBackgroundMs&&(this.diagnosticBackgroundMs=this.scene.backgroundRenderMs,this.overlay.dataset.xrBackgroundMs=this.diagnosticBackgroundMs.toFixed(2)),this.diagnostics){let{quality:e,rateHz:n}=this.settings.background,r=Math.round(this.scene.backgroundPacedHz),i=this.scene.backgroundLatencyMs,a=`${n} Hz${r>0?` paced ${r} Hz`:``}${i>0?`, ${i.toFixed(0)} ms latency`:``}`,o=this.settings.background.wormhole?this.scene.nativeWormholeActive?`Native grains (experimental), ${a}, ${this.scene.nativeExecutionLabel}`:`${e}, ${a}${this.backgroundThread?`, ${this.backgroundThread}`:``}, ${this.scene.gpuMaterialEnabled?`GPU`:`CPU`} material${this.scene.gpuLinesEnabled?`, GPU lines`:``}, ${this.scene.backgroundRasterLabel} raster${this.scene.backgroundUploadedAhead?`, upload ahead`:``}`:`Wormhole off`,s=this.frameCost;s.updateMs=this.runtime.lastUpdateMs,s.renderMs=this.runtime.lastRenderMs,s.displayHz=this.scene.displayFrameRate,s.gpuSamples=this.runtime.gpuSamples,s.gpuTimer=this.runtime.gpuTimerAvailable;let c=this.scene.backgroundAheadSamples;s.aheadSamples=c??Fx,this.backgroundDiagnostics.record(t,this.session.getState()===`playing`,this.scene.backgroundFramesShown,this.scene.backgroundRenderMs,this.scene.backgroundStageTimes,o,s)&&(this.overlay.dataset.xrBackgroundStages=this.backgroundDiagnostics.summary),c&&(c.length=0)}let s=this.session.getState()===`playing`?`Pause`:this.session.getState()===`paused`?`Resume`:this.session.getState()===`finished`?`Restart`:`Play`;this.previewButton.textContent!==s&&(this.previewButton.textContent=s)}dispose(){this.clearChartDiagnostics(),!this.disposed&&(this.disposed=!0,this.loadGeneration++,this.session.setResolutionObserver(null),this.haloChart=[],this.scene.setNoteRolePlan(null),this.handleSessionEnd(),this.playback.dispose(),this.desktopInput.dispose(),this.engine.onProgress=void 0,this.engine.onAnalysisComplete=void 0,this.engine.onAnalysisError=void 0,this.runtime.setUpdateCallback(null),this.runtime.onSessionStart=null,this.runtime.onSessionEnd=null,this.inputAdapter.dispose(),this.menuPanel.dispose(),this.scene.dispose(),this.drawer.dispose())}},Rx=class e{gl;ext;pending=[];free=[];active=null;constructor(e,t){this.gl=e,this.ext=t}static create(t){if(!t||typeof t.createQuery!=`function`)return null;let n=null;try{n=t.getExtension(`EXT_disjoint_timer_query_webgl2`)}catch{n=null}return n?new e(t,n):null}begin(){if(this.active||this.pending.length>=6)return;let e=this.free.pop()??this.gl.createQuery();e&&(this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT,e),this.active=e)}end(){this.active&&=(this.gl.endQuery(this.ext.TIME_ELAPSED_EXT),this.pending.push(this.active),null)}poll(e){e.length=0;let t=this.gl,n=!!t.getParameter(this.ext.GPU_DISJOINT_EXT);for(;this.pending.length;){let r=this.pending[0];if(!t.getQueryParameter(r,t.QUERY_RESULT_AVAILABLE))break;let i=t.getQueryParameter(r,t.QUERY_RESULT);this.pending.shift(),this.free.push(r),!n&&Number.isFinite(i)&&e.push(i/1e6)}if(n)for(;this.pending.length;)this.free.push(this.pending.shift())}dispose(){this.active&&=(this.gl.endQuery(this.ext.TIME_ELAPSED_EXT),this.free.push(this.active),null);for(let e of[...this.pending,...this.free])this.gl.deleteQuery(e);this.pending.length=0,this.free.length=0}},zx=class{renderer;scene;camera;container;updateCallback=null;lastFrameTimeMs=null;nextDesktopFrameMs=null;playing=!1;dirty=!0;loopArmed=!1;enteringXr=!1;desktopYaw=0;desktopPitch=0;desktopRotation=new Yn(0,0,0,`YXZ`);renderedFrames=0;diagnostics;measureFrameCost=!1;lastUpdateMsValue=0;lastRenderMsValue=0;gpuTimer=null;gpuTimerProbed=!1;gpuSamplesValue=[];animate=(e,t)=>this.handleFrame(e,t??null);visibilityChanged=()=>{this.lastFrameTimeMs=null,this.invalidate()};handleResizeBound=()=>this.handleResize();disposed=!1;sessionStarted=()=>{this.lastFrameTimeMs=null,this.resetDesktopView(),this.onSessionStart?.()};sessionEnded=()=>{this.lastFrameTimeMs=null,this.camera.position.set(0,1.65,2.6),this.resetDesktopView(),this.onSessionEnd?.(),this.handleResize()};onSessionStart=null;onSessionEnd=null;constructor(e,t={}){this.diagnostics=t.diagnostics===!0,this.container=e,this.renderer=new Ed({antialias:!1,alpha:!1}),this.renderer.xr.enabled=!0,e.appendChild(this.renderer.domElement),this.scene=new xr,this.scene.background=new Y(0),this.camera=new Is(70,Math.max(1,e.clientWidth)/Math.max(1,e.clientHeight),.05,$.cameraFarMeters),this.camera.position.set(0,1.65,2.6),window.addEventListener(`resize`,this.handleResizeBound),document.addEventListener(`visibilitychange`,this.visibilityChanged),this.renderer.xr.addEventListener(`sessionstart`,this.sessionStarted),this.renderer.xr.addEventListener(`sessionend`,this.sessionEnded),this.handleResize()}handleFrame(e,t){if(this.disposed)return;let n=this.renderer.xr.isPresenting;if(n&&!t)return;if(!n&&document.hidden){this.syncLoop();return}if(!n&&!this.dirty&&this.nextDesktopFrameMs!==null&&e+.1<this.nextDesktopFrameMs)return;if(!n){let t=(this.nextDesktopFrameMs??e)+1e3/60;this.nextDesktopFrameMs=t>e?t:e+1e3/60}let r=this.lastFrameTimeMs===null?0:(e-this.lastFrameTimeMs)/1e3;this.lastFrameTimeMs=e,this.dirty=!1;let i=this.diagnostics||this.measureFrameCost,a=i?performance.now():0;this.updateCallback?.(t,r);let o=i?performance.now()-a:0,s=i?performance.now():0,c=i?this.frameTimer():null;if(c?c.poll(this.gpuSamplesValue):this.gpuSamplesValue.length=0,c?.begin(),this.renderer.render(this.scene,this.camera),c?.end(),i&&(this.lastUpdateMsValue=o,this.lastRenderMsValue=performance.now()-s),this.diagnostics){let e=this.renderer.domElement;e.dataset.xrFrames=String(++this.renderedFrames),e.dataset.xrDrawCalls=String(this.renderer.info.render.calls),e.dataset.xrPixels=String(e.width*e.height),e.dataset.xrUpdateMs=o.toFixed(2)}this.syncLoop()}get lastUpdateMs(){return this.lastUpdateMsValue}get lastRenderMs(){return this.lastRenderMsValue}get gpuSamples(){return this.gpuSamplesValue}get gpuTimerAvailable(){return this.gpuTimer!==null}frameTimer(){return this.gpuTimerProbed||(this.gpuTimerProbed=!0,this.gpuTimer=Rx.create(this.renderer.getContext())),this.gpuTimer}setPlaying(e){this.playing!==e&&(this.lastFrameTimeMs=null,this.nextDesktopFrameMs=null),this.playing=e,this.invalidate()}invalidate(){this.dirty=!0,this.syncLoop()}syncLoop(){if(this.disposed)return;let e=this.renderer.xr.isPresenting||this.enteringXr||!document.hidden&&(this.playing||this.dirty);e!==this.loopArmed&&(this.loopArmed=e,this.renderer.setAnimationLoop(e?this.animate:null),e||(this.lastFrameTimeMs=null,this.nextDesktopFrameMs=null))}setUpdateCallback(e){this.updateCallback=e,this.invalidate()}rotateDesktopView(e,t){if(this.disposed||this.enteringXr||this.isPresenting()||!Number.isFinite(e)||!Number.isFinite(t))return;let n=this.camera.fov*Math.PI/180;this.desktopYaw=(this.desktopYaw+e*n)%(2*Math.PI),this.desktopPitch=Math.max(-Math.PI/2+.01,Math.min(Math.PI/2-.01,this.desktopPitch+t*n)),this.camera.quaternion.setFromEuler(this.desktopRotation.set(this.desktopPitch,this.desktopYaw,0,`YXZ`)),this.camera.updateMatrixWorld(!0),this.invalidate()}resetDesktopView(){this.desktopYaw=0,this.desktopPitch=0,this.camera.quaternion.identity(),this.camera.updateMatrixWorld(!0)}handleResize(){if(this.renderer.xr.isPresenting)return;let e=Math.max(1,this.container.clientWidth),t=Math.max(1,this.container.clientHeight);this.camera.aspect=e/t,this.camera.updateProjectionMatrix(),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25,Math.sqrt(1920*1080/(e*t)))),this.renderer.setSize(e,t),this.invalidate()}async requestImmersiveSession(){let e=navigator.xr;if(!e)throw Error(`WebXR is not available on this device/browser.`);this.renderer.xr.setReferenceSpaceType(`local-floor`);let t=await e.requestSession(`immersive-vr`,{requiredFeatures:[`local-floor`]});if(this.disposed)throw await t.end(),Error(`XR runtime disposed.`);this.enteringXr=!0,this.syncLoop();try{await this.renderer.xr.setSession(t)}catch(e){throw await t.end(),e}finally{this.enteringXr=!1,this.invalidate()}return t}endActiveSession(){let e=this.renderer.xr.getSession();e&&e.end()}isPresenting(){return this.renderer.xr.isPresenting}dispose(){this.disposed||(this.disposed=!0,this.renderer.setAnimationLoop(null),this.renderer.xr.removeEventListener(`sessionstart`,this.sessionStarted),this.renderer.xr.removeEventListener(`sessionend`,this.sessionEnded),window.removeEventListener(`resize`,this.handleResizeBound),document.removeEventListener(`visibilitychange`,this.visibilityChanged),this.endActiveSession(),this.gpuTimer?.dispose(),this.gpuTimer=null,this.renderer.dispose(),this.renderer.domElement.parentElement===this.container&&this.container.removeChild(this.renderer.domElement))}},Bx=1024,Vx=class{data=new Float32Array(Bx*24);count=0;active=!1;cols=0;rows=0;viewportWidth=0;viewportHeight=0;detail=0;amount=0;bloom=0;prepared=ee();reset(){this.active=!1,this.count=0}begin(e,t,n,r,i,a,o){this.active=!0,this.count=0,this.cols=Math.max(1,Math.floor(e)),this.rows=Math.max(1,Math.floor(t)),this.viewportWidth=n,this.viewportHeight=r,this.detail=i,this.amount=a,this.bloom=o}carrier(e){if(!this.active)return;let t=this.prepared;if(!T(this.cols,this.rows,this.viewportWidth,this.viewportHeight,e,this.detail,t))return;if((this.count+1)*24>this.data.length){let e=new Float32Array(this.data.length*2);e.set(this.data),this.data=e}let n=this.count*24,r=this.data;r[n+Ph.TAIL_X]=t.tailX,r[n+Ph.TAIL_Y]=t.tailY,r[n+Ph.TANGENT_X]=t.tangentX,r[n+Ph.TANGENT_Y]=t.tangentY,r[n+Ph.LENGTH]=t.length,r[n+Ph.RADIUS]=t.radius,r[n+Ph.CORE_RADIUS]=t.coreRadius,r[n+Ph.FLUX_GAIN]=t.flux*t.depositGain,r[n+Ph.COLOR_R]=t.colorR,r[n+Ph.COLOR_G]=t.colorG,r[n+Ph.COLOR_B]=t.colorB,r[n+Ph.HALO_GAIN]=t.haloGain,r[n+Ph.IDENTITY_HI]=t.identity>>>16&65535,r[n+Ph.IDENTITY_LO]=t.identity&65535,r[n+Ph.PHASE]=t.phase,r[n+Ph.FILAMENT_PHASE]=t.filamentPhase,r[n+Ph.FIBRE_PHASE]=t.fibrePhase,r[n+Ph.FILAMENT_FREQUENCY]=t.filamentFrequency,r[n+Ph.FIBRE_ACROSS]=t.fibreAcross,r[n+Ph.FIBRE_ALONG]=t.fibreAlong,r[n+Ph.FILAMENT_BIAS]=t.filamentBias,r[n+Ph.FILAMENT_FLOOR]=t.filamentFloor,r[n+Ph.FLAGS]=+!!t.isWeave+(t.filamented?2:0),r[n+Ph.NEGLIGIBLE]=t.negligible,this.count++}get frame(){return this.active?{cols:this.cols,rows:this.rows,amount:this.amount,bloom:this.bloom,detail:this.detail,count:this.count,data:this.data}:null}},Hx=2048,Ux=e=>(e>0?Math.min(255,Math.round(e)):0)/255,Wx=class{data=new Float32Array(Hx*9);count=0;square=!1;width=1;height=1;reset(e,t){this.count=0,this.square=!1,this.width=Math.max(1,Math.floor(e)),this.height=Math.max(1,Math.floor(t))}line(e,t,n,r,i,a,o,s,c,l){let u=c/255;if(!(u>0))return;if((this.count+1)*9>this.data.length){let e=new Float32Array(this.data.length*2);e.set(this.data),this.data=e}let d=this.count*9,f=this.data;f[d+Zh.X1]=e,f[d+Zh.Y1]=t,f[d+Zh.X2]=n,f[d+Zh.Y2]=r,f[d+Zh.WIDTH]=Math.max(1e-4,i),f[d+Zh.R]=Ux(a),f[d+Zh.G]=Ux(o),f[d+Zh.B]=Ux(s),f[d+Zh.A]=Math.min(1,u),this.square=l,this.count++}get frame(){return{width:this.width,height:this.height,square:this.square,count:this.count,data:this.data}}};function Gx(){return{frames:[],events:[],sampleRate:44100,hopSize:1024,bpm:0,trackAnalysis:_(),currentTime:0,isExporting:!1,exportTime:0,playbackFade:0,visualTuning:a(),targetTuning:a(),activeVisualTransitionId:null,spiralTransitionAnchor:null,currentFrame:{e:0,densityProj:0,melodyProj:0,fxProj:0,subEnergy:0,bassEnergy:0,subFlux:0,bassFlux:0,perceptualSpectrum:Array(24).fill(0),state:`IDLE`,eRatio:0},currentFeatures:{melody:0,vocal:0,fx:0,density:0,brightness:0,tension:0},modulation:{subEnergy:0,bassEnergy:0,subFlux:0,bassFlux:0,kineticTension:0,densityDrive:0,spectralChaos:0,rhythmicImpulse:0,macroMomentum:0},beatDecay:0,denseImpactFlash:0,directorOutput:{state:`IDLE`,centripetalOrbit:0,glitchIntensity:0,invertBackground:!1}}}var Kx=[`wormholeNebulaAmount`,`wormholeNebulaDetail`,`wormholeNebulaBloom`,`wormholeNebulaWeave`,`wormholeSpiral`,`wormholeSpiralArms`,`wormholeGrainDensity`],qx=class{state;identity;rawTuning;macros;boosts;policy;spiralDirection=`auto`;cosmos={};wall=null;wallPresetGates=new Map;denseEvents=[];activePreset=``;director=new j;resolver=new l;semanticBase=a();semantic=new s(this.resolver,()=>this.semanticBase);choreography=null;motifRuntime=new r;semanticProjection=new S;plan=null;analysis=null;get performancePlan(){return this.plan}presets=new Map;finiteRevisionApplied=-1;lastPoint=null;boosted=a();boostedBase=a();finiteAutomation=new C;spiralAutomation=new w;spiralPreset=e=>this.presets.get(e);resolveSpiralTuning=(e,t)=>this.resolveTuning(e,t);constructor(e){if(e.version!==1)throw Error(`Unsupported Wormhole context seed`);this.rawTuning={...e.rawTuning},this.macros={...e.macros},this.boosts={...re(),...e.boosts},this.policy={...e.policy},this.prepare(null)}prepare(e){this.analysis=e,this.spiralAutomation.invalidate(),this.finiteAutomation.invalidate(),this.state=Gx(),e&&Object.assign(this.state,e),this.identity=new N(this.state),this.cosmos.sky!==void 0&&this.identity.setSkyboxEnabled(this.cosmos.sky>0),this.director=new j,this.resolver=new l,this.resolver.setPlan(e?.trackAnalysis.externalVisualScorePlan??null),this.semanticBase={...this.rawTuning},this.semantic=new s(this.resolver,()=>this.semanticBase),this.plan=null,this.presets.clear(),this.wallPresetGates.clear(),this.lastPoint=null,this.motifRuntime=new r,this.semanticProjection=new S,this.denseEvents=this.state.events.filter(e=>e.type===2),this.choreography=e&&this.policy.semanticResolver?o(u(ne(e.trackAnalysis)),e.trackAnalysis):null,Object.assign(this.state.targetTuning,this.rawTuning),this.resolveTuning(this.state.targetTuning,this.state.visualTuning),this.activePreset=``}rewind(){let e=this.plan,t=new Map(this.presets);this.prepare(this.analysis),e?this.preparePlan(e,t):this.presets=t}preparePlan(e,t){let n=new Map;for(let r of new Set(e.points.map(e=>e.preset))){let e=t.get(r);if(!e||typeof e!=`object`)throw Error(`Missing Wormhole preset: ${r}`);n.set(r,JSON.parse(JSON.stringify(e)))}this.plan=e.points.length>0&&e.points.every(c)?v(e,1,{durationSec:this.analysis?.duration}):e,this.presets=n,this.wallPresetGates.clear();for(let[e,t]of n)this.wallPresetGates.set(e,p(t,this.rawTuning).wormholeOpticsEnabled>=.5);this.spiralAutomation.invalidate(),this.finiteAutomation.invalidate(),this.finiteAutomation.configure(this.plan,this.spiralPreset,0,this.resolveSpiralTuning,this.rawTuning),this.spiralAutomation.configure(this.plan,this.spiralPreset,0,this.resolveSpiralTuning,this.rawTuning)}resolveTuning(e,t){if(this.policy.gains===`meta`?ae(e,this.macros,this.boosts,t):Object.assign(t,e),this.cosmos.stars!==void 0&&(t.wormholeStarfield=this.cosmos.stars),this.cosmos.galaxies!==void 0&&(t.wormholeGalaxy=this.cosmos.galaxies),this.cosmos.sky!==void 0&&(t.wormholeSkybox=this.cosmos.sky),this.wall?.mode===`off`)t.wormholeWall=0,t.wormholeWallRefraction=0,t.wormholeWallCaustics=0,t.wormholeWallWaves=0,t.wormholeWallCracks=0;else if(this.wall){let e={amount:`wormholeWall`,fringe:`wormholeWallRefraction`,caustics:`wormholeWallCaustics`,waves:`wormholeWallWaves`,cracks:`wormholeWallCracks`};for(let n of hy){let r=e[n],i=n===`amount`&&this.wall.mode===`on`&&t[r]<=0?1:t[r];t[r]=oe(r,this.wall[n],i)}this.wall.material!==`preset`&&(t.wormholeWallMode=+(this.wall.material===`mosaic`))}return t}step(e,t,r,a,o,s){let c=this.state;c.currentTime=e,c.playbackFade=t?Math.min(1,c.playbackFade+r):c.playbackFade,o&&e<(a??0)&&(c.targetTuning={...this.rawTuning},this.semanticBase={...this.rawTuning},this.lastPoint=null),this.finiteAutomation.configure(this.plan,this.spiralPreset,0,this.resolveSpiralTuning,this.rawTuning);let l=n(this.plan,e);this.wall&&this.identity.setWallEnabled(this.wall.mode===`on`||this.wall.mode===`preset`&&(l?this.wallPresetGates.get(l.preset)??!1:this.rawTuning.wormholeOpticsEnabled>=.5)),l&&(l!==this.lastPoint||this.finiteRevisionApplied!==this.finiteAutomation.revision)&&((this.policy.semanticResolver||this.policy.semanticChoreography)&&Object.assign(c.targetTuning,this.semanticBase),h(c.targetTuning,this.presets.get(l.preset),l),this.finiteAutomation.applyCanonicalTarget(l,c.targetTuning),this.finiteRevisionApplied=this.finiteAutomation.revision,this.semanticBase={...c.targetTuning},this.lastPoint=l);let u=null;this.semantic.restoreBaseTuning(c.targetTuning),this.policy.semanticChoreography&&this.resolver.hasPlan()?(this.motifRuntime.clear(c.targetTuning,this.semanticBase),u=b(this.semantic.update(e,c.targetTuning))):this.choreography?u=P(this.motifRuntime.update(this.choreography,e,this.semanticBase,c.targetTuning)):this.motifRuntime.clear(c.targetTuning,this.semanticBase);let d=l?`automation:${l.id}`:``;c.activeVisualTransitionId=d&&u?`${d}|${u}`:d||u||null,this.resolveTuning(c.targetTuning,this.boosted),this.spiralDirection!==`auto`&&(this.boosted.wormholeSpiralDirection=this.spiralDirection===`left`?-1:1);let f=this.policy.semanticChoreography&&this.resolver.hasPlan()||!!this.choreography?.score;f&&(this.resolveTuning(this.semanticBase,this.boostedBase),this.spiralDirection!==`auto`&&(this.boostedBase.wormholeSpiralDirection=this.spiralDirection===`left`?-1:1));let p=f?this.boostedBase:this.boosted;this.semanticProjection.restore(c.visualTuning),s?Object.assign(c.visualTuning,p):i(c.visualTuning,p,p.transitionSpeed,r),this.finiteAutomation.apply(e,c.visualTuning,p),this.spiralDirection===`auto`||l?.cuePlacement?(this.spiralAutomation.configure(this.plan,this.spiralPreset,0,this.resolveSpiralTuning,this.rawTuning),this.spiralAutomation.apply(e,c.visualTuning,p),c.spiralTransitionAnchor=this.spiralDirection===`auto`?this.spiralAutomation.transitionAnchor:null):c.spiralTransitionAnchor=null,this.spiralDirection!==`auto`&&l?.cuePlacement&&(c.visualTuning.wormholeSpiralDirection=this.spiralDirection===`left`?-1:1),f&&this.semanticProjection.apply(c.visualTuning,this.boostedBase,this.boosted);let m=Math.max(0,Math.floor(e*c.sampleRate/c.hopSize));c.frames[m]&&Object.assign(c.currentFrame,c.frames[m]),c.trackAnalysis.features[m]&&Object.assign(c.currentFeatures,c.trackAnalysis.features[m]);let _=c.events[Jx(c.events,e)],v=this.denseEvents[Jx(this.denseEvents,e)],x=c.trackAnalysis.cues[Jx(c.trackAnalysis.cues,e)];c.beatDecay=_?y(g,e-_.time):0,c.denseImpactFlash=v?y(te,e-v.time):0;let S=x?x.intensity*y(k,e-x.time):0;M(c.modulation,c.currentFrame,c.currentFeatures,c.beatDecay,S,c.visualTuning);let C=c.frames[Math.floor((e+c.visualTuning.dropAnticipation)*c.sampleRate/c.hopSize)];c.directorOutput=this.director.update(e,c.currentFrame,c.currentFeatures,c.trackAnalysis.buildupConfidence[m]??0,c.trackAnalysis.spectralPivot[m]??0,c.visualTuning,c.modulation,c.visualTuning.dropAnticipation>0?C:void 0),o&&this.identity.syncPosition(e),this.activePreset=l?.preset??``}setPresentation(e){let t=!1,n=!1;if(e.wall){let n={...this.wall??gy},r=e.wall;(r.mode===`off`||r.mode===`preset`||r.mode===`on`)&&(n.mode=r.mode),(r.material===`preset`||r.material===`membrane`||r.material===`mosaic`)&&(n.material=r.material);for(let e of hy){let t=r[e];t!==void 0&&Number.isFinite(t)&&(n[e]=Math.max(0,Math.min(1,t)))}JSON.stringify(n)!==JSON.stringify(this.wall)&&(this.wall=n,t=!0)}for(let n of[`stars`,`galaxies`,`sky`]){let r=e.cosmos?.[n];if(r===void 0||!Number.isFinite(r))continue;let i=Math.min(n===`sky`?1:2,Math.max(0,r));i!==this.cosmos[n]&&(this.cosmos={...this.cosmos,[n]:i},t=!0)}if(e.spiralDirection!==void 0){let t=e.spiralDirection===`left`||e.spiralDirection===`right`?e.spiralDirection:`auto`;t!==this.spiralDirection&&(this.spiralDirection=t,n=!0)}for(let n of[`intensity`,`motion`,`depth`,`detail`]){let r=e.macros?.[n];if(r===void 0||!Number.isFinite(r))continue;let i=Math.min(1,Math.max(0,r));i!==this.macros[n]&&(this.macros[n]=i,t=!0)}for(let[n,r]of Object.entries(e.grainMaterial??{})){if(!Kx.includes(n)||r===void 0||!Number.isFinite(r))continue;let e=Math.min(1,Math.max(0,r));e!==this.boosts[n]&&(this.boosts[n]=e,t=!0)}let r=e.lineStroke;if(r!==void 0&&Number.isFinite(r)){let e=Math.min(1,Math.max(0,r));e!==this.boosts.lineWeight&&(this.boosts.lineWeight=e,t=!0)}return t&&(this.spiralAutomation.invalidate(),this.finiteAutomation.invalidate()),this.cosmos.sky!==void 0&&this.identity.setSkyboxEnabled(this.cosmos.sky>0),{tuningChanged:t,directionChanged:n}}dispose(){this.plan=null,this.presets.clear(),this.spiralAutomation.invalidate(),this.finiteAutomation.invalidate()}};function Jx(e,t){let n=0,r=e.length;for(;n<r;){let i=n+r>>>1;e[i].time<=t?n=i+1:r=i}return n-1}function Yx(e,t){let n=document.createElement(`canvas`);return n.width=e,n.height=t,n}var Xx=class{canvas;compactMaterialPreview=!0;logicalWidth=null;logicalHeight=null;transparentBackground=!1;frameCount=0;ctx;raster;strokeActive=!0;fillActive=!0;firstVertex=!0;strokeR=0;strokeG=0;strokeB=0;strokeA=255;appliedR=NaN;appliedG=NaN;appliedB=NaN;alpha=1;cap=`round`;constructor(e,t,n=Yx){this.canvas=n(e,t),this.raster=n===Yx?new O:new O(()=>n(1,1));let r=this.canvas.getContext(`2d`);if(!r)throw Error(`Wormhole canvas is unavailable.`);this.ctx=r,r.lineCap=`round`}get width(){return this.logicalWidth??this.canvas.width}get height(){return this.logicalHeight??this.canvas.height}setPreviewSize(e,t,n,r,i){this.logicalWidth=e,this.logicalHeight=t,this.compactMaterialPreview=r,this.transparentBackground=i;let a=Math.max(1,Math.round(e*n)),o=Math.max(1,Math.round(t*n));(this.canvas.width!==a||this.canvas.height!==o)&&(this.canvas.width=a,this.canvas.height=o,this.appliedR=this.appliedG=this.appliedB=NaN,this.alpha=1,this.cap=`round`,this.ctx.lineCap=`round`),this.ctx.setTransform(a/e,0,0,o/t,0,0)}background(e,t,n,r=255){this.opaque(),this.ctx.save(),this.ctx.fillStyle=`rgba(${e},${t},${n},${r/255})`,this.ctx.clearRect(0,0,this.width,this.height),this.transparentBackground||this.ctx.fillRect(0,0,this.width,this.height),this.ctx.restore()}noStroke(){this.strokeActive=!1}noFill(){this.fillActive=!1}fill(e,t,n,r=255){this.fillActive=!0,this.ctx.fillStyle=`rgba(${e},${t},${n},${r/255})`}stroke(e,t,n,r=255){this.strokeActive=!0,this.strokeR=e,this.strokeG=t,this.strokeB=n,this.strokeA=r}strokeWeight(e){this.ctx.lineWidth=Math.max(1e-4,e)}line(e,t,n,r,i){if(!this.strokeActive)return;let a=i??`round`;a!==this.cap&&(this.cap=a,this.ctx.lineCap=a),this.applyStroke(),this.ctx.beginPath(),this.ctx.moveTo(e,t),this.ctx.lineTo(n,r),this.ctx.stroke()}paint(){this.fillActive&&(this.opaque(),this.ctx.fill()),this.strokeActive&&(this.applyStroke(),this.ctx.stroke())}applyStroke(){let e=this.strokeR,t=this.strokeG,n=this.strokeB;(e!==this.appliedR||t!==this.appliedG||n!==this.appliedB)&&(this.appliedR=e,this.appliedG=t,this.appliedB=n,this.ctx.strokeStyle=`rgb(${e},${t},${n})`);let r=this.strokeA/255;this.setAlpha(r>0?Math.min(1,r):0)}opaque(){this.setAlpha(1)}setAlpha(e){e!==this.alpha&&(this.alpha=e,this.ctx.globalAlpha=e)}circle(e,t,n){this.ctx.beginPath(),this.ctx.arc(e,t,Math.max(0,n/2),0,Math.PI*2),this.paint()}triangle(e,t,n,r,i,a){this.ctx.beginPath(),this.ctx.moveTo(e,t),this.ctx.lineTo(n,r),this.ctx.lineTo(i,a),this.ctx.closePath(),this.paint()}beginShape(){this.ctx.beginPath(),this.firstVertex=!0}vertex(e,t){this.firstVertex?this.ctx.moveTo(e,t):this.ctx.lineTo(e,t),this.firstVertex=!1}endShape(){this.paint()}radialGlow(e,t,n,r,i){this.opaque();let a=this.ctx.createRadialGradient(e,t,0,e,t,n);a.addColorStop(0,`rgba(${r.join(`,`)},${i})`),a.addColorStop(1,`rgba(8,5,14,0)`),this.ctx.save(),this.ctx.fillStyle=a,this.ctx.beginPath(),this.ctx.arc(e,t,n,0,Math.PI*2),this.ctx.fill(),this.ctx.restore()}radialDim(e,t,n,r,i){this.opaque();let a=this.ctx.createRadialGradient(e,t,Math.max(0,n),e,t,Math.max(n+1,r));a.addColorStop(0,`rgba(0,0,0,0)`),a.addColorStop(1,`rgba(0,0,0,${Math.min(1,Math.max(0,i))})`),this.ctx.save(),this.ctx.fillStyle=a,this.ctx.fillRect(0,0,this.width,this.height),this.ctx.restore()}compositeRingTint(e,t,n,r,i,a,o,s,c){this.opaque();let l=this.ctx.createRadialGradient(e,t,Math.max(0,n),e,t,Math.max(n+1,r)),u=`rgba(${i.join(`,`)},${Math.min(1,Math.max(0,a))})`;l.addColorStop(0,`rgba(0,0,0,0)`),l.addColorStop(.38,u),l.addColorStop(.68,u),l.addColorStop(1,`rgba(0,0,0,0)`),this.ctx.save();try{this.ctx.globalCompositeOperation=o,this.ctx.fillStyle=l,s!==void 0&&c!==void 0&&c>s&&(this.ctx.beginPath(),this.ctx.moveTo(e,t),this.ctx.arc(e,t,Math.hypot(this.width,this.height)*1.5,s,c),this.ctx.closePath(),this.ctx.clip()),this.ctx.fillRect(0,0,this.width,this.height)}finally{this.ctx.restore(),this.ctx.globalCompositeOperation=`source-over`}}beginFieldRaster(e,t,n){return this.raster.beginFieldRaster(e,t,n)}drawFieldRaster(e,t,n,r,i,a,o){this.opaque(),this.raster.drawFieldRaster(e,this.ctx,t,n,r,i,a,o)}},Zx=[.001,10],Qx=[1,.7,.35],$x=-2,eS=3.5,tS=50*1.2/1e3,nS=.05,rS=.001,iS=.5,aS=.82,oS=.55,sS=[0,0,0];function cS(e,t=0){return Number.isFinite(e)?e:t}function lS(e){return Number.isFinite(e)?Math.min(1,Math.max(0,e)):0}function uS(e,t){let n=e-Math.floor(e/t)*t;return n>=t?0:n}function dS(e){let t=Math.min(2,Math.max(0,cS(e))),n=Math.floor(t),r=Math.min(2,n+1),i=t-n;return Qx[n]+(Qx[r]-Qx[n])*i}function fS(){return{time:0,travel:0,travelRate:0,amount:0,density:0,radius:0,depth:0,spiralTurns:0,turbulence:0,tubeSpread:Zx[0],streak:0,wisp:0,hue:0,red:0,green:0,blue:0,hazeRed:0,hazeGreen:0,hazeBlue:0,pulse:0,impact:0}}function pS(e,t,n,r,i){e.time=Math.max(0,cS(t)),e.travel=Math.max(0,cS(r.travel)),e.travelRate=Math.min(4,Math.max(0,cS(r.travelRate)));let a=lS(.4*lS(cS(n.wormholeWarp)/5)+.35*lS(n.wormholeJitter)+.25*Math.sqrt(lS(n.wormholeNebulaAmount)));e.amount=lS(n.lineAlpha)*(iS+(1-iS)*a),e.density=lS(dS(n.wormholeEmissionMode)*(.6+.4*lS(n.wormholeGrainDensity))),e.radius=lS((cS(n.wormholeRadius)-.1)/2.9);let o=Math.max(nS,cS(n.wormholeRadius,nS))/Math.max(rS,cS(n.wormholeDepth,rS));e.depth=1-lS((Math.log2(o)-$x)/(eS-$x)),e.tubeSpread=Math.min(Zx[1],Math.max(Zx[0],tS*o)),e.spiralTurns=Math.min(8,Math.max(-8,cS(r.spiralTurns??0))),e.turbulence=lS(.7*lS(n.wormholeJitter)+.3*lS(n.wormholeCurve)),e.streak=lS(cS(n.wormholeContinuity)/2),e.wisp=lS(Math.sqrt(lS(n.wormholeNebulaAmount))*(.4+.6*lS(n.wormholeNebulaWeave))),e.hue=uS(cS(r.hue,cS(n.circleHue)),360);let s=Number.isFinite(r.red)&&Number.isFinite(r.green)&&Number.isFinite(r.blue);s||m(sS,e.hue,aS,oS),e.red=lS((s?r.red:sS[0])/255),e.green=lS((s?r.green:sS[1])/255),e.blue=lS((s?r.blue:sS[2])/255);let c=Number.isFinite(r.hazeRed)&&Number.isFinite(r.hazeGreen)&&Number.isFinite(r.hazeBlue);return e.hazeRed=c?lS(r.hazeRed/255):e.red,e.hazeGreen=c?lS(r.hazeGreen/255):e.green,e.hazeBlue=c?lS(r.hazeBlue/255):e.blue,e.pulse=lS(i.beatDecay),e.impact=lS(i.denseImpactFlash),e}function mS(e){return(t,n)=>{let r=e?e(t,n):Object.assign(document.createElement(`canvas`),{width:t,height:n});return r.getContext(`2d`,{willReadFrequently:!0}),r}}function hS(e,t,n){let r=n??((e,t)=>Object.assign(document.createElement(`canvas`),{width:e,height:t}));try{return new D(e,t,r)}catch{return null}}var gS=typeof performance<`u`?performance:null,_S=960,vS=540,yS=30;function bS(e,t){return Number.isFinite(e)&&e>=16?Math.round(e):t}var xS=768,SS=432,CS=class{onError=null;rasterFailed=!1;backend;canvas;rasterKind;context;get state(){return this.context.state}get identity(){return this.context.identity}get plan(){return this.context.performancePlan}minFrameIntervalSec=1/yS-.001;presentationDirty=!1;directionDirty=!1;lastTime=null;lastPlaying=!1;lastWallSec=NaN;revision=0;disposed=!1;preparationReady=!1;duration=0;diagnostics;profile;collector;material=null;lineCollector;lines=null;spatial=fS();spatialDrawn=!1;stages;depthCue;midBackend;nearBackend;layers;constructor(e={}){this.context=new qx(e.contextSeed??{version:1,rawTuning:a(),macros:py,boosts:my,policy:{gains:`meta`,semanticResolver:E.semanticResolver,semanticChoreography:E.semanticChoreography}}),this.diagnostics=e.diagnostics===!0,this.profile=e.profile===!0&&gS!==null,this.collector=e.externalMaterial===!0?new Vx:null,this.lineCollector=this.collector&&e.externalLines===!0?new Wx:null,this.stages=this.profile?{tune:0,background:0,grains:0,weave:0,resolve:0,composite:0,draw:0}:null;let t=e.softwareRaster===!0?mS(e.createSurface):e.createSurface,n=bS(e.width,_S),r=bS(e.height,vS);this.backend=(e.webglRaster===!0?hS(n,r,e.createSurface):null)??new Xx(n,r,t),this.rasterKind=this.backend instanceof D?`webgl`:`canvas2d`,this.canvas=this.backend.canvas,this.depthCue=e.depthCue??0,this.midBackend=e.depthLayers?new Xx(xS,SS,t):null,this.nearBackend=e.depthLayers?new Xx(xS,SS,t):null,this.midBackend&&this.nearBackend&&(this.layers=[this.canvas,this.midBackend.canvas,this.nearBackend.canvas]),this.configureIdentity(),this.diagnostics&&(this.canvas.hidden=!0,this.canvas.dataset.xrWormhole=`true`,document.body.appendChild(this.canvas))}get focalPoint(){return this.identity.routeFocus}get materialFrame(){return this.material}get lineFrame(){return this.lines}get spatialFrame(){return this.spatialDrawn?this.spatial:null}get stageTimes(){return this.stages}async prepare(e){let t=++this.revision;if(this.preparationReady=!1,this.duration=e?.duration??0,this.context.prepare(e),this.configureIdentity(),this.spatialDrawn=!1,this.lastTime=null,!e){this.preparationReady=!0;return}let n=e.performancePlan,r=new Map;await Promise.all([...new Set(n.points.map(e=>e.preset))].map(async e=>{let t=await fetch(`/plexus-engine/visual-tuning-presets/${encodeURIComponent(e)}`);if(!t.ok)throw Error(`Could not load Wormhole preset: ${e}`);r.set(e,await t.json())})),!(this.disposed||t!==this.revision)&&(this.context.preparePlan(n,r),this.lastTime=null,this.preparationReady=!0)}render(e,t,n){return this.renderFrame(e,t,n,!1)}renderExact(e){if(this.disposed||!this.preparationReady)throw Error(`Exact Wormhole source is not prepared.`);if(!Number.isFinite(this.duration)||this.duration<0||!Number.isFinite(e)||e<0||e>this.duration)throw Error(`Exact Wormhole time outside prepared track.`);this.context.rewind(),this.configureIdentity(),this.lastTime=null,this.lastPlaying=!1,this.backend.frameCount=0;let t=Math.floor(e*60);t/60>e&&t--;for(let e=0;e<=t;e++)if(!this.renderFrame(e/60,!0,!0,!0))throw Error(`Exact Wormhole frame unavailable.`);if(t/60<e&&!this.renderFrame(e,!0,!0,!0))throw Error(`Exact Wormhole endpoint unavailable.`)}renderFrame(e,t,n,r){if(this.disposed||this.rasterFailed)return!1;if(this.backend instanceof D&&this.backend.contextLost){this.rasterFailed=!0;let e=`Wormhole WebGL context lost. Re-enable the background to retry.`;if(this.onError)return this.onError(e),!1;throw Error(e)}let i=this.stages?gS.now():0,a=this.lastTime,o=!r&&gS?gS.now()/1e3:NaN,s=a===null?NaN:e-a,c=t&&this.lastPlaying&&s>=0&&(n===void 0?F(s,o-this.lastWallSec):n),l=a!==null&&!c&&(e<a||s>.25),u=this.presentationDirty;if(!r&&a!==null&&t===this.lastPlaying&&!l&&!u&&!this.directionDirty&&s<this.minFrameIntervalSec)return!1;this.presentationDirty=!1,this.directionDirty=!1;let d=r?a===null?1/60:s:c?Math.min(s,1):x(e,a);this.lastTime=e,this.lastPlaying=t,this.lastWallSec=o,this.context.step(e,t,d,a,l,a===null||l||!r&&u);let f=this.state;this.backend.frameCount++,this.midBackend?.background(0,0,0),this.nearBackend?.background(0,0,0);let p=this.stages?gS.now():0;return this.collector?.reset(),this.lineCollector?.reset(this.backend.width,this.backend.height),this.identity.draw(this.backend,[],[]),this.backend instanceof D&&this.backend.finish(),this.material=this.collector?.frame??null,this.lines=this.material&&this.lineCollector?this.lineCollector.frame:null,pS(this.spatial,e,f.visualTuning,this.identity.frameDrive,f),this.spatialDrawn=!0,this.stages&&(this.stages.tune=p-i,Object.assign(this.stages,this.identity.stageTimes),this.stages.draw=gS.now()-p),this.diagnostics&&(this.canvas.dataset.frames=String(this.backend.frameCount),this.canvas.dataset.tuning=JSON.stringify(f.visualTuning),this.canvas.dataset.point=this.context.activePreset),!0}setPresentation(e){let t=this.context.setPresentation(e);this.presentationDirty||=t.tuningChanged,this.directionDirty||=t.directionChanged;let n=e.maxFrameRateHz;n!==void 0&&Number.isFinite(n)&&n>0&&(this.minFrameIntervalSec=Math.max(0,1/n-.004))}dispose(){this.disposed=!0,++this.revision,this.context.dispose(),this.backend instanceof D&&this.backend.dispose(),this.canvas.width=this.canvas.height=1;for(let e of[this.midBackend,this.nearBackend])e&&(e.canvas.width=e.canvas.height=1);this.diagnostics&&this.canvas.remove()}configureIdentity(){this.profile&&this.identity.setStageClock(gS),this.collector&&this.identity.setMaterialSink(this.collector),this.lineCollector&&this.identity.setLineSink(this.lineCollector),this.identity.setDepthCue(this.depthCue),this.identity.setDepthLayers(this.midBackend&&this.nearBackend?{mid:this.midBackend,near:this.nearBackend}:null)}};function wS(e){return new Worker(`/plexus-engine/assets/wormholeRender.worker-DOTYM1LN.js`,{name:e?.name})}var TS=960,ES=540,DS=30,OS=.25,kS=.3,AS=typeof performance<`u`?performance:null;function jS(e=typeof document>`u`?void 0:document){if(typeof Worker>`u`)return`no Worker`;if(typeof OffscreenCanvas>`u`)return`no OffscreenCanvas`;if(!e)return`no document`;if(typeof OffscreenCanvas.prototype.transferToImageBitmap!=`function`)return`no transferToImageBitmap`;try{return e.createElement(`canvas`).getContext(`bitmaprenderer`)?``:`no bitmaprenderer`}catch{return`no bitmaprenderer`}}function MS(e,t){return t!==null&&e.frames===t.frames&&e.events===t.events&&e.trackAnalysis===t.trackAnalysis&&e.sampleRate===t.sampleRate&&e.hopSize===t.hopSize&&e.bpm===t.bpm&&e.duration===t.duration}var NS=class{canvas;onFrameReady=null;onError=null;presenter;worker;focus={x:0,y:0};diagnostics;generation=0;preparedGeneration=-1;preparing=null;sentAnalysis=null;pending=null;receivedSerial=0;rasterKindValue=null;shownSerialValue=0;spatial={};spatialShown=!1;stages=null;material=null;lines=null;inFlight=!1;lastTime=NaN;lastPlaying=!1;presentationDirty=!1;leadSec=1/DS;requestedAt=0;requestedSongTime=NaN;requestedPlaying=!1;requestedRenderTime=NaN;latencyMs=0;renderMs=0;shownFrames=0;failure=null;disposed=!1;constructor(e={}){this.diagnostics=e.diagnostics===!0;let t=Math.round(e.width??TS),n=Math.round(e.height??ES);this.canvas=document.createElement(`canvas`),this.canvas.width=t,this.canvas.height=n;let r=this.canvas.getContext(`bitmaprenderer`);if(!r)throw Error(`ImageBitmap presentation is unavailable.`);this.presenter=r,this.worker=e.createWorker?e.createWorker():new wS,this.worker.onmessage=e=>this.receive(e.data),this.worker.onerror=e=>this.fail(e.message||`Wormhole worker error.`),this.worker.postMessage({type:`init`,protocol:1,width:t,height:n,depthCue:e.depthCue??0,...e.profile?{profile:!0}:{},...e.externalMaterial?{externalMaterial:!0}:{},...e.externalMaterial&&e.externalLines?{externalLines:!0}:{},...e.softwareRaster?{softwareRaster:!0}:{},...e.webglRaster?{webglRaster:!0}:{}}),this.diagnostics&&(this.canvas.hidden=!0,this.canvas.dataset.xrWormhole=`worker`,document.body.appendChild(this.canvas))}get focalPoint(){return this.focus}get frameLatencyMs(){return this.latencyMs}get lastRenderMs(){return this.renderMs}get materialFrame(){return this.material}get lineFrame(){return this.lines}get spatialFrame(){return this.spatialShown?this.spatial:null}get stagedImage(){return this.pending?.bitmap??null}get stagedSerial(){return this.pending?.serial??0}get stagedMaterialFrame(){return this.pending?.material??null}get stagedLineFrame(){return this.pending?.lines??null}get shownSerial(){return this.shownSerialValue}get rasterKind(){return this.rasterKindValue}get stageTimes(){return this.stages}prepare(e){if(this.disposed)return Promise.resolve();if(this.failure)return Promise.reject(Error(this.failure));let t=++this.generation;this.preparing?.resolve(),this.preparing=null,this.discardPending(),this.inFlight=!1,this.lastTime=NaN;let n=e!==null&&MS(e,this.sentAnalysis)?e.performancePlan:null;return new Promise((r,i)=>{this.preparing={generation:t,resolve:r,reject:i};try{n?this.worker.postMessage({type:`prepare-plan`,generation:t,performancePlan:n}):(this.sentAnalysis=null,this.worker.postMessage({type:`prepare`,generation:t,analysis:e&&ie(e)}),this.sentAnalysis=e)}catch(e){this.preparing=null,i(e instanceof Error?e:Error(String(e)))}})}render(e,t){if(this.disposed||this.failure)return!1;let n=!1,r=this.pending;if(r){this.pending=null,this.presenter.transferFromImageBitmap(r.bitmap),this.shownSerialValue=r.serial,this.focus.x=r.focalX,this.focus.y=r.focalY,r.spatial&&Object.assign(this.spatial,r.spatial),this.spatialShown=r.spatial!==null,this.renderMs=r.renderMs,this.stages=r.stages;let i=this.material;this.material=r.material,this.lines=r.lines,i!==r.material&&this.releaseMaterial(i),this.diagnostics&&(this.canvas.dataset.frames=String(++this.shownFrames));let a=e-r.requestedSongTime;t&&r.requestedPlaying&&a>0&&a<.5&&(this.leadSec+=(a-this.leadSec)*kS),n=!0}if(!this.inFlight&&this.preparedGeneration===this.generation&&Number.isFinite(e)&&!(!t&&!this.lastPlaying&&e===this.lastTime&&!this.presentationDirty)){let n=AS?AS.now():NaN,r=t&&this.lastPlaying&&Number.isFinite(this.lastTime)&&F(e-this.lastTime,(n-this.requestedAt)/1e3),i=t?r?Math.max(e+this.leadSec,this.requestedRenderTime):e+this.leadSec:e;this.inFlight=!0,this.lastTime=e,this.lastPlaying=t,this.presentationDirty=!1,this.requestedAt=n,this.requestedSongTime=e,this.requestedPlaying=t,this.requestedRenderTime=i,this.worker.postMessage({type:`render`,generation:this.generation,time:i,playing:t,...r?{continuous:!0}:{}})}return n}setPresentation(e){if(this.disposed)return;let t=e.maxFrameRateHz;t!==void 0&&Number.isFinite(t)&&t>0&&(this.leadSec=1/t),this.presentationDirty=!0,this.worker.postMessage({type:`presentation`,presentation:e})}dispose(){if(!this.disposed){this.disposed=!0,this.preparing?.resolve(),this.preparing=null,this.discardPending(),this.material=null,this.lines=null,this.spatialShown=!1,this.onFrameReady=null,this.onError=null,this.worker.onmessage=null,this.worker.onerror=null;try{this.worker.postMessage({type:`dispose`})}catch{}this.worker.terminate(),this.canvas.width=this.canvas.height=1,this.diagnostics&&this.canvas.remove()}}receive(e){if(this.disposed){e.type===`frame`&&e.bitmap.close();return}switch(e.type){case`prepared`:if(this.preparing?.generation!==e.generation)return;this.preparedGeneration=e.generation,(e.raster===`webgl`||e.raster===`canvas2d`)&&(this.rasterKindValue=e.raster),this.preparing.resolve(),this.preparing=null;return;case`prepare-error`:if(this.preparing?.generation!==e.generation)return;this.preparing.reject(Error(e.message)),this.preparing=null;return;case`frame`:if(e.generation!==this.generation){e.bitmap.close(),this.releaseMaterial(e.material??null);return}if(this.inFlight=!1,this.discardPending(),AS){let e=AS.now()-this.requestedAt;this.latencyMs=this.latencyMs>0?this.latencyMs+(e-this.latencyMs)*OS:e}this.pending={bitmap:e.bitmap,focalX:e.focalX,focalY:e.focalY,renderMs:e.renderMs,stages:e.stages??null,material:e.material??null,lines:e.lines??null,spatial:e.spatial??null,requestedSongTime:this.requestedSongTime,requestedPlaying:this.requestedPlaying,serial:++this.receivedSerial},this.onFrameReady?.();return;case`unchanged`:e.generation===this.generation&&(this.inFlight=!1);return;case`failure`:this.fail(e.message);return}}fail(e){if(this.failure)return;this.failure=e,this.worker.onmessage=null,this.worker.onerror=null,this.worker.terminate(),this.discardPending();let t=this.preparing;this.preparing=null,t?t.reject(Error(e)):this.onError?.(e)}discardPending(){this.pending?.bitmap.close(),this.releaseMaterial(this.pending?.material??null),this.pending=null}releaseMaterial(e){let t=e?.data.buffer;if(!(!t||!(t.byteLength>0)||this.disposed||this.failure))try{this.worker.postMessage({type:`release-material`,buffer:t},[t])}catch{}}},PS=(dg*16+fg*16+dg*3+fg*3)*4,FS=mg*16*4,IS=gg*16*4;function LS(e){if(e.byteLength!==PS)throw Error(`Invalid native transfer buffer size.`);return{grains:new Float32Array(e,0,dg*16),weave:new Float32Array(e,dg*16*4,fg*16),grainMaterial:new Float32Array(e,(dg*16+fg*16)*4,dg*3),weaveMaterial:new Float32Array(e,(dg*16+fg*16+dg*3)*4,fg*3)}}function RS(e){return e.buffer instanceof ArrayBuffer&&e.buffer.byteLength===PS&&Number.isSafeInteger(e.serial)&&e.serial>0&&Number.isSafeInteger(e.count)&&e.count>=0&&e.count<=1440&&Number.isSafeInteger(e.weaveCount)&&e.weaveCount>=0&&e.weaveCount<=4320&&[e.amount,e.detail,e.bloom].every(e=>Number.isFinite(e)&&e>=0&&e<=1)&&Number.isFinite(e.renderMs)&&e.renderMs>=0&&Number.isFinite(e.focal?.x)&&Number.isFinite(e.focal?.y)&&(e.cosmosCount===void 0&&e.cosmosBuffer===void 0||typeof e.cosmosCount==`number`&&Number.isSafeInteger(e.cosmosCount)&&e.cosmosCount>=0&&e.cosmosCount<=4818&&e.cosmosBuffer instanceof ArrayBuffer&&e.cosmosBuffer.byteLength===FS)&&(e.wallCount===void 0&&e.wallBuffer===void 0||typeof e.wallCount==`number`&&Number.isSafeInteger(e.wallCount)&&e.wallCount>=0&&e.wallCount<=3200&&e.wallBuffer instanceof ArrayBuffer&&e.wallBuffer.byteLength===IS)&&(e.spatial===null||e.spatial.time===e.songTime&&Object.values(e.spatial).every(Number.isFinite))}var zS=class{width=960;height=540;frameCount=0;background(){}noStroke(){}noFill(){}fill(){}stroke(){}strokeWeight(){}line(){}circle(){}triangle(){}beginShape(){}vertex(){}endShape(){}radialGlow(){}radialDim(){}compositeRingTint(){}drawFieldRaster(){}beginFieldRaster(){return null}},BS=class{context;backend=new zS;weavePacket={count:0,data:new Float32Array(fg*16)};materialPacket={amount:0,detail:0,bloom:0,grains:new Float32Array(dg*3),weave:new Float32Array(fg*3)};packet={version:1,generation:0,serial:0,songTime:0,count:0,data:new Float32Array(dg*16),weave:this.weavePacket,material:this.materialPacket};spatial=fS();cosmosPacket={count:0,data:new Float32Array(mg*16)};wallPacket={count:0,data:new Float32Array(gg*16)};ready=!1;shown=!1;disposed=!1;revision=0;previous=null;lastPlaying=!1;lastWall=NaN;dirty=!0;snap=!1;interval=1/36-.004;cost=0;constructor(e){this.packet.cosmos=this.cosmosPacket,this.packet.wall=this.wallPacket,this.context=new qx(e??{version:1,rawTuning:a(),macros:py,boosts:my,policy:{gains:`meta`,semanticResolver:E.semanticResolver,semanticChoreography:E.semanticChoreography}}),this.context.identity.setNativeSink(this)}get frame(){return this.shown?this.packet:null}get focalPoint(){return this.context.identity.routeFocus}get spatialFrame(){return this.shown?this.spatial:null}get lastRenderMs(){return this.cost}async prepare(e){if(this.disposed)return;let t=++this.revision;if(this.ready=!1,this.shown=!1,this.previous=null,this.packet.count=0,this.weavePacket.count=0,this.cosmosPacket.count=0,this.wallPacket.count=0,this.context.prepare(e),this.context.identity.setNativeSink(this),e){let n=new Map;if(await Promise.all([...new Set(e.performancePlan.points.map(e=>e.preset))].map(async e=>{let t=await fetch(`/plexus-engine/visual-tuning-presets/${encodeURIComponent(e)}`);if(!t.ok)throw Error(`Could not load Wormhole preset: ${e}`);n.set(e,await t.json())})),this.disposed||t!==this.revision)return;this.context.preparePlan(e.performancePlan,n)}this.disposed||t!==this.revision||(this.packet.generation=t,this.ready=!0,this.dirty=!0)}render(e,t,n){if(!this.ready||this.disposed||!Number.isFinite(e)||e<0)return!1;let r=performance.now(),i=this.previous,a=i===null?0:e-i,o=t&&this.lastPlaying&&i!==null&&(n??F(a,(r-this.lastWall)/1e3)),s=i!==null&&!o&&(a<0||a>.25);if(i!==null&&!this.dirty&&!s&&t===this.lastPlaying&&a<this.interval)return!1;let c=o?Math.min(1,a):x(e,i);return this.context.step(e,t,c,i,s,i===null||s||this.snap),this.context.identity.setNativeSink(this),this.packet.count=0,this.weavePacket.count=0,this.cosmosPacket.count=0,this.wallPacket.count=0,this.packet.songTime=e,this.packet.serial++,this.backend.frameCount++,this.context.identity.draw(this.backend,[],[]),pS(this.spatial,e,this.context.state.visualTuning,this.context.identity.frameDrive,this.context.state),this.previous=e,this.lastPlaying=t,this.lastWall=r,this.dirty=!1,this.snap=!1,this.shown=!0,this.cost=performance.now()-r,!0}setPresentation(e){let t=this.context.setPresentation(e);this.dirty||=t.tuningChanged||t.directionChanged,this.snap||=t.tuningChanged||t.directionChanged,e.maxFrameRateHz&&Number.isFinite(e.maxFrameRateHz)&&(this.interval=Math.max(0,1/e.maxFrameRateHz-.004))}beginMaterial(e,t,n){this.materialPacket.amount=e,this.materialPacket.detail=t,this.materialPacket.bloom=n}wall(e,t,n,r,i,a,o,s,c,l=0){if(this.wallPacket.count>=3200)return;let u=this.wallPacket.count++,d=u*16;this.writeSegment(this.wallPacket.data,u,t,n,r,i,a,o,s,c,l,t,0),this.wallPacket.data[d+15]=e}cosmos(e,t,n,r,i,a,o,s,c){if(this.cosmosPacket.count>=4818)return;let l=this.cosmosPacket.count++,u=l*16,d=pg;this.writeSegment(this.cosmosPacket.data,l,t,n,r,i,a,o,s,c,0,t,0),this.cosmosPacket.data[u+7]=Math.max(.001,i*d),this.cosmosPacket.data[u+15]=e}grain(e,t,n,r,i,a,o,s,c,l,u,d=0,f=0){this.packet.count>=1440||(this.writeMaterial(this.materialPacket.grains,this.packet.count,d,f,s),this.writeSegment(this.packet.data,this.packet.count++,e,t,n,r,i,a,o,s,c,l,u))}weave(e,t,n,r,i,a,o,s,c,l,u,d=0,f=0,p=s){this.weavePacket.count>=4320||(this.writeMaterial(this.materialPacket.weave,this.weavePacket.count,d,f,p),this.writeSegment(this.weavePacket.data,this.weavePacket.count++,e,t,n,r,i,a,o,s,c,l,u))}writeMaterial(e,t,n,r,i){let a=t*3;e[a]=n,e[a+1]=Math.min(1,Math.max(0,r)),e[a+2]=Math.min(1,Math.max(0,i/255))}writeSegment(e,t,n,r,i,a,o,s,c,l,u,d,f){let p=t*16,m=pg;e[p]=n,e[p+1]=r.x*m,e[p+2]=-r.y*m,e[p+3]=-r.z*m,e[p+4]=i.x*m,e[p+5]=-i.y*m,e[p+6]=-i.z*m,e[p+7]=Math.min(.08,Math.max(.004,a*m)),e[p+8]=o/255,e[p+9]=s/255,e[p+10]=c/255,e[p+11]=Math.min(1,Math.max(0,l/255)),e[p+12]=u,e[p+13]=d,e[p+14]=f,e[p+15]=0}dispose(){this.disposed=!0,this.revision++,this.shown=!1,this.ready=!1,this.context.identity.setNativeSink(null),this.context.dispose(),this.packet.count=0,this.weavePacket.count=0,this.cosmosPacket.count=0,this.wallPacket.count=0}};function VS(){return new Worker(new URL(`/plexus-engine/assets/wormholeNative.worker-CTwhNE5o.js`,``+import.meta.url),{type:`module`})}function HS(){let e=LS(new ArrayBuffer(PS));return{frame:{version:1,generation:0,serial:0,songTime:0,count:0,data:e.grains,weave:{count:0,data:e.weave},cosmos:{count:0,data:new Float32Array(FS/4)},wall:{count:0,data:new Float32Array(IS/4)},material:{amount:0,detail:0,bloom:0,grains:e.grainMaterial,weave:e.weaveMaterial}},meta:null,latency:0}}var US=(e,t)=>!!e&&e.songTime===t.songTime&&e.playing===t.playing&&e.epoch===t.epoch&&e.revision===t.revision,WS=class{options;worker=null;local=null;emptyFocus={x:0,y:0};banks=[HS(),HS()];shownBank=-1;pendingBank=-1;generation=0;requestId=0;epoch=0;revision=0;ready=!1;disposed=!1;desired=null;lastSent=null;lastSentAt=0;observed=null;flight=null;timer=null;preparing=null;analysis=null;presentation={};reason=``;producerMs=0;copyMs=0;onFrameReady=null;onError=null;constructor(e={}){this.options=e}get executionLabel(){return this.local?`main geometry (fallback: ${this.reason}); no background canvas`:`worker geometry; no background canvas`}get frame(){return this.local?.frame??(this.shownBank>=0?this.banks[this.shownBank].frame:null)}get focalPoint(){return this.local?.frame?this.local.focalPoint:this.shownBank>=0?this.banks[this.shownBank].meta.focal:this.emptyFocus}get spatialFrame(){return this.local?.frame?this.local.spatialFrame:this.shownBank>=0?this.banks[this.shownBank].meta.spatial:null}get lastRenderMs(){return this.local?.lastRenderMs??this.producerMs}get frameLatencyMs(){return this.local?0:this.shownBank>=0?this.banks[this.shownBank].latency:0}get lastTransferMs(){return this.copyMs}prepare(e){return this.disposed?Promise.resolve():(this.preparing?.resolve(),this.preparing=null,this.stopWorker(),this.local?.dispose(),this.local=null,this.analysis=e,this.generation++,this.ready=!1,this.shownBank=-1,this.pendingBank=-1,this.desired=null,this.lastSent=null,this.observed=null,this.epoch++,this.producerMs=0,new Promise((t,n)=>{if(this.preparing={generation:this.generation,resolve:t,reject:n},this.options.forceMain){this.fallback(`xrBackgroundThread=main`);return}try{let t=(this.options.workerFactory??VS)();this.worker=t,t.onmessage=e=>this.receive(t,e.data),t.onerror=e=>{e.preventDefault?.(),t===this.worker&&this.fallback(e.message||`worker error`)},t.onmessageerror=()=>{t===this.worker&&this.fallback(`worker message could not be decoded`)},this.arm(this.options.prepareTimeoutMs??15e3,`worker startup timed out`),t.postMessage({type:`prepare`,version:1,generation:this.generation,analysis:e&&ie(e),seed:this.options.seed,presentation:this.presentation})}catch(e){this.fallback(e instanceof Error?e.message:String(e))}}))}setPresentation(e){let t={...this.presentation,...e,macros:{...this.presentation.macros,...e.macros},grainMaterial:{...this.presentation.grainMaterial,...e.grainMaterial},cosmos:{...this.presentation.cosmos,...e.cosmos},...this.presentation.wall||e.wall?{wall:{...this.presentation.wall,...e.wall}}:{}};JSON.stringify(t)!==JSON.stringify(this.presentation)&&(this.presentation=t,this.revision++,this.pendingBank=-1,this.desired=null,this.local?.setPresentation(t))}render(e,t){if(this.disposed||!this.ready||!Number.isFinite(e)||e<0)return!1;if(this.local)return this.local.render(e,t);let n=performance.now(),r=this.observed;if(r){let i=e-r.time;(t!==r.playing||i<0||!t&&i!==0||i>.25&&!F(i,(n-r.wall)/1e3))&&(this.epoch++,this.pendingBank=-1)}this.observed={time:e,playing:t,wall:n},this.desired={songTime:e,playing:t,epoch:this.epoch,revision:this.revision};let i=!1;if(this.pendingBank>=0){let e=this.banks[this.pendingBank].meta;e.epoch===this.epoch&&e.revision===this.revision&&(this.shownBank=this.pendingBank,this.producerMs=e.renderMs,i=!0),this.pendingBank=-1}return this.flush(),i}flush(){if(!this.worker||!this.ready||this.flight||!this.desired||US(this.lastSent,this.desired))return;let e=this.desired,t=performance.now(),n=this.lastSent,r={type:`render`,version:1,generation:this.generation,requestId:++this.requestId,...e,continuous:!!n&&n.playing&&e.playing&&n.epoch===e.epoch&&F(e.songTime-n.songTime,(t-this.lastSentAt)/1e3),presentation:this.presentation};this.flight={request:r,sentAt:t},this.lastSent=r,this.lastSentAt=t;try{this.arm(this.options.renderTimeoutMs??5e3,`native worker render timed out`),this.worker.postMessage(r)}catch(e){this.fallback(e instanceof Error?e.message:String(e))}}receive(e,t){if(this.disposed||e!==this.worker||t.version!==1||t.generation!==this.generation)return;if(t.type===`error`){this.fallback(t.message);return}if(t.type===`ready`){if(this.ready)return;if(t.canvasFree!==!0){this.fallback(`native worker capability mismatch`);return}this.clearTimer(),this.ready=!0,this.settle(),this.onFrameReady?.();return}let n=this.flight;if(!n||t.requestId!==n.request.requestId)return;let r=n.request;if(t.epoch!==r.epoch||t.revision!==r.revision||t.songTime!==r.songTime){this.fallback(`native worker frame identity mismatch`);return}this.clearTimer(),this.flight=null;try{if(t.type===`frame`){if(!RS(t))throw Error(`Invalid native worker frame.`);if(t.epoch===this.epoch&&t.revision===this.revision){let e=performance.now(),r=+(this.shownBank===0),i=this.banks[r],a=LS(t.buffer),o=i.frame;o.data.set(a.grains.subarray(0,t.count*16)),o.weave.data.set(a.weave.subarray(0,t.weaveCount*16)),o.material.grains.set(a.grainMaterial.subarray(0,t.count*3)),o.material.weave.set(a.weaveMaterial.subarray(0,t.weaveCount*3)),o.generation=t.generation,o.serial=t.serial,o.songTime=t.songTime,o.count=t.count,o.weave.count=t.weaveCount,o.material.amount=t.amount,o.material.detail=t.detail,o.material.bloom=t.bloom,o.cosmos.count=t.cosmosCount??0,t.cosmosBuffer&&o.cosmos.data.set(new Float32Array(t.cosmosBuffer,0,o.cosmos.count*16)),o.wall.count=t.wallCount??0,t.wallBuffer&&o.wall.data.set(new Float32Array(t.wallBuffer,0,o.wall.count*16)),i.meta=t,i.latency=performance.now()-n.sentAt,this.pendingBank=r,this.copyMs=performance.now()-e}let r=[t.buffer];t.cosmosBuffer&&r.push(t.cosmosBuffer),t.wallBuffer&&r.push(t.wallBuffer),e.postMessage({type:`release`,version:1,generation:this.generation,requestId:t.requestId,buffer:t.buffer,...t.cosmosBuffer?{cosmosBuffer:t.cosmosBuffer}:{},...t.wallBuffer?{wallBuffer:t.wallBuffer}:{}},r)}this.flush()}catch(e){this.fallback(e instanceof Error?e.message:String(e));return}this.pendingBank>=0&&this.onFrameReady?.()}settle(e){let t=this.preparing;!t||t.generation!==this.generation||(this.preparing=null,e?t.reject(e):t.resolve())}fallback(e){if(this.disposed||this.local)return;this.reason=e.slice(0,160),this.stopWorker(),this.ready=!1,this.pendingBank=-1,this.desired=null;let t=this.generation;try{let e=(this.options.mainFactory??(e=>new BS(e)))(this.options.seed);this.local=e,e.setPresentation(this.presentation),e.prepare(this.analysis).then(()=>{this.disposed||t!==this.generation||e!==this.local||(this.ready=!0,this.settle(),this.onFrameReady?.())},e=>{if(!this.disposed&&t===this.generation){let t=e instanceof Error?e:Error(String(e));this.settle(t),this.onError?.(t.message)}})}catch(e){let t=e instanceof Error?e:Error(String(e));this.settle(t),this.onError?.(t.message)}}arm(e,t){this.clearTimer(),this.timer=setTimeout(()=>this.fallback(t),e)}clearTimer(){this.timer!==null&&(clearTimeout(this.timer),this.timer=null)}stopWorker(){this.clearTimer(),this.worker&&=(this.worker.onmessage=null,this.worker.onerror=null,this.worker.onmessageerror=null,this.worker.terminate(),null),this.flight=null}dispose(){this.disposed||(this.disposed=!0,this.ready=!1,this.stopWorker(),this.local?.dispose(),this.local=null,this.preparing?.resolve(),this.preparing=null,this.shownBank=-1,this.pendingBank=-1,this.desired=null,this.onFrameReady=null,this.onError=null)}},GS=document.querySelector(`#xr-app`);if(!GS)throw Error(`#xr-app container missing from xr/index.html`);var KS=window.location.search.includes(`xrDiagnostics=1`),qS=new d(void 0,{loopPlayback:!1,heroMetronome:!1,rhythmOnsets:!0}),JS=new zx(GS,{diagnostics:KS}),YS=null;try{YS=window.localStorage}catch{YS=null}var XS=window.location.search.includes(`xrBackgroundThread=main`),ZS=XS?``:jS(),QS=!XS&&ZS===``,$S=QS?`worker`:`MAIN THREAD (${XS?`?xrBackgroundThread=main`:ZS})`;new Lx(qS,JS,GS,e=>{let t={diagnostics:KS,profile:e?.profile===!0,depthCue:.7,width:e?.width,height:e?.height,externalMaterial:e?.externalMaterial===!0,externalLines:e?.externalLines===!0,softwareRaster:e?.softwareRaster===!0,webglRaster:e?.webglRaster===!0};return QS?new NS(t):new CS(t)},{diagnostics:KS,settingsStore:Ox(YS),backgroundThread:$S,nativeWormholeFactory:()=>new WS({forceMain:XS})});