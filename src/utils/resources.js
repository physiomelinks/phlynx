// Example Frontend Logic
const GITHUB_ORG = 'physiomelinks'
const REPO = 'circulatory-autogen-modules'
const BRANCH = 'main'
const CURRENT_MANIFEST_PATH = `manifests/vitalworkshop.json`
const BASE_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_ORG}/${REPO}@${BRANCH}/`

async function loadManifest() {
  const response = await fetch(BASE_URL + CURRENT_MANIFEST_PATH)
  const manifest = await response.json()
  return manifest.collections
}

function getUrlForResource(path) {
  return BASE_URL + path
}

function getPurgedUrlForResource(path) {
  return `${BASE_URL.replace('cdn', 'purge')}${path ? path : CURRENT_MANIFEST_PATH}`
}

export { loadManifest, getUrlForResource, getPurgedUrlForResource }
