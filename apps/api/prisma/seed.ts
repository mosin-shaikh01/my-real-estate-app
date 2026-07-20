import { hash } from '@node-rs/argon2'
import {
  AGENT_PERMISSIONS,
  NOTIFICATION_TEMPLATE_KEYS,
  PERMISSIONS,
  PUBLIC_PERMISSIONS,
  ROLE_SLUGS,
  SUPER_ADMIN_PERMISSIONS,
  TEMPLATE_LABELS,
  type PermissionKey,
} from '@app/shared'
import { prisma } from '../src/lib/prisma.js'
import { DEFAULT_TEMPLATES } from '../src/notification/templates/default-templates.js'

// ============================================================================
// SEED — idempotent. Safe to run repeatedly; never destructive.
// ============================================================================
// The permission catalog is UPSERTED from packages/shared on every run. That
// is the mechanism behind "add a key, restart, admin can assign it" — the
// catalog is code, the assignment is data.
// ============================================================================

const AMENITIES = [
  { name: 'Swimming Pool', category: 'Recreation' },
  { name: 'Gymnasium', category: 'Recreation' },
  { name: 'Clubhouse', category: 'Recreation' },
  { name: "Children's Play Area", category: 'Recreation' },
  { name: 'Landscaped Garden', category: 'Recreation' },
  { name: 'Covered Parking', category: 'Parking' },
  { name: 'Visitor Parking', category: 'Parking' },
  { name: '24x7 Security', category: 'Safety' },
  { name: 'CCTV Surveillance', category: 'Safety' },
  { name: 'Fire Safety', category: 'Safety' },
  { name: 'Power Backup', category: 'Utilities' },
  { name: 'Lift', category: 'Utilities' },
  { name: 'Water Supply 24x7', category: 'Utilities' },
  { name: 'Rainwater Harvesting', category: 'Utilities' },
  { name: 'Vastu Compliant', category: 'Other' },
  { name: 'Gated Community', category: 'Other' },
  { name: 'Pet Friendly', category: 'Other' },
  { name: 'Modular Kitchen', category: 'Interior' },
  { name: 'Wardrobes', category: 'Interior' },
  { name: 'Balcony', category: 'Interior' },
]

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/** Digits only, India country code stripped. Must match the API's normaliser. */
const normalisePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('91') && digits.length > 10 ? digits.slice(-10) : digits
}

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    const field = 'field' in p ? (p.field as string) : null
    await prisma.permission.upsert({
      where: { key: p.key },
      create: {
        key: p.key,
        resource: p.resource,
        action: p.action,
        field,
        description: p.description,
      },
      update: { resource: p.resource, action: p.action, field, description: p.description },
    })
  }

  // Prune permissions that have left the code catalog. Without this, a removed
  // key lingers as an orphan row — invisible until something enumerates every
  // Permission (the roles editor does), where it shows as a grantable-but-dead
  // permission. Cascade clears its role/user grants too. The catalog is the
  // single source of truth; the table must not drift above it.
  const pruned = await prisma.permission.deleteMany({
    where: { key: { notIn: PERMISSIONS.map((p) => p.key) } },
  })
  console.log(
    `  permissions: ${PERMISSIONS.length} upserted${pruned.count ? `, ${pruned.count} stale pruned` : ''}`,
  )
}

async function seedRole(slug: string, name: string, description: string, keys: readonly PermissionKey[]) {
  const role = await prisma.role.upsert({
    where: { slug },
    create: { slug, name, description, isSystem: true },
    update: { name, description },
  })

  const perms = await prisma.permission.findMany({
    where: { key: { in: [...keys] } },
    select: { id: true },
  })

  // Replace the mapping wholesale so removing a key from the catalog actually
  // revokes it on the next seed.
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
  await prisma.rolePermission.createMany({
    data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  })

  console.log(`  role ${slug}: ${perms.length} permissions`)
  return role
}

async function main() {
  console.log('Seeding...')

  await seedPermissions()

  const superAdminRole = await seedRole(
    ROLE_SLUGS.SUPER_ADMIN,
    'Super Admin',
    'Unrestricted access to everything.',
    SUPER_ADMIN_PERMISSIONS,
  )
  const agentRole = await seedRole(
    ROLE_SLUGS.AGENT,
    'Agent',
    'Sees only assigned clients and properties. Cannot delete or manage permissions.',
    AGENT_PERMISSIONS,
  )
  await seedRole(
    ROLE_SLUGS.PUBLIC,
    'Public',
    'Anonymous visitor to the future public listing site. Published listings only.',
    PUBLIC_PERMISSIONS,
  )

  // --- App settings (singleton) -----------------------------------------
  // Seed sensible demo branding so the app looks configured out of the box.
  // Upsert on the singleton, so re-running never creates a duplicate.
  await prisma.appSetting.upsert({
    where: { singleton: true },
    create: {
      singleton: true,
      crmName: 'Estate',
      tagline: 'Property, client and agent management',
      primaryColor: '#4f46e5',
      companyName: 'Estate Realty Pvt. Ltd.',
      ownerName: 'Priya Deshmukh',
      email: 'hello@estate.local',
      phone: '+91 22 4000 1000',
      mobile: '+91 98765 43210',
      website: 'https://estate.local',
      addressLine1: '4th Floor, Trade Tower, BKC',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      pincode: '400051',
      businessHours: 'Mon–Sat, 10:00–19:00 IST',
      description: 'A modern real-estate CRM for property, client and agent management.',
    },
    update: {},
  })
  console.log('  app settings: singleton upserted')

  // --- Notification templates -------------------------------------------
  // Create-only: seed the built-in defaults but NEVER overwrite an admin's
  // edits on a re-run (update is a no-op).
  for (const key of NOTIFICATION_TEMPLATE_KEYS) {
    const def = DEFAULT_TEMPLATES[key]
    await prisma.notificationTemplate.upsert({
      where: { key },
      create: {
        key,
        name: TEMPLATE_LABELS[key],
        channel: 'email',
        subject: def.subject,
        bodyHtml: def.bodyHtml,
      },
      update: {},
    })
  }
  console.log(`  notification templates: ${NOTIFICATION_TEMPLATE_KEYS.length} upserted`)

  // --- Amenities ---------------------------------------------------------
  for (const a of AMENITIES) {
    await prisma.amenity.upsert({
      where: { slug: slugify(a.name) },
      create: { name: a.name, slug: slugify(a.name), category: a.category },
      update: { category: a.category },
    })
  }
  console.log(`  amenities: ${AMENITIES.length} upserted`)

  // --- Users -------------------------------------------------------------
  // Dev credentials only. The real app has no registration endpoint; admins
  // create agents. Password is intentionally weak for demo convenience and is
  // never a production concern -- see docs/DEVELOPMENT_RULES.md.
  const devPassword = await hash('Passw0rd!')

  const admin = await prisma.user.upsert({
    where: { id: 'seed-admin' },
    create: {
      id: 'seed-admin',
      email: 'admin@demo.local',
      passwordHash: devPassword,
      fullName: 'Priya Deshmukh',
      phone: '+91 98200 11223',
      status: 'ACTIVE',
    },
    // Reset identity + password + status on reseed: a demo database drifts
    // (a test changes a password, an edit renames the admin), and reseed should
    // return it to a known-good login. Without this, `npm run db:seed` leaves a
    // changed password in place and the demo credentials silently stop working.
    update: {
      email: 'admin@demo.local',
      passwordHash: devPassword,
      fullName: 'Priya Deshmukh',
      phone: '+91 98200 11223',
      status: 'ACTIVE',
    },
  })
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
    create: { userId: admin.id, roleId: superAdminRole.id },
    update: {},
  })

  const agentSpecs = [
    { id: 'seed-agent-1', email: 'agent@demo.local', name: 'Rohan Kulkarni', phone: '+91 98201 44556', rate: '2.00', exp: 6, spec: 'Residential — Western suburbs' },
    { id: 'seed-agent-2', email: 'agent2@demo.local', name: 'Aisha Khan', phone: '+91 98202 77889', rate: '2.50', exp: 3, spec: 'Commercial leasing' },
  ]

  const agents = []
  for (const a of agentSpecs) {
    const user = await prisma.user.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        email: a.email,
        passwordHash: devPassword,
        fullName: a.name,
        phone: a.phone,
        status: 'ACTIVE',
      },
      // Restore identity + password + status on reseed — see the admin above.
      // Also clears any per-agent permission overrides a test may have left, so
      // the demo agent starts from the plain role every time.
      update: {
        email: a.email,
        passwordHash: devPassword,
        fullName: a.name,
        phone: a.phone,
        status: 'ACTIVE',
      },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: agentRole.id } },
      create: { userId: user.id, roleId: agentRole.id },
      update: {},
    })
    await prisma.userPermission.deleteMany({ where: { userId: user.id } })
    await prisma.agentProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        experienceYears: a.exp,
        specialization: a.spec,
        commissionRate: a.rate,
        address: 'Mumbai, Maharashtra',
      },
      update: {
        experienceYears: a.exp,
        specialization: a.spec,
        commissionRate: a.rate,
      },
    })
    agents.push(user)
  }
  console.log(`  users: 1 admin + ${agents.length} agents`)

  // --- Properties --------------------------------------------------------
  const amenityIds = await prisma.amenity.findMany({ select: { id: true, slug: true } })
  const amenityBySlug = new Map(amenityIds.map((a) => [a.slug, a.id]))

  const propertySpecs = [
    {
      id: 'seed-prop-1',
      title: '3 BHK Sea-Facing Apartment in Bandra West',
      propertyType: 'APARTMENT' as const,
      listingType: 'SALE' as const,
      status: 'AVAILABLE' as const,
      visibility: 'PUBLIC' as const,
      featured: true,
      salePrice: '72500000.00',
      areaSqft: '1850.00',
      bedrooms: 3,
      bathrooms: 3,
      parking: 2,
      furnished: 'SEMI_FURNISHED' as const,
      facing: 'WEST' as const,
      floor: 14,
      totalFloor: 22,
      builtYear: 2019,
      locality: 'Bandra West',
      city: 'Mumbai',
      pincode: '400050',
      lat: '19.055000',
      lng: '72.826500',
      agentIdx: 0,
      amenities: ['swimming-pool', 'gymnasium', '24x7-security', 'lift', 'power-backup', 'covered-parking'],
      internalNotes: 'Owner is motivated — has already relocated to Dubai. Will consider 6.9cr for a quick close.',
    },
    {
      id: 'seed-prop-2',
      title: '2 BHK in Powai with Lake View',
      propertyType: 'APARTMENT' as const,
      listingType: 'BOTH' as const,
      status: 'AVAILABLE' as const,
      visibility: 'PUBLIC' as const,
      featured: false,
      salePrice: '24000000.00',
      rentPricePerMonth: '85000.00',
      securityDeposit: '510000.00',
      areaSqft: '1120.00',
      bedrooms: 2,
      bathrooms: 2,
      parking: 1,
      furnished: 'FULLY_FURNISHED' as const,
      facing: 'NORTH_EAST' as const,
      floor: 8,
      totalFloor: 18,
      builtYear: 2021,
      locality: 'Powai',
      city: 'Mumbai',
      pincode: '400076',
      lat: '19.116700',
      lng: '72.905000',
      agentIdx: 0,
      amenities: ['gymnasium', 'clubhouse', 'lift', '24x7-security', 'pet-friendly'],
      internalNotes: 'Listed for both sale and rent — owner prefers a sale.',
    },
    {
      id: 'seed-prop-3',
      title: 'Commercial Office Floor, BKC',
      propertyType: 'COMMERCIAL_OFFICE' as const,
      listingType: 'RENT' as const,
      status: 'UNDER_OFFER' as const,
      visibility: 'INTERNAL' as const,
      featured: false,
      rentPricePerMonth: '1250000.00',
      securityDeposit: '7500000.00',
      maintenanceCharges: '95000.00',
      areaSqft: '6200.00',
      parking: 8,
      furnished: 'UNFURNISHED' as const,
      floor: 5,
      totalFloor: 12,
      builtYear: 2017,
      locality: 'Bandra Kurla Complex',
      city: 'Mumbai',
      pincode: '400051',
      agentIdx: 1,
      amenities: ['power-backup', 'lift', 'cctv-surveillance', 'fire-safety', 'visitor-parking'],
      internalNotes: 'Offer received at 11.8L/mo. Awaiting landlord confirmation.',
    },
    {
      id: 'seed-prop-4',
      title: '4 BHK Villa in Lonavala',
      propertyType: 'VILLA' as const,
      listingType: 'SALE' as const,
      status: 'SOLD' as const,
      visibility: 'INTERNAL' as const,
      featured: false,
      salePrice: '41000000.00',
      areaSqft: '3400.00',
      bedrooms: 4,
      bathrooms: 4,
      parking: 3,
      furnished: 'FULLY_FURNISHED' as const,
      facing: 'SOUTH_EAST' as const,
      builtYear: 2015,
      locality: 'Tungarli',
      city: 'Lonavala',
      pincode: '410401',
      agentIdx: 1,
      amenities: ['swimming-pool', 'landscaped-garden', 'gated-community', 'vastu-compliant'],
      internalNotes: 'Closed Mar 2026. Buyer financed through HDFC.',
    },
    {
      id: 'seed-prop-5',
      title: '1 BHK Starter Flat, Thane West',
      propertyType: 'APARTMENT' as const,
      listingType: 'RENT' as const,
      status: 'RENTED' as const,
      visibility: 'PUBLIC' as const,
      featured: false,
      rentPricePerMonth: '28000.00',
      securityDeposit: '168000.00',
      areaSqft: '610.00',
      bedrooms: 1,
      bathrooms: 1,
      parking: 1,
      furnished: 'SEMI_FURNISHED' as const,
      facing: 'EAST' as const,
      floor: 3,
      totalFloor: 14,
      builtYear: 2020,
      locality: 'Ghodbunder Road',
      city: 'Thane',
      pincode: '400607',
      agentIdx: 0,
      amenities: ['lift', 'covered-parking', '24x7-security', 'childrens-play-area'],
    },
    {
      id: 'seed-prop-6',
      title: 'Residential Plot, Alibaug',
      propertyType: 'PLOT' as const,
      listingType: 'SALE' as const,
      status: 'AVAILABLE' as const,
      visibility: 'PRIVATE' as const,
      featured: false,
      salePrice: '18500000.00',
      areaSqft: '5000.00',
      parking: 0,
      furnished: 'UNFURNISHED' as const,
      locality: 'Awas',
      city: 'Alibaug',
      pincode: '402201',
      agentIdx: 1,
      amenities: ['gated-community'],
      internalNotes: 'Off-market. Do not list publicly — seller request.',
    },
  ]

  for (const p of propertySpecs) {
    const { amenities, agentIdx, lat, lng, ...rest } = p

    // The scalar fields, used for BOTH create and update. `update` deliberately
    // repeats them rather than being `{}`: a demo database drifts (a test marks
    // a property SOLD, an edit changes a price), and reseed should REPAIR that
    // to a known-good state, not leave the drift in place. `code`, `createdAt`
    // and generated columns are omitted — those must not be reset.
    const scalarData = {
      ...rest,
      description:
        'Well-maintained property in a sought-after location, close to schools, transport and retail. Contact the assigned agent for a viewing.',
      address: `${p.locality}, ${p.city}`,
      state: 'Maharashtra',
      country: 'India',
      latitude: lat ?? null,
      longitude: lng ?? null,
      assignedAgentId: agents[agentIdx]?.id ?? null,
      // Clear drift that tests may have introduced.
      archivedAt: null,
      deletedAt: null,
    }

    await prisma.property.upsert({
      where: { id: p.id },
      // `code` omitted — the Postgres sequence default (PROP-00001) fills it,
      // proving the hand-written migration SQL works.
      create: scalarData,
      update: scalarData,
    })

    for (const slug of amenities) {
      const amenityId = amenityBySlug.get(slug)
      if (!amenityId) continue
      await prisma.propertyAmenity.upsert({
        where: { propertyId_amenityId: { propertyId: p.id, amenityId } },
        create: { propertyId: p.id, amenityId },
        update: {},
      })
    }
  }
  console.log(`  properties: ${propertySpecs.length} upserted`)

  // --- Clients -----------------------------------------------------------
  const clientSpecs = [
    {
      id: 'seed-client-1',
      fullName: 'Vikram Malhotra',
      phone: '+91 98765 43210',
      email: 'vikram.m@example.com',
      priority: 'HIGH' as const,
      source: 'Referral — Mehta family',
      followUpStatus: 'NEGOTIATING' as const,
      agentIdx: 0,
      requirement: {
        budgetMin: '60000000.00',
        budgetMax: '80000000.00',
        propertyType: 'APARTMENT' as const,
        listingType: 'SALE' as const,
        bedrooms: 3,
        city: 'Mumbai',
        locality: 'Bandra West',
        areaMin: '1500.00',
        amenities: ['swimming-pool', 'gymnasium'],
      },
      notes: 'Wants sea-facing, high floor. Decision-maker is his wife.',
    },
    {
      id: 'seed-client-2',
      fullName: 'Sneha Iyer',
      phone: '+91 99876 54321',
      whatsapp: '+91 99876 54321',
      email: 'sneha.iyer@example.com',
      priority: 'MEDIUM' as const,
      source: 'Website enquiry',
      followUpStatus: 'CONTACTED' as const,
      agentIdx: 0,
      requirement: {
        budgetMin: '20000000.00',
        budgetMax: '26000000.00',
        propertyType: 'APARTMENT' as const,
        listingType: 'SALE' as const,
        bedrooms: 2,
        city: 'Mumbai',
        amenities: ['pet-friendly'],
      },
      notes: 'Has two cats — pet-friendly building is a hard requirement.',
    },
    {
      id: 'seed-client-3',
      fullName: 'Farhan Qureshi',
      phone: '+91 98111 22334',
      email: 'farhan@exampleco.in',
      priority: 'HIGH' as const,
      source: 'Facebook Campaign Q3',
      followUpStatus: 'INTERESTED' as const,
      agentIdx: 1,
      requirement: {
        budgetMin: '1000000.00',
        budgetMax: '1400000.00',
        propertyType: 'COMMERCIAL_OFFICE' as const,
        listingType: 'RENT' as const,
        city: 'Mumbai',
        locality: 'Bandra Kurla Complex',
        areaMin: '5000.00',
        amenities: ['power-backup'],
      },
      notes: 'Expanding fintech team. Needs possession within 60 days.',
    },
    {
      id: 'seed-client-4',
      fullName: 'Meera Joshi',
      phone: '+91 97000 88776',
      priority: 'LOW' as const,
      source: 'Walk-in',
      followUpStatus: 'NEW' as const,
      agentIdx: 1,
      requirement: {
        budgetMin: '25000.00',
        budgetMax: '32000.00',
        propertyType: 'APARTMENT' as const,
        listingType: 'RENT' as const,
        bedrooms: 1,
        city: 'Thane',
      },
      notes: null,
    },
  ]

  for (const c of clientSpecs) {
    const { requirement, agentIdx, ...rest } = c
    await prisma.client.upsert({
      where: { id: c.id },
      create: {
        ...rest,
        phoneNormalized: normalisePhone(c.phone),
        assignedAgentId: agents[agentIdx]?.id ?? null,
      },
      update: {},
    })

    const existing = await prisma.clientRequirement.findFirst({
      where: { clientId: c.id, isActive: true },
    })
    if (!existing) {
      const { amenities, ...reqRest } = requirement
      const req = await prisma.clientRequirement.create({
        data: { ...reqRest, clientId: c.id, isActive: true },
      })
      for (const slug of amenities ?? []) {
        const amenityId = amenityBySlug.get(slug)
        if (!amenityId) continue
        await prisma.requirementAmenity.create({
          data: { requirementId: req.id, amenityId },
        })
      }
    }
  }
  console.log(`  clients: ${clientSpecs.length} upserted (with active requirements)`)

  // --- Assignments (the core feature) ------------------------------------
  const assignments = [
    { clientId: 'seed-client-1', propertyId: 'seed-prop-1', status: 'VISITED' as const },
    { clientId: 'seed-client-2', propertyId: 'seed-prop-2', status: 'SHARED' as const },
    { clientId: 'seed-client-3', propertyId: 'seed-prop-3', status: 'INTERESTED' as const },

    // CROSS-AGENT, deliberately. seed-prop-6 belongs to Aisha; seed-client-1
    // belongs to Rohan. This is what makes Rohan see a property that is not
    // his — the second clause of scopeForProperty, and the spec's own workflow
    // ("Open Client -> View Assigned Properties").
    //
    // Without a row like this the clause is dead code in the demo: every seeded
    // client happened to be shown only their own agent's inventory, so the
    // feature existed and was invisible.
    { clientId: 'seed-client-1', propertyId: 'seed-prop-6', status: 'SHORTLISTED' as const },
  ]
  for (const a of assignments) {
    await prisma.propertyAssignment.upsert({
      where: { clientId_propertyId: { clientId: a.clientId, propertyId: a.propertyId } },
      create: { ...a, assignedById: admin.id },
      update: {},
    })
  }
  console.log(`  assignments: ${assignments.length} upserted`)

  // --- Interactions ------------------------------------------------------
  // lastContactAt is a deliberate denormalisation, written alongside the
  // interaction -- exactly as the API must do it in a transaction.
  const interactions = [
    {
      id: 'seed-int-1',
      clientId: 'seed-client-1',
      type: 'SITE_VISIT' as const,
      body: 'Viewed the Bandra flat. Liked the view; concerned about the maintenance charge.',
      daysAgo: 3,
    },
    {
      id: 'seed-int-2',
      clientId: 'seed-client-1',
      type: 'CALL' as const,
      body: 'Discussed negotiating to 6.9cr. Will revert after speaking to his wife.',
      daysAgo: 1,
    },
    {
      id: 'seed-int-3',
      clientId: 'seed-client-3',
      type: 'MEETING' as const,
      body: 'Site walkthrough at BKC with his ops lead.',
      daysAgo: 2,
    },
  ]
  for (const i of interactions) {
    const { daysAgo, ...rest } = i
    const occurredAt = new Date(Date.now() - daysAgo * 86_400_000)
    await prisma.clientInteraction.upsert({
      where: { id: i.id },
      create: { ...rest, occurredAt, authorId: admin.id },
      update: {},
    })
    await prisma.client.update({
      where: { id: i.clientId },
      data: { lastContactAt: occurredAt },
    })
  }
  console.log(`  interactions: ${interactions.length} upserted`)

  // --- Deal (makes the reports computable) -------------------------------
  await prisma.deal.upsert({
    where: { id: 'seed-deal-1' },
    create: {
      id: 'seed-deal-1',
      propertyId: 'seed-prop-4',
      clientId: 'seed-client-2',
      agentId: agents[1]?.id ?? null,
      dealType: 'SALE',
      closedAt: new Date('2026-03-18'),
      closedPrice: '39500000.00',
      // Snapshotted from the agent's rate AT CLOSE -- not joined live.
      commissionRate: '2.50',
      commissionAmount: '987500.00',
      notes: 'Closed below ask. Buyer financed through HDFC.',
    },
    update: {},
  })
  console.log('  deals: 1 upserted')

  console.log('\nSeed complete.')
  console.log('  admin@demo.local  / Passw0rd!   (Super Admin)')
  console.log('  agent@demo.local  / Passw0rd!   (Agent — Rohan)')
  console.log('  agent2@demo.local / Passw0rd!   (Agent — Aisha)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
