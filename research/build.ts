import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { platform, arch } from 'node:process'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

const rustTarget = process.argv[2] || (await Bun.$`rustc -vV`.text()).match(/^host: (.+)$/m)?.[1]
if (!rustTarget) throw new Error('Rust target not available')
const targets: Record<string, string> = {
  'aarch64-apple-darwin': 'bun-darwin-arm64',
  'x86_64-apple-darwin': 'bun-darwin-x64-baseline',
  'x86_64-pc-windows-msvc': 'bun-windows-x64-baseline',
  'x86_64-unknown-linux-gnu': 'bun-linux-x64-baseline',
  'aarch64-unknown-linux-gnu': 'bun-linux-arm64',
}
const bunTarget = targets[rustTarget]
if (!bunTarget) throw new Error(`Unsupported research target: ${rustTarget}`)
const exe = rustTarget.includes('windows') ? '.exe' : ''
const base = new URL('../src-tauri/', import.meta.url)
const { fileURLToPath } = await import('node:url')
const output = (folder: string, name: string) => fileURLToPath(new URL(`${folder}/${name}`, base))
await mkdir(output('binaries', ''), { recursive: true })
const binary = output('binaries', `signal-research-${rustTarget}${exe}`)
const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('./index.ts', import.meta.url))],
  compile: {
    // Native Windows hosts can reuse their installed Bun runtime. Downloading the
    // separate baseline compiler fails to extract on the Windows CI runner.
    ...(platform === 'win32' && arch === 'x64' && rustTarget === 'x86_64-pc-windows-msvc'
      ? {}
      : { target: bunTarget as Bun.Build.CompileTarget }),
    outfile: binary,
  },
  plugins: [
    {
      name: 'explicit-ws-exports',
      setup(build) {
        // Bun 1.3.13's standalone compiler mishandles a star re-export of its built-in ws.
        build.onLoad({ filter: /platform-node-shared[/\\]dist[/\\]NodeWS\.js$/ }, () => ({
          loader: 'js',
          contents:
            'export { WebSocket, WebSocketServer, Server, Receiver, Sender, createWebSocketStream } from "ws";',
        }))
        // The analysis worker uses tool-less generation, so it does not ship a terminal daemon.
        build.onLoad({ filter: /@opencode[/\\]pty[/\\]index\.js$/ }, () => ({
          loader: 'js',
          contents: 'export const binaryPath = undefined;',
        }))
      },
    },
  ],
})
if (!result.success) throw new AggregateError(result.logs, 'Could not compile the OpenCode worker')
if (rustTarget.endsWith('-unknown-linux-gnu')) {
  // linuxdeploy must not rewrite Bun's executable with patchelf or strip.
  await pipeline(createReadStream(binary), createGzip(), createWriteStream(`${binary}.gz`))
}
