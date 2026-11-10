'use client'
export { AccountPage } from "./account/legacy-account-page"

export { OffersPage, OfferDetailPage } from "./offers/offer-pages"

export { DestinationsPage, DestinationDetailPage, DestinationDetailView } from "./content/destination-pages"

export { BlogsPage, BlogEditorialPage, BlogDetailPage } from "./content/blog-pages"

export { EventCard, EventsPage, EventDetailPage } from "./events/event-pages"

export { EditorialHero, DetailNotFound, ContentCard, GuidePage, AccessiblePage, FAQPage, PolicyPage } from "./content/public-content-pages"

export { ForgotPasswordPage, ResetPasswordPage } from "./account/password-recovery-pages"

export { ContactPage, ContactForm } from "./enquiries/contact-page"

export { CarsPage, CarCard, CarRequestForm, CarRequestPage } from "./cars/car-pages"

import { CalendarCheck, Gift, Headphones, Star } from "lucide-react";
import { blogs, destinations, faqs, offers } from "@/data/content";

import { isOfferActive, offerHref } from '@/lib/offers/special-offers'
import { getActiveDealPercent } from '@/data/tours'

import { useDbOffersStatus } from "@/lib/catalogue/offers-blogs-client";

import { isEventPublished } from "@/lib/events/events";

import { catalogTours, getDealPrice } from "@/data/tours";

import { formatPrice } from "./locale";
import { Heading, images } from "@/components/site";

export { AboutPage } from './content/about-page'

export { SearchPage } from './content/public-search-page'
