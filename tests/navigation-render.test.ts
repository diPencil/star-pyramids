import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NavigationMenu } from '@/components/navigation-menu'
import { defaultNavigation, type PublicNavigation } from '@/lib/navigation'
const menu=():PublicNavigation=>({revision:1,primaryLocale:'en',items:defaultNavigation().items.map(row=>({...row,href:row.target?.type==='internal'?row.target.href:undefined,children:row.children.map(child=>({...child,href:child.target?.type==='internal'?child.target.href:undefined,children:[]}))}))})
const render=(navigation=menu(),mobile=false,locale='en',preview=false,actions=false)=>renderToStaticMarkup(createElement(NavigationMenu,{navigation,mobile,locale,preview,actions,pathname:'/rent-car',idPrefix:'test'}))
describe('published navigation public markup',()=>{
 it('uses the existing desktop dropdown classes, aria-controls and active links',()=>{const html=render();expect(html).toContain('class="nav-dropdown"');expect(html).toContain('aria-controls="test-tours"');expect(html).toMatch(/<a[^>]*class="active"[^>]*href="\/rent-car"/);expect(html).not.toContain('mobile-plan');expect(html).not.toContain('href="/make-your-trip"')})
 it('uses mobile drawer section headings and original group ordering',()=>{const html=render(menu(),true);expect(html).toContain('<section><h2>Egypt Tours</h2>');expect(html).toContain('Plan &amp; discover');expect(html).toContain('Help &amp; company');expect(html.match(/href="\/special-offers"/g)).toHaveLength(1);expect(html).not.toContain('role="menuitem"')})
 it.each([['es','Alquilar coche'],['it','Noleggio auto']] as const)('renders %s labels in desktop and mobile', (locale,label)=>{expect(render(menu(),false,locale)).toContain(label);expect(render(menu(),true,locale)).toContain(label)})
 it('keeps empty/disabled published menus empty and honors primary-language fallback',()=>{expect(render({...menu(),items:[]})).not.toContain('<a');const nav=menu();nav.items[2].labels.it='';expect(render(nav,false,'it')).toContain('Rent Car');nav.items[2].enabled=false;expect(render(nav)).not.toContain('href="/rent-car"')})
 it('applies safe target attributes and separates the editable action slot',()=>{const nav=menu();nav.items[2].newTab=true;expect(render(nav)).toContain('target="_blank" rel="noopener noreferrer"');expect(render(nav,false,'en',true)).not.toContain('target="_blank"');expect(render(nav,false,'en',false,true)).toContain('make-trip-link');expect(render(nav,false,'en',false,true)).toContain('href="/make-your-trip"')})
})
