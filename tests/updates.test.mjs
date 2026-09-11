import test from 'node:test';
import assert from 'node:assert/strict';
import { checkForUpdate, isNewerVersion, versionParts, UPDATE_MANIFEST_URL } from '../lib/updates.ts';
test('stable versions compare numerically and never downgrade',()=>{
 assert.ok(isNewerVersion('0.10.0','0.2.0')); assert.ok(isNewerVersion('1.0.0','0.99.9'));
 for(const v of ['0.2.0','0.1.9','0.2.0-beta','garbage'])assert.equal(isNewerVersion(v,'0.2.0'),false);
 for(const v of [null,'01.2.3','1.2','1.2.3<script>','99999999999999999999.0.0'])assert.equal(versionParts(v),null);
});
test('update checks omit private data and ignore untrusted links',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{assert.equal(url,UPDATE_MANIFEST_URL);assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.body,undefined);return Response.json({version:'0.3.0',notesUrl:'https://evil.invalid'});};
  assert.deepEqual(await checkForUpdate(new AbortController().signal),{version:'0.3.0',notesUrl:'https://github.com/greddmbamboo/signal-template/releases/tag/v0.3.0'});
  for(const response of [new Response('offline',{status:503}),Response.json({version:'not-a-version'}),new Response('bad json')]){globalThis.fetch=async()=>response;await assert.rejects(checkForUpdate(new AbortController().signal));}
 } finally {globalThis.fetch=original;}
});
