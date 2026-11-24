import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { makeManifest, stageBundles, targets, updaterConfig } from './release.mjs'

const repo = 'Zettersten/signal-desk'
const version = '1.2.3'
const record = (tag, size, keyByte = 7) => {
  const bytes = Buffer.alloc(size, keyByte)
  bytes.write(tag)
  return bytes.toString('base64')
}
const key = Buffer.from(`untrusted comment: public key\n${record('Ed', 42)}\n`).toString('base64')
const signature = (v, keyByte) =>
  Buffer.from(
    `untrusted comment: signature\n${record('ED', 74, keyByte)}\ntrusted comment: timestamp:1\tfile:sample\tversion:${v}\nAA==\n`,
  ).toString('base64')

test('release configuration pins HTTPS stable releases and requires versioned signatures', () => {
  const config = updaterConfig(repo, ` ${key}\n`)
  assert.equal(config.bundle.createUpdaterArtifacts, true)
  assert.deepEqual(config.plugins.updater, {
    pubkey: key,
    requireSignedVersion: true,
    endpoints: [`https://github.com/${repo}/releases/latest/download/latest.json`],
    windows: { installMode: 'passive' },
  })
  assert.throws(() => updaterConfig(repo, ''), /TAURI_UPDATER_PUBLIC_KEY/)
  assert.throws(() => updaterConfig('malformed/repo/extra', key), /owner\/name/)
  assert.throws(() => updaterConfig(repo, 'key'), /TAURI_UPDATER_PUBLIC_KEY/)
})

test('stages the right asset and signature for every platform and rejects incomplete or mismatched releases', () => {
  const root = mkdtempSync(join(tmpdir(), 'signal-desk-release-'))
  try {
    const assets = join(root, 'assets')
    for (const [target, spec] of Object.entries(targets)) {
      const bundle = join(root, 'bundles', target)
      mkdirSync(bundle, { recursive: true })
      writeFileSync(join(bundle, `Signal Desk.${spec.installer}`), 'installer')
      if (spec.update !== spec.installer) writeFileSync(join(bundle, `Signal Desk.${spec.update}`), 'update')
      writeFileSync(join(bundle, `Signal Desk.${spec.update}.sig`), signature(version))
      stageBundles({ version, target, bundle, output: join(assets, target), signed: true })
    }
    const input = { repo, version, assets, key }
    const manifest = makeManifest(input)
    assert.equal(manifest.version, version)
    assert.equal(Object.keys(manifest.platforms).length, 5)
    assert.equal(
      manifest.platforms['darwin-aarch64'].url,
      `https://github.com/${repo}/releases/download/v1.2.3/signal-desk-1.2.3-darwin-aarch64.app.tar.gz`,
    )
    assert.equal(manifest.platforms['windows-x86_64'].signature, signature(version))
    const path = join(assets, 'x86_64-pc-windows-msvc', 'signal-desk-1.2.3-windows-x86_64.exe.sig')
    writeFileSync(path, signature('1.2.2'))
    assert.throws(() => makeManifest(input), /does not bind version/)
    writeFileSync(path, signature(version, 8))
    assert.throws(() => makeManifest(input), /does not match the configured public key/)
    rmSync(path)
    assert.throws(() => makeManifest(input), /found 0/)
    assert.throws(() => makeManifest({ ...input, version: '1.2.3-beta.1' }), /stable SemVer/)
  } finally {
    rmSync(root, { recursive: true })
  }
})
