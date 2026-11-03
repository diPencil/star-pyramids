import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {beforeEach,it,expect,vi} from 'vitest'
import type {DirectoryCustomer,CustomerDetail,GuestBookingContact} from '@/lib/admin-customers-client'
const state=vi.hoisted(()=>({accounts:[] as DirectoryCustomer[],guests:[] as GuestBookingContact[],canGuests:true,canRecovery:false,detail:null as CustomerDetail|null,recovery:vi.fn()}))
vi.mock('@/lib/admin-customers-client',()=>({useDbCustomersStatus:()=>({data:state.accounts,guestContacts:state.guests,canViewGuestContacts:state.canGuests,canRequestGuestRecovery:state.canRecovery,viewerPermissions:[],loading:false,error:null,retry:vi.fn(),refresh:vi.fn()}),useDbCustomerDetail:()=>({data:state.detail,canPreview:false,canManage:false,loading:false,error:null,retry:vi.fn(),refresh:vi.fn()}),mutateCustomerStatus:vi.fn(),requestGuestCrmRecovery:state.recovery}))
vi.mock('@/components/admin/admin-currency',()=>({useAdminCurrency:()=>({formatUsd:(value:number)=>`USD ${value}`})}))
vi.mock('@/components/shared-select',()=>({SharedSelect:()=>null}))
import CustomersPage from '@/app/admin/customers/page'
import {CustomerDetailContent} from '@/app/admin/customers/[key]/content'
const date='2026-11-03T10:00:00Z'
const account:DirectoryCustomer={publicId:'registered',email:'registered@example.com',firstName:'Registered',lastName:'Customer',displayName:'Registered Customer',username:null,countryCode:null,phone:null,avatar:null,status:'ACTIVE',emailVerifiedAt:date,lastLoginAt:null,createdAt:date,bookingsCount:1,tripsCount:2,totalSpent:620,confirmedSpent:0,lastBookingAt:date}
beforeEach(()=>{state.accounts=[];state.guests=[{reference:'SP-BK-TEST01',displayName:'Legacy Guest',email:'guest@example.com',phone:'+201234567890',createdAt:date,status:'PENDING',currency:'USD',total:620,tripsCount:2}];state.canGuests=true;state.canRecovery=false;state.recovery.mockClear();state.detail=null})
it('renders an old guest in CRM even with no registered customer, with only a booking-view action',()=>{
  const html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).toContain('Guest booking contacts');expect(html).toContain('Legacy Guest');expect(html).toContain('guest@example.com')
  expect(html).toContain('href="/admin/bookings/SP-BK-TEST01"');expect(html).not.toContain('/admin/customers/SP-BK-TEST01')
  expect(html).toContain('<td>2</td>');expect(html).toContain('no account access')
})
it('does not render guest PII when the server capability is absent',()=>{
  state.canGuests=false
  const html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).not.toContain('Legacy Guest');expect(html).not.toContain('guest@example.com')
})
it('shows account booking and trip counts as separate columns',()=>{
  state.accounts=[account]
  const html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).toContain('Trips');expect(html).toContain('<td>1</td>');expect(html).toContain('<td>2</td>')
})
it('the customer profile lists both titles and the two-trip count within one booking',()=>{
  state.detail={...account,bookings:[{reference:'SP-BK-TEST01',status:'PENDING',paymentStatus:'PENDING',currency:'USD',total:620,createdAt:date,items:[{tourSlug:'alexandria',tourTitle:'Alexandria',travelDate:'',guests:2},{tourSlug:'ancient',tourTitle:'Ancient Wonders',travelDate:'',guests:2}]}],tripRequests:[],carRequests:[],eventRequests:[],payments:[],favorites:[],conversations:[]}
  const html=renderToStaticMarkup(createElement(CustomerDetailContent,{customerKey:'registered'}))
  expect(html).toContain('Alexandria · Ancient Wonders');expect(html).toContain('<td>2</td>');expect(html).toContain('<td>4</td>')
  state.detail={...state.detail,collectedValue:null}
  const restricted=renderToStaticMarkup(createElement(CustomerDetailContent,{customerKey:'registered'}))
  expect(restricted).toContain('Payment records restricted');expect(restricted).not.toContain('No payments yet')
})
it('pagination totals include all contacts while showing only ten booking rows',()=>{
  state.guests=Array.from({length:12},(_,i)=>({...state.guests[0],reference:`REF${i}`,displayName:`Unique guest ${i}`}))
  const html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).toContain('12 guest booking contacts');expect(html).toContain('Showing 1-10 of 12')
  expect(html).toContain('Unique guest 9');expect(html).not.toContain('Unique guest 10')
})
it('reports multi-currency booked and confirmed values independently of collected money',()=>{
  state.accounts=[{...account,bookedValue:[{currency:'EUR',amount:50},{currency:'USD',amount:620}],confirmedValue:[{currency:'EUR',amount:50}],collectedValue:null}]
  const html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).toContain('EUR');expect(html).toContain('USD');expect(html).toContain('Restricted')
  expect(html).not.toContain('$670');expect(html).toContain('Registered')
})
it('shows pending verification separately and exposes recovery only via an explicit capability',()=>{
  state.accounts=[{...account,status:'PENDING',emailVerifiedAt:null}]
  let html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).toContain('Pending verification');expect(html).not.toContain('Email recovery link for')
  state.canRecovery=true
  html=renderToStaticMarkup(createElement(CustomersPage))
  expect(html).toContain('Email recovery link for SP-BK-TEST01');expect(state.recovery).not.toHaveBeenCalled()
})
