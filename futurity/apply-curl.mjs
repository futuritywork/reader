import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const filename = join(process.argv[2] ?? process.cwd(), 'node_modules/@nomagick/node-libcurl-impersonate/dist/Curl.js');
const source = readFileSync(filename, 'utf8');
const expected = 'f01a81e0aa1876a879a8946a19d771793d91a6a2c0ca9d8a1cc6df9e45e3b484';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const streamRead = `                    handle.streamPendingReadSize += size;
                    if (handle.handle.isPausedRecv && handle.isRunning) {
                        handle.nextPauseFlags = handle.handle.pauseFlags & ~CurlPause_1.CurlPause.Recv;
                    }`;
const resumableRead = `                    handle.streamPendingReadSize += size;
                    setImmediate(() => {
                        if (handle.handle.isOpen && handle.isRunning && handle.handle.isPausedRecv && handle.streamPendingReadSize > 0) {
                            const pauseFlags = (handle.nextPauseFlags ?? handle.handle.pauseFlags) & ~CurlPause_1.CurlPause.Recv;
                            handle.nextPauseFlags = null;
                            handle.pause(pauseFlags);
                        }
                    });`;

if (source.split(resumableRead).length === 2 && hash(source.replace(resumableRead, streamRead)) === expected) {
    console.log('Curl resume patch already applied');
} else if (hash(source) === expected && source.split(streamRead).length === 2) {
    writeFileSync(filename, source.replace(streamRead, resumableRead));
    console.log('Applied curl response resume patch');
} else {
    throw new Error('Curl differs from the reviewed version; rebase and review the dependency patch');
}
