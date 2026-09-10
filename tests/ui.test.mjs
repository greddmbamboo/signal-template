import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('job links use a new external tab with opener protection',async()=>{const page=await readFile('app/page.tsx','utf8');assert.match(page,/href=\{selected\.url\}[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/);});
test('aggregator results are not mislabeled as ATS listings',async()=>{const page=await readFile('app/page.tsx','utf8');assert.match(page,/Market listing found/);assert.doesNotMatch(page,/ATS listing found/);});
test('the build gate includes a full type check',async()=>{const script=await readFile('scripts/build-verified.sh','utf8');assert.match(script,/tsc.*--noEmit/s);});
test('cover letter modal stays within the viewport and scrolls its editor',async()=>{const css=await readFile('app/globals.css','utf8');assert.match(css,/\.cover-dialog\{[^}]*max-height:calc\(100dvh - 32px\)[^}]*overflow:hidden/);assert.match(css,/\.cover-editor\{[^}]*height:100%!important[^}]*overflow-y:auto[^}]*resize:none/);});
test('navigation scrollbar is hidden and listing actions share one height',async()=>{const css=await readFile('app/globals.css','utf8');assert.match(css,/\[data-slot=tabs-list\]\{[^}]*overflow-y:hidden[^}]*scrollbar-width:none/);assert.match(css,/\[data-slot=tabs-list\]::-webkit-scrollbar\{display:none\}/);assert.match(css,/\.detail-actions>a,\.detail-actions>button\{height:40px;min-height:40px/);});
test('green CTAs share the secondary button stroke without changing score chips',async()=>{const [css,page]=await Promise.all([readFile('app/globals.css','utf8'),readFile('app/page.tsx','utf8')]);assert.match(css,/\.signal-cta\{[^}]*background:#ddf879!important[^}]*border:1px solid #172b42!important/);assert.match(page,/className="refresh signal-cta"/);assert.match(page,/className="signal-cta"/);assert.doesNotMatch(css,/\.scorebox\.fit strong\{[^}]*border:/);});
