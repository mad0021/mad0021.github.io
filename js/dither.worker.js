/* Dither engine — runs off the main thread. Every figure is a shade field (0..1) rendered
   through a Bayer 8x8 ordered dither. The page only sends state (theme, colours, visibility, hover). */
  var B=[0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  function hash(x,y){var h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h)}
  function noise(x,y){var xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;var u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
    var a=hash(xi,yi),b=hash(xi+1,yi),c2=hash(xi,yi+1),e=hash(xi+1,yi+1);return a+(b-a)*u+(c2-a)*v+(a-b-c2+e)*u*v}
  function fbm(x,y){var s=0,a=.5;for(var i=0;i<5;i++){s+=a*noise(x,y);x*=2.03;y*=2.03;a*=.5}return s}
  function clamp(v){return v<0?0:v>1?1:v}
  var FIGS={
    apps:function(t){ // a tablet; the active form field steps down over time
      var act=Math.floor(t*.6)%3;
      return function(x,y,W,H){
        var u=x/W,v=y/H;
        if(u<.24||u>.76||v<.06||v>.94)return 0;
        var edge=u<.27||u>.73||v<.11||v>.89;
        if(edge)return .35+.45*(1-u);               // lit bezel, light from the left
        for(var k=0;k<3;k++){var fy=.2+k*.22;
          if(v>fy&&v<fy+.12&&u>.32&&u<.68)return k===act?.95:.3+.15*(1-u)}
        return v>.82&&v<.86&&u>.32&&u<.5?2.9:.05}},   // seal-red submit button
    flow:function(t){ // three lanes, packets travelling right
      return function(x,y,W,H){
        var u=x/W,v=y/H,best=0;
        for(var k=0;k<3;k++){
          var ly=.22+k*.28+.05*Math.sin(u*7-t*1.2+k*2),d=Math.abs(v-ly);
          if(d<.11){var pk=(u*3-t*.5+k*.37)%1;pk=pk<0?pk+1:pk;
            var val=(1-d/.11)*(pk<.28?.95:.22);if(val>best)best=val}}
        return best}},
    data:function(t){ // shaded cylinder with a scan line passing through
      var scan=.18+.68*((t*.12)%1);
      return function(x,y,W,H){
        var u=x/W,v=y/H,nx=(u-.5)/.2;
        var cap=nx*nx+Math.pow((v-.18)/.08,2);
        if(cap<1)return .85-.3*nx;
        if(Math.abs(nx)>=1||v<.18||v>.86)return Math.abs(nx)<1&&Math.abs(v-.86)<.01?.4:0;
        var nz=Math.sqrt(1-nx*nx),lam=Math.max(0,-.55*nx+.83*nz);
        var ring=((v-.18)/.68*4)%1<.07?.35:1;
        return clamp(lam*.85*ring+.04+.5*Math.exp(-Math.pow((v-scan)*40,2)))}},
    bi:function(t){ // six bars breathing; the fifth is the answer, in seal red
      return function(x,y,W,H){
        var u=(x/W-.1)/.8,v=y/H;
        if(Math.abs(v-.92)<.012&&u>-.02&&u<1.02)return .55;
        if(u<0||u>=1)return 0;
        var i=Math.floor(u*6),f=u*6-i;if(f<.2||f>.8)return 0;
        var h=i===4?.78:.22+.4*(.5+.5*Math.sin(i*1.9+t*.5));
        if(v>.9||v<.9-h)return 0;
        var sh=.35+.55*(1-(f-.2)/.6);
        return i===4?2+sh:sh*.8}},
    mono:function(t){ // the M from the nav seal, embossed with the sphere's veins
      var lx=Math.cos(t*.7)*.6,ly=-.5;
      return function(x,y,W,H){
        var m=monoMask&&monoMask[y*W+x];if(!m)return 0;
        var nx=x/W-.5,ny=y/H-.5,g=fbm(nx*5+t*.05,ny*5);
        var vein=Math.abs(Math.sin((nx*6+ny*4+g*4)*2.6));
        return clamp((.45+nx*lx*-1.2+ny*ly*-1)*(.55+.45*vein)*m)}},
    wall:function(t){var id=root.dataset.theme||'ink';if(MOTIFS[id]){var m=MOTIFS[id](t);return function(x,y,W,H){return m(x+Math.round(W*.18),y,W,H)}} // motifs are drawn around x≈.68: centre them in the HVMANITY composition
      var L=lum[id];if(!L){loadLum(id);return null}
      return function(x,y,W,H){var i=y*W+x;return L.a[i]?2+L.l[i]:L.l[i]}},
    motif:function(t,ds){return MOTIFS[ds.motif](t)},
    terrain:function(t){ // two ridgelines drifting at different speeds, a low sun
      return function(x,y,W,H){
        var u=x/W,v=y/H,a=W/H;
        var far=.5-1.1*(fbm(u*2.2+t*.02,1.7)-.45),near=.78-1.2*(fbm(u*3.5+t*.05+9,4.1)-.45);
        if(v>near)return .2+.55*clamp((v-near)*2.5)*(.6+.4*fbm(u*20,v*8));
        if(v>far)return .16+.18*clamp((v-far)*3);
        var dx=(u-.78)*a,dy=v-.22;if(dx*dx+dy*dy<.02)return .9;
        return hash(x,y)>.996?.8:0}}
  };


  /* ANIME MOTIFS: original procedural scenes, one per theme. Each motif(t) -> function(x,y,W,H) like the figures above. */
  function sm(a,b,x){x=clamp((x-a)/(b-a));return x*x*(3-2*x)}
  var textMasks={};
  function textMask(txt,font,W,H,key){ // cached alpha mask of a string, for the divergence meter
    if(textMasks[key])return textMasks[key];
    var o=new OffscreenCanvas(W,H),g=o.getContext('2d');
    g.fillStyle='#fff';g.font=font;g.textAlign='right';g.textBaseline='middle';g.fillText(txt,W*.84,H*.5);
    var px=g.getImageData(0,0,W,H).data,m=new Float32Array(W*H);for(var i=0;i<m.length;i++)m[i]=px[i*4+3]/255;
    return textMasks[key]=m;
  }
  var MOTIFS={
    onepiece:function(t){var bob=.012*Math.sin(t*1.2);return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,hz=.62,dx=(u-.7)*a,dy=v-(.52+bob);
      var sx=(u-.88)*a,sy=v-.24;if(sx*sx+sy*sy<.006&&v<hz)return 2.9;
      if(dx*dx/.05+dy*dy/.0035<1)return Math.abs(dy)<.004?.95:.55+.35*Math.abs(Math.sin(dx*120+dy*60));
      if(dy<0&&dy>-.12&&dx*dx/.013+Math.pow(dy+.01,2)/.012<1)return dy>-.03?2.9:.6+.3*Math.abs(Math.sin(dx*90-dy*140));
      if(v<hz)return hash(x,y)>.995?.6:0;
      if(Math.abs(sx)<.06&&Math.sin(v*160+t*2)>.3)return 2+.5*(1-(v-hz)*2);
      return Math.sin(u*38+t*1.6+v*90)>.86?.18+.5*(v-hz):.04}},
    naruto:function(t){return function(x,y,W,H){
      var a=W/H,X=(x/W-.68)*a,Y=y/H-.5,r=Math.sqrt(X*X+Y*Y),an=Math.atan2(Y,X);
      if(r<.15){var sw=Math.sin(an*3+r*40-t*5);return r>.142?.98:(sw>.2?.95:.55+.35*(1-r/.15))}
      if(r<.2){var g=Math.sin(an*7-t*6+r*30);return g>.6?.8*(1-(r-.15)/.05):0}
      if(r<.45){var f=Math.sin(an-Math.log(r+.001)*4+t*.8);if(f>.7)return 2+clamp((f-.7)*3)*(1.05-r*1.6)}
      for(var j=0;j<14;j++){var lx=(hash(j,1)+t*.012*(1+hash(j,2)))%1,ly=(hash(j,3)+t*.02)%1,ddx=(x/W-lx)*a,ddy=y/H-ly;
        if(Math.abs(ddx)+Math.abs(ddy)*1.8<.012)return 2.6}
      return 0}},
    dbz:function(t){return function(x,y,W,H){
      var a=W/H,X=(x/W-.68)*a,Y=y/H-.5,r=Math.sqrt(X*X+Y*Y),an=Math.atan2(Y,X);
      for(var k=0;k<7;k++){var th=t*.15+k*Math.PI*2/7,ox=X-Math.cos(th)*.3,oy=Y-Math.sin(th)*.3*.85,or=Math.sqrt(ox*ox+oy*oy);
        if(or<.05){var sa=Math.atan2(oy,ox)-t*.3,star=.018*(.55+.45*Math.cos(5*sa));
          var n=k%4+1,hit=false;for(var q=0;q<n;q++){var qx=ox-(n>1?.015*Math.cos(q*2.1):0),qy=oy-(n>1?.015*Math.sin(q*2.1):0),qr=Math.sqrt(qx*qx+qy*qy),qa=Math.atan2(qy,qx);if(qr<.007*(.55+.45*Math.cos(5*qa))+.002)hit=true}
          if(hit)return 0;return 2+.45+.5*clamp(1-(ox+.02)*8-(oy+.02)*8)*(1-or/.05*.5)}}
      if(r<.05)return .97;
      var rr=.16+.05*fbm(an*2.5+3,t*.9-r*5);if(r<rr)return .55+.4*(1-r/rr);
      var ray=Math.pow(Math.abs(Math.sin(an*11+t*.4+Math.sin(an*5)*.6)),24);
      return r<.5&&ray>.35?.5*(1-r/.5):0}},
    jjk:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,X=(u-.68)*a,Y=v-.46,r=Math.sqrt(X*X+Y*Y),an=Math.atan2(Y,X);
      var R=.2+.01*Math.sin(t*3);
      if(r<R){var nz=Math.sqrt(1-r*r/(R*R)),lam=clamp(-.5*X/R-.5*Y/R+.7*nz);return 2+.25+.7*lam*(.7+.3*fbm(X*12+t,Y*12))}
      if(r<R+.05&&Math.sin(an*14+t*5+r*80)>.7)return .9*(1-(r-R)/.05);
      var p=(an*3+t)%1;if(r<.42&&hash(Math.floor(an*40),Math.floor(r*60-t*8))>.96)return .7;
      var n=fbm(u*6,v*4+t*.7),f=clamp((n-.42)*3.2)*Math.pow(v,1.3)*1.2;return f*.4}},
    csm:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,X=u*a,cy=.5;
      var nx=.92*a,dn=Math.sqrt(Math.pow(X-nx,2)+Math.pow(v-cy,2));
      var inBar=(X>.4*a&&X<nx&&Math.abs(v-cy)<.06)||dn<.06;
      var edge=inBar&&((X<nx&&Math.abs(Math.abs(v-cy)-.06)<.012)||(X>=nx&&Math.abs(dn-.06)<.012));
      if(edge){var ph=((X*60+t*4)%1+1)%1;return ph<.5?.95:.4}
      if(inBar)return Math.abs(v-cy)<.012&&X<nx-.02?.15:.45+.25*(1-Math.abs(v-cy)*14);
      var ox=Math.abs(v-cy)<.07+.01*Math.sin(X*200)&&X>.4*a&&X<nx+.08?1:0;
      if(ox&&Math.abs(Math.abs(v-cy)-.075)<.006&&(((X*60+t*4)%1+1)%1)<.4)return .85;
      if(u>.27&&u<.41&&v>.36&&v<.66)return (Math.floor(v*80)%3===0)?.15:.32;
      if(u>.3&&u<.37&&v>.3&&v<.36)return .6;
      var near=Math.abs(v-cy);return near<.3&&hash(Math.floor(x/2),Math.floor(y/2))>.985-near*.03?2.85:0}},
    hxh:function(t){var vals=[];for(var i=0;i<6;i++)vals.push(.12+.16*(.5+.5*Math.sin(t*.5+i*1.3))+.06*hash(i,4));
      function suit(px,py,k){ // heart (k even) or spade (k odd), unit size
        if(k%2){py=-py;if(Math.abs(px)<.12&&py<-.3&&py>-.75)return 1}
        var q=px*px+py*py-1;return q*q*q-px*px*py*py*py<0}
      return function(x,y,W,H){
        var a=W/H,X=(x/W-.68)*a,Y=y/H-.5,r=Math.sqrt(X*X+Y*Y),an=(Math.atan2(Y,X)+Math.PI*2.5)%(Math.PI*2),sec=an/(Math.PI/3),i=Math.floor(sec)%6,f=sec-Math.floor(sec);
        for(var k=0;k<4;k++){var cx=(.3+.17*k+.02*Math.sin(t*.6+k))*a-.68*a,cyy=-.28+.56*hash(k,9)+.04*Math.sin(t*.8+k*2),sz=.035;
          if(Math.abs(X-cx)<sz*1.3&&Math.abs(Y-cyy)<sz*1.8){var lx=(X-cx)/sz*.9,ly=-(Y-cyy)/sz*.9;if(suit(lx,ly+.1,k))return k%2?.05:2.9;return .92}}
        var rad=vals[i]*(1-f)+vals[(i+1)%6]*f,hx=Math.max(Math.abs(X)*.866+Math.abs(Y)*.5,Math.abs(Y));
        if(r<rad)return Math.abs(r-rad)<.006?2.95:2+.35;
        if(hx<.36&&((hx*10)%1<.05))return .4;
        if(r<.36&&Math.abs(Math.sin(an*3))<.012)return .35;
        return 0}},
    berserk:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,dx=(u-.82)*a,dy=v-.22,r=Math.sqrt(dx*dx+dy*dy);
      if(r<.09)return 0;
      if(r<.14)return 2+(1-(r-.09)/.05)*(.75+.25*fbm(Math.atan2(dy,dx)*4,t*.6));
      var sx=(u-.62)*a;
      if(v>.3&&v<.33&&Math.abs(sx)<.17)return .75;
      if(v>.1&&v<.3&&Math.abs(sx)<.02)return (Math.floor(v*70)%2)?.5:.3;
      if(v>.08&&v<.11&&Math.abs(sx)<.035)return .7;
      if(v>.33&&Math.abs(sx)<.1){var rust=fbm(sx*30,v*12);return Math.abs(sx)>.092?.9:.3+.45*clamp(1-(sx+.1)/.2)*(.6+.4*rust)-(rust>.62?.25:0)}
      return v>.9?.08+.15*fbm(u*12+t*.1,v*6):(hash(x,y)>.994?.35:0)}},
    vinland:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H;
      if(hash(Math.floor(x/3),Math.floor((y-t*25*(1+hash(Math.floor(x/3),1)))/3))>.988)return .9;
      var ridge=.5-.5*(fbm(u*2.4+7,2)-.45);
      if(v>.66)return Math.sin(u*30+t+v*70)>.9?.3:.05;
      if(u>.58&&u<.72&&v>.38&&v<.56)return ((u-.58)*30|0)%2?2.85:.75;
      if(Math.abs(u-.65)<.003&&v>.32&&v<.62)return .6;
      if(v>.6&&v<.66&&Math.abs(u-.65)<.12-(v-.6)*1.2)return .55;
      return v>ridge?.12+.25*clamp((v-ridge)*4):0}},
    frieren:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,dx=(u-.72)*a,dy=v-.36,r=Math.sqrt(dx*dx+dy*dy),an=Math.atan2(dy,dx);
      if(Math.abs(r-.12)<.004||Math.abs(r-.09)<.003)return 2.9;
      if(r<.09&&Math.abs(Math.sin(an*3+t*.3))<.03)return 2.7;
      if(v>.62){var f=hash(Math.floor(x/4),Math.floor(y/4));return f>.93?(f>.975?2.8:.85):.06+.08*(v-.62)}
      return hash(x,y)>.993?.4+.5*Math.abs(Math.sin(t+x)):0}},
    mob:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,dx=(u-.66)*a,dy=v-.5,r=Math.sqrt(dx*dx+dy*dy);
      var m=textMask('100%','600 '+Math.round(H*.16)+'px "Chakra Petch", sans-serif',W,H,'mob'+W)[y*W+x];
      if(m>.35)return .95;
      var w=Math.sin(r*55-t*3);
      if(r<.5&&w>.75)return (Math.floor(r*55/(Math.PI*2)-t*.48)%2?2.8:.7)*(1)-(r>.4?.3:0);
      return 0}},
    ttgl:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,hw=.17*(v-.08)/.8;
      if(v>.08&&v<.88&&Math.abs((u-.66)*a)<hw){var k=((v*11+(u-.66)*a/hw*.9-t*1.3)%1+1)%1;return k<.5?2+.6+.3*(1-v):.5+.3*(1-Math.abs((u-.66)*a)/hw)}
      if(Math.abs((u-.66)*a)<.004&&v<.08)return .9;
      return hash(0,Math.floor(u*90))>.9&&((v*2+t*1.4+hash(1,Math.floor(u*90)))%1)<.12?.35:(hash(x,y)>.995?.6:0)}},
    codegeass:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,px=(u-.66)*a;
      var base=v>.55&&v<.6&&Math.abs(px)<.07-(v-.55)*.4,body=v>.3&&v<=.55&&Math.abs(px)<.022+(v-.3)*.12,collar=Math.abs(v-.3)<.012&&Math.abs(px)<.05,
          head=Math.pow(px/.035,2)+Math.pow((v-.25)/.04,2)<1,cross=(Math.abs(px)<.007&&v>.12&&v<.21)||(Math.abs(v-.155)<.007&&Math.abs(px)<.025);
      if(base||body||collar||head||cross)return .55+.4*clamp(1-px*12);
      if(v<.46)return hash(x,y)>.996?.4:0;
      var z=.12/(v-.44),X=(u-.62)*z*3.2,cx=Math.floor(X*2),cz=Math.floor(z*2.2),fog=clamp(1.2-z*.35);
      if(cx===0&&cz===2)return 2+.55+.35*Math.sin(t*1.5);
      return (cx+cz)%2?.5*fog:.06*fog}},
    akira:function(t){var R=.27+.02*Math.sin(t*.5);return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,col=Math.floor(u*40),h=.12+.22*hash(col,1);
      var tr=Math.abs(v-.9),head=.55+.03*Math.sin(t*.7);
      if(u<head&&tr<.012*(u/head)+.002)return 2+.5+.45*(u/head);
      if(Math.abs(u-head)*a<.02&&tr<.02)return 2.98;
      if(v>1-h&&v<.86)return hash(Math.floor(u*150),Math.floor(v*80))>.8?.65:.16;
      var dx=(u-.7)*a,dy=v-.7,d=Math.sqrt(dx*dx+dy*dy);
      if(dy<0&&d<R)return d>R-.018?2.9:.98-.35*(d/R)*fbm(dx*8+t*.2,dy*8);
      return hash(x,y)>.996?.5:0}},
    gits:function(t){return function(x,y,W,H){
      var u=x/W,v=y/H,col=Math.floor(u*48),h=.15+.3*hash(col,8);
      if(v>1-h)return hash(Math.floor(u*190),Math.floor(v*110))>.83?2.75:.13;
      var c=Math.floor(u*56),sp=.25+hash(c,3)*.6,head=(t*sp*.25+hash(c,7))%1,dv=head-v;
      if(dv<0||dv>.4||hash(c,Math.floor(v*44))<.35)return 0;
      return dv<.025?2.95:(1-dv/.4)*.6}},
    eva:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,X=(u-.7)*a,Y=v-.5;
      var vb=Math.abs(X),hb=Math.abs(v-.3),core=(vb<.022&&v>.04&&v<.82)||(hb<.018&&vb<.17);
      if(core)return .98;
      var d=Math.min(v>.04&&v<.82?vb:9,vb<.17?hb:9),glow=Math.exp(-d*26)*(.75+.25*Math.sin(t*2));
      if(glow>.3)return glow;
      if(v>.82)return hash(Math.floor(u*120),Math.floor(v*60))>.7?.3:.08;
      var hx=Math.max(Math.abs(X)*.866+Math.abs(Y)*.5,Math.abs(Y)),ring=((hx*5-t*.35)%1+1)%1;
      return ring<.05?2.8:0}},
    bebop:function(t){return function(x,y,W,H){
      var a=W/H,X=(x/W-.7)*a,Y=y/H-.5,r=Math.sqrt(X*X+Y*Y),ang=Math.atan2(Y,X);
      if(r<.07)return r<.012?0:2.85;
      if(r<.4)return .12+.12*Math.sin(r*260)+.55*Math.pow(Math.max(0,Math.cos(ang-t*1.5)),10);
      return hash(x,y)>.994?.75:0}},
    spirited:function(t){var x0=((t*.035)%1.6)-.3;return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,hz=.58;
      if(v<hz){
        var tu=u-x0;if(v>.5&&v<hz&&tu>0&&tu<.42){var car=Math.floor(tu/.105),cu=tu-car*.105;
          if(cu>.1)return 0;if(v>.515&&v<.545&&(cu*100%3.2)>1.1)return 2.9;return v<.508?.5:.22}
        for(var k=0;k<2;k++){var ly=.16+k*.12,cx=Math.round((u-k*.04)/.08)*.08+k*.04,dx=(u-cx)*1.9,dy=(v-ly)/.04;if(dx*dx/.0008+dy*dy<1)return 2.85}
        return hash(x,y)>.995?.5:0}
      var ru=u-x0,rv=hz*2-v+.006*Math.sin(v*120+t*3);
      if(rv>.5&&ru>0&&ru<.42&&(ru%.105)<.1)return rv>.515&&rv<.545?2.4:.1;
      return Math.sin(u*50+t*2+v*120)>.9?.22:.04}},
    mononoke:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H;
      for(var j=0;j<8;j++){var kx=.48+.06*j+.01*Math.sin(j*3),ky=.66+.18*hash(j,6)+.008*Math.sin(t*1.2+j),s=.9+.4*hash(j,2);
        var dx=(u-kx)*a/s,dyh=(v-ky)/s,db=(v-(ky+.055*s))/s;
        if(dx*dx/.0012+dyh*dyh/.0015<1){
          var tilt=.006*Math.sin(t*2+j),e1=(dx+.013)*(dx+.013)+(dyh+tilt)*(dyh+tilt),e2=(dx-.013)*(dx-.013)+(dyh-tilt)*(dyh-tilt),mo=dx*dx+(dyh-.018)*(dyh-.018);
          return (e1<.00005||e2<.00005||mo<.00003)?0:.97}
        if(dx*dx/.0004+db*db/.0011<1)return .9}
      for(var k=0;k<9;k++){var tx=hash(k,2),w=.015+.03*hash(k,3);if(Math.abs(u-tx)<w)return .05+.2*Math.pow(1-(u-tx+w)/(2*w),2)}
      return v>.92?.15+.2*fbm(u*30,v*10):Math.pow(Math.max(0,Math.sin(u*9-v*5+.5)),8)*.09*(1-v)}},
    yourname:function(t){var hd=.8+.04*Math.sin(t*.25);return function(x,y,W,H){
      var u=x/W,v=y/H,cord=.8+.035*Math.sin(u*9+t)+.01*Math.sin(u*31-t*2);
      if(Math.abs(v-cord)<.007)return ((u*60+t*4)%1<.5)?2.95:2.6;
      for(var k=0;k<2;k++){var ly=.08+u*(.55+.18*k),d=Math.abs(v-ly);
        if(u<hd&&d<.03){var val=Math.exp(-d*110)*(u/hd);if(val>.12)return k?val:2+val}}
      if(Math.abs(u-hd)<.012&&Math.abs(v-(.08+hd*.55))<.02)return 2.95;
      return hash(x,y)>.992?.8:.22*v*v*v}},
    aot:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,top=.62;
      if(v>top)return v<top+.012?.75:(((Math.floor(v*60)%2?Math.floor(u*30):Math.floor(u*30+.5))+Math.floor(v*60))%2?.32:.22);
      var dx=(u-.7)*a,dy=v-.5;
      if(dx*dx/.03+dy*dy/.05<1){
        if(Math.pow((dx+.06)/.022,2)+Math.pow((dy+.03)/.012,2)<1||Math.pow((dx-.06)/.022,2)+Math.pow((dy+.03)/.012,2)<1)return .98;
        if(dy>.07&&dy<.1&&Math.abs(dx)<.08)return (Math.floor(dx*120)%2)?.7:.1;
        return 2+.3+.35*Math.abs(Math.sin(dx*90))*clamp(1-dx*dx*20)}
      var steam=fbm(u*6+t*.15,v*5-t*.3);
      return steam>.6&&Math.abs(dx)<.5?(steam-.6)*2.2:0}},
    fma:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,X=(u-.66)*a,Y=v-.5,r=Math.sqrt(X*X+Y*Y),an=Math.atan2(Y,X);
      if(Math.abs(X)<.025&&Y<-.23&&Y>-.27)return .85;
      if(Math.abs(X)<.012&&Y<-.27&&Y>-.31)return .7;
      if(r<.235&&r>.205)return .55+.4*clamp(.6-X*3-Y*3);
      if(r<.205){
        if(r>.18&&r<.195&&Math.abs(Math.sin(an*6))<.09)return .95;
        if(r>.185&&r<.195&&Math.abs(Math.sin(an*30))<.15)return .5;
        var hm=t*.05-Math.PI/2,mm=t*.6-Math.PI/2,ah=an-hm,am=an-mm;ah=Math.atan2(Math.sin(ah),Math.cos(ah));am=Math.atan2(Math.sin(am),Math.cos(am));
        if(r<.1&&Math.abs(ah)*r<.006)return .95;
        if(r<.16&&Math.abs(am)*r<.004)return .95;
        if(r<.012)return .95;
        return .07+.06*(1-r/.205)}
      for(var k=0;k<14;k++){var lx=X-(.02+k*.028),ly=Y-(-.27+.012*k*k*.08);if(lx*lx+ly*ly<.00012)return k%2?.7:.45}
      var gx=X+.33,gy=Y-.22,gr=Math.sqrt(gx*gx+gy*gy);
      if(Math.abs(gx)+Math.abs(gy)*.7<.045)return 2.95-.4*clamp(gx*10+gy*10);
      if(gr<.13)return Math.exp(-gr*22)>.25?2+.5*Math.exp(-gr*22):0;
      return hash(x,y)>.996?.3:0}},
    kimetsu:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H;
      if(v>.8){var c=(Math.floor(x/(W/40))+Math.floor((y-.8*H)/(W/40)))%2;return c?4.75:.04}
      var X=(u-.66)*a,Y=v-.5,r=Math.sqrt(X*X+Y*Y),an=Math.atan2(Y,X),sweep=((an+Math.PI-t*.9)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
      var th=.03+.05*(sweep/(Math.PI*2)),fl=fbm(an*6-t*1.5,r*14-t*2),d=Math.abs(r-.27-.03*(fl-.5));
      if(sweep>Math.PI*.55&&d<th*(.6+fl)){var k=1-d/(th*(.6+fl));return k>.7?.97:2+.45+.5*k}
      var e=hash(Math.floor(x/2),Math.floor((y+t*30*(1+hash(Math.floor(x/2),5)))/2));
      if(e>.993&&v<.8)return 2+.6+.35*hash(x,7);
      return 0}},
    deathnote:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H,X=(u-.86)*a,Y=v-.2,in1=X*X+Y*Y<.016,X2=X+.05,Y2=Y-.02,in2=X2*X2+Y2*Y2<.014;
      if(in1&&!in2)return .55+.4*fbm(X*14,Y*14);
      var nx=u-.62,ny=v-.3;
      if(nx>0&&nx<.2&&ny>0&&ny<.6){var e=Math.min(nx,.2-nx,ny,.6-ny);
        if(e<.004)return .85;if(nx<.022)return .3;if(Math.abs(ny-.12)<.05&&nx>.05&&nx<.17)return e<.008?.5:.14;return .06+.04*hash(x,y)}
      var ax=(u-.88)*a,ay=v-.8;if(ax*ax+ay*ay<.004)return 2.55+.4*clamp(-ax*6-ay*6+.3);
      if(Math.abs(ax-.012)<.004&&ay<-.06&&ay>-.09)return .6;
      return hash(x,y)>.997?.4:0}},
    steins:function(t){return function(x,y,W,H){
      var a=W/H,u=x/W,v=y/H;
      var m=textMask('1.048596','600 '+Math.round(H*.13)+'px "IBM Plex Mono", monospace',W,H,'st'+W)[y*W+x];
      if(m>.3)return 2+(.55+.4*m)*(.8+.2*Math.sin(t*3+u*20));
      var G=[[.14,.32,.17,12,1],[.3,.72,.12,9,-1],[.08,.82,.07,7,1]];
      for(var i=0;i<3;i++){var g=G[i],X=(u-g[0])*a,Y=v-g[1],r=Math.sqrt(X*X+Y*Y),an=Math.atan2(Y,X);
        var tooth=Math.sin(an*g[3]+t*.6*g[4])>0?.025:0;
        if(r<g[2]+tooth&&r>g[2]*.35)return .2+.45*clamp(.5-X*2-Y*2);}
      return 0}}
  };

  /* worker runtime: owns every dither canvas; the page only sends state */
  var root={dataset:{}},lum={},monoMask=null,bone,seal,alt,t=.6,reduce=false,hover=-1,F={};
  function loadLum(id){postMessage({need:id})}
  function rgb(h){return [1,3,5].map(function(i){return parseInt(h.substr(i,2),16)})}
  function draw(f){
    if(!bone&&!f.own)return; // colours not received yet
    var fn=f.fig(t*7.5,f.ds);if(!fn){f.ctx.clearRect(0,0,f.W,f.H);return}
    var b=f.own?f.own[0]:bone,sl=f.own?f.own[1]:seal,al=f.own?f.own[2]:alt,d=f.img.data,W=f.W,H=f.H;
    for(var y=0;y<H;y++)for(var x=0;x<W;x++){
      var v=fn(x,y,W,H),col=b;if(v>=4){v-=4;col=al}else if(v>=2){v-=2;col=sl}
      var i=(y*W+x)*4,on=v>(B[(y&7)*8+(x&7)]+.5)/64;
      d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=on?255:0}
    f.ctx.putImageData(f.img,0,0);f.drawn=true;
  }
  /* which figures move: glyphs always, the hero only for procedural motifs, a theme card only while pointed at */
  function moving(f){if(f.ds.fig==='motif')return f.id===hover;if(f.ds.fig==='wall')return !!MOTIFS[root.dataset.theme];return true}
  onmessage=function(e){var m=e.data;
    if(m.add)m.add.forEach(function(c){var ctx=c.cv.getContext('2d');
      F[c.id]={id:c.id,ctx:ctx,W:c.cv.width,H:c.cv.height,img:ctx.createImageData(c.cv.width,c.cv.height),ds:c.ds,fig:FIGS[c.ds.fig],vis:false,drawn:false,
        own:c.ds.bone?[rgb(c.ds.bone),rgb(c.ds.seal),rgb(c.ds.alt||c.ds.seal)]:null}});
    if('reduce' in m)reduce=m.reduce;
    if(m.colors){bone=m.colors[0];seal=m.colors[1];alt=m.colors[2];root.dataset.theme=m.theme;for(var k in F)if(!F[k].own&&F[k].drawn||F[k].vis&&!F[k].own)draw(F[k])}
    if(m.lum){lum[m.lum]={l:m.l,a:m.a};for(var k2 in F)if(F[k2].ds.fig==='wall')draw(F[k2])}
    if(m.mask){monoMask=m.mask;for(var k3 in F)if(F[k3].ds.fig==='mono')draw(F[k3])}
    if('vis' in m){var f=F[m.vis];f.vis=m.on;if(m.on&&!f.drawn)draw(f)}
    if('hover' in m){var old=F[hover];hover=m.hover;if(old&&old.vis)draw(old)}
  };
  setInterval(function(){if(reduce)return;t+=.012;for(var k in F){var f=F[k];if(f.vis&&moving(f))draw(f)}},90);
