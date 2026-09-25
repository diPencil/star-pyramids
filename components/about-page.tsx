'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Anchor, ArrowRight, Clock3, Compass, HeartHandshake, Pause, Play, Route, Ship, Sun } from 'lucide-react'
import { destinations, siteImages } from '@/data/content'
import { useLocale } from '@/components/locale'
import { HelpCTA, PageShowcaseHero, SiteShell } from '@/components/site'

const destinationNames: Record<string, string> = {
  'cairo-giza': 'القاهرة والجيزة', luxor: 'الأقصر', aswan: 'أسوان',
  hurghada: 'الغردقة', 'white-desert': 'الصحراء البيضاء',
}

const featuredDestinations = destinations.filter((item) => destinationNames[item.slug])

function AboutContent() {
  const { locale } = useLocale()
  const ar = locale === 'ar'
  const [paused, setPaused] = useState(false)
  const values = ar ? [
    { icon: Compass, title: 'وجهتك بطريقتك', copy: 'نبدأ بما تحب رؤيته، ثم نترك للرحلة مساحة تتنفس فيها.' },
    { icon: Clock3, title: 'وقت للتجربة', copy: 'الأماكن المهمة تستحق وقتًا لفهمها، لا مجرد المرور عليها.' },
    { icon: HeartHandshake, title: 'تفاصيل واضحة', copy: 'المسار والخدمات والتوقيت أمور تُراجع قبل أن تلتزم بالرحلة.' },
  ] : [
    { icon: Compass, title: 'Your kind of Egypt', copy: 'Start with what you want to see, then leave room for the journey to breathe.' },
    { icon: Clock3, title: 'Time to be there', copy: 'Meaningful places deserve time to understand, not just a quick stop.' },
    { icon: HeartHandshake, title: 'Clarity in the details', copy: 'The route, services, and timing should be clear before you commit.' },
  ]
  const ways = ar ? [
    { icon: Sun, title: 'رحلات اليوم الواحد', copy: 'يوم مركز في القاهرة أو الأقصر أو وجهتك المفضلة.', href: '/egypt-tours/one-day-tours', image: siteImages.cairo },
    { icon: Route, title: 'رحلات متعددة الأيام', copy: 'مساحة أكبر للتنقل بين حكايات مصر ومدنها.', href: '/egypt-tours/multi-days-tours', image: siteImages.pyramids },
    { icon: Ship, title: 'الرحلات النيلية', copy: 'رحلة بين ضفتي النيل ومعابد الجنوب.', href: '/egypt-tours/nile-cruises', image: siteImages.nile },
    { icon: Anchor, title: 'رحلات الموانئ', copy: 'استغل وقت توقف السفينة في رحلة تناسب موعدها.', href: '/egypt-tours/shore-excursions', image: siteImages.redSea },
  ] : [
    { icon: Sun, title: 'One-day tours', copy: 'A focused day in Cairo, Luxor, or the place calling you most.', href: '/egypt-tours/one-day-tours', image: siteImages.cairo },
    { icon: Route, title: 'Multi-day journeys', copy: 'More time to connect the places and stories across Egypt.', href: '/egypt-tours/multi-days-tours', image: siteImages.pyramids },
    { icon: Ship, title: 'Nile cruises', copy: 'Follow the river through the temples and landscapes of the south.', href: '/egypt-tours/nile-cruises', image: siteImages.nile },
    { icon: Anchor, title: 'Shore excursions', copy: 'Make a ship call count with a route shaped around port time.', href: '/egypt-tours/shore-excursions', image: siteImages.redSea },
  ]
  const steps = ar ? [
    { number: '01', title: 'احكِ لنا عن رحلتك', copy: 'المواعيد، عدد المسافرين، والأماكن التي تتمنى زيارتها.' },
    { number: '02', title: 'اختَر الإيقاع المناسب', copy: 'قارن بين رحلة جاهزة وطلب مخصص، وحدد ما يهمك فعلًا.' },
    { number: '03', title: 'راجع التفاصيل', copy: 'تأكد من البرنامج والسعر والمشمولات والتوقيت مع الفريق قبل الحجز.' },
  ] : [
    { number: '01', title: 'Tell us your plans', copy: 'Share your dates, travel party, and the places you hope to see.' },
    { number: '02', title: 'Find your rhythm', copy: 'Compare a listed journey with a tailored request and choose what matters.' },
    { number: '03', title: 'Confirm the details', copy: 'Review the itinerary, price, inclusions, and timing with the team before booking.' },
  ]

  const destinationCards = (duplicate: boolean) => featuredDestinations.map((item) => (
    <li key={`${duplicate ? 'copy' : 'original'}-${item.slug}`}>
      <Link href={`/destinations/${item.slug}`} tabIndex={duplicate ? -1 : undefined} className="about-destination-card" dir={ar ? 'rtl' : 'ltr'}>
        <Image src={item.detail.heroImage} alt={item.detail.heroAlt} fill sizes="(max-width: 760px) 230px, 310px" />
        <span>{ar ? destinationNames[item.slug] : item.title}<ArrowRight size={19} aria-hidden="true" /></span>
      </Link>
    </li>
  ))

  return <main className="about-page">
    <PageShowcaseHero image={destinations[1].detail.heroImage} eyebrow={ar ? 'اكتشف مصر معنا' : 'Discover Egypt with us'} title="STAR PYRAMIDS" intro={ar ? 'رحلات تنطلق من شغفك بالمكان، وتترك لك وقتًا لتعيش مصر بطريقتك.' : 'Journeys shaped around your curiosity, with room to experience Egypt at your own pace.'} primaryLabel={ar ? 'اعرف قصتنا' : 'Discover our story'} primaryHref="#our-story" secondaryLabel={ar ? 'شاهد طرق السفر' : 'See ways to travel'} secondaryHref="#travel-styles" railLabel={ar ? 'من نحن' : 'Who we are'} railTitle={ar ? 'مصر أكبر من قائمة أماكن.' : 'Egypt is more than a checklist.'} railHref="#our-story" railMeta={[{ Icon: Compass, label: ar ? 'رحلات داخل مصر' : 'Egypt-led journeys' }, { Icon: Clock3, label: ar ? 'بإيقاع يناسبك' : 'At your own pace' }]} statsLabel={ar ? 'ملخص التجربة' : 'Experience summary'} stats={[{ value: featuredDestinations.length, label: ar ? 'وجهات مختارة' : 'Featured places' }, { value: ways.length, label: ar ? 'طرق للسفر' : 'Ways to travel' }]}/>

    <section id="our-story" className="about-story about-section container" aria-labelledby="about-story-title">
      <div className="about-story-copy"><span className="eyebrow">{ar ? 'من نحن' : 'Who we are'}</span><h2 id="about-story-title">{ar ? 'مصر أكبر من قائمة أماكن.' : 'Egypt is more than a checklist.'}</h2><p>{ar ? 'في STAR PYRAMIDS نرى أن الرحلة الجيدة تجمع بين المعالم التي حلمت بها والتفاصيل الصغيرة التي تجعل المكان أقرب إليك. لهذا نعرض طرقًا مختلفة لاستكشاف مصر، من يوم واحد إلى رحلة تمتد بين مدنها.' : 'At STAR PYRAMIDS, a good journey makes room for the landmarks you have dreamed of and the smaller moments that bring a place closer. That is why we offer different ways to explore Egypt, from a single day to a journey across its cities.'}</p><p>{ar ? 'تصفح الرحلات والوجهات، أو أخبرنا بما تفكر فيه لنبدأ حوارًا حول برنامج يناسب وقتك واهتماماتك.' : 'Browse the journeys and destinations, or tell us what you have in mind to start a conversation about a route that fits your time and interests.'}</p><Link className="text-link" href="/contact">{ar ? 'تواصل معنا' : 'Talk to us'} <ArrowRight size={17}/></Link></div>
      <figure className="about-story-image"><Image src={siteImages.pyramids} alt={ar ? 'أبو الهول وأهرامات الجيزة' : 'The Sphinx and Pyramids of Giza'} fill sizes="(max-width: 900px) 100vw, 45vw" /><figcaption>{ar ? 'الجيزة، مصر' : 'Giza, Egypt'}</figcaption></figure>
    </section>

    <section className="about-values about-section" aria-labelledby="about-values-title"><div className="container"><div className="about-section-heading"><span className="eyebrow">{ar ? 'طريقتنا' : 'Our approach'}</span><h2 id="about-values-title">{ar ? 'التفاصيل تصنع الفرق.' : 'The details make the difference.'}</h2></div><div className="about-values-grid">{values.map(({icon:Icon,title,copy},index)=><article key={title}><span className="about-value-number">0{index+1}</span><Icon size={27} strokeWidth={1.7} aria-hidden="true"/><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>

    <section className="about-destinations about-section" aria-labelledby="about-destinations-title"><div className="container about-section-heading about-heading-row"><div><span className="eyebrow">{ar ? 'من مصر وإليها' : 'Across Egypt'}</span><h2 id="about-destinations-title">{ar ? 'لكل مكان حكاية مختلفة.' : 'Every place has a different story.'}</h2><p>{ar ? 'اختَر المكان الذي يلفت انتباهك، ودع الرحلة تبدأ من هناك.' : 'Follow the place that catches your eye and start your journey there.'}</p></div><button type="button" className="about-motion-toggle" aria-label={paused ? (ar ? 'تشغيل حركة الوجهات' : 'Play destination slider') : (ar ? 'إيقاف حركة الوجهات' : 'Pause destination slider')} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused ? <Play size={18} fill="currentColor"/> : <Pause size={18} fill="currentColor"/>}</button></div><div className="about-marquee-viewport" aria-label={ar ? 'وجهات مصر' : 'Egypt destinations'}><div className={`about-marquee-track${paused ? ' is-paused' : ''}`}><ul className="about-marquee-list">{destinationCards(false)}</ul><ul className="about-marquee-list" aria-hidden="true">{destinationCards(true)}</ul></div></div></section>

    <section id="travel-styles" className="about-ways about-section container" aria-labelledby="about-ways-title"><div className="about-section-heading about-ways-heading"><div><span className="eyebrow">{ar ? 'طرق السفر' : 'Ways to travel'}</span><h2 id="about-ways-title">{ar ? 'رحلة تناسب الوقت الذي لديك.' : 'A journey for the time you have.'}</h2></div><p>{ar ? 'من ساعات في مدينة واحدة إلى أيام على النيل، ابدأ بالشكل الأقرب لك.' : 'From a few hours in one city to days along the Nile, start with the format that feels right.'}</p></div><div className="about-ways-grid">{ways.map(({icon:Icon,title,copy,href,image},index)=><Link key={href} href={href} className="about-way-card" aria-label={title}><Image src={image} alt="" fill sizes="(max-width: 760px) 100vw, 55vw"/><span className="about-way-shade"/><span className="about-way-top"><span>0{index+1}</span><Icon size={25} strokeWidth={1.7} aria-hidden="true"/></span><span className="about-way-card-copy"><strong>{title}</strong><small>{copy}</small></span><span className="about-way-action" aria-hidden="true"><ArrowRight size={20}/></span></Link>)}</div></section>

    <section className="about-process about-section" aria-labelledby="about-process-title"><div className="container about-process-layout"><div className="about-process-intro"><span className="eyebrow">{ar ? 'من الفكرة إلى الرحلة' : 'From idea to itinerary'}</span><h2 id="about-process-title">{ar ? 'ابدأ بسؤال. وانطلق بخطة واضحة.' : 'Begin with a question. Go with a clear plan.'}</h2><p>{ar ? 'لا تحتاج إلى معرفة كل التفاصيل من البداية. ابدأ بما تعرفه، ثم راجع خياراتك قبل اتخاذ القرار.' : 'You do not need every answer at the start. Begin with what you know, then review your options before making a decision.'}</p><Link href="/make-your-trip" className="primary-btn">{ar ? 'ابدأ التخطيط' : 'Start planning'} <ArrowRight size={17}/></Link></div><ol className="about-process-steps">{steps.map(step=><li key={step.number}><span>{step.number}</span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>)}</ol></div></section>

    <section className="about-closing" aria-labelledby="about-closing-title"><Image src={destinations[2].detail.heroImage} alt="" fill sizes="100vw"/><div className="about-closing-shade"/><div className="container about-closing-content"><span className="about-kicker">{ar ? 'الرحلة التالية' : 'The next chapter'}</span><h2 id="about-closing-title">{ar ? 'مصر في انتظارك.' : 'Your Egypt is waiting.'}</h2><p>{ar ? 'اختر رحلة جاهزة أو احكِ لنا عن الرحلة التي تتخيلها.' : 'Choose a journey to explore or tell us the one you have in mind.'}</p><div className="about-hero-actions"><Link href="/trips" className="primary-btn">{ar ? 'شاهد كل الرحلات' : 'See all trips'} <ArrowRight size={17}/></Link><Link href="/contact" className="about-hero-link">{ar ? 'تواصل معنا' : 'Contact us'} <ArrowRight size={17}/></Link></div></div></section>
    <HelpCTA />
  </main>
}

export function AboutPage() {
  return <SiteShell><AboutContent /></SiteShell>
}
