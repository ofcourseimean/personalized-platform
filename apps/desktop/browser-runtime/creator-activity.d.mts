export interface ActivityPost { published: string; timestamp: string; text: string; pinned: boolean; media: boolean }
export const creatorSearchOrigin: string
export const creatorSpaceOrigin: string
export function creatorProfiles(links: { labels: string[]; href: string }[], name: string): string[]
export function activityTime(text: string, now: number): number
export function newestActivity(posts: ActivityPost[], now?: number): { post: ActivityPost; time: number } | undefined
