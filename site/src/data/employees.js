/*
 * The six AI agents on the WhatsApp page, as the "Meet your new team" cards
 * tell them: who they are, a sample shift (customer ⇄ agent) and what got
 * done, the tools they work with, and the accent colour of each card. Four
 * are small-business jobs, two (dealer network, HR) are for bigger companies.
 * The hero's flip stage has its own data, agents.js, with the same six.
 */
export const EMPLOYEES = [
  {
    key: 'sales',
    name: 'Priya',
    role: 'Sales AI Agent',
    who: 'D2C · retail · jewellery',
    job: 'Sells from your catalog, checks stock, holds the item, sends the pay link.',
    shift: [
      ['in', 'Green wala kundan choker hai? Size adjust hoga?'],
      ['out', 'Haan, green mein hai, ₹2,499 after the offer. 24 hrs ke liye hold kar doon? Size ke liye Meera abhi join karengi.'],
    ],
    done: 'Held · pay link sent · Meera looped in',
    tools: ['Catalog', 'Payments', 'Handoff'],
    color: '#E2571E',
  },
  {
    key: 'leads',
    name: 'Arjun',
    role: 'Leads AI Agent',
    who: 'Real estate · cars · solar',
    job: 'Answers every ad click in seconds, asks the four questions, scores the lead, hands the hot ones to sales.',
    shift: [
      ['in', 'Saw your 3BHK ad. Price?'],
      ['out', 'Starts at ₹1.2 Cr, possession Dec 2027. Is this to move in or to invest, and is ₹1.2–1.5 Cr your range?'],
    ],
    done: 'Scored 82 · site visit Sat 11 am · assigned to Rohit',
    tools: ['Ads', 'CRM', 'Calendar'],
    color: '#1F3A5F',
  },
  {
    key: 'reception',
    name: 'Meera',
    role: 'Bookings AI Agent',
    who: 'Clinics · salons · labs',
    job: 'Books, reschedules and reminds. Fills a cancelled slot from the waitlist.',
    shift: [
      ['in', 'Cleaning appointment this Saturday?'],
      ['out', 'Dr Mehta has 11 am and 4 pm free on Saturday. Which one suits you?'],
    ],
    done: 'Booked 4 pm · reminder 24 h before · waitlist cleared',
    tools: ['Calendar', 'Reminders'],
    color: '#F0A32F',
  },
  {
    key: 'collections',
    name: 'Sunita',
    role: 'Collections AI Agent',
    who: 'Coaching · gyms · receivables',
    job: "Polite fee, EMI and invoice reminders in the customer's language, a UPI link, and an escalation for the stubborn ones.",
    shift: [
      ['out', "Namaste Sunita ji, Aarav's April fee of ₹6,000 is due Friday. You can pay here 👇"],
      ['in', 'Done, paid just now'],
    ],
    done: 'Paid via UPI · receipt sent · ledger updated',
    tools: ['Payments', 'ERP'],
    color: '#8E1F1F',
  },
  {
    key: 'dealer',
    name: 'Rajat',
    role: 'Dealer Network AI Agent',
    who: 'Manufacturers · 100+ dealers',
    job: 'Your dealers order, check depot stock, see schemes and file claims on WhatsApp. Orders land in SAP or Tally.',
    shift: [
      ['in', '120 units Model X, Diwali scheme lagega?'],
      ['out', 'Haan, 5% Diwali scheme till 31 Oct. 340 in stock at Bhiwandi. ₹9.6 L net, confirm karoon?'],
    ],
    done: 'Order D-214 in SAP · claim #1182 approved',
    tools: ['ERP', 'Schemes', 'Claims'],
    color: '#2B3A42',
  },
  {
    key: 'hr',
    name: 'Nisha',
    role: 'HR Helpdesk AI Agent',
    who: 'Companies with 100+ staff',
    job: 'Leave, payslips, policies, attendance and day-one onboarding for every employee, in their language.',
    shift: [
      ['in', 'August ka payslip bhej do, aur 12–14 Oct leave chahiye'],
      ['out', 'Payslip attached. 12–14 Oct leave sent to Ramesh for approval; you have 9 days left this year.'],
    ],
    done: 'Payslip PDF sent · leave approved · HRMS updated',
    tools: ['HRMS', 'Payroll', 'Handoff'],
    color: '#6B2D5C',
  },
]
