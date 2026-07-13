export interface SubgenreSeed {
  name: string
  searchTerm?: string // iTunes term override when the raw name is too broad
}

export interface FamilySeed {
  name: string
  slug: string
  color: string
  sort: number
  subgenres: SubgenreSeed[]
}

export const families: FamilySeed[] = [
  { name: 'Pop', slug: 'pop', color: '#da3d7f', sort: 1, subgenres: [
    { name: 'pop' }, { name: 'dance pop' }, { name: 'art pop' }, { name: 'indie pop' },
    { name: 'electropop' }, { name: 'swedish pop' }, { name: 'synthpop' }, { name: 'power pop' } ] },
  { name: 'Hip-Hop', slug: 'hip-hop', color: '#ce5d19', sort: 2, subgenres: [
    { name: 'hip hop' }, { name: 'rap' }, { name: 'trap' }, { name: 'conscious hip hop' },
    { name: 'drill' }, { name: 'boom bap' }, { name: 'cloud rap' } ] },
  { name: 'Latin', slug: 'latin', color: '#e04078', sort: 3, subgenres: [
    { name: 'reggaeton' }, { name: 'latin pop' }, { name: 'trap latino' }, { name: 'salsa' },
    { name: 'bachata' }, { name: 'cumbia' }, { name: 'latin hip hop' } ] },
  { name: 'Rock', slug: 'rock', color: '#b6503a', sort: 4, subgenres: [
    { name: 'rock' }, { name: 'classic rock' }, { name: 'alternative rock' }, { name: 'indie rock' },
    { name: 'hard rock' }, { name: 'garage rock' }, { name: 'psychedelic rock' } ] },
  { name: 'Metal', slug: 'metal', color: '#8f3b3b', sort: 5, subgenres: [
    { name: 'metal' }, { name: 'black metal' }, { name: 'death metal' }, { name: 'thrash metal' },
    { name: 'doom metal' }, { name: 'power metal' }, { name: 'metalcore' } ] },
  { name: 'Electronic', slug: 'electronic', color: '#7078bc', sort: 6, subgenres: [
    { name: 'house' }, { name: 'deep house' }, { name: 'techno' }, { name: 'trance' },
    { name: 'drum and bass' }, { name: 'dubstep' }, { name: 'synthwave' }, { name: 'edm' } ] },
  { name: 'Jazz', slug: 'jazz', color: '#568608', sort: 7, subgenres: [
    { name: 'jazz' }, { name: 'bebop' }, { name: 'cool jazz' }, { name: 'jazz fusion' },
    { name: 'vocal jazz' }, { name: 'smooth jazz' } ] },
  { name: 'R&B / Soul', slug: 'rnb-soul', color: '#a05fbf', sort: 8, subgenres: [
    { name: 'r&b', searchTerm: 'r&b' }, { name: 'soul' }, { name: 'neo soul' }, { name: 'funk' },
    { name: 'motown' }, { name: 'contemporary r&b', searchTerm: 'contemporary r&b' } ] },
  { name: 'Country', slug: 'country', color: '#c77a3a', sort: 9, subgenres: [
    { name: 'country' }, { name: 'contemporary country' }, { name: 'outlaw country' },
    { name: 'americana' }, { name: 'bluegrass' } ] },
  { name: 'Folk', slug: 'folk', color: '#7a9a2a', sort: 10, subgenres: [
    { name: 'folk' }, { name: 'indie folk' }, { name: 'folk rock' }, { name: 'singer-songwriter' } ] },
  { name: 'Classical', slug: 'classical', color: '#6f86c9', sort: 11, subgenres: [
    { name: 'classical' }, { name: 'baroque' }, { name: 'opera' }, { name: 'compositional ambient' },
    { name: 'orchestral soundtrack', searchTerm: 'orchestral' } ] },
  { name: 'Reggae', slug: 'reggae', color: '#3f9a4d', sort: 12, subgenres: [
    { name: 'reggae' }, { name: 'dancehall' }, { name: 'dub' }, { name: 'roots reggae' }, { name: 'ska' } ] },
  { name: 'Blues', slug: 'blues', color: '#698620', sort: 13, subgenres: [
    { name: 'blues' }, { name: 'delta blues' }, { name: 'electric blues' }, { name: 'blues rock' } ] },
  { name: 'Punk', slug: 'punk', color: '#c23b57', sort: 14, subgenres: [
    { name: 'punk' }, { name: 'pop punk' }, { name: 'hardcore punk' }, { name: 'post-punk' } ] },
  { name: 'Indie', slug: 'indie', color: '#5b9d0c', sort: 15, subgenres: [
    { name: 'indie' }, { name: 'indietronica' }, { name: 'dream pop' }, { name: 'shoegaze' },
    { name: 'bedroom pop' } ] },
  { name: 'K-Pop', slug: 'k-pop', color: '#e35fa0', sort: 16, subgenres: [
    { name: 'k-pop', searchTerm: 'k-pop' }, { name: 'k-rap', searchTerm: 'korean hip hop' },
    { name: 'korean r&b', searchTerm: 'korean r&b' } ] },
  { name: 'Afro', slug: 'afro', color: '#d09a1e', sort: 17, subgenres: [
    { name: 'afrobeat' }, { name: 'afropop' }, { name: 'amapiano' }, { name: 'afro house' } ] },
  { name: 'Ambient', slug: 'ambient', color: '#5aa0a8', sort: 18, subgenres: [
    { name: 'ambient' }, { name: 'dark ambient' }, { name: 'drone' }, { name: 'new age' } ] },
  { name: 'Funk / Disco', slug: 'funk-disco', color: '#c9820c', sort: 19, subgenres: [
    { name: 'disco' }, { name: 'funk' }, { name: 'nu disco' }, { name: 'boogie' } ] },
  { name: 'Gospel', slug: 'gospel', color: '#8a9a20', sort: 20, subgenres: [
    { name: 'gospel' }, { name: 'christian music', searchTerm: 'gospel' }, { name: 'worship' } ] },
  { name: 'Soundtrack', slug: 'soundtrack', color: '#6c6f86', sort: 21, subgenres: [
    { name: 'soundtrack' }, { name: 'video game music' }, { name: 'anime' }, { name: 'movie tunes', searchTerm: 'film score' } ] },
  { name: 'Nordic', slug: 'nordic', color: '#4f8fbf', sort: 22, subgenres: [
    { name: 'swedish pop' }, { name: 'swedish indie pop' }, { name: 'schlager' }, { name: 'swedish indie rock' } ] },
]
