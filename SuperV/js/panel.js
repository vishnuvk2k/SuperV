(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cep = window.__adobe_cep__, isAE = !!cep, node = window.cep_node && window.cep_node.require ? window.cep_node.require : (typeof require === 'function' ? require : null);
  var defaults = { recentColours: ['#0080FF', '#6577F3', '#F3A4AD', '#FFE181'], pinnedColours: [], encoder: '' };
  var presetList = VKText.presets;
  var cancelRender = false, state, preset = 'slide', encoder = null, path = null, fs = null, extensionRoot = '', videoPath = '', outputPath = '', exportJob = null, busy = false, previewAnimations = [], previewTimer;
  try {
    var configRequest=new XMLHttpRequest();configRequest.open('GET','config/defaults.json',false);configRequest.send();
    var config=JSON.parse(configRequest.responseText);
    if(Array.isArray(config.recentColours))defaults.recentColours=config.recentColours;
    if(Array.isArray(config.pinnedColours))defaults.pinnedColours=config.pinnedColours;
    if(/^#[0-9a-f]{6}$/i.test(config.theme))document.documentElement.style.setProperty('--blue',config.theme);

  } catch (_) { /* Built-in defaults also support browser file previews with local-file restrictions. */ }
  function status(message, kind) { $('status').textContent = String(message).toUpperCase(); $('status').className = kind || ''; }
  function save() { try { localStorage.setItem('vk.gsd.settings.v1', JSON.stringify(state)); } catch (e) { status('Settings could not be saved: ' + e.message, 'error'); } }
  function load() {
    try { state = JSON.parse(localStorage.getItem('vk.gsd.settings.v1') || '{}'); } catch (_) { state = {}; }
    state = Object.assign({}, defaults, state);
    state.recentColours = Array.isArray(state.recentColours) ? state.recentColours.filter(validHex).slice(0,4) : defaults.recentColours.slice();
    defaults.recentColours.forEach(function(c){ if(state.recentColours.length<4 && state.recentColours.indexOf(c)<0)state.recentColours.push(c); });
    state.pinnedColours = Array.isArray(state.pinnedColours) ? state.pinnedColours.filter(validHex).slice(0,12) : [];
    state.fields = state.fields || {};
    Object.keys(state.fields).forEach(function(id){var el=$(id);if(!el)return;if(el.type==='checkbox')el.checked=!!state.fields[id];else el.value=state.fields[id];});
    $('encoder-path').value = state.encoder || '';
  }
  function validHex(s){return typeof s==='string' && /^#[0-9a-f]{6}$/i.test(s);}
  function value(id){return $(id).value;}
  function checked(id){return $(id).checked;}
  function n(id){var e=$(id);if(!e.checkValidity())throw new Error('Check '+id.replace(/-/g,' ')+'. '+e.validationMessage);var x=Number(e.value);if(!Number.isFinite(x))throw new Error('Enter a number.');return x;}
  var connection;
  function bridge(action, args) {
    if(!connection)return Promise.reject(new Error('The AE connection could not be initialized. Reinstall the complete 1.2.2 package.'));
    return connection.call(action,args);
  }
  function setBusy(v){busy=v;document.querySelectorAll('[data-action],#export-gif,#sample-colour,#apply-hex').forEach(function(b){b.disabled=v;});}
  async function run(action,args){if(busy)return;setBusy(true);status('Working…');try{var r=await bridge(action,args);status(r.message||'Done.','success');return r;}catch(e){status(e.message,'error');}finally{setBusy(false);}}
  function tab(id){document.querySelectorAll('.tab').forEach(function(t){t.classList.toggle('active',t.id===id);});document.querySelectorAll('nav button').forEach(function(b){b.classList.toggle('active',b.dataset.tab===id);});if(id==='text')playPreview();}
  function textOptions(){return {preset:preset,duration:n('text-duration'),stagger:n('text-stagger'),by:VKText.get(preset).by||value('text-by'),direction:value('text-direction')};}
  function toolArgs(action){switch(action){
    case 'crop':return {mode:value('crop-mode'),scope:value('crop-scope'),range:value('crop-range'),padding:n('crop-padding')};
    case 'null':return {position:value('null-position'),parent:checked('null-parent')};
    case 'copyKeys':case 'pasteKeys':return {expressions:checked('keys-expressions'),offset:value('keys-offset')};
    case 'loop':return {direction:value('loop-direction'),type:value('loop-type'),count:n('loop-count'),replace:checked('replace-expression')};
    case 'wiggle':return {amount:n('wiggle-pixels'),frequency:n('wiggle-speed'),replace:checked('replace-expression')};
    case 'counter':return {from:n('counter-from'),to:n('counter-to'),duration:n('counter-duration'),decimals:n('counter-decimals'),prefix:value('counter-prefix'),suffix:value('counter-suffix'),separator:checked('counter-separator'),first:checked('counter-separator')?n('counter-first'):3,every:checked('counter-separator')?n('counter-every'):3,replace:checked('replace-expression')};
    case 'text':case 'textPreview':return textOptions();
    default:return {};
  }}
  function counterPreview(){
    $('counter-comma-options').hidden=!checked('counter-separator');
    try{
      var o=toolArgs('counter');
      $('counter-preview').textContent=[o.from,o.to].map(function(v){return VKFormatNumber(v,o.decimals,o.separator,o.first,o.every,o.prefix,o.suffix);}).join(' → ');
    }catch(e){$('counter-preview').textContent='CHECK YOUR NUMBER SETTINGS';}
  }
  function rememberColour(hex){hex=hex.toUpperCase();showColour(hex);state.recentColours=[hex].concat(state.recentColours.filter(function(c){return c!==hex;})).slice(0,4);save();swatches();}
  function swatches(){
    function fill(id,colours){$(id).textContent='';colours.forEach(function(c){var b=document.createElement('button');b.className='swatch'+(state.pinnedColours.indexOf(c)>=0?' pinned':'');b.style.backgroundColor=c;b.title=c+' · CLICK TO APPLY · SHIFT-CLICK TO PIN';b.setAttribute('aria-label',b.title);b.onclick=async function(e){if(e.shiftKey){var i=state.pinnedColours.indexOf(c);if(i>=0)state.pinnedColours.splice(i,1);else if(state.pinnedColours.length<12)state.pinnedColours.push(c);save();swatches();return;}var r=await run('colour',{hex:c});if(r)rememberColour(c);};$(id).appendChild(b);});}
    fill('colour-swatches',state.recentColours);fill('pinned-swatches',state.pinnedColours);
  }
  function animateText(el,spec,o,small){
    el.textContent='';var units=[],animations=[],by=spec.by||o.by,sample=VKText.sample(spec),lines=sample.split('\n');
    el.classList.toggle('has-lines',lines.length>1);
    lines.forEach(function(line,lineIndex){
      var parts=by==='line'?[line]:by==='word'?line.split(' '):line.split('');
      parts.forEach(function(part,i){var unit=document.createElement('span');unit.className='unit';unit.textContent=part;el.appendChild(unit);units.push(unit);if(by==='word'&&i<parts.length-1)el.appendChild(document.createTextNode(' '));});
      if(lineIndex<lines.length-1)el.appendChild(document.createElement('br'));
    });
    var ds=VKText.delays(sample,by,o.stagger,spec.parallelRows),rawTotal=o.duration+Math.max.apply(Math,ds),total=o.duration,factor=total/rawTotal,ratio=parseFloat(getComputedStyle(el).fontSize)/66;
    units.forEach(function(unit,i){
        var frames=[];
        var delay=o.direction==='out'&&spec.reverseOut?rawTotal-o.duration-ds[i]:ds[i];
        if(spec.step){delay+=(i+1)*o.duration/units.length;animations.push(unit.animate([{opacity:o.direction==='out'?1:0},{opacity:o.direction==='out'?0:1}],{duration:1,delay:Math.max(0,delay*factor*1000-1),easing:'steps(1,end)',fill:'both'}));return;}
        for(var k=0;k<=60;k++){
          var t=k*o.duration/60,amount=VKText.amount(t,1,1,o.duration,0,o.direction==='out',false,spec.curve||'smooth')/100,visible=1-amount;
          var x=(spec.x||0)*(spec.opposing?(i%2===0?-1:1):1);
          var frame={opacity:spec.outline?Math.min(1,visible*8):visible,transform:'translate('+x*amount*ratio+'px,'+(spec.y||0)*amount*ratio+'px) scale('+(1+((spec.scale===undefined?100:spec.scale)-100)/100*amount)+')',filter:'blur('+(spec.blur||0)*ratio*amount+'px)'};
          if(spec.outline){unit.style.webkitTextStroke='0.7px currentColor';frame.color='rgba(241,241,241,'+Math.max(.001,(visible-.18)/.82)+')';unit.style.webkitTextStrokeColor='rgba(241,241,241,0.55)';}
          if(spec.tracking)frame.letterSpacing=spec.tracking*ratio*amount+'px';
          frames.push(frame);
        }
        animations.push(unit.animate(frames,{duration:o.duration*factor*1000,delay:delay*factor*1000,fill:'both',easing:'linear'}));
    });
    return {animations:animations,total:total*1000};
  }
  function renderPresets(){
    var group='';$('preset-grid').textContent='';
    presetList.forEach(function(p){
      if(p.group!==value('text-category'))return;
      if(p.group!==group){group=p.group;var heading=document.createElement('h3');heading.className='preset-group';heading.textContent=group;$('preset-grid').appendChild(heading);}
      var b=document.createElement('button');b.className='preset'+(p.id===preset?' active':'');b.dataset.preset=p.id;
      b.innerHTML='<span class="sample">SuperV</span><span class="caption"></span>';b.querySelector('.caption').textContent=p.name;
      b.title=p.name+' · '+(p.by||'selectable')+' timing';var hover=[];
      b.addEventListener('click',function(){
        preset=p.id;document.querySelectorAll('.preset').forEach(function(x){x.classList.toggle('active',x===b);});
        $('text-by').disabled=!!p.by;if(p.by)$('text-by').value=p.by;
        $('text-duration').value=p.duration;$('text-stagger').value=p.stagger;
        playPreview();
      });
      b.addEventListener('mouseenter',function(){hover.forEach(function(a){a.cancel();});hover=animateText(b.querySelector('.sample'),p,{by:p.by||'word',duration:p.duration,stagger:p.stagger,direction:'in'},true).animations;});
      b.addEventListener('mouseleave',function(){hover.forEach(function(a){a.cancel();});hover=[];});
      $('preset-grid').appendChild(b);
    });
  }
  function playPreview(){
    previewAnimations.forEach(function(a){a.cancel();});previewAnimations=[];clearTimeout(previewTimer);
    var o;try{o=textOptions();}catch(_){return;}
    var spec=VKText.get(preset);$('preview-label').textContent=spec.name;
    var preview=animateText($('preview-text'),spec,o,false);previewAnimations=preview.animations;
    previewAnimations.push($('preview-progress').animate([{width:'0%'},{width:'100%'}],{duration:preview.total,fill:'both'}));
  }
  function exportFields(){var channels=value('gif-channels');$('gif-background-row').hidden=channels!=='rgb';$('gif-threshold-row').hidden=channels!=='rgba';$('video-row').hidden=value('gif-source')!=='video';$('gif-range-row').hidden=value('gif-source')!=='comp';$('channel-hint').textContent=channels==='alpha'?'ALPHA EXPORTS A GRAYSCALE MASK. VIDEO WITHOUT ALPHA PRODUCES WHITE.':channels==='rgba'?'GIF USES HARD-EDGE TRANSPARENCY. SOFT ALPHA IS THRESHOLDED.':'RGB FLATTENS TRANSPARENCY ONTO THE BACKGROUND COLOUR.';}
  function executable(){var p=value('encoder-path').trim();if(p)return p;if(path&&extensionRoot){var bundled=path.join(extensionRoot,'bin','ffmpeg.exe');if(fs.existsSync(bundled))return bundled;}return 'ffmpeg';}
  async function exportGIF(){
    if(busy)return;
    var temp=null;try{
      if(!isAE)throw new Error('GIF export runs inside After Effects.');
      if(!encoder)throw new Error('CEP Node runtime unavailable. Reinstall the extension.');
      var options={width:n('gif-width'),fps:n('gif-fps'),channels:value('gif-channels'),colours:n('gif-colours'),dither:value('gif-dither'),loop:n('gif-loop'),threshold:n('gif-threshold'),background:value('gif-background')};
      encoder.buildArgs(Object.assign({},options,{input:'check',output:'check'}));
      setBusy(true);status('Checking encoder…');await encoder.testEncoder(executable());
      if(value('gif-source')==='video'&&!videoPath)throw new Error('Choose a video file first.');
      var dest=await bridge('pickOutput');if(!dest.path){status('Export cancelled.');return;}
      options.output=dest.path;
      if(value('gif-source')==='comp'){
        temp=encoder.makeTemp();status('Rendering PNG frames in AE. Press ESC in AE to cancel.');
        var rendered=await renderVerified({purpose:'gif',directory:temp,range:value('gif-range'),fps:options.fps},'cancel-export');
        var sequence=encoder.validateSequence(temp,rendered.frames);
        options.input=sequence.input;options.sequence=true;
      }else{options.input=videoPath;options.sequence=false;}
      if(path.resolve(options.input).toLowerCase()===path.resolve(options.output).toLowerCase())throw new Error('Choose an output different from your source file.');
      status('Encoding GIF…');$('cancel-export').hidden=false;
      exportJob=encoder.encode(executable(),options,function(chunk){var match=chunk.match(/frame=(\d+)/);if(match)status('Encoding GIF · '+match[1]+' frames');});
      var result=await exportJob.promise;outputPath=result.path;$('output-size').textContent=(result.bytes/1024/1024).toFixed(2)+' MB';$('export-result').hidden=false;
      var url=node('url').pathToFileURL ? node('url').pathToFileURL(outputPath).href : 'file:///'+outputPath.replace(/\\/g,'/');
      $('gif-preview').src=url+'?v='+Date.now();$('gif-preview').hidden=false;status('GIF exported · '+outputPath,'success');
    }catch(e){status(e.message,'error');}finally{exportJob=null;$('cancel-export').hidden=true;setBusy(false);if(temp)try{encoder.cleanup(temp);}catch(e){status('Export finished; temporary PNGs remain at '+temp+'. '+e.message,'error');}}
  }
  async function renderVerified(options,cancelButton){
    var session=await bridge('renderBegin',options),success=false;cancelRender=false;
    if(cancelButton)$(cancelButton).hidden=false;
    try{
      for(var i=0;i<session.frames;){
        if(cancelRender)throw new Error('Cancelled. Nothing was changed.');
        status('Rendering PNG '+(i+1)+' / '+session.frames+'…');
        var batch=await bridge('renderFrame',{token:session.token,index:i,count:8});
        var paths=batch.paths||[batch.path];
        for(var k=0;k<paths.length;k++)await encoder.waitForPNG(paths[k]);
        i+=paths.length;
      }
      encoder.validateSequence(options.directory,session.frames);
      success=true;return session;
    }finally{if(cancelButton)$(cancelButton).hidden=true;await bridge('renderFinish',{token:session.token,success:success});}
  }
  function showColour(hex){
    $('colour-hex').value=hex.toUpperCase();$('new-colour').value=hex.toLowerCase();
    $('colour-rgb').textContent=[1,3,5].map(function(i){return parseInt(hex.substr(i,2),16);}).join(', ');
  }
  async function applyHex(){
    if(busy)return;
    var hex=value('colour-hex').trim();if(hex.charAt(0)!=='#')hex='#'+hex;
    if(!validHex(hex)){status('Enter six HEX digits, for example #46A2DA.','error');return;}
    rememberColour(hex);await run('colour',{hex:hex.toUpperCase()});
  }
  async function cropComp(){
    if(busy)return;
    var temp=null;
    try{
      var options=toolArgs('crop');setBusy(true);
      if(options.mode!=='exact'){
        status('Measuring layer bounds…');
        var fast=await bridge('cropFast',options);
        status(fast.message,'success');return;
      }
      if(!encoder)throw new Error('Open the extension inside After Effects. Exact crop uses the included encoder.');
      await encoder.testEncoder(executable());temp=encoder.makeTemp();
      status('Measuring artwork. AE is rendering '+(options.range==='current'?'the current frame':'each frame in the range')+' at half size…');
      var measurement=await renderVerified({purpose:'crop',scope:options.scope,range:options.range,directory:temp,scale:2},'crop-cancel');
      var sequence=encoder.validateSequence(temp,measurement.frames);
      status('Reading rendered transparency…');
      var b=await encoder.alphaBounds(executable(),sequence,function(frame,total){status('Measuring transparency · '+frame+' / '+total+' frames');});
      // Scale half-size measurements back to comp pixels, with one pixel of safety at each edge.
      var rx=measurement.width/sequence.width,ry=measurement.height/sequence.height,extra=rx>1||ry>1?1:0;
      var bounds={left:Math.max(0,Math.floor(b.left*rx)-extra),top:Math.max(0,Math.floor(b.top*ry)-extra),right:Math.min(measurement.width,Math.ceil(b.right*rx)+extra),bottom:Math.min(measurement.height,Math.ceil(b.bottom*ry)+extra)};
      bounds.left=Math.min(bounds.left,measurement.width-1);bounds.top=Math.min(bounds.top,measurement.height-1);
      var result=await bridge('cropApply',Object.assign({},bounds,{token:measurement.token,padding:options.padding}));
      status(result.message,'success');
    }catch(e){status(e.message,'error');}
    finally{setBusy(false);if(temp)try{encoder.cleanup(temp);}catch(e){status('Temporary PNGs remain at '+temp+'. '+e.message,'error');}}
  }
  load();counterPreview();swatches();renderPresets();exportFields();showColour(state.recentColours[0]||'#46A2DA');
  if(node){try{path=node('path');fs=node('fs');extensionRoot=isAE?decodeURI(cep.getSystemPath('extension')):path.dirname(decodeURI(location.pathname).replace(/^\/(\w:)/,'$1'));extensionRoot=extensionRoot.replace(/^file:\/\/\//,'');encoder=node(path.join(extensionRoot,'js','encoder.cjs'));}catch(e){status('Encoder module: '+e.message,'error');}}
  try {
    if(isAE)extensionRoot=decodeURI(cep.getSystemPath('extension')).replace(/^file:\/\/\//,'');
    connection=window.VKBridge.create(cep,extensionRoot);
  }catch(e){status('Connection setup: '+e.message,'error');}
  $('reconnect').onclick=async function(){
    if(busy||!connection)return;setBusy(true);status('Connecting to After Effects…');
    try{var r=await connection.reconnect();status('SuperV 1.2.2 · '+r.message,'success');}catch(e){status(e.message,'error');}finally{setBusy(false);}
  };
  if(!isAE)$('preview-notice').hidden=false;else bridge('ping').then(function(r){status('SuperV 1.2.2 · '+r.message,'success');}).catch(function(e){status(e.message,'error');});
  document.querySelectorAll('nav button').forEach(function(b){b.onclick=function(){tab(b.dataset.tab);};});
  $('settings-toggle').onclick=function(){tab($('settings').classList.contains('active')?'tools':'settings');};
  document.querySelectorAll('[data-action]').forEach(function(b){b.onclick=async function(){try{var action=b.dataset.action;if(action==='crop'){await cropComp();return;}var r=await run(action==='null'?'nullTool':action,toolArgs(action));if(action==='copyKeys'&&r)$('clipboard-info').textContent=r.message;}catch(e){status(e.message,'error');}};});
  $('tool-search').oninput=function(){var q=this.value.toUpperCase();document.querySelectorAll('.tool').forEach(function(b){b.hidden=b.textContent.toUpperCase().indexOf(q)<0;});};
  $('sample-colour').onclick=async function(){var r=await run('colour',{sample:true});if(r)r.colours.forEach(rememberColour);};
  $('new-colour').onchange=async function(){var c=this.value;rememberColour(c);await run('colour',{hex:c});};
  $('apply-hex').onclick=applyHex;
  $('colour-hex').addEventListener('keydown',function(e){if(e.key==='Enter')applyHex();});
  var watching=false;
  if(isAE)setInterval(async function(){
    if(busy||watching||!connection||!connection.isConnected()||!checked('colour-auto'))return;
    watching=true;
    try{var r=await bridge('colourWatch');if(r.colours)r.colours.slice(0,4).reverse().forEach(rememberColour);}catch(_){}
    finally{watching=false;}
  },1200);
  ['counter-from','counter-to','counter-decimals','counter-prefix','counter-suffix','counter-separator','counter-first','counter-every'].forEach(function(id){$(id).addEventListener('input',counterPreview);});
  $('clear-pins').onclick=function(){state.pinnedColours=[];save();swatches();status('Pinned colours cleared.');};
  $('replay').onclick=playPreview;
  $('text-category').onchange=function(){var p=presetList.filter(function(x){return x.group===value('text-category');})[0];preset=p.id;$('text-duration').value=p.duration;$('text-stagger').value=p.stagger;$('text-by').disabled=!!p.by;if(p.by)$('text-by').value=p.by;renderPresets();playPreview();};
  ['text-duration','text-stagger','text-by','text-direction'].forEach(function(id){$(id).addEventListener('change',playPreview);});
  ['gif-source','gif-channels'].forEach(function(id){$(id).onchange=exportFields;});
  $('pick-video').onclick=async function(){var r=await run('pickFile',{title:'Choose video to convert'});if(r&&r.path){videoPath=r.path;$('video-label').textContent=videoPath;}};
  $('pick-encoder').onclick=async function(){var r=await run('pickFile',{title:'Choose ffmpeg.exe'});if(r&&r.path){state.encoder=r.path;$('encoder-path').value=r.path;save();}};
  $('encoder-path').onchange=function(){state.encoder=this.value.trim();save();};
  $('test-encoder').onclick=async function(){try{if(!encoder)throw new Error('Open the panel inside After Effects.');status('Testing encoder…');status(await encoder.testEncoder(executable()),'success');}catch(e){status(e.message,'error');}};
  $('export-gif').onclick=exportGIF;$('cancel-export').onclick=function(){cancelRender=true;if(exportJob)exportJob.cancel();};
  $('crop-cancel').onclick=function(){cancelRender=true;status('Cancelling after the current frames…');};
  $('show-output').onclick=function(){if(outputPath&&node)node('child_process').execFile('explorer.exe',['/select,',outputPath],{windowsHide:true},function(){});};
  $('reset-settings').onclick=function(){localStorage.removeItem('vk.gsd.settings.v1');location.reload();};
  document.querySelectorAll('input,select').forEach(function(el){if(!el.id||el.id==='encoder-path'||el.id==='tool-search'||el.id==='new-colour'||el.id==='text-category')return;el.addEventListener('change',function(){state.fields[el.id]=el.type==='checkbox'?el.checked:el.value;save();});});
})();
