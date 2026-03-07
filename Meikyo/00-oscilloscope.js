/* ═══ STARS ═══ */

/* ═══ OSCILLOSCOPE ═══ */
(()=>{const cv=document.getElementById('osc');const cx=cv.getContext('2d');let t=0;const resize=()=>{cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;};resize();window.addEventListener('resize',resize);(function draw(){cx.clearRect(0,0,cv.width,cv.height);[[.018,.016,16,'rgba(0,229,255,0.45)'],[.031,.022,10,'rgba(140,63,255,0.3)'],[.009,.008,22,'rgba(29,233,182,0.2)']].forEach(([f,f2,a,col])=>{cx.strokeStyle=col;cx.lineWidth=1.2;cx.beginPath();for(let x=0;x<cv.width;x++){const y=cv.height/2+Math.sin(x*f+t)*a+Math.sin(x*f2+t*1.4)*(a*.6);x===0?cx.moveTo(x,y):cx.lineTo(x,y);}cx.stroke();});t+=.014;requestAnimationFrame(draw);})();})();

