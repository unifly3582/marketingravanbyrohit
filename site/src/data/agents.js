/*
 * The six AI agents in the WhatsApp page's hero flip stage. Each is one
 * generated frame per shape (scripts/gen-employees.mjs →
 * scripts/employees-frames.py): the card, the person, the assets and the
 * text are all in the picture, with the flat page around them cut to
 * transparency so only the card and its assets turn. `wide` is the desktop
 * frame (4:3), `tall` the phone frame (3:4); `page` is the colour that was
 * cut away, painted on the hero behind.
 */
import salesWide from '../assets/agents/sales-wide.webp'
import salesTall from '../assets/agents/sales-tall.webp'
import leadsWide from '../assets/agents/leads-wide.webp'
import leadsTall from '../assets/agents/leads-tall.webp'
import receptionWide from '../assets/agents/reception-wide.webp'
import receptionTall from '../assets/agents/reception-tall.webp'
import collectionsWide from '../assets/agents/collections-wide.webp'
import collectionsTall from '../assets/agents/collections-tall.webp'
import dealerWide from '../assets/agents/dealer-wide.webp'
import dealerTall from '../assets/agents/dealer-tall.webp'
import hrWide from '../assets/agents/hr-wide.webp'
import hrTall from '../assets/agents/hr-tall.webp'

export const AGENTS = [
  {
    key: 'sales', name: 'Priya', role: 'Sales AI Agent', dot: '#E2571E',
    wide: { src: salesWide, page: '#FDDECC' },
    tall: { src: salesTall, page: '#FAE1D4' },
  },
  {
    key: 'leads', name: 'Arjun', role: 'Leads AI Agent', dot: '#1F3A5F',
    wide: { src: leadsWide, page: '#E0E9F3' },
    tall: { src: leadsTall, page: '#E3ECF5' },
  },
  {
    key: 'reception', name: 'Meera', role: 'Bookings AI Agent', dot: '#F0A32F',
    wide: { src: receptionWide, page: '#FCEBCF' },
    tall: { src: receptionTall, page: '#FCEDD1' },
  },
  {
    key: 'collections', name: 'Sunita', role: 'Collections AI Agent', dot: '#8E1F1F',
    wide: { src: collectionsWide, page: '#EED9D8' },
    tall: { src: collectionsTall, page: '#F1DEDD' },
  },
  {
    key: 'dealer', name: 'Rajat', role: 'Dealer Network AI Agent', dot: '#2B3A42',
    wide: { src: dealerWide, page: '#DFE9ED' },
    tall: { src: dealerTall, page: '#DBE7EB' },
  },
  {
    key: 'hr', name: 'Nisha', role: 'HR Helpdesk AI Agent', dot: '#6B2D5C',
    wide: { src: hrWide, page: '#EDD9E8' },
    tall: { src: hrTall, page: '#EFE1EE' },
  },
]
