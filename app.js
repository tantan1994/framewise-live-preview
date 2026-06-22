const devices=[
  {id:'iphone-se',name:'iPhone SE',size:'375 × 667 pt',w:375,h:667,r:39},
  {id:'iphone-16',name:'iPhone 16 Pro',size:'402 × 874 pt',w:402,h:874,r:58},
  {id:'iphone-16-max',name:'iPhone 16 Pro Max',size:'440 × 956 pt',w:440,h:956,r:62}
];
const select=document.querySelector('#deviceSelect'), device=document.querySelector('#device'), screen=document.querySelector('#screen');
let zoom=.82;
function setDevice(id){const d=devices.find(x=>x.id===id); device.style.width=d.w+'px';device.style.height=d.h+'px';device.style.borderRadius=d.r+'px';screen.style.borderRadius=(d.r-8)+'px';document.querySelector('#captionName').textContent=d.name;document.querySelector('#captionSize').textContent=d.size;[...select.children].forEach(x=>x.classList.toggle('active',x.dataset.id===id));}
devices.forEach((d,i)=>{const b=document.createElement('button');b.className='device-choice'+(i===1?' active':'');b.dataset.id=d.id;b.innerHTML=`<i class="device-icon"></i><span><b>${d.name}</b><small>${d.size}</small></span>`;b.onclick=()=>setDevice(d.id);select.append(b)});
function setZoom(v){zoom=Math.max(.45,Math.min(1,v));document.querySelector('#phoneWrap').style.transform=`scale(${zoom})`;document.querySelector('#zoomValue').textContent=Math.round(zoom*100)+'%'}
document.querySelector('#zoomIn').onclick=()=>setZoom(zoom+.08);document.querySelector('#zoomOut').onclick=()=>setZoom(zoom-.08);document.querySelector('#fit').onclick=()=>setZoom(innerWidth<900?.62:.82);document.querySelector('.icon-btn').onclick=()=>setZoom(.82);
document.querySelectorAll('.fit-option').forEach(b=>b.onclick=()=>{document.querySelectorAll('.fit-option').forEach(x=>x.classList.remove('active'));b.classList.add('active');screen.classList.remove('contain','width');if(b.dataset.fit!=='cover')screen.classList.add(b.dataset.fit)});
document.querySelector('#safeToggle').onclick=e=>{e.currentTarget.classList.toggle('on');screen.classList.toggle('no-safe')};
const input=document.querySelector('#fileInput');input.onchange=e=>{const file=e.target.files[0];if(!file)return;document.querySelector('#uploadedImage').src=URL.createObjectURL(file);document.querySelector('#uploadedImage').style.display='block';document.querySelector('#demoUi').style.display='none';};
const target=document.querySelector('#phoneWrap');['dragenter','dragover'].forEach(type=>target.addEventListener(type,e=>{e.preventDefault();target.style.opacity='.75'}));['dragleave','drop'].forEach(type=>target.addEventListener(type,e=>{e.preventDefault();target.style.opacity='1'}));target.addEventListener('drop',e=>{const file=e.dataTransfer.files[0];if(file&&file.type.startsWith('image/')){input.files=e.dataTransfer.files;input.dispatchEvent(new Event('change'))}});
