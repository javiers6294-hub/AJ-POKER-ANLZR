Chart.register(ChartDataLabels);

// REEMPLAZA ESTO CON LA URL DE TU PROYECTO EN VERCEL
const BACKEND_URL = 'https://poker-backend-seven.vercel.app'; 

let hierarchy = ["STRAIGHT FLUSH","QUADS","FULL HOUSE","FLUSH","STRAIGHT","3 OF A KIND","TWO PAIR","OVERPAIR","TOP PAIR","TOP PAIR BAD K","MIDDLE PAIR","WEAK PAIR","FLUSH DRAW","OESD","GUTSHOT","ACE HIGH (kicker 9+)","ACE HIGH (kicker <9)","OVERCARDS","BACK DOOR FD","BACK DOOR SD","AIR / NOTHING"];

let playerCombos = { j1: {}, j2: {} }, board = [], userGroups = [], library = [], historyStack = [];
let isDragging = false, dragMode = true, chartJ1, chartJ2;

const ranks=['A','K','Q','J','T','9','8','7','6','5','4','3','2'], suits=['p','c','d','t'],
      suitSym={p:'♠',c:'♥',d:'♦',t:'♣'}, suitCls={p:'p-color',c:'c-color',d:'d-color',t:'t-color'},
      vals={'A':14,'K':13,'Q':12,'J':11,'T':10,'9':9,'8':8,'7':7,'6':6,'5':5,'4':4,'3':3,'2':2};

async function update() {
    const body = document.getElementById('m-body'); 
    body.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 20px;'>Analizando combos...</td></tr>";

    try {
        let sessionToken = null;
        if (window.Clerk && window.Clerk.session) {
            sessionToken = await window.Clerk.session.getToken();
        }

        const response = await fetch(`${BACKEND_URL}/api/analyze`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}` 
            },
            body: JSON.stringify({ playerCombos, board })
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('Debes iniciar sesión para analizar manos.');
            throw new Error('Error en el servidor de análisis');
        }
        
        const stats = await response.json();
        body.innerHTML = "";
        
        userGroups.forEach((g, idx) => {
            const v1 = g.cats.reduce((a,c)=>a+(stats.j1.c[c]||0),0), v2 = g.cats.reduce((a,c)=>a+(stats.j2.c[c]||0),0);
            const p1 = stats.j1.t ? (v1/stats.j1.t*100).toFixed(1) : 0, p2 = stats.j2.t ? (v2/stats.j2.t*100).toFixed(1) : 0;
            body.innerHTML += `<tr style="background:rgba(241,196,15,0.07);">
                <td><input type="checkbox" class="f-j1-g" data-idx="${idx}" onchange="toggleGroup(this,'j1',${idx})"></td>
                <td style="font-weight:bold; color:var(--j1);">${v1}</td>
                <td style="color:var(--accent); font-weight:bold; font-size:14px;">📁 ${g.name}</td>
                <td>
                    <div class="bar-wrap bar-grp"><div class="bar-fill" style="width:${p1}%; background:#27ae60"></div><span class="bar-text">${v1} combos (${p1}%)</span></div>
                    <div class="bar-wrap bar-grp"><div class="bar-fill" style="width:${p2}%; background:#2980b9"></div><span class="bar-text">${v2} combos (${p2}%)</span></div>
                </td>
                <td style="font-weight:bold; color:var(--j2);">${v2}</td>
                <td><input type="checkbox" class="f-j2-g" data-idx="${idx}" onchange="toggleGroup(this,'j2',${idx})"></td>
                <td onclick="userGroups.splice(${idx},1);update()" style="color:var(--danger); cursor:pointer; font-weight:bold; font-size:18px;">×</td></tr>`;
        });

        hierarchy.forEach(cat => {
            const c1 = stats.j1.c[cat]||0, c2 = stats.j2.c[cat]||0, p1 = stats.j1.t ? (c1/stats.j1.t*100).toFixed(1) : 0, p2 = stats.j2.t ? (c2/stats.j2.t*100).toFixed(1) : 0;
            const tags = userGroups.filter(g => g.cats.includes(cat)).map(g => `<span class="tag-group">${g.name}</span>`).join("");
            body.innerHTML += `<tr>
                <td><input type="checkbox" class="f-j1" data-cat="${cat}"></td>
                <td>${c1}</td>
                <td><div style="font-weight:bold;">${cat}</div><div>${tags}</div></td>
                <td>
                    <div class="bar-wrap bar-cat"><div class="bar-fill" style="width:${p1}%; background:#1e8449"></div><span class="bar-text">${c1} combos (${p1}%)</span></div>
                    <div class="bar-wrap bar-cat"><div class="bar-fill" style="width:${p2}%; background:#1a5276"></div><span class="bar-text">${c2} combos (${p2}%)</span></div>
                </td>
                <td>${c2}</td>
                <td><input type="checkbox" class="f-j2" data-cat="${cat}"></td>
                <td></td></tr>`;
        });

        document.getElementById('totTxt').innerText = `J1: ${stats.j1.t} | J2: ${stats.j2.t}`;
        updateCharts(stats);

    } catch (error) {
        console.error("Fallo de conexión:", error);
        body.innerHTML = `<tr><td colspan='7' style='color:red; text-align:center;'>${error.message}</td></tr>`;
    }
}

function toggleGroup(el, p, idx) {
    const isChecked = el.checked;
    userGroups[idx].cats.forEach(cat => {
        const catBox = document.querySelector(`.f-${p}[data-cat="${cat}"]`);
        if(catBox) catBox.checked = isChecked;
    });
}

function initCharts() {
    const cfg = (t) => ({
        type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#2ecc71', '#3498db', '#f1c40f', '#9b59b6', '#e74c3c', '#1abc9c', '#d35400'] }] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            layout: { padding: { left: 0, right: 10, top: 0, bottom: 0 } },
            plugins: { 
                legend: { display: true, position: 'right', labels: { color: '#fff', font: { size: 10 }, boxWidth: 10, padding: 6 } }, 
                title: { display: true, text: t, color: '#fff', font: {size: 14} },
                datalabels: { display: false } 
            } 
        }
    });
    chartJ1 = new Chart(document.getElementById('chartJ1'), cfg('GRUPOS J1 (%)'));
    chartJ2 = new Chart(document.getElementById('chartJ2'), cfg('GRUPOS J2 (%)'));
}

function wrapText(str, maxChars = 14) {
    if (str.length <= maxChars) return str;
    const words = str.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
        if (currentLine.length + 1 + words[i].length <= maxChars) {
            currentLine += " " + words[i];
        } else { lines.push(currentLine); currentLine = words[i]; }
    }
    lines.push(currentLine); return lines;
}

function updateCharts(stats) {
    if(userGroups.length === 0) { 
        chartJ1.data.datasets[0].data = []; chartJ1.data.labels = [];
        chartJ2.data.datasets[0].data = []; chartJ2.data.labels = [];
    } else {
        const data1 = userGroups.map(g => stats.j1.t ? (g.cats.reduce((a,c)=>a+(stats.j1.c[c]||0),0)/stats.j1.t*100).toFixed(1) : 0);
        const data2 = userGroups.map(g => stats.j2.t ? (g.cats.reduce((a,c)=>a+(stats.j2.c[c]||0),0)/stats.j2.t*100).toFixed(1) : 0);
        chartJ1.data.datasets[0].data = data1; chartJ2.data.datasets[0].data = data2;
        chartJ1.data.labels = userGroups.map((g, i) => wrapText(`${g.name} (${data1[i]}%)`));
        chartJ2.data.labels = userGroups.map((g, i) => wrapText(`${g.name} (${data2[i]}%)`));
    }
    chartJ1.update(); chartJ2.update();
}

function renderMatrix(id, p, cls) {
    const m = document.getElementById(id);
    ranks.forEach((r1, i) => ranks.forEach((r2, j) => {
        const c = document.createElement('div'); c.className = 'cell'; c.id = `${id}-${i}-${j}`;
        c.innerText = i < j ? r1+r2+'s' : (i > j ? r2+r1+'o' : r1+r1);
        c.onmousedown = () => { isDragging=true; dragMode=!c.classList.contains(cls); toggle(c,p,cls,dragMode); };
        c.onmouseenter = () => { if(isDragging) toggle(c,p,cls,dragMode); };
        m.appendChild(c);
    }));
}

function toggle(c,p,cls,m){ if(m){c.classList.add(cls); playerCombos[p][c.id]=getCombos(c.innerText);}else{c.classList.remove(cls); delete playerCombos[p][c.id];} update(); }

function getCombos(t){
    const r1=t[0],r2=t[1],type=t[2]||'p',res=[],v1=vals[r1],v2=vals[r2];
    if(type==='s')suits.forEach(s=>res.push([{v:v1,s},{v:v2,s}]));
    else if(type==='o')suits.forEach(s1=>suits.forEach(s2=>{if(s1!==s2)res.push([{v:v1,s:s1},{v:v2,s:s2}]);}));
    else for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)res.push([{v:v1,s:suits[i]},{v:v1,s:suits[j]}]); return res;
}

function renderDeck(){
    const d=document.getElementById('deck'); d.innerHTML="";
    suits.forEach(s=>ranks.forEach(r=>{
        const isB=board.some(bc=>bc.v===vals[r]&&bc.s===s);
        const c = document.createElement('div'); c.className = `cell card-ui ${isB?'':suitCls[s]}`;
        c.style.width="28px"; c.style.height="38px";
        if(isB) c.style.opacity="0.1"; c.innerHTML=`${r}${suitSym[s]}`;
        c.onclick=()=>{ const idx=board.findIndex(bc=>bc.v===vals[r]&&bc.s===s); if(idx>-1) board.splice(idx,1); else if(board.length<5) board.push({v:vals[r],s,r}); renderBoard(); renderDeck(); update(); };
        d.appendChild(c);
    }));
}

function renderBoard(){
    const b=document.getElementById('brd'); b.innerHTML="";
    board.forEach(c => b.innerHTML += `<div class="card-ui ${suitCls[c.s]}" style="width:45px; height:65px; font-size:22px;">${c.r}${suitSym[c.s]}</div>`);
}

function createGroup() {
    const n = document.getElementById('grpName').value, cats = Array.from(document.querySelectorAll('.f-j1:checked')).map(i => i.dataset.cat);
    if(n && cats.length) { userGroups.push({name:n, cats}); document.getElementById('grpName').value=""; update(); }
}

async function applyFilters() {
    historyStack.push(JSON.stringify(playerCombos)); 
    let f1 = Array.from(document.querySelectorAll('.f-j1:checked')).map(i=>i.dataset.cat);
    let f2 = Array.from(document.querySelectorAll('.f-j2:checked')).map(i=>i.dataset.cat);
    
    try {
        let sessionToken = null;
        if (window.Clerk && window.Clerk.session) {
            sessionToken = await window.Clerk.session.getToken();
        }

        const response = await fetch(`${BACKEND_URL}/api/filter`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ playerCombos, board, f1, f2 })
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('Acceso denegado al servidor de filtros.');
            throw new Error('Error en el filtrado del servidor');
        }

        playerCombos = await response.json();
        sync(); 
        update();
    } catch (error) {
        console.error("Error al aplicar filtros:", error);
        alert(error.message || "Hubo un problema procesando los filtros en el servidor.");
    }
}

function undoFilter() { if(historyStack.length > 0) { playerCombos = JSON.parse(historyStack.pop()); sync(); update(); } }

function clearTable() {
    if (confirm("¿Seguro que quieres borrar todo?")) {
        playerCombos = { j1: {}, j2: {} }; board = []; historyStack = []; 
        document.querySelectorAll('input[type="checkbox"]').forEach(box => box.checked = false);
        sync(); renderBoard(); renderDeck(); update();      
    }
}

function sync() { document.querySelectorAll('.cell').forEach(c => { c.classList.remove('p1-sel','p2-sel'); if(c.id.startsWith('m1')&&playerCombos.j1[c.id]) c.classList.add('p1-sel'); if(c.id.startsWith('m2')&&playerCombos.j2[c.id]) c.classList.add('p2-sel'); }); }

function openH(){ const l=document.getElementById('hList'); l.innerHTML=""; hierarchy.forEach((n,i)=>l.innerHTML+=`<div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #333; font-size:11px;"><span>${n}</span><div><button onclick="moveH(${i},-1)">▲</button><button onclick="moveH(${i},1)">▼</button></div></div>`); document.getElementById('modalH').style.display='block'; }
function moveH(i,d){ let n=i+d; if(n>=0&&n<hierarchy.length){[hierarchy[i],hierarchy[n]]=[hierarchy[n],hierarchy[i]]; openH();}}
function closeH(){ document.getElementById('modalH').style.display='none'; update(); }

function saveRange(p){ const n=prompt("Nombre del rango:"); if(!n)return; const d={}; for(let id in playerCombos[p]) d[id.split('-').slice(1).join('-')]=playerCombos[p][id]; library.push({name:n, data:d, p}); renderLib(); }

function renderLib(){ 
    const b=document.getElementById('libBox'); b.innerHTML=""; 
    library.forEach((it,i)=>b.innerHTML+=`
        <div class="lib-item">
            <div style="font-weight:bold; color:var(--accent); font-size:11px;">${it.name.toUpperCase()} <span style="font-size:9px; color:#666;">[${it.p.toUpperCase()}]</span></div>
            <div class="lib-actions">
                <button class="btn-pro btn-util" style="flex:1; padding:4px; font-size:9px;" onclick="loadRange(${i},'j1')">P1</button>
                <button class="btn-pro btn-util" style="flex:1; padding:4px; font-size:9px;" onclick="loadRange(${i},'j2')">P2</button>
                <button class="btn-pro btn-danger" style="flex:0.6; padding:4px; font-size:9px;" onclick="library.splice(${i},1);renderLib()">DEL</button>
            </div>
        </div>`); 
}

function loadRange(idx,tP){ const d=library[idx].data, nC={}; for(let u in d) nC[`${tP==='j1'?'m1':'m2'}-${u}`]=JSON.parse(JSON.stringify(d[u])); playerCombos[tP]=nC; sync(); update(); }

function exportJSON(){ const b=new Blob([JSON.stringify({playerCombos,board,library,hierarchy,userGroups})],{type:"application/json"}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download="poker_lab_pro.json"; a.click(); }

function importJSON(e){ const r=new FileReader(); r.onload=(ev)=>{ const d=JSON.parse(ev.target.result); playerCombos=d.playerCombos; board=d.board; library=d.library||[]; hierarchy=d.hierarchy||hierarchy; userGroups=d.userGroups||[]; sync(); renderDeck(); renderBoard(); renderLib(); update(); }; r.readAsText(e.target.files[0]); }

function loadDefaultConfig() {
    fetch('poker_lab_pro (1).json').then(response => {
        if (!response.ok) throw new Error("No se encontró el archivo.");
        return response.json();
    }).then(d => {
        playerCombos = d.playerCombos || { j1: {}, j2: {} };
        board = d.board || []; library = d.library || [];
        if(d.hierarchy) hierarchy = d.hierarchy; 
        userGroups = d.userGroups || [];
        sync(); renderDeck(); renderBoard(); renderLib(); update();
    }).catch(error => { console.warn(error); update(); });
}

// Inicialización
initCharts(); renderMatrix('m1','j1','p1-sel'); renderMatrix('m2','j2','p2-sel'); renderDeck(); loadDefaultConfig();
