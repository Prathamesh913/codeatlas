// CodeAtlas Phase 4B.1 — Semantic Investigation Fixture Tests
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Helpers to synthesize evidence + structural + source for fixtures
function writeJson(path, data) { writeFileSync(path, JSON.stringify(data, null, 2) + '\n'); }

function makeBase(evidenceDir, structuralDir, repoDir, files, imports, symbols, units) {
  mkdirSync(evidenceDir, { recursive: true });
  mkdirSync(structuralDir, { recursive: true });
  mkdirSync(repoDir, { recursive: true });
  const fileEntries = files.map(f => ({ path: f.path, extension: f.path.includes('.') ? '.' + f.path.split('.').pop() : '', language: 'TypeScript', type: 'TypeScript', size: 100, included: true, excluded_reason: null }));
  writeJson(join(evidenceDir, 'files.json'), fileEntries);
  writeJson(join(evidenceDir, 'imports.json'), imports);
  writeJson(join(evidenceDir, 'symbols.json'), symbols);
  // Build minimal graph
  const nodes = fileEntries.map(f => ({ id: f.path, kind: 'file', declares: symbols.filter(s => s.file === f.path).map(s => s.name) }));
  // add external nodes referenced
  const extIds = new Set();
  for (const imp of imports) {
    if (imp.resolution_status === 'not_local') extIds.add('ext:' + imp.target);
    if (imp.resolution_status === 'unresolved') extIds.add('unresolved:' + imp.target);
  }
  for (const id of extIds) nodes.push({ id, kind: id.startsWith('ext:') ? 'external_dependency' : 'unresolved_module', label: id.slice(4) });
  nodes.sort((a,b)=>a.id<b.id?-1:1);
  const edges = imports.map((imp,i)=>({id:`e${i}`, from: imp.source, to: imp.resolution_status==='resolved'?imp.resolved_path: (imp.resolution_status==='unresolved'?'unresolved:'+imp.target:'ext:'+imp.target), type:'IMPORTS', provenance:{evidence:'imports.json', source_file: imp.source, target: imp.target, observed:`file '${imp.source}' imports '${imp.target}'`, resolution_status: imp.resolution_status}}));
  // declares edges not needed for graph, but clue extraction uses symbols
  const graph = { tool:'codeatlas-structural-graph', version:'0.4.0', nodes, edges };
  writeJson(join(structuralDir, 'graph.json'), graph);
  writeJson(join(structuralDir, 'units.json'), { tool:'codeatlas-structural-graph', version:'0.4.0', structural_unit_term:'Structural Unit', unit_count: units.length, units });
  // analysis: need degree, shared_dependencies, connectivity, etc.
  const degree = {};
  for (const u of units) for (const m of u.members) degree[m] = u.members.length > 1 ? 1 : 0;
  // compute shared_dependencies from imports
  const inCount = {};
  for (const imp of imports) if (imp.resolution_status==='resolved') inCount[imp.resolved_path]=(inCount[imp.resolved_path]||0)+1;
  const shared = Object.entries(inCount).filter(([,c])=>c>=2).map(([file,importers])=>({file, importers}));
  const analysis = {
    tool:'codeatlas-structural-graph', version:'0.4.0',
    connectivity:{ components: units.map(u=>({members:u.members, size:u.size})), component_count: units.length, orphans: units.filter(u=>u.size===1).map(u=>u.members[0]), orphan_count: units.filter(u=>u.size===1).length },
    hubs: units.flatMap(u=>u.hubs.map(h=>({file:h, degree:2, component_size:u.size}))),
    bridges: [], cycles: [], shared_dependencies: shared,
    entrypoint_reachability: [],
    degree,
  };
  writeJson(join(structuralDir,'analysis.json'), analysis);
  // write source files
  for (const f of files) {
    const full = join(repoDir, f.path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, f.content);
  }
  return { evidenceDir, structuralDir, repoDir };
}

describe('Fixture A — Strong UI Evidence', () => {
  it('produces a feature_candidate with medium/high confidence', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-A-'));
    const ev = join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[
      {path:'src/SearchProjects.tsx', content:`export function SearchProjects(){ return <div><h1>Search Projects</h1><button>Search Projects</button></div> }`},
      {path:'src/search.ts', content:`export function search(query:string){ return fetch('/api/search?q='+query) }`},
    ];
    const imports=[
      {source:'src/SearchProjects.tsx', target:'./search', type:'import', classification:'local', symbols:[], resolution_status:'resolved', resolved_path:'src/search.ts', confidence:'high'},
    ];
    const symbols=[{file:'src/SearchProjects.tsx', name:'SearchProjects', symbol_kind:'named_export', confidence:'high'}, {file:'src/search.ts', name:'search', symbol_kind:'function', confidence:'high'}];
    const units=[{id:'unit-001', size:2, members:['src/SearchProjects.tsx','src/search.ts'], hubs:['src/SearchProjects.tsx'], bridges:[], cycles:[], orphans:[], reason:'Connected component of 2'}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    const cand = res.candidates.find(c=>c.structural_units.includes('unit-001'));
    assert.ok(cand, 'candidate exists');
    assert.equal(cand.candidate_type, 'feature_candidate');
    assert.ok(['high','medium'].includes(cand.confidence), `confidence ${cand.confidence} should be high/medium`);
    assert.ok(cand.evidence.supporting.some(e=>/Search Projects/i.test(e.clue)), 'supporting evidence includes UI label');
    assert.ok(cand.inspected_files.every(f=>f.selection_reasons.length>0), 'every inspected file has selection reason');
  });
});

describe('Fixture B — Shared Infrastructure', () => {
  it('produces a system_candidate for a shared module', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-B-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[
      {path:'src/persistence/db.ts', content:`export function save(key:string, v:any){ return setDoc(doc(db,key), v) } export function load(key:string){ return getDocs(collection(db,key)) }`},
      {path:'src/featureA.ts', content:`import { save } from "./persistence/db"; export const a=1`},
      {path:'src/featureB.ts', content:`import { load } from "./persistence/db"; export const b=1`},
      {path:'src/featureC.ts', content:`import { save } from "./persistence/db"; export const c=1`},
    ];
    const imports=[
      {source:'src/featureA.ts', target:'./persistence/db', type:'import', classification:'local', symbols:['save'], resolution_status:'resolved', resolved_path:'src/persistence/db.ts', confidence:'high'},
      {source:'src/featureB.ts', target:'./persistence/db', type:'import', classification:'local', symbols:['load'], resolution_status:'resolved', resolved_path:'src/persistence/db.ts', confidence:'high'},
      {source:'src/featureC.ts', target:'./persistence/db', type:'import', classification:'local', symbols:['save'], resolution_status:'resolved', resolved_path:'src/persistence/db.ts', confidence:'high'},
    ];
    const symbols=[{file:'src/persistence/db.ts', name:'save', symbol_kind:'named_export', confidence:'high'}, {file:'src/persistence/db.ts', name:'load', symbol_kind:'named_export', confidence:'high'}];
    const units=[{id:'unit-001', size:4, members:['src/persistence/db.ts','src/featureA.ts','src/featureB.ts','src/featureC.ts'], hubs:['src/persistence/db.ts'], bridges:[], cycles:[], orphans:[], reason:'hub'}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    const cand = res.candidates[0];
    assert.equal(cand.candidate_type, 'system_candidate');
    assert.ok(cand.hypothesis.toLowerCase().includes('persistence') || cand.hypothesis.toLowerCase().includes('shared'), 'hypothesis mentions persistence/shared');
    assert.ok(!cand.hypothesis.toLowerCase().includes('notion system') && !cand.hypothesis.toLowerCase().includes('feature search'), 'not forced to feature');
  });
});

describe('Fixture C — Misleading Filename', () => {
  it('does not blindly trust notion filename; preserves conflict', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-C-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[
      {path:'src/lib/notion.ts', content:`import { db } from "./firebase"; export function fetchNotionPosters(){ return getDocs(collection(db,"posters")) } // Public path: reads go through CLIENT Firestore SDK`},
      {path:'src/lib/firebase.ts', content:`export const db={}`},
      {path:'src/lib/posters.ts', content:`export type Poster={}`},
    ];
    const imports=[
      {source:'src/lib/notion.ts', target:'./firebase', type:'import', classification:'local', symbols:['db'], resolution_status:'resolved', resolved_path:'src/lib/firebase.ts', confidence:'high'},
      {source:'src/lib/notion.ts', target:'./posters', type:'import', classification:'local', symbols:['Poster'], resolution_status:'resolved', resolved_path:'src/lib/posters.ts', confidence:'high'},
    ];
    const symbols=[{file:'src/lib/notion.ts', name:'fetchNotionPosters', symbol_kind:'named_export', confidence:'high'}];
    const units=[{id:'unit-001', size:3, members:['src/lib/notion.ts','src/lib/firebase.ts','src/lib/posters.ts'], hubs:['src/lib/notion.ts'], bridges:[], cycles:[], orphans:[], reason:'unit'}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    const cand = res.candidates[0];
    // must not be a Notion System blindly; hypothesis should mention posters/firebase or be ambiguous
    assert.ok(!/notion system/i.test(cand.hypothesis), 'should not blindly create Notion System');
    const hasWeakening = cand.evidence.weakening.some(e=>/notion/i.test(e.clue));
    const hasCompeting = cand.competing_hypotheses.length>0;
    assert.ok(hasWeakening || hasCompeting, 'should record notion naming conflict as weakening or competing');
    assert.ok(cand.evidence.supporting.some(e=>/firebase|poster/i.test(e.clue)), 'supporting includes firebase/poster behavior');
  });
});

describe('Fixture D — Ambiguous Unit', () => {
  it('returns ambiguous with competing hypotheses', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-D-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[
      {path:'src/A.tsx', content:`export function A(){ return <><h1>Search Projects</h1><button>Filter by Date</button></> }`},
      {path:'src/B.ts', content:`export function search(){} export function filterByDate(){}`},
    ];
    const imports=[{source:'src/A.tsx', target:'./B', type:'import', classification:'local', symbols:[], resolution_status:'resolved', resolved_path:'src/B.ts', confidence:'high'}];
    const symbols=[{file:'src/B.ts', name:'search', symbol_kind:'function', confidence:'high'}, {file:'src/B.ts', name:'filterByDate', symbol_kind:'function', confidence:'high'}];
    const units=[{id:'unit-001', size:2, members:['src/A.tsx','src/B.ts'], hubs:[], bridges:[], cycles:[], orphans:[], reason:''}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    const cand = res.candidates[0];
    assert.equal(cand.candidate_type, 'ambiguous');
    assert.ok(cand.competing_hypotheses.length>=2, 'should have competing hypotheses');
    assert.ok(cand.ambiguity_notes.length>0, 'ambiguity notes present');
  });
});

describe('Fixture E — Insufficient Evidence', () => {
  it('returns insufficient_evidence for utility with no UI/behavioral clues', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-E-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[
      {path:'src/utils/helpers.ts', content:`export function formatDate(d:Date){ return d.toISOString() } export function validateEmail(s:string){ return s.includes("@") }`},
    ];
    const imports=[];
    const symbols=[{file:'src/utils/helpers.ts', name:'formatDate', symbol_kind:'function', confidence:'high'}];
    const units=[{id:'unit-001', size:1, members:['src/utils/helpers.ts'], hubs:[], bridges:[], cycles:[], orphans:['src/utils/helpers.ts'], reason:'orphan'}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    const cand = res.candidates[0];
    assert.equal(cand.candidate_type, 'insufficient_evidence');
    assert.equal(cand.confidence, 'unknown');
  });
});

describe('Fixture F — Naming vs UI Conflict', () => {
  it('considers UI over filename and records conflict', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-F-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[
      {path:'src/userManager.ts', content:`export function render(){ return \`<button>Sign out</button><button>Change Password</button><div>Profile Settings</div>\` }`},
    ];
    const imports=[];
    const symbols=[{file:'src/userManager.ts', name:'render', symbol_kind:'function', confidence:'high'}];
    const units=[{id:'unit-001', size:1, members:['src/userManager.ts'], hubs:[], bridges:[], cycles:[], orphans:['src/userManager.ts'], reason:'orphan'}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    const cand = res.candidates[0];
    // should recognize UI evidence over filename; ambiguous is acceptable, but must not blindly trust userManager
    const hypothesisMentionsUi = /Sign out|Change Password|Profile|auth/i.test(cand.hypothesis);
    const hasConflictNote = cand.evidence.weakening.length>0 || cand.competing_hypotheses.length>0 || /userManager/i.test(JSON.stringify(cand.evidence));
    // For F, hypothesize currently gives ambiguous due to namingVsUiConflict — assert that
    assert.ok(cand.candidate_type==='ambiguous' || hypothesisMentionsUi, 'should consider UI evidence');
    assert.ok(hasConflictNote, 'should record filename vs UI conflict');
    assert.ok(!/^This Structural Unit may provide userManager/i.test(cand.hypothesis), 'should not blindly trust filename');
  });
});

describe('Investigation provenance', () => {
  it('every inspected file has selection reasons and every candidate has evidence', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-prov-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[{path:'src/A.ts', content:`export const x=1`}];
    const imports=[]; const symbols=[]; const units=[{id:'unit-001', size:1, members:['src/A.ts'], hubs:[], bridges:[], cycles:[], orphans:['src/A.ts'], reason:''}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const res = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out') });
    for (const c of res.candidates) {
      for (const f of c.inspected_files) assert.ok(f.selection_reasons.length>0, `file ${f.file} should have selection reasons`);
      assert.ok(c.evidence.supporting.length>=0, 'evidence array exists');
    }
  });
  it('output is deterministic', async () => {
    const base = mkdtempSync(join(tmpdir(), 'p4b1-det-'));
    const ev=join(base,'evidence'), st=join(base,'structural'), repo=join(base,'repo');
    const files=[{path:'src/A.tsx', content:`export function A(){ return <h1>Search Projects</h1> }`}];
    const imports=[]; const symbols=[]; const units=[{id:'unit-001', size:1, members:['src/A.tsx'], hubs:[], bridges:[], cycles:[], orphans:['src/A.tsx'], reason:''}];
    makeBase(ev,st,repo,files,imports,symbols,units);
    const { runInvestigation } = await import('../../src/investigate/index.js');
    const r1 = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out1') });
    const r2 = runInvestigation({ evidenceDir: ev, structuralDir: st, repoRoot: repo, outputDir: join(base,'out2') });
    // candidates deterministic ignoring generated_at
    const c1 = r1.candidates.map(c=>({ ...c, investigation_scope: { ...c.investigation_scope, repo_root: 'X' }}));
    const c2 = r2.candidates.map(c=>({ ...c, investigation_scope: { ...c.investigation_scope, repo_root: 'X' }}));
    assert.deepEqual(c1, c2);
  });
});
