'use client'
import { Users, Award, MapPin, Star, MousePointerClick, CalendarDays, ThumbsUp, Landmark, Leaf, Compass, Heart, ShieldCheck, Clock3, Sun, Ship, CheckCircle, HeartHandshake, Route, Anchor, CalendarCheck, Gift, Headphones } from 'lucide-react'
import type { CmsIconId } from '@/lib/page-sections'
export const cmsIcons = { Users, Award, MapPin, Star, MousePointerClick, CalendarDays, ThumbsUp, Landmark, Leaf, Compass, Heart, ShieldCheck, Clock3, Sun, Ship, CheckCircle, HeartHandshake, Route, Anchor, CalendarCheck, Gift, Headphones }
export function CmsIcon({ id, size = 22 }: { id?: CmsIconId; size?: number }) { const Icon = cmsIcons[id ?? 'Star']; return <Icon size={size} aria-hidden="true" /> }
