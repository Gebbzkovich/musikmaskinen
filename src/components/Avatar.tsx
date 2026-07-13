export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const letter = ((name ?? '?').trim()[0] ?? '?').toUpperCase()
  if (url) return <img src={url} alt="" width={size} height={size} className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />
  return <span className="flex flex-none items-center justify-center rounded-full bg-white/10 font-semibold" style={{ width: size, height: size }}>{letter}</span>
}
