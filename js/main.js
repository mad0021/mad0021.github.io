(function(){
  /* language */
  var root=document.documentElement;
  var kitReady=false,curTheme='ink';
  function setLang(l){
    root.setAttribute('data-lang',l);root.lang=l;
    document.querySelector('.nav nav').setAttribute('aria-label',l==='en'?'Sections':'Secciones');
    document.querySelectorAll('[data-en]').forEach(function(el){el.setAttribute('aria-label',el.dataset[l]||el.dataset.es)});
    document.querySelectorAll('[data-alt-en]').forEach(function(im){im.alt=l==='en'?im.dataset.altEn:im.dataset.altEs});
    if(kitReady)applyKit(curTheme);
    document.querySelectorAll('.lang button').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.set===l))});
    try{localStorage.setItem('mad-lang',l)}catch(e){}
  }
  var saved=new URLSearchParams(location.search).get('lang');try{saved=saved||localStorage.getItem('mad-lang')}catch(e){}
  setLang(saved==='en'||saved==='es'?saved:(/^en/i.test((navigator.languages||[navigator.language])[0]||'')?'en':'es'));
  document.querySelectorAll('.lang button').forEach(function(b){b.addEventListener('click',function(){setLang(b.dataset.set)})});

  /* copy email */
  var btn=document.getElementById('copy-mail'),mail=document.getElementById('mail');
  btn.addEventListener('click',function(){
    var done=function(){var es=btn.querySelector('[lang=es]'),en=btn.querySelector('[lang=en]');es.textContent='Copiado';en.textContent='Copied';var st=document.getElementById('copy-status');st.textContent='';setTimeout(function(){st.textContent=root.lang==='en'?'Email copied':'Email copiado'},50);setTimeout(function(){es.textContent='Copiar';en.textContent='Copy'},1600)};
    var select=function(){var r=document.createRange();r.selectNodeContents(mail);var s=getSelection();s.removeAllRanges();s.addRange(r);document.getElementById('copy-status').textContent=root.lang==='en'?'Email selected, press Ctrl+C':'Email seleccionado, pulsa Ctrl+C'};
    try{navigator.clipboard.writeText(mail.textContent).then(done,select)}catch(e){select()}
  });


  /* shots viewer: native <dialog>, arrows and Esc work from the keyboard */
  var viewer=document.getElementById('viewer'),shots=document.querySelectorAll('.shot'),cur=0;
  function show(i){
    cur=(i+shots.length)%shots.length;var s=shots[cur],img=s.querySelector('img');
    viewer.querySelector('img').src=img.src;viewer.querySelector('img').alt=img.alt;
    document.getElementById('v-n').textContent='S-0'+(cur+1);
    document.getElementById('v-t').innerHTML=s.querySelector('.cap span:last-child').innerHTML;
    document.getElementById('v-d').innerHTML=s.querySelector('.desc').innerHTML;
  }
  shots.forEach(function(s,i){s.addEventListener('click',function(){show(i);if(viewer.showModal)viewer.showModal()})});
  viewer.addEventListener('click',function(e){
    var b=e.target.closest('button');
    if(b&&b.dataset.step)show(cur+ +b.dataset.step);
    else if((b&&b.hasAttribute('data-close'))||e.target===viewer)viewer.close();
  });
  viewer.addEventListener('keydown',function(e){if(e.key==='ArrowRight')show(cur+1);if(e.key==='ArrowLeft')show(cur-1)});

  /* DITHER ENGINE: every figure is a shade field (0..1) rendered through a Bayer 8x8 ordered dither, bone on ink.
     A figure is fig(t) -> function(x,y,W,H) returning the shade; values >= 2 mean "seal red" with shade v-2. */
  function clamp(v){return v<0?0:v>1?1:v}
  var bone,seal;
  function hex(v){v=getComputedStyle(document.documentElement).getPropertyValue(v).trim();return [1,3,5].map(function(i){return parseInt(v.substr(i,2),16)})}
  var alt;function readColors(){bone=hex('--bone');seal=hex('--seal');alt=getComputedStyle(document.documentElement).getPropertyValue('--alt').trim()?hex('--alt'):seal}readColors();


  /* image figures: luminance (+ accent where the picture already carries the theme's accent colour), cached per theme */
  var BUST="assets/bust-marcus-aurelius.webp"; // Marcus Aurelius, marble bust (photo: Wikimedia Commons, "Marble Bust of Marcus Aurelius (Roman Emperor 161-180 AD) (28273837396).jpg", CC0)
  var loading={};
  function loadLum(id){
    if(loading[id])return;loading[id]=1;
    var src=id==='ink'?BUST:(getComputedStyle(root).getPropertyValue('--w-'+id).match(/url\(["']?(.*?)["']?\)\s*$/)||[])[1];if(src)src=src.replace(/^\.\.\//,'');
    if(!src)return;
    var im=new Image();im.onload=function(){
      var W=size.wallfx[0],H=size.wallfx[1],o=document.createElement('canvas');o.width=W;o.height=H;var g=o.getContext('2d');
      if(id==='ink'){var h=H*.96,w=h*im.width/im.height;g.drawImage(im,W*.8-w/2,H-h+H*.02,w,h)}
      else g.drawImage(im,0,0,W,H);
      var px=g.getImageData(0,0,W,H).data,l=new Float32Array(W*H),a=new Uint8Array(W*H),sc=hex('--seal');
      for(var i=0;i<l.length;i++){
        var R=px[i*4],G=px[i*4+1],Bl=px[i*4+2],al=px[i*4+3]/255,y=(.3*R+.59*G+.11*Bl)/255*al;
        l[i]=id==='ink'?Math.pow(clamp((y-.06)/.9),1.45)*.92:clamp((y-.05)/.8);
        var ch=Math.max(R,G,Bl)-Math.min(R,G,Bl),dc=Math.abs(R-sc[0])+Math.abs(G-sc[1])+Math.abs(Bl-sc[2]);
        a[i]=id!=='ink'&&ch>70&&dc<170?1:0;
      }
      if((root.dataset.theme||'ink')===id)worker.postMessage({lum:id,l:l,a:a},[l.buffer,a.buffer]);else loading[id]=0;
    };im.src=src;
  }

  /* the M mask comes from the display font itself, once it has loaded */
  var glyph='M';
  function buildMask(){
    if(!size.mono)return;
    var c={width:size.mono[0],height:size.mono[1]},o=document.createElement('canvas');o.width=c.width;o.height=c.height;var g=o.getContext('2d');
    g.fillStyle='#fff';g.textAlign='center';
    if(glyph==='M'){g.textBaseline='alphabetic';g.font='300 '+Math.round(c.height*1.15)+'px Fraunces, Georgia, serif';g.fillText('M',c.width/2,c.height*.95)}
    else{g.textBaseline='middle';g.font='600 '+Math.round(c.height*.92)+'px "Shippori Mincho B1","Yu Mincho",serif';g.fillText(glyph,c.width/2,c.height*.54)}
    var px=g.getImageData(0,0,c.width,c.height).data,m=new Float32Array(c.width*c.height);
    for(var i=0;i<m.length;i++)m[i]=px[i*4+3]/255;worker.postMessage({mask:m},[m.buffer]);
  }

  /* every dither canvas is handed to a worker: the pixel loops never block scrolling or input.
     shortcut: browsers without OffscreenCanvas (Safari < 16.4) show the canvases empty, they're decorative; upgrade if that audience matters */
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,size={},worker=null;
  var cvs=Array.prototype.slice.call(document.querySelectorAll('canvas[data-fig]'));
  if(window.Worker&&HTMLCanvasElement.prototype.transferControlToOffscreen){
    worker=new Worker('js/dither.worker.js?v=3bab9cc8');
    var add=cvs.map(function(c,i){c.dataset.fid=i;if(c.id)size[c.id]=[c.width,c.height];if(c.dataset.fig==='mono')size.mono=[c.width,c.height];
      return {id:i,cv:c.transferControlToOffscreen(),ds:Object.assign({},c.dataset)}});
    worker.postMessage({add:add,reduce:reduce},add.map(function(a){return a.cv}));
    worker.onmessage=function(e){if(e.data.need)loadLum(e.data.need)};
    var fio=new IntersectionObserver(function(es){es.forEach(function(e){worker.postMessage({vis:+e.target.dataset.fid,on:e.isIntersecting})})},{rootMargin:'100px'});
    cvs.forEach(function(c){fio.observe(c)});
    document.querySelectorAll('.theme[data-motif]').forEach(function(b){var id=+b.querySelector('canvas').dataset.fid;
      b.addEventListener('pointerenter',function(){worker.postMessage({hover:id})});b.addEventListener('focus',function(){worker.postMessage({hover:id})});
      b.addEventListener('pointerleave',function(){worker.postMessage({hover:-1})});b.addEventListener('blur',function(){worker.postMessage({hover:-1})})});
  }else worker={postMessage:function(){}};
  if(document.fonts)document.fonts.ready.then(function(){buildMask()});

  /* THEMES: swap the palette on <html>, remember it, repaint the dither figures in the new colours */
  var themeBtns=document.querySelectorAll('.theme');
  /* id: [glyph, display face, reading, name] — kanji are original marks for each mood, not titles or logos */
  var KIT={ink:['M','serif','','Tinta'],rose:['桃','serif','momo','Rose'],'blue-hour':['夜','serif','yoru','Blue Hour'],'red-august':['侍','mincho','samurai','Red August'],
    teal:['刃','tech','yaiba','Teal'],forest:['緑','mincho','midori','Forest'],chrome:['球','tech','tama','Chrome'],
    akira:['光','tech','hikari','Akira'],gits:['殻','tech','kara','Ghost in the Shell'],eva:['使','tech','shito','Evangelion'],bebop:['星','tech','hoshi','Cowboy Bebop'],
    spirited:['湯','mincho','yu','El viaje de Chihiro'],mononoke:['森','mincho','mori','Mononoke'],yourname:['結','mincho','musubi','Your Name'],aot:['壁','mincho','kabe','Attack on Titan'],
    fma:['錬','mincho','renkin','Fullmetal Alchemist'],kimetsu:['炎','mincho','honō','Demon Slayer'],deathnote:['名','mincho','na','Death Note'],steins:['時','tech','toki','Steins;Gate'],
    onepiece:['海','mincho','umi','One Piece'],naruto:['忍','mincho','shinobi','Naruto'],dbz:['気','tech','ki','Dragon Ball Z'],jjk:['呪','tech','noroi','Jujutsu Kaisen'],csm:['鋸','tech','nokogiri','Chainsaw Man'],hxh:['念','tech','nen','Hunter x Hunter'],berserk:['剣','mincho','ken','Berserk'],vinland:['航','mincho','kō','Vinland Saga'],frieren:['旅','mincho','tabi','Frieren'],mob:['超','tech','chō','Mob Psycho 100'],ttgl:['螺','tech','ra','Gurren Lagann'],codegeass:['王','mincho','ō','Code Geass']};
  var NAME_EN={ink:'Ink',spirited:'Spirited Away',mononoke:'Princess Mononoke'};
  var sealEl=document.querySelector('.seal'),wmEl=document.querySelector('.watermark'),iconEl=document.querySelector('link[rel="icon"]');
  function applyKit(id){
    var k=KIT[id]||KIT.ink,kanji=k[0]!=='M',en=root.lang==='en',name=(en&&NAME_EN[id])||k[3];
    if(k[1]==='serif')delete root.dataset.font;else root.dataset.font=k[1];
    sealEl.textContent=k[0];sealEl.classList.toggle('k',kanji);
    wmEl.textContent=k[0];wmEl.classList.toggle('k',kanji);
    document.querySelectorAll('.idx .mk').forEach(function(m){m.textContent=kanji?k[0]:''});
    document.getElementById('kit-cap').textContent=id==='ink'?'fig. 01 — '+(en?'Marcus Aurelius':'Marco Aurelio')+' · CC0':'fig. 01 — '+name+' · '+k[0];
    document.getElementById('wallfx').setAttribute('aria-label',id==='ink'?(en?'Dithered bust of Marcus Aurelius (CC0 photo, Wikimedia Commons)':'Busto de Marco Aurelio tramado (foto CC0, Wikimedia Commons)'):(en?'Dithered figure: ':'Figura tramada: ')+name);
    document.getElementById('kit-foot').textContent=name;
    var cs=getComputedStyle(root),sv=cs.getPropertyValue('--seal').trim(),iv=cs.getPropertyValue('--ink').trim();
    iconEl.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="'+sv+'"/><text x="16" y="'+(kanji?24:23)+'" font-family="'+(kanji?'Yu Mincho,serif':'Georgia,serif')+'" font-size="'+(kanji?21:20)+'" font-weight="600" text-anchor="middle" fill="'+iv+'">'+k[0]+'</text></svg>');
    document.querySelector('meta[name="theme-color"]').content=iv;
    glyph=k[0];buildMask();
  }
  function setTheme(id){
    if(id==='ink')delete root.dataset.theme;else root.dataset.theme=id;
    if(document.querySelector('.theme[data-motif="'+id+'"]'))root.dataset.motif=id;else delete root.dataset.motif;
    themeBtns.forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.theme===id))});
    try{localStorage.setItem('mad-theme',id)}catch(e){}
    curTheme=id;applyKit(id);
    cancelAnimationFrame(postFrame);postFrame=requestAnimationFrame(function(){readColors();worker.postMessage({colors:[bone,seal,alt],theme:curTheme})});
  }
  var postFrame=0,more=document.querySelector('.more-themes');
  themeBtns.forEach(function(b){b.addEventListener('click',function(){
    var u=new URL(location);if(u.searchParams.has('theme')){u.searchParams.delete('theme');history.replaceState(null,'',u)} // a shared link sets the first look, not every later visit
    var go=function(){setTheme(b.dataset.theme)};
    if(!document.startViewTransition||b.getAttribute('aria-pressed')==='true')return go();
    var r=b.getBoundingClientRect();root.style.setProperty('--vt-x',(r.left+r.width/2)+'px');root.style.setProperty('--vt-y',(r.top+r.height/2)+'px');
    var vt=document.startViewTransition(go);vt.ready.catch(function(){}); // skipped transitions (hidden tab, rapid clicks) still apply the theme
  })});
  var first=root.dataset.theme;if(!first||!document.querySelector('.theme[data-theme="'+first+'"]'))first='ink'; // ?theme= links and stored values may be stale
  setTheme(first);kitReady=true;
  if(more&&more.querySelector('.theme[data-theme="'+first+'"]'))more.open=true;

  /* reveal each section once, children staggered */
  var groups=document.querySelectorAll('[data-reveal]');
  groups.forEach(function(g){Array.prototype.forEach.call(g.children,function(c,i){c.style.setProperty('--i',i)})});
  if('IntersectionObserver' in window&&!reduce){
    root.classList.add('reveal');
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -12% 0px'});
    groups.forEach(function(g){io.observe(g)});
  }else groups.forEach(function(g){g.classList.add('in')});

  /* theme wallpaper swatches are offscreen at load: fetch them only when the section is near */
  var thSec=document.getElementById('themes');
  if('IntersectionObserver' in window)new IntersectionObserver(function(e,o){if(e[0].isIntersecting){thSec.classList.add('near');o.disconnect()}},{rootMargin:'800px'}).observe(thSec);else thSec.classList.add('near');

  /* nav marks the section in view */
  var navA=document.querySelectorAll('.nav nav a');
  if('IntersectionObserver' in window){
    var navIO=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)navA.forEach(function(a){if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')})})},{rootMargin:'-45% 0px -50% 0px'});
    document.querySelectorAll('main section[id]').forEach(function(s){navIO.observe(s)});
  }

  /* SIGNAL: scroll position drives the sequence Apps → Flow → Data → BI (desktop, motion allowed) */
  var sig=document.getElementById('signal'),cards=sig.querySelectorAll('.flow article'),bars=sig.querySelectorAll('.flow .bar');
  var wide=matchMedia('(min-width:901px)'),ticking=false;
  function scrub(){
    ticking=false;
    if(!sig.classList.contains('scrub'))return;
    var r=sig.getBoundingClientRect(),span=sig.offsetHeight-innerHeight;
    var p=Math.min(1,Math.max(0,-r.top/span))*cards.length; // 0..4
    for(var i=0;i<cards.length;i++){
      var f=Math.min(1,Math.max(0,p-i));
      bars[i].style.transform='scaleX('+f+')';
      cards[i].classList.toggle('on',p>i||i===0);
    }
  }
  function mode(){
    sig.classList.remove('scrub');
    var fits=sig.querySelector('.wrap').offsetHeight<=innerHeight-56;
    var on=wide.matches&&!reduce&&fits;
    sig.classList.toggle('scrub',on);
    if(!on){cards.forEach(function(c){c.classList.remove('on')});bars.forEach(function(b){b.style.transform=''})}
    scrub();
  }
  addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(scrub)}},{passive:true});
  (wide.addEventListener?wide.addEventListener('change',mode):wide.addListener(mode));
  var rz=0;addEventListener('resize',function(){cancelAnimationFrame(rz);rz=requestAnimationFrame(mode)});
  mode();

  /* pause the dither loop in hidden tabs and follow live reduced-motion changes */
  var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)');
  var motionBtn=document.getElementById('motion'),paused=false;
  try{paused=localStorage.getItem('mad-motion')==='off'}catch(e){}
  function pause(){worker.postMessage({reduce:document.hidden||(rm&&rm.matches)||paused});motionBtn.setAttribute('aria-pressed',String(paused))}
  motionBtn.addEventListener('click',function(){paused=!paused;try{localStorage.setItem('mad-motion',paused?'off':'on')}catch(e){}pause()});
  pause();
  document.addEventListener('visibilitychange',pause);
  if(rm&&rm.addEventListener)rm.addEventListener('change',function(){reduce=rm.matches;pause();mode()});
})();
