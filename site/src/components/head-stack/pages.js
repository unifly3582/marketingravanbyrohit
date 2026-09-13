/** Turn an eager import.meta.glob of *.webp into ordered { key, src } pages. */
export function pagesFrom(glob) {
  return Object.entries(glob)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, src]) => ({ key: path.split('/').pop().replace('.webp', ''), src }))
}
