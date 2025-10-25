// script.js - core logic for seating arrangement

/* Utilities and configuration */
const departments = ["CSE","ECE","IT","MECH","CIVIL"];
const deptClassPrefix = "dept-";

/* Helper: generate student objects with roll numbers per dept based on counts */
function generateStudentList(counts) {
  const list = [];
  departments.forEach(dept=>{
    const cnt = counts[dept] || 0;
    for(let i=1;i<=cnt;i++){
      const roll = `${dept}-${String(i).padStart(3,'0')}`;
      list.push({dept, roll});
    }
  });
  return list;
}

/* Get neighbor coordinates (up,down,left,right) */
function neighbors(r,c,rows,cols) {
  const out = [];
  if(r>0) out.push([r-1,c]);
  if(r<rows-1) out.push([r+1,c]);
  if(c>0) out.push([r,c-1]);
  if(c<cols-1) out.push([r,c+1]);
  return out;
}

/* Try to fill grid using backtracking with randomization. 
   grid: rows x cols, countsMap: {dept:count}
*/
function tryArrange(rows, cols, countsMap, attemptLimit = 20000) {
  const total = rows*cols;
  const depts = Object.keys(countsMap).filter(d => countsMap[d] > 0);
  // build multiset of students as array of dept strings (we'll assign rolls later)
  const pool = [];
  depts.forEach(d => {
    for(let i=0;i<countsMap[d];i++) pool.push(d);
  });
  // quick check: total seats must equal sum(counts)
  if(pool.length !== total) return null;

  // randomize initial pool for variety
  function shuffle(a) { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } }
  shuffle(pool);

  // grid to fill with dept or null
  const grid = Array.from({length:rows},()=>Array(cols).fill(null));

  // order of cell filling: could be sequential or better: try heuristic - fill highest-degree first (center)
  const cells = [];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) cells.push([r,c]);
  // keep fixed order for reproducibility; we will randomize choices instead

  // counts left
  const countsLeft = {...countsMap};

  let attempts = 0;

  function canPlace(r,c,dept) {
    for(const [nr,nc] of neighbors(r,c,rows,cols)){
      if(grid[nr][nc] === dept) return false;
    }
    return true;
  }

  // backtracking DFS
  function dfs(idx) {
    if(++attempts > attemptLimit) return false;
    if(idx === cells.length) return true;

    const [r,c] = cells[idx];

    // Create list of departments sorted (attempt heuristic): those with higher remaining first to avoid later bottleneck; but shuffle same-level
    const cand = Object.keys(countsLeft).filter(d => countsLeft[d] > 0);
    // sort by descending counts
    cand.sort((a,b) => countsLeft[b] - countsLeft[a]);

    // Small randomization to avoid deterministic failures
    if(cand.length > 1) {
      // 30% chance to shuffle order a bit
      if(Math.random() < 0.3) cand.sort(()=>Math.random()-0.5);
    }

    for(const d of cand){
      if(!canPlace(r,c,d)) continue;
      // place
      grid[r][c] = d;
      countsLeft[d]--;
      if(dfs(idx+1)) return true;
      // backtrack
      grid[r][c] = null;
      countsLeft[d]++;
    }

    return false;
  }

  const ok = dfs(0);
  if(ok) return grid;
  return null;
}

/* Convert dept-grid to seat objects with roll numbers (assign sequentially per dept) */
function assignRollsToGrid(grid) {
  const rows = grid.length, cols = grid[0].length;
  const counters = {};
  const result = Array.from({length:rows},()=>Array(cols).fill(null));
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const d = grid[r][c];
      counters[d] = (counters[d]||0)+1;
      const roll = `${d}-${String(counters[d]).padStart(3,'0')}`;
      result[r][c] = {dept:d, roll};
    }
  }
  return result;
}

/* DOM rendering */
function renderSeatingGrid(container, seatGrid) {
  container.innerHTML = '';
  const rows = seatGrid.length, cols = seatGrid[0].length;
  const table = document.createElement('table');
  table.className = 'seating-grid';
  const tbody = document.createElement('tbody');

  for(let r=0;r<rows;r++){
    const tr = document.createElement('tr');
    for(let c=0;c<cols;c++){
      const td = document.createElement('td');
      const seatInfo = seatGrid[r][c];
      const seatDiv = document.createElement('div');
      seatDiv.className = `seat ${deptClassPrefix}${seatInfo.dept}`;
      seatDiv.innerHTML = `<div>${seatInfo.roll}</div><small>${seatInfo.dept}</small>`;
      td.appendChild(seatDiv);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);

  // legend
  const legend = document.createElement('div');
  legend.className = 'legend';
  for(const d of departments){
    const item = document.createElement('div');
    item.className = 'legend-item';
    const color = document.createElement('span');
    color.className = `legend-color ${deptClassPrefix}${d}`;
    color.style.display = 'inline-block';
    color.style.borderRadius = '4px';
    color.style.width = '18px';
    color.style.height = '18px';
    item.appendChild(color);
    const text = document.createElement('div');
    text.innerText = `${d}`;
    item.appendChild(text);
    legend.appendChild(item);
  }
  container.appendChild(legend);
}

/* Top-level handler */
document.addEventListener('DOMContentLoaded',()=>{
  const genBtn = document.getElementById('generate');
  const shuffleBtn = document.getElementById('shuffle');
  const downloadBtn = document.getElementById('download');
  const resetBtn = document.getElementById('reset');
  const wrap = document.getElementById('seating-wrap');

  function readCounts() {
    const rows = parseInt(document.getElementById('rows').value,10);
    const cols = parseInt(document.getElementById('cols').value,10);
    const counts = {};
    departments.forEach(d => {
      counts[d] = Math.max(0, parseInt(document.getElementById(d).value || 0,10));
    });
    return {rows, cols, counts};
  }

  function totalCount(counts) {
    return Object.values(counts).reduce((a,b)=>a+b,0);
  }

  function attemptAndRender() {
    wrap.innerHTML = ''; // clear
    const {rows,cols,counts} = readCounts();
    const total = rows * cols;
    const sum = totalCount(counts);
    if(sum !== total) {
      const al = document.createElement('div');
      al.className = 'alert';
      al.innerText = `Total seats (${total}) and total students (${sum}) do not match. Please ensure sums match.`;
      wrap.appendChild(al);
      return;
    }

    // quick heuristic impossibility check (very rough): if any dept count > total - (min neighbors) ... skipping strong analytic bound; rely on solver
    // Try multiple attempts with randomization
    let seating = null;
    const tries = 5; // try a few attempts with different random seeds by small random shuffles in tryArrange
    for(let t=0;t<tries && !seating;t++){
      seating = tryArrange(rows, cols, counts, 30000);
    }

    if(!seating){
      alert("Rearrangement not possible for given input.");
      const al = document.createElement('div');
      al.className = 'alert';
      al.innerText = 'Rearrangement not possible for given input.';
      wrap.appendChild(al);
      return;
    }

    const seatObjs = assignRollsToGrid(seating);
    renderSeatingGrid(wrap, seatObjs);
  }

  genBtn.addEventListener('click', attemptAndRender);

  shuffleBtn.addEventListener('click', ()=>{
    // just re-run; since algorithm has small randomization it will produce alternate layout
    attemptAndRender();
  });

  downloadBtn.addEventListener('click', ()=>{
    const container = document.getElementById('seating-wrap');
    if(!container || container.innerHTML.trim().length === 0) { alert('Nothing to download. Generate first.'); return; }
    html2canvas(container, { scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'seating-chart.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err=>{
      alert('Download failed: ' + err.message);
    });
  });

  resetBtn.addEventListener('click', ()=>{
    // reset to defaults
    document.getElementById('rows').value = 5;
    document.getElementById('cols').value = 6;
    document.getElementById('CSE').value = 8;
    document.getElementById('ECE').value = 8;
    document.getElementById('IT').value  = 8;
    document.getElementById('MECH').value= 8;
    document.getElementById('CIVIL').value=8;
    wrap.innerHTML = '';
  });

  // initial render (optional)
  // attemptAndRender();
});
