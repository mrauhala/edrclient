// A file from public/ (schemas, the IWXXM stylesheet) as served with the app. The app runs at the
// site root on Firebase and from the npm CLI, but under /<repository>/ on GitHub Pages, so a
// root-absolute path like /schemas/... would miss there.
export function publicUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/*$/, '/')}${path.replace(/^\/+/, '')}`;
}
