import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/auth';

const prisma = new PrismaClient();

// DEVELOPMENT-ONLY SEED DATA
// This file creates sample users for local development and testing.
// These users must NOT be used in production. Production users should
// be created through the admin API or a separate provisioning process.

const DEPARTMENTS = [
  { name: 'CCO', description: 'Final visibility and approval for sensitive, high-budget, public, strategic campaigns' },
  { name: 'Brand & Positioning', description: 'Voice, identity, positioning, PR sensitivity, visual/message alignment' },
  { name: 'Acquisition', description: 'Reach, SEO, algorithm fit, hashtags, timing, amplification' },
  { name: 'Conversion & Closing', description: 'CTA, WhatsApp flow, landing pages, objection handling, sales route' },
  { name: 'Growth & Retention', description: 'Upsell, re-engagement, community, loyalty, alumni, B2B nurturing' },
  { name: 'Commercial Operations', description: 'CRM tagging, reporting, attribution, dashboards, analytics, pipeline visibility' },
  { name: 'Production & Design', description: 'Creative assets, reels, carousels, videos, campaign visuals, asset delivery' },
  { name: 'Event Operations & Logistics', description: 'Event content, venue, scheduling, logistics' },
];

async function seed() {
  console.log('Seeding database...');

  // Seed departments
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
    console.log(`  Department: ${dept.name}`);
  }

  // Seed admin user
  const adminPassword = await hashPassword('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@tanaghum.com' },
    update: {},
    create: {
      email: 'admin@tanaghum.com',
      name: 'Admin',
      password_hash: adminPassword,
      role: 'admin',
      is_active: true,
    },
  });
  console.log('  User: admin@tanaghum.com (role: admin)');

  // Seed sample users for each department role
  const sampleUsers = [
    { email: 'cco@tanaghum.com', name: 'CCO User', role: 'cco' as const, deptName: 'CCO' },
    { email: 'brand.head@tanaghum.com', name: 'Brand Head', role: 'department_head' as const, deptName: 'Brand & Positioning' },
    { email: 'acquisition.specialist@tanaghum.com', name: 'Acquisition Specialist', role: 'specialist' as const, deptName: 'Acquisition' },
    { email: 'conversion.reviewer@tanaghum.com', name: 'Conversion Reviewer', role: 'reviewer' as const, deptName: 'Conversion & Closing' },
    { email: 'growth.viewer@tanaghum.com', name: 'Growth Viewer', role: 'viewer' as const, deptName: 'Growth & Retention' },
  ];

  const defaultPassword = await hashPassword('password123');
  for (const user of sampleUsers) {
    const dept = await prisma.department.findUnique({ where: { name: user.deptName } });
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        password_hash: defaultPassword,
        role: user.role,
        department_id: dept?.id,
        is_active: true,
      },
    });
    console.log(`  User: ${user.email} (role: ${user.role}, dept: ${user.deptName})`);
  }

  console.log('Seeding complete.');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
