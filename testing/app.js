"use strict";
const $ = (id) => document.getElementById(id);
const baseline = "0.4.0-dev.1";
const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
const link = (v) => { try { const url = new URL(v); return /^https?:$/.test(url.protocol) ? url.href : ""; } catch { return ""; } };
const tracks = {Audio:"Audio clarity",Gameplay:"Gameplay understandability"};
const topics = {
 Audio:["Static / distortion","Overlapping sounds","Music and effects layering","Volume and priority rules"],
 Gameplay:["Player confusion points","Tutorial and input feedback","Board readability","Move feedback","Win-state feedback"]
};
const seed = [
 ["Audio",0,"Static in playable build","Player reported that the sound was all static and overlapping.","Capture the first audible static with build, output device, volume, and exact steps.","Audio plays cleanly through the same sequence.","Isolate the music and effects buses to identify the source."],
 ["Audio",1,"Sounds overlap during play","Player reported overlapping sounds.","Record the shortest sequence that produces overlap, including what was playing first.","Repeated actions stay intelligible without duplicate stacking.","Review retrigger limits and which cues may play together."],
 ["Gameplay",0,"Gameplay feels confusing","Player reported that gameplay was confusing.","Watch a new player attempt the tutorial unaided and record the first hesitation.","A new player can explain the goal and make a move unaided.","Clarify the first point of hesitation using existing rules."],
 ["Audio",2,"Music and effects layering","","Compare the same move with music on and off.","Move and receiver cues remain audible over music.","Check mix balance and brief music ducking if needed."],
 ["Audio",3,"Volume and cue priority","","Test volume controls and a rapid sequence of competing cues.","Volume controls work and success cues stay audible during busy moments.","Document priority for win, pulse, move, and UI cues."],
 ["Gameplay",1,"Tutorial and input feedback","","Run the opening tutorial with both tap and swipe.","The player can select and move a magnet one square and recognize invalid inputs.","Verify that tutorial prompts match the available inputs."],
 ["Gameplay",2,"Board readability","","Ask a new player to identify magnets, poles, and receivers on the 5×5 board.","The player can distinguish all three before moving.","Review contrast and labels at phone scale."],
 ["Gameplay",3,"Move feedback","","Record a legal move and an invalid attempt, including the pulse response.","Selection, legal movement, invalid movement, push and pull are distinguishable.","Check the timing and clarity of existing cues."],
 ["Gameplay",4,"Win-state feedback","","Solve a puzzle and record the last move through the completion screen.","The player recognizes that all receivers are powered and knows how to continue.","Check completion feedback against the final board state."]
].map(([track,i,title,observed,next,expected,fix],index)=>({id:"FF-"+String(index+1).padStart(3,"0"),track,topic:topics[track][i],title,observed,next,expected,fix,build:baseline,status:observed?"Reported":"Planned check",result:"NOT TESTED",blocking:true,planned:!observed}));
const key = "flux-frenzy-qa-v1";
let state;
try { state=JSON.parse(localStorage.getItem(key))??{rows:seed,candidate:""}; } catch { state={rows:seed,candidate:""}; }
const views=[["overview","◈","Overview"],["audio","♫","Audio clarity"],["game","⊞","Gameplay clarity"],["queue","☰","Issue queue"],["compare","⇄","Fix comparison"],["gate","◉","Release gate"]];
let page="overview", query="", filter="", editing=null, toastTimer;
const nameKey = (v="")=>v.trim().toLowerCase();
const planned = (r) => r.planned ?? Boolean(seed.find(s=>s.id===r.id)?.planned);
const mandatory = (r) => seed.some(s=>s.id===r.id);
const ready = (r) => (
  (r.status==="Fix claimed" && r.fix?.trim() && nameKey(r.implementer) && nameKey(r.implementer)!==nameKey(r.tester)) ||
  (r.status==="Check complete" && planned(r))
) && r.result==="PASS" && r.hands && r.independent &&
  [r.tester,r.testBuild,r.testDevice,r.testDate,r.testNotes,r.regression,r.steps,r.expected,r.proof].every(v=>v?.trim()) &&
  Boolean(link(r.proof));
const blocks = (r) => mandatory(r) || r.blocking;
const cleared = (r) => ready(r) && r.testBuild===state.candidate && !r.blocker?.trim();
const pending = () => state.rows.filter(r=>blocks(r) && !cleared(r));
const isOpen = () => Boolean(state.candidate && state.rows.some(blocks) && !pending().length);
const save = (next) => { try { localStorage.setItem(key,JSON.stringify(next)); state=next; return true; } catch { return false; } };
function toast(msg){ $("toast").textContent=msg; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$("toast").textContent="",3400); }
const issue = r => '<button class="issue" data-edit="'+esc(r.id)+'">'+esc(r.title)+'</button>';
const pill = (label,cls="") => '<span class="pill '+cls+'">'+esc(label)+'</span>';
const testLabel = r => ready(r) ? pill("Verified PASS","pass") : pill(r.result==="FAIL"?"FAIL":"NOT TESTED",r.result==="FAIL"?"report":"");
const table = rows => rows.length ? '<div class="tablewrap"><table><thead><tr><th>ISSUE</th><th>WORKFLOW</th><th>IMPLEMENTATION</th><th>INDEPENDENT TEST</th><th>NEXT ACTION</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+issue(r)+'<span class="id">'+esc(r.id)+' · '+esc(r.build || "Build pending")+'</span></td><td>'+esc(r.topic)+'</td><td>'+pill(r.status,r.status==="Reported"?"report":"")+'</td><td>'+testLabel(r)+'</td><td>'+esc(r.next || "—")+'</td></tr>').join("")+'</tbody></table></div>' : '<div class="panel empty">No records match this view.</div>';
const section = (title,sub,extra="") => '<div class="sectionhead"><div><h2>'+title+'</h2><p>'+sub+'</p></div>'+extra+'</div>';
const workflow = (view,icon,title,detail) => '<button class="workflow" data-page="'+view+'"><span class="tileicon">'+icon+'</span><span><b>'+title+'</b><small>'+detail+'</small></span><span class="arrow">↗</span></button>';
function render(){
 $("nav").innerHTML='<div class="navlabel">WORKSPACE</div>'+views.map(([id,icon,title])=>'<button data-page="'+id+'" class="navbutton '+(id===page?"active":"")+'" '+(id===page?'aria-current="page"':'')+'><span aria-hidden="true">'+icon+'</span>'+title+'</button>').join("");
 const metrics=[["PLAYTEST RECORDS",state.rows.length,""],["FIXES CLAIMED",state.rows.filter(r=>r.status==="Fix claimed").length,""],["INDEPENDENT PASSES",state.rows.filter(ready).length,"mint"],["RELEASE GATE",isOpen()?"OPEN":"HOLD",isOpen()?"mint":"amber"]];
 $("stats").innerHTML=metrics.map(([l,v,c])=>'<div class="stat"><small>'+l+'</small><strong class="'+c+'">'+v+'</strong></div>').join("");
 if(page==="overview") {
  $("view").innerHTML=section("Testing workflows","Windows browser and Android QA builds were reported available. Confirm the exact build and device in each session.")+
  '<div class="workflows">'+workflow("audio","♫","Audio clarity","Static, layering, volume and cue priority")+workflow("game","⊞","Gameplay understandability","Tutorial, inputs, board, moves and win state")+'</div>'+
  section("Reported playtest issues","Initial player reports. Exact reproduction and environment are still pending.",'<button data-page="queue">Open issue queue →</button>')+table(state.rows.filter(r=>r.status==="Reported"));
 } else if (page==="compare") {
  const claims=state.rows.filter(r=>r.status==="Fix claimed"), verified=claims.filter(ready);
  const list=(rows,detail)=>rows.length?rows.map(r=>'<div class="line">'+issue(r)+'<p>'+detail(r)+'</p></div>').join(""):'<p>No records yet.</p>';
  $("view").innerHTML=section("Fix comparison","Implementation claims and independent hands-on results are recorded separately.")+
  '<div class="comparison"><article class="panel"><h3>Claimed fixes · '+claims.length+'</h3>'+list(claims,r=>esc(r.fix || "Fix details pending")+" · "+esc(r.implementer || "Implementer pending"))+'</article>'+
  '<article class="panel"><h3>Independently verified · '+verified.length+'</h3>'+list(verified,r=>esc(r.testBuild)+" · "+esc(r.tester)+" · "+esc(r.testDate)+' · <a target="_blank" rel="noopener noreferrer" href="'+esc(link(r.proof))+'">Evidence ↗</a>')+'</article></div>';
 } else if(page==="gate") {
  $("view").innerHTML=section("Release gate", "Hold additional levels, boosters, monetization and release work until independent hands-on verification clears the candidate.")+
  '<article class="panel"><h3 class="'+(isOpen()?"mint":"amber")+'">'+(isOpen()?"OPEN · candidate verified":"HOLD · verification required")+'</h3><form id="candidate" class="gateform"><label>Candidate build version<input name="candidate" value="'+esc(state.candidate)+'" placeholder="Enter exact build" required></label><button>Set candidate</button></form>'+
  '<p>Each blocking record needs a hands-on PASS on this exact build, with exact reproduction steps, test device, date, evidence link, regression notes, and a cleared blocker. Claimed fixes need a tester other than the implementer. Planned checks can pass without a code change.</p><p><strong>Scope:</strong> Keep the 5×5 magnet board, one-square moves, push/pull pulse, and the goal of powering all receivers together.</p>'+
  '<h3 class="subhead">Blocking records</h3><ul class="checks">'+state.rows.filter(blocks).map(r=>'<li><span class="'+(cleared(r)?"mint":"amber")+'">'+(cleared(r)?"✓":"○")+'</span>'+issue(r)+'<span>· '+esc(cleared(r)?"Verified on candidate":r.blocker || (ready(r)?"Candidate retest needed":"Independent pass needed"))+'</span></li>').join("")+'</ul></article>';
  $("candidate").onsubmit=e=>{e.preventDefault();const candidate=new FormData(e.target).get("candidate").trim();if(!candidate)return; if(save({...state,candidate})){render();toast("Candidate saved");}else toast("Could not save to this browser.");};
 } else {
  const title=page==="audio"?tracks.Audio:page==="game"?tracks.Gameplay:"Playtest issue queue";
  $("view").innerHTML=section(title,"Open a record to update reproduction, implementation, or independent test evidence.",'<div class="filter"><input id="query" aria-label="Search issues" placeholder="Search issues" value="'+esc(query)+'"><select id="filter" aria-label="Filter issues"><option value="">All records</option>'+["Reported","Planned check","Diagnosing","Fix planned","Implementing","Fix claimed","Check complete","Verified PASS","FAIL"].map(x=>'<option '+(x===filter?"selected":"")+'>'+x+'</option>').join("")+'</select></div>')+'<div id="records"></div>';
  $("query").oninput=e=>{query=e.target.value;renderRows();}; $("filter").onchange=e=>{filter=e.target.value;renderRows();};renderRows();
 }
}
function renderRows(){
 const track=page==="audio"?"Audio":page==="game"?"Gameplay":"";
 const rows=state.rows.filter(r=>(!track||r.track===track)&&(!filter||(filter==="Verified PASS"?ready(r):filter==="FAIL"?r.result==="FAIL":r.status===filter))&&[r.id,r.title,r.topic,r.observed,r.next].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
 $("records").innerHTML=table(rows);
}
const groups=[
 ["Reproduction",[
  ["title","Issue title","text",true],["track","Workflow",Object.keys(tracks)],["topic","Focus area","topic"],
  ["build","Reported build version"],["device","Device or browser"],["steps","Exact reproduction steps","area"],
  ["observed","Observed behavior","area"],["expected","Expected behavior","area"],["evidence","Screenshot or recording URL","url"]
 ]],
 ["Implementation",[
  ["fix","Proposed fix or claimed change","area"],["status","Implementation status",["Reported","Planned check","Diagnosing","Fix planned","Implementing","Fix claimed"]],["implementer","Implementer name or ID"],["blocker","Blocker","area"],["next","One next action","area",true],["blocking","Release gate blocker","check"]
 ]],
 ["Independent hands-on retest",[
  ["result","Test result",["NOT TESTED","PASS","FAIL"]],["tester","Independent tester name or ID"],["testBuild","Tested build version"],["testDevice","Retest device or browser"],["testDate","Retest date","date"],
  ["testNotes","What you did and what happened","area"],["proof","Retest screenshot or recording URL","url"],["regression","Regression notes and outcome","area"],
  ["hands","I played the stated build and reran the reproduction steps.","check"],["independent","The retest was run independently of the implementation.","check"]
 ]]
];
function options(items,v){return items.map(x=>'<option '+(x===v?"selected":"")+'>'+esc(x)+'</option>').join("");}
function field([name,label,type="text",required],r){
 const v=esc(r[name]??""), req=required?" required":"";
 if(name==="status" && planned(r))type=[...type,"Check complete"];
 if(name==="blocking" && mandatory(r))return '<p class="cap">Required release gate check</p>';
 if(type==="check")return '<label class="wide check"><input type="checkbox" name="'+name+'" '+(r[name]?"checked":"")+'>'+label+'</label>';
 const input=Array.isArray(type)||type==="topic"?'<select name="'+name+'">'+options(type==="topic"?topics[r.track]:type,r[name])+'</select>':type==="area"?'<textarea name="'+name+'"'+req+'>'+v+'</textarea>':'<input name="'+name+'" type="'+type+'" value="'+v+'"'+req+'>';
 const evidence=(name==="proof"||name==="evidence")&&link(r[name])?' <a target="_blank" rel="noopener noreferrer" href="'+esc(link(r[name]))+'">Open evidence ↗</a>':'';
 return '<label class="'+(type==="area"||type==="url"||name==="title"?"wide":"")+'">'+label+evidence+input+'</label>';
}
function openEditor(id){
 const record=state.rows.find(r=>r.id===id), r=record??{track:page==="game"?"Gameplay":"Audio",build:baseline,status:"Reported",result:"NOT TESTED",blocking:true};
 editing=record?.id??null;
 $("dialogTitle").textContent=record?record.id+" · Edit issue":"Log issue";
 $("fields").innerHTML=groups.map(([label,fields])=>'<fieldset><legend>'+label+'</legend>'+fields.map(f=>field(f,r)).join("")+'</fieldset>').join("");
 $("form").elements.track.onchange=e=>{$("form").elements.topic.innerHTML=options(topics[e.target.value]);};
 $("error").textContent="";$("editor").showModal();
}
$("form").onsubmit=e=>{
 e.preventDefault();
 const data=new FormData(e.target);
 const id=editing??"FF-"+String(1+Math.max(0,...state.rows.map(r=>Number(r.id.slice(3))))).padStart(3,"0");
 const previous=state.rows.find(row=>row.id===id);
 const r={id,planned:previous?planned(previous):data.get("status")==="Planned check",...Object.fromEntries([...data].map(([k,v])=>[k,v.trim()]))};
 for(const key of ["hands","independent","blocking"])r[key]=data.has(key);
 const error=$("error");
 if(!r.title||!r.next){error.textContent="Enter an issue title and one next action.";return;}
 if([r.evidence,r.proof].some(v=>v&&!link(v))){error.textContent="Evidence links must use HTTP or HTTPS.";return;}
 if(r.result==="PASS"&&!ready(r)){error.textContent="A PASS requires a claimed fix with distinct implementer and tester, or a completed planned check. Both need exact reproduction, expected behavior, hands-on confirmation, and complete retest evidence and regression notes.";return;}
 const rows=editing?state.rows.map(old=>old.id===id?r:old):[...state.rows,r];
 if(!save({...state,rows})){error.textContent="Could not save to this browser.";return;}
 $("editor").close();render();toast(id+" saved");
};
$("close").onclick=()=>$("editor").close();
$("new").onclick=()=>openEditor();
document.addEventListener("click",e=>{
 const nav=e.target.closest("[data-page]");
 if(nav){page=nav.dataset.page;query="";filter="";render();return;}
 const editor=e.target.closest("[data-edit]");
 if(editor)openEditor(editor.dataset.edit);
});
const icons={2:["mint","+"],6:["purple","−"],8:["target","◎"],12:["mint","+"],16:["target","◎"],21:["purple","−"],24:["target","◎"]};
$("grid").innerHTML=Array.from({length:25},(_,i)=>'<span class="cell '+(icons[i]?.[0]??"")+'">'+(icons[i]?.[1]??"")+'</span>').join("");
render();
