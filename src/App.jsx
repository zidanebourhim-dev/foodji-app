18:42:22.221 Running build in Portland, USA (West) – pdx1
18:42:22.222 Build machine configuration: 2 cores, 8 GB
18:42:22.231 Cloning github.com/zidanebourhim-dev/foodji-app (Branch: main, Commit: 77e2e26)
18:42:22.232 Skipping build cache, deployment was triggered without cache.
18:42:24.373 Cloning completed: 2.142s
18:42:24.732 Running "vercel build"
18:42:25.678 Vercel CLI 50.11.0
18:42:26.212 Running "install" command: `npm install --legacy-peer-deps`...
18:42:32.691 npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
18:42:41.176 
18:42:41.177 added 913 packages, and audited 914 packages in 15s
18:42:41.177 
18:42:41.177 119 packages are looking for funding
18:42:41.178   run `npm fund` for details
18:42:41.182 
18:42:41.182 5 vulnerabilities (1 low, 1 moderate, 3 high)
18:42:41.183 
18:42:41.183 To address all issues, run:
18:42:41.183   npm audit fix
18:42:41.183 
18:42:41.183 Run `npm audit` for details.
18:42:41.328 Running "npm run build"
18:42:41.425 
18:42:41.429 > vite-react-starter@0.0.0 build
18:42:41.430 > vite build
18:42:41.430 
18:42:41.670 [36mvite v7.3.0 [32mbuilding client environment for production...[36m[39m
18:42:41.732 transforming...
18:42:41.791 [32m✓[39m 10 modules transformed.
18:42:41.793 [31m✗[39m Build failed in 92ms
18:42:41.793 [31merror during build:
18:42:41.793 [31m[vite:esbuild] Transform failed with 1 error:
18:42:41.793 /vercel/path0/src/App.jsx:1274:110: ERROR: Unterminated string literal[31m
18:42:41.793 file: [36m/vercel/path0/src/App.jsx:1274:110[31m
18:42:41.793 [33m
18:42:41.794 [33mUnterminated string literal[33m
18:42:41.794 1272 |                            <strong style={{fontSize:'1.1rem'}}>{it.nom}</strong>
18:42:41.794 1273 |                        </div>
18:42:41.794 1274 |                        <div style={{display:'flex', justifyContent:'space-between', color: COLORS.secondary'}}>
18:42:41.794      |                                                                                                                ^
18:42:41.794 1275 |                            <span>
18:42:41.794 1276 |                                {it.choixPates && <strong style={{color: COLORS.primary, marginRight:'5px'}}>{it.choixP...
18:42:41.795 [31m
18:42:41.799     at failureErrorWithLog (/vercel/path0/node_modules/esbuild/lib/main.js:1467:15)
18:42:41.799     at /vercel/path0/node_modules/esbuild/lib/main.js:736:50
18:42:41.799     at responseCallbacks.<computed> (/vercel/path0/node_modules/esbuild/lib/main.js:603:9)
18:42:41.799     at handleIncomingPacket (/vercel/path0/node_modules/esbuild/lib/main.js:658:12)
18:42:41.799     at Socket.readFromStdout (/vercel/path0/node_modules/esbuild/lib/main.js:581:7)
18:42:41.799     at Socket.emit (node:events:508:28)
18:42:41.799     at addChunk (node:internal/streams/readable:559:12)
18:42:41.799     at readableAddChunkPushByteMode (node:internal/streams/readable:510:3)
18:42:41.800     at Readable.push (node:internal/streams/readable:390:5)
18:42:41.800     at Pipe.onStreamRead (node:internal/stream_base_commons:189:23)[39m
18:42:41.818 Error: Command "npm run build" exited with 1