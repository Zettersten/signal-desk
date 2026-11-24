import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const targets = {
  'aarch64-apple-darwin': { platform: 'darwin-aarch64', installer: 'dmg', update: 'app.tar.gz' },
  'x86_64-apple-darwin': { platform: 'darwin-x86_64', installer: 'dmg', update: 'app.tar.gz' },
  'x86_64-pc-windows-msvc': { platform: 'windows-x86_64', installer: 'exe', update: 'exe' },
  'x86_64-unknown-linux-gnu': { platform: 'linux-x86_64', installer: 'AppImage', update: 'AppImage' },
  'aarch64-unknown-linux-gnu': { platform: 'linux-aarch64', installer: 'AppImage', update: 'AppImage' },
}

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const repoPattern = /^[a-z\d][a-z\d-]*\/[a-z\d][a-z\d_.-]*$/i
export function linuxWorkerConfig(target) {
  if (!Object.hasOwn(targets, target) || !targets[target].platform.startsWith('linux-')) {
    throw new Error(`Unsupported Linux worker target: ${target}`)
  }
  return { bundle: { resources: { [`binaries/signal-research-${target}.gz`]: 'signal-research.gz' } } }
}
const stableVersion = (version) => {
  if (!versionPattern.test(version))
    throw new Error('The release version must be stable SemVer (major.minor.patch).')
  return version
}
const project = (repo) => {
  if (!repoPattern.test(repo)) throw new Error('Expected a GitHub repository in owner/name form.')
  return `https://github.com/${repo}/releases`
}

function minisignLines(value, name) {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`Invalid ${name}.`)
  return Buffer.from(value, 'base64').toString('utf8').split(/\r?\n/)
}

function publicKeyId(key) {
  const lines = minisignLines(key?.trim(), 'TAURI_UPDATER_PUBLIC_KEY; use the contents of the .pub file')
  const bytes = Buffer.from(lines[1] ?? '', 'base64')
  if (
    !lines[0]?.startsWith('untrusted comment:') ||
    bytes.length !== 42 ||
    bytes.toString('ascii', 0, 2) !== 'Ed'
  ) {
    throw new Error('Invalid TAURI_UPDATER_PUBLIC_KEY; use the contents of the .pub file.')
  }
  return bytes.subarray(2, 10)
}

export function updaterConfig(repo, key) {
  const pubkey = key?.trim()
  if (!pubkey)
    throw new Error('Set the TAURI_UPDATER_PUBLIC_KEY repository variable to the public key contents.')
  publicKeyId(pubkey)
  return {
    bundle: { createUpdaterArtifacts: true },
    plugins: {
      updater: {
        pubkey,
        requireSignedVersion: true,
        endpoints: [`${project(repo)}/latest/download/latest.json`],
        windows: { installMode: 'passive' },
      },
    },
  }
}

const installerName = (version, target) => `signal-desk-${version}-${target.platform}.${target.installer}`
const updateName = (version, target) => `signal-desk-${version}-${target.platform}.${target.update}`

function findOne(dir, matches) {
  const candidates = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((file) => file.isFile() && matches(file.name))
    .map((file) => join(file.parentPath, file.name))
  if (candidates.length !== 1)
    throw new Error(`Expected one matching bundle in ${dir}, found ${candidates.length}.`)
  return candidates[0]
}

export function stageBundles({ version, target, bundle, output, signed }) {
  stableVersion(version)
  if (!Object.hasOwn(targets, target)) throw new Error(`Unsupported release target: ${target}`)
  const spec = targets[target]
  const installer = findOne(bundle, (name) => name.endsWith(`.${spec.installer}`))
  mkdirSync(output, { recursive: true })
  copyFileSync(installer, join(output, installerName(version, spec)))
  if (!signed) return
  const asset =
    spec.installer === spec.update ? installer : findOne(bundle, (name) => name.endsWith(`.${spec.update}`))
  const name = updateName(version, spec)
  if (asset !== installer) copyFileSync(asset, join(output, name))
  copyFileSync(`${asset}.sig`, join(output, `${name}.sig`))
}

export function makeManifest({ repo, version, assets, key }) {
  const release = `${project(repo)}/download/v${stableVersion(version)}`
  const expectedKey = publicKeyId(key)
  const platforms = Object.fromEntries(
    Object.values(targets).map((target) => {
      const name = updateName(version, target)
      findOne(assets, (file) => file === installerName(version, target))
      findOne(assets, (file) => file === name)
      const signature = readFileSync(
        findOne(assets, (file) => file === `${name}.sig`),
        'utf8',
      ).trim()
      const [untrusted, record, comment] = minisignLines(signature, `signature file for ${name}`)
      const bytes = Buffer.from(record ?? '', 'base64')
      if (
        !untrusted?.startsWith('untrusted comment:') ||
        bytes.length !== 74 ||
        !bytes.subarray(2, 10).equals(expectedKey)
      ) {
        throw new Error(`Signature for ${name} does not match the configured public key.`)
      }
      if (!comment?.startsWith('trusted comment:') || !comment.split('\t').includes(`version:${version}`))
        throw new Error(`Signature for ${name} does not bind version ${version}.`)
      return [target.platform, { url: `${release}/${encodeURIComponent(name)}`, signature }]
    }),
  )
  return { version, platforms }
}

function main([command, ...args]) {
  const repo = process.env.GITHUB_REPOSITORY || 'Zettersten/signal-desk'
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  if (command === 'linux-worker-config' && args.length === 2) {
    writeFileSync(args[1], JSON.stringify(linuxWorkerConfig(args[0])))
  } else if (command === 'config' && args.length === 1) {
    if (!process.env.TAURI_SIGNING_PRIVATE_KEY?.trim())
      throw new Error('Set the TAURI_SIGNING_PRIVATE_KEY secret for tagged builds.')
    if (process.env.GITHUB_REF_NAME !== `v${stableVersion(version)}`)
      throw new Error('The release tag must match the package version.')
    writeFileSync(args[0], JSON.stringify(updaterConfig(repo, process.env.TAURI_UPDATER_PUBLIC_KEY)))
  } else if (command === 'stage' && (args.length === 3 || (args.length === 4 && args[3] === '--signed'))) {
    stageBundles({
      version,
      target: args[0],
      bundle: args[1],
      output: args[2],
      signed: args[3] === '--signed',
    })
  } else if (command === 'manifest' && args.length === 2) {
    if (process.env.GITHUB_REF_NAME !== `v${stableVersion(version)}`)
      throw new Error('The release tag must match the package version.')
    const manifest = makeManifest({
      repo,
      version,
      assets: args[0],
      key: process.env.TAURI_UPDATER_PUBLIC_KEY,
    })
    writeFileSync(args[1], JSON.stringify(manifest, null, 2) + '\n')
  } else {
    throw new Error(`Unknown release command: ${basename(command || 'none')}.`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2))
