import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { ReviewMarquee } from '@/components/review-marquee'
const render=(ids:string[])=>renderToStaticMarkup(createElement(ReviewMarquee<{id:string}>,{ariaLabel:'Customer reviews',items:ids.map(id=>({id})),getKey:item=>item.id,renderItem:(item,clone)=>createElement('article',{'data-review':item.id,'data-clone':clone},'Real review '+item.id)}))
it.each([1,2,3])('shows %s real reviews once each, without artificial marquee repeats',count=>{const html=render(Array.from({length:count},(_,i)=>String(i)));expect((html.match(/<article/g)||[]).length).toBe(count);expect(html).toContain('rev-marquee-static');expect(html).not.toContain('rev-marquee-track');expect(html).not.toContain('aria-hidden')})
it('deduplicates repeated public IDs without merging different reviews with identical text',()=>{const html=render(['same','same','other']);expect((html.match(/<article/g)||[]).length).toBe(2)})
it('retains one accessible review set and an aria-hidden animation clone for a populated rail',()=>{const html=render(['a','b','c','d']);expect((html.match(/data-clone="false"/g)||[]).length).toBe(4);expect((html.match(/data-clone="true"/g)||[]).length).toBe(4);expect(html).toContain('rev-marquee-track');expect(html).toContain('aria-hidden="true"')})
it('has no fabricated cards for an empty feed',()=>{expect(render([])).toBe('')})
