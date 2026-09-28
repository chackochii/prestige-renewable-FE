// The fixed parts of a Prestige proposal: the letterhead, the acceptance
// steps, the disclaimers and the Commercial Terms and Conditions.
//
// These are the company's standing document, not per-job data — the quote
// supplies the customer, the system and the numbers, and everything here
// wraps around it. Keeping the wording in one place means a change to the
// terms is one edit, not a hunt through a PDF builder.

/** Letterhead and footer. A business unit may override any of these. */
export const COMPANY = {
  name: "Prestige Renewable Solutions",
  legalName: "Prestige Industrial Group Pty Ltd",
  abn: "73 632 138 295",
  address: "Unit 116, 14 Loyalty Rd, North Rocks NSW 2121",
  strapline: "SOLAR  •  BESS  •  EV CHARGING",
  wordmark: "PRESTIGE",
};

/** How long a proposal stands before it has to be repriced. */
export const VALIDITY_DAYS = 30;

export const NEXT_STEPS_INTRO =
  "To proceed with this proposal, please confirm your acceptance below. Once received, Prestige Renewable Solutions " +
  "will formally schedule the installation and lodge the required grid connection and CDC applications.";

export const NEXT_STEPS = [
  "Client signs and returns this proposal to confirm acceptance.",
  "A 10% deposit is invoiced on acceptance, with the balance due on practical completion.",
  "Grid connection approval will be lodged by Prestige Renewable Solutions on the client's behalf.",
  "CDC / DA approval: if the client has not separately engaged a certifier, Prestige will obtain a CDC/DA quote on the client's behalf.",
  "On the client's approval of that quote, Prestige will commence the CDC/DA approval process.",
  "Installation is scheduled and completed, followed by system commissioning and handover.",
];

export const ACCEPTANCE_NOTE =
  "By signing below, the Client confirms acceptance of this proposal, and acknowledges that it has read and understood " +
  "the Commercial Terms and Conditions set out in this document, has had the opportunity to obtain independent advice, " +
  "and agrees that they form part of the Agreement.";

export const ESTIMATE_DISCLAIMERS = [
  "Solar production, savings and payback figures are estimates based on modelled generation and site consumption data " +
    "available at the time of preparation. PRC incentive values are indicative; final figures are calculated and lodged " +
    "by an Accredited Certificate Provider. This proposal is not financial advice and does not constitute a binding " +
    "contract until formally accepted by both parties.",
  "Return on investment and payback calculations in this proposal are based on the best available information, " +
    "statistics and market intelligence at the time of preparation. They carry inherent risk from factors outside " +
    "Prestige Renewable Solutions' control, including electricity and export rate changes, government policy and " +
    "incentive scheme changes, and market price movements, and are not guaranteed. They should be treated as " +
    "indicative estimates only. Prestige recommends the client undertake its own research and due diligence, " +
    "including independent financial advice, before accepting this proposal.",
];

export const EQUIPMENT_COMPLIANCE_NOTE =
  "All equipment is CEC-approved and installed by CEC-accredited designers and installers, in line with AS/NZS 5033 " +
  "and AS/NZS 4777 standards.";

export const TERMS_PREAMBLE =
  "Supply and Installation of Battery Energy Storage, Solar, EV Charging, Electrical and Roofing Systems. " +
  `${COMPANY.legalName} ABN ${COMPANY.abn}, trading as ${COMPANY.name}.`;

export const TERMS_INTRO =
  "These Commercial Terms and Conditions apply to commercial installations. They form part of the Agreement together " +
  "with the Proposal, and govern the supply and installation of the Works described in this proposal.";

/**
 * The Commercial Terms and Conditions, numbered as they appear in the signed
 * document. Clause numbers are part of the contract — other clauses refer to
 * them — so they are written out rather than generated from array positions.
 */
export const COMMERCIAL_TERMS = [
  {
    n: 1,
    title: "DEFINITIONS AND INTERPRETATION",
    clauses: [
      [
        "1.1",
        '"Agreement" means the Proposal, these Commercial Terms and Conditions, all documents expressly incorporated by reference and each Variation agreed under clause 11.',
      ],
      ["1.2", '"Business Day" means a day other than a Saturday, Sunday or public holiday in New South Wales.'],
      ["1.3", '"Client" means the person or entity identified as the customer in the Proposal.'],
      [
        "1.4",
        '"Equipment" means all plant, batteries, inverters, solar panels, EV chargers, switchgear, cabling, monitoring equipment, roofing materials and other goods supplied for the Works.',
      ],
      ["1.5", '"Force Majeure Event" has the meaning in clause 23.'],
      [
        "1.6",
        '"Latent Condition" means a physical condition at, under or adjoining the Site that materially differs from conditions reasonably apparent from a non-invasive visual inspection or the information supplied before the Proposal.',
      ],
      ["1.7", '"Practical Completion" means the stage described in clause 15.'],
      [
        "1.8",
        '"Prestige", "we", "us" or "our" means Prestige Industrial Group Pty Ltd ABN 73 632 138 295 trading as Prestige Renewable Solutions. Subcontractors are not parties to the Agreement.',
      ],
      [
        "1.9",
        '"Proposal" means Prestige\'s quotation or proposal describing the Works, Equipment, price, assumptions, exclusions and payment schedule.',
      ],
      ["1.10", '"Site" means the installation location identified in the Proposal.'],
      [
        "1.11",
        '"System" means the completed battery energy storage, solar photovoltaic, EV charging, electrical, roofing or associated system described in the Proposal.',
      ],
      [
        "1.12",
        '"Variation" means an agreed change to the Works, Equipment, price, programme or other requirement of the Agreement.',
      ],
      [
        "1.13",
        '"Works" means the supply, design, installation, commissioning and other services expressly included in the Proposal.',
      ],
      [
        "1.14",
        "Headings do not affect interpretation. Including and similar expressions are not words of limitation. A reference to law includes amendments and replacements.",
      ],
    ],
  },
  {
    n: 2,
    title: "APPLICATION AND CONTRACT DOCUMENTS",
    clauses: [
      [
        "2.1",
        "The Agreement applies only to the commercial or industrial Works in the Proposal. The Client warrants that it is acquiring the Works wholly or predominantly for business purposes and will promptly notify Prestige if that is not correct.",
      ],
      [
        "2.2",
        "If documents conflict, the order of precedence is: an agreed Variation; the Proposal and its scope, pricing and special conditions; drawings and technical schedules expressly listed in the Proposal; and these Commercial Terms and Conditions.",
      ],
      [
        "2.3",
        "A purchase order issued by the Client is evidence of acceptance only. Terms printed on or incorporated into a Client purchase order do not amend the Agreement unless Prestige expressly accepts them in writing.",
      ],
      [
        "2.4",
        "Nothing in the Agreement excludes, restricts or modifies a right, guarantee or remedy that cannot lawfully be excluded, restricted or modified.",
      ],
    ],
  },
  {
    n: 3,
    title: "QUOTATION ACCEPTANCE AND AUTHORITY",
    clauses: [
      [
        "3.1",
        "The Proposal remains open for the validity period stated in it. After that period Prestige may withdraw or reprice it because of equipment cost, exchange rate, freight, regulatory, certificate market or availability changes.",
      ],
      [
        "3.2",
        "A binding Agreement forms when the Client accepts the Proposal in writing or by conduct, including issuing a purchase order or paying a deposit, and Prestige confirms the order or commences performance.",
      ],
      [
        "3.3",
        "Each person accepting or varying the Agreement warrants that they are authorised to bind the party for whom they act.",
      ],
    ],
  },
  {
    n: 4,
    title: "SCOPE DESIGN AND COMPLIANCE",
    clauses: [
      [
        "4.1",
        "Prestige will perform the Works with due care and skill, using appropriately licensed personnel, and in accordance with applicable laws, mandatory codes, network requirements and Australian Standards that apply to the Works at the time they are performed.",
      ],
      [
        "4.2",
        "The scope is limited to items expressly included in the Proposal. Any item described as excluded, optional, provisional, by others or subject to inspection is not included unless later added by Variation.",
      ],
      [
        "4.3",
        "Prestige may rely on plans, load profiles, bills, interval data, surveys, structural information, existing asset information and other information supplied by the Client or its advisers. The Client is responsible for the accuracy and completeness of that information.",
      ],
      [
        "4.4",
        "Prestige is not responsible for a defect caused solely by a Client design, specification or instruction where Prestige has notified the Client of a reasonably identifiable non-compliance or material risk and the Client directs Prestige to proceed, to the extent proceeding is lawful and safe.",
      ],
      [
        "4.5",
        "If specified Equipment becomes unavailable, Prestige may propose an equivalent or better substitute. A material substitution requires the Client's written approval, which must not be unreasonably withheld or delayed. Any price or programme effect will be addressed as a Variation.",
      ],
    ],
  },
  {
    n: 5,
    title: "APPROVALS GRID CONNECTION AND THIRD PARTIES",
    clauses: [
      [
        "5.1",
        "Prestige will obtain only approvals, applications and certificates expressly allocated to it in the Proposal. The Client must obtain and maintain all owner, landlord, financier, strata, body corporate, planning, development, access and operational consents allocated to it or not expressly included in Prestige's scope.",
      ],
      [
        "5.2",
        "DNSP, retailer, metering coordinator, council, certifier, telecommunications provider, Accredited Certificate Provider and other third-party decisions and timeframes are outside Prestige's control. Prestige does not guarantee approval, export capacity, meter completion, energisation dates, network availability or continued scheme eligibility.",
      ],
      [
        "5.3",
        "Prestige remains responsible for correcting a rejection, delay or additional requirement to the extent directly caused by Prestige's non-compliant design, documentation or workmanship. Other third-party requirements or changes are a Variation.",
      ],
    ],
  },
  {
    n: 6,
    title: "PRICE GST AND ADJUSTMENTS",
    clauses: [
      [
        "6.1",
        "The price is exclusive of GST unless the Proposal states otherwise. GST is payable in addition to the price when a taxable supply is made.",
      ],
      [
        "6.2",
        "The price is based on the assumptions, Site information, access arrangements, programme and existing conditions known at the Proposal date.",
      ],
      [
        "6.3",
        "The price may change only under an agreed Variation or an express adjustment mechanism in the Proposal. If the Client delays delivery or commencement by more than 30 days, Prestige may claim demonstrable increases in equipment, freight, labour, storage, exchange rate, tax or regulatory costs reasonably incurred because of the delay.",
      ],
    ],
  },
  {
    n: 7,
    title: "PAYMENT",
    clauses: [
      [
        "7.1",
        "The Client must pay the deposit and each progress claim in accordance with the Proposal. Unless the Proposal states otherwise, invoices are due within 14 days of issue without set-off or deduction except as required by law.",
      ],
      [
        "7.2",
        "The Client must notify Prestige of a genuine invoice dispute within five Business Days, identifying the amount and reasons. The Client must pay the undisputed portion by the due date.",
      ],
      [
        "7.3",
        "Overdue amounts accrue interest at 10 percent per annum, calculated daily, or the maximum lawful rate if lower. The Client must also reimburse reasonable debt recovery costs lawfully incurred.",
      ],
      [
        "7.4",
        "After giving at least five Business Days' written notice, Prestige may suspend procurement, delivery or work while an undisputed amount remains overdue. Prestige is entitled to a reasonable extension of time and its reasonable suspension, storage and remobilisation costs.",
      ],
      [
        "7.5",
        "Payment is not evidence that the Works are defect-free and does not affect either party's rights in relation to defects or breach.",
      ],
    ],
  },
  {
    n: 8,
    title: "TITLE RISK AND SECURITY",
    clauses: [
      [
        "8.1",
        "Risk in Equipment passes to the Client when delivered to the Site, except to the extent loss or damage is caused by Prestige or its subcontractors. The Client must keep the Site and delivered Equipment appropriately insured.",
      ],
      [
        "8.2",
        "Title to Equipment that has not become a fixture remains with Prestige until all amounts relating to that Equipment are paid. Until then the Client must not sell, encumber, relocate or dispose of it and must identify it as Prestige's property where reasonably practicable.",
      ],
      [
        "8.3",
        "The Agreement constitutes a security agreement. The Client grants Prestige a security interest in Equipment and proceeds to secure all amounts owing and authorises Prestige to register and maintain that interest under the Personal Property Securities Act 2009 Cth. The Client must reasonably assist with registration and enforcement.",
      ],
      [
        "8.4",
        "To the extent permitted by law, the Client waives notices that may be waived under the Personal Property Securities Act. Nothing authorises Prestige to enter premises or remove fixtures contrary to law.",
      ],
    ],
  },
  {
    n: 9,
    title: "CLIENT SITE AND OPERATIONAL OBLIGATIONS",
    clauses: [
      [
        "9.1",
        "The Client must provide timely, safe and unobstructed access, suitable parking and laydown areas, agreed working hours, amenities, utilities, isolations, inductions and a representative authorised to make Site decisions.",
      ],
      [
        "9.2",
        "The Client must disclose known hazards and relevant information about asbestos, hazardous materials, contamination, underground and concealed services, roof condition, structural limitations, fire systems, operational processes and hazardous areas.",
      ],
      [
        "9.3",
        "The Client must protect or relocate sensitive goods, vehicles, stock and equipment and coordinate its personnel and other contractors so they do not delay, obstruct or damage the Works.",
      ],
      [
        "9.4",
        "If the Site is unsafe or access is materially different from that allowed for, Prestige may stop work until the risk is controlled. The resulting time and reasonable cost consequences are a Variation unless caused by Prestige.",
      ],
      [
        "9.5",
        "Each party must comply with its work health and safety duties. The Agreement does not transfer a statutory duty that cannot lawfully be transferred.",
      ],
    ],
  },
  {
    n: 10,
    title: "LATENT CONDITIONS HAZARDOUS MATERIALS AND EXISTING ASSETS",
    clauses: [
      [
        "10.1",
        "Unless expressly included, the Proposal is based on a non-invasive visual assessment and does not include destructive investigation, structural certification, asbestos sampling, service locating or testing of concealed building elements.",
      ],
      [
        "10.2",
        "Prestige must notify the Client after becoming aware of a Latent Condition. Any investigation, redesign, protection, remediation, delay or additional work reasonably required because of that condition is a Variation, unless caused by Prestige.",
      ],
      [
        "10.3",
        "Prestige may stop work where suspected asbestos, contamination, unsafe wiring, structural instability or another material hazard is identified. Testing, removal and remediation must be performed by appropriately qualified persons and are excluded unless expressly included.",
      ],
      [
        "10.4",
        "Prestige is not responsible for failure of existing switchboards, cabling, roofs, structures, drainage, communications or other existing assets except to the extent caused by Prestige's failure to exercise due care and skill.",
      ],
    ],
  },
  {
    n: 11,
    title: "VARIATIONS",
    clauses: [
      [
        "11.1",
        "A Variation may arise from a Client request, a Latent Condition, changed law or authority requirement, inaccurate information, delayed access, unavailable Equipment, necessary safety work or another matter outside the original scope.",
      ],
      [
        "11.2",
        "Before commencing a Variation where reasonably practicable, Prestige will describe the change and its price and programme effect, and the Client must approve it in writing. Email approval by an authorised representative is sufficient.",
      ],
      [
        "11.3",
        "If urgent work is reasonably necessary to protect people, property or the Works, Prestige may make the Site safe and notify the Client promptly. The Client must pay the reasonable cost unless the urgent condition was caused by Prestige.",
      ],
      [
        "11.4",
        "Prestige is not obliged to perform a Variation until price and programme consequences are agreed, except for urgent safety work under clause 11.3.",
      ],
    ],
  },
  {
    n: 12,
    title: "ROOFING AND BUILDING ENVELOPE WORK",
    clauses: [
      [
        "12.1",
        "Roofing work includes only the areas, materials, penetrations, flashings, repairs, waterproofing and make-good expressly identified in the Proposal.",
      ],
      [
        "12.2",
        "Unless expressly included, Prestige does not warrant the general condition, remaining life or watertightness of the existing roof or building envelope. Prestige remains responsible for damage and water ingress directly caused by its defective penetrations, flashings, installation or failure to exercise due care and skill.",
      ],
      [
        "12.3",
        "Hidden corrosion, rotten battens, fragile sheets, defective membranes, non-compliant existing work, wet insulation, unsuitable framing, concealed services and other conditions not reasonably visible before work are Latent Conditions.",
      ],
      [
        "12.4",
        "Exact matching of aged tiles, sheets, coatings and finishes cannot be guaranteed where matching products are unavailable. Reasonably compatible replacements may be proposed for Client approval.",
      ],
      [
        "12.5",
        "The Client must disclose existing roof warranties and obtain any manufacturer or landlord consents not expressly allocated to Prestige. Prestige will comply with disclosed requirements that are provided before pricing; additional requirements may be a Variation.",
      ],
      [
        "12.6",
        "Scaffolding, edge protection, cranes, traffic control, roof replacement, structural strengthening, asbestos work and extensive weatherproofing are excluded unless expressly included.",
      ],
    ],
  },
  {
    n: 13,
    title: "SYSTEM PERFORMANCE AND OPERATING ASSUMPTIONS",
    clauses: [
      [
        "13.1",
        "Savings, generation, consumption, demand reduction, payback, export revenue, charging revenue and emissions figures are estimates based on stated assumptions and are not guaranteed.",
      ],
      [
        "13.2",
        "Actual outcomes may vary because of weather, shading, soiling, degradation, temperature, operating mode, load profile, electricity tariffs, export constraints, outages, curtailment, retailer arrangements, Client behaviour, maintenance and regulatory changes.",
      ],
      [
        "13.3",
        "Battery usable capacity, charge and discharge rate, cycle life, throughput, state of charge limits and degradation are subject to the Proposal, manufacturer specifications and operating conditions. Backup, black-start or uninterrupted supply is included only if expressly stated, and only nominated loads will be supported.",
      ],
      [
        "13.4",
        "Charging from solar PV, the grid or both depends on the specified inverter, controls, approvals and configuration. No charging source or operating mode is included unless identified in the Proposal.",
      ],
      [
        "13.5",
        "EV charger availability, billing, payment processing, roaming, software, SIM, cloud and network functions may depend on third-party services and ongoing fees. Prestige is not responsible for third-party outages or changes except to the extent Prestige separately supplies and breaches that service.",
      ],
    ],
  },
  {
    n: 14,
    title: "CERTIFICATES REBATES AND ENVIRONMENTAL PRODUCTS",
    clauses: [
      [
        "14.1",
        "PRC, STC and other certificate or rebate eligibility, quantity, timing and value are determined under applicable scheme rules and market conditions. Unless expressly guaranteed in the Proposal, figures are estimates only.",
      ],
      [
        "14.2",
        "Where the price includes an assumed certificate or rebate credit, the Proposal must identify the gross price, assumed credit and net amount payable. The Client assigns eligible rights to Prestige or its nominated provider and must promptly provide accurate eligibility information, signatures, access and evidence.",
      ],
      [
        "14.3",
        "The Client must pay a shortfall caused by market price changes, scheme changes, Client ineligibility, inaccurate Client information, prior assignments, access failure or Client delay. Prestige bears a shortfall to the extent directly caused by Prestige's calculation error, late lodgement or non-compliant work.",
      ],
      [
        "14.4",
        "Prestige is not responsible for changes in tariffs, retailer offers, export prices, tax treatment or government policy after the Proposal date. Financial models are commercial estimates and are not financial, tax or investment advice.",
      ],
    ],
  },
  {
    n: 15,
    title: "PRACTICAL COMPLETION COMMISSIONING AND HANDOVER",
    clauses: [
      [
        "15.1",
        "Practical Completion occurs when the Works are complete except for minor defects or omissions that do not prevent safe and substantially intended use, required commissioning within Prestige's control is complete, and the System is capable of operation to the extent permitted by available Site and network conditions.",
      ],
      [
        "15.2",
        "Pending DNSP, retailer, meter, certificate or other third-party action does not prevent Practical Completion if Prestige has completed its relevant obligations and the delay is not caused by Prestige. A Prestige-caused compliance or documentation issue must be corrected before the affected milestone is complete.",
      ],
      [
        "15.3",
        "Prestige will provide the handover documents included in the Proposal, which may include operating information, warranties, test results, as-built information and compliance certificates.",
      ],
      [
        "15.4",
        "The Client must inspect the Works promptly and provide one consolidated list of apparent minor defects within five Business Days after notice of Practical Completion. Prestige will rectify valid defects within a reasonable time. Minor defects do not entitle the Client to withhold payment exceeding a reasonable estimate of rectification cost.",
      ],
      [
        "15.5",
        "Practical Completion is deemed to occur if the Client takes beneficial use of the System, other than for agreed testing, or unreasonably prevents inspection or commissioning after receiving reasonable notice.",
      ],
    ],
  },
  {
    n: 16,
    title: "WARRANTIES AND DEFECTS",
    clauses: [
      [
        "16.1",
        "Manufacturer warranties apply on their published terms and are additional to rights that cannot be excluded by law. Prestige will provide available warranty documents and reasonably assist the Client to submit a valid manufacturer claim.",
      ],
      [
        "16.2",
        "Prestige warrants its installation workmanship for 12 months from Practical Completion, unless the Proposal states a longer period. Prestige will rectify a notified workmanship defect within a reasonable time.",
      ],
      [
        "16.3",
        "The warranty does not cover normal wear, expected battery or panel degradation, misuse, accident, vandalism, pest damage, unauthorised work, failure to maintain, operation outside specifications, Client or third-party changes, grid events, telecommunications failure, Force Majeure Events or defects in existing assets, except to the extent Prestige caused or contributed to the loss.",
      ],
      [
        "16.4",
        "The Client must notify Prestige promptly, provide reasonable diagnostic information and access, take reasonable steps to prevent further damage, and not arrange third-party repair without first giving Prestige a reasonable opportunity to inspect and rectify, except in an emergency.",
      ],
      [
        "16.5",
        "Removal, freight, access equipment and reinstallation costs for a manufacturer-only defect are payable as stated in the Proposal or manufacturer warranty, except to the extent the cost is recoverable from Prestige under a non-excludable law or results from Prestige's breach.",
      ],
    ],
  },
  {
    n: 17,
    title: "INTELLECTUAL PROPERTY AND DOCUMENTS",
    clauses: [
      [
        "17.1",
        "Each party retains ownership of intellectual property it owned before the Agreement. Prestige retains intellectual property in its methodologies, templates, calculations, designs and documents.",
      ],
      [
        "17.2",
        "After full payment, Prestige grants the Client a non-exclusive licence to use project-specific documents solely to operate, maintain and repair the System at the Site. The Client must not reuse them at another site or provide them to a competitor for replication without Prestige's written consent.",
      ],
      [
        "17.3",
        "The Client warrants that Prestige may use Client-supplied documents and indemnifies Prestige against third-party intellectual property claims arising from that use, except to the extent caused by Prestige's unauthorised use.",
      ],
    ],
  },
  {
    n: 18,
    title: "CONFIDENTIALITY DATA AND REMOTE ACCESS",
    clauses: [
      [
        "18.1",
        "Each party must protect the other party's confidential information and use it only for the Agreement, except where disclosure is required by law or reasonably made to professional advisers, insurers, financiers, subcontractors or scheme and network participants under equivalent confidentiality obligations.",
      ],
      [
        "18.2",
        "The Client authorises Prestige and relevant providers to collect and use Site, equipment, energy and contact data reasonably required to design, install, commission, monitor, support and administer the System and incentives, subject to applicable privacy law.",
      ],
      [
        "18.3",
        "The Client must maintain internet connectivity, accounts and credentials allocated to it, apply security updates and control user access. Prestige may use remote access only for authorised support, monitoring and configuration and must take reasonable security measures.",
      ],
    ],
  },
  {
    n: 19,
    title: "SUBCONTRACTING PERSONNEL AND SITE COORDINATION",
    clauses: [
      [
        "19.1",
        "Prestige may engage suitably qualified subcontractors and remains responsible for their work as if it were performed by Prestige, subject to the Agreement.",
      ],
      [
        "19.2",
        "The Client must coordinate its employees, tenants, agents and other contractors. Prestige is entitled to an extension of time and reasonable additional cost for interference, rework or delay caused by them.",
      ],
    ],
  },
  {
    n: 20,
    title: "INSURANCE",
    clauses: [
      [
        "20.1",
        "Prestige will maintain public liability insurance and workers compensation insurance as required by law while performing the Works and will provide evidence on reasonable request.",
      ],
      [
        "20.2",
        "The Client must maintain appropriate property, plant, business interruption and public liability insurance for the Site, existing assets and its operations. The Client must notify its insurer of the Works where required.",
      ],
      ["20.3", "Insurance does not limit a party's liability under the Agreement."],
    ],
  },
  {
    n: 21,
    title: "LIABILITY",
    clauses: [
      [
        "21.1",
        "To the maximum extent permitted by law, Prestige's aggregate liability arising out of or in connection with the Agreement, whether in contract, tort including negligence, statute or otherwise, is limited to the total price paid or payable under the Agreement.",
      ],
      [
        "21.2",
        "The cap in clause 21.1 does not apply to liability that cannot lawfully be limited, death or personal injury caused by negligence, fraud, wilful misconduct, or infringement of third-party intellectual property rights.",
      ],
      [
        "21.3",
        "To the maximum extent permitted by law, neither party is liable to the other for indirect or consequential loss, loss of profit, loss of revenue, loss of production, loss of opportunity, loss of goodwill or anticipated savings, except that this exclusion does not limit the Client's obligation to pay the price or amounts expressly payable under the Agreement.",
      ],
      [
        "21.4",
        "Prestige is not liable for loss arising from inaccurate Client information, Client or third-party acts, existing asset failure, network or utility events, tariff or scheme changes, or operation contrary to instructions, except to the extent Prestige caused or contributed to the loss.",
      ],
      [
        "21.5",
        "Where a guarantee under the Australian Consumer Law applies and liability may lawfully be limited, Prestige's liability is limited, at its option and to the extent fair and reasonable, to replacing or repairing goods, supplying equivalent goods, supplying services again, or paying the reasonable cost of those remedies.",
      ],
      [
        "21.6",
        "Each party must take reasonable steps to mitigate loss. Liability is reduced to the extent the other party or a third party caused or contributed to the loss.",
      ],
    ],
  },
  {
    n: 22,
    title: "CLIENT INDEMNITY",
    clauses: [
      [
        "22.1",
        "The Client indemnifies Prestige against third-party claims and reasonable loss arising from the Client's breach, negligence, wilful misconduct, inaccurate information, undisclosed Site hazard, unlawful instruction or infringement of intellectual property rights.",
      ],
      [
        "22.2",
        "The indemnity is reduced to the extent the loss was caused or contributed to by Prestige or its subcontractors and does not apply to indirect loss excluded under clause 21.",
      ],
    ],
  },
  {
    n: 23,
    title: "DELAY AND FORCE MAJEURE",
    clauses: [
      [
        "23.1",
        "Dates are estimates unless the Proposal expressly states they are fixed. Prestige is entitled to a reasonable extension for Variation, Client delay, restricted access, unsafe conditions, weather, authority or network delay, industrial action, transport or supply disruption, cyber incident, epidemic, natural disaster, change in law or another event beyond Prestige's reasonable control.",
      ],
      [
        "23.2",
        "The affected party must notify the other party and take reasonable steps to reduce the effect. Payment obligations for completed work and committed Equipment are not suspended by a Force Majeure Event.",
      ],
      [
        "23.3",
        "If a Force Majeure Event prevents substantial performance for more than 90 consecutive days, either party may terminate the affected unperformed portion on written notice. The Client must pay for work performed, Equipment ordered that cannot reasonably be cancelled or returned, and reasonable demobilisation and storage costs.",
      ],
    ],
  },
  {
    n: 24,
    title: "SUSPENSION AND TERMINATION",
    clauses: [
      [
        "24.1",
        "Either party may terminate for a material breach not remedied within 10 Business Days after written notice, or immediately where the breach cannot be remedied, subject to any mandatory law.",
      ],
      [
        "24.2",
        "Prestige may suspend or terminate on written notice for persistent non-payment, repeated denial of access, an unresolved serious safety risk, unlawful instruction or insolvency event, to the extent permitted by law.",
      ],
      [
        "24.3",
        "The Client may terminate for convenience on written notice. The Client must pay for work performed, Equipment ordered or committed, supplier cancellation or restocking charges, demobilisation, storage and other reasonable costs arising from termination, less costs reasonably avoided by Prestige.",
      ],
      [
        "24.4",
        "On termination, accrued rights continue. Clauses concerning payment, title, security, warranties, confidentiality, intellectual property, liability, indemnity and dispute resolution survive.",
      ],
    ],
  },
  {
    n: 25,
    title: "DISPUTE RESOLUTION",
    clauses: [
      [
        "25.1",
        "A party claiming a dispute must give written notice describing it. Senior representatives must meet or confer in good faith within 10 Business Days to attempt resolution.",
      ],
      [
        "25.2",
        "If unresolved, either party may propose mediation by a mutually agreed mediator. Unless urgent, the parties should attempt mediation before substantive court proceedings.",
      ],
      [
        "25.3",
        "Nothing prevents urgent injunctive relief, debt recovery, exercise of a security right, or use of rights under applicable security of payment legislation.",
      ],
    ],
  },
  {
    n: 26,
    title: "GENERAL",
    clauses: [
      [
        "26.1",
        "The Agreement is governed by New South Wales law and the parties submit to the non-exclusive jurisdiction of its courts and tribunals.",
      ],
      [
        "26.2",
        "Prestige may assign receivables or subcontract performance. Neither party may otherwise assign the Agreement without the other's prior written consent, not to be unreasonably withheld, except to a related body corporate with equivalent financial capacity.",
      ],
      [
        "26.3",
        "A notice may be delivered personally or sent to the postal or email address stated in the Proposal. Email is received when it enters the recipient's information system unless the sender receives a failure notice.",
      ],
      ["26.4", "A waiver must be in writing. Delay or failure to exercise a right is not a waiver."],
      [
        "26.5",
        "If a provision is invalid or unenforceable, it is read down to the minimum extent necessary or severed, and the remainder continues.",
      ],
      [
        "26.6",
        "The Agreement constitutes the entire agreement about its subject matter, but does not exclude liability for fraud, misleading conduct or a representation that cannot lawfully be excluded.",
      ],
      [
        "26.7",
        "The Agreement may be signed electronically and in counterparts. Each counterpart forms one instrument.",
      ],
    ],
  },
];
