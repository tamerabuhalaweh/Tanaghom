import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/auth';

const prisma = new PrismaClient();

// DEVELOPMENT-ONLY SEED DATA
// This file creates sample users for local development and testing.
// These users must NOT be used in production. Production users should
// be created through the admin API or a separate provisioning process.

const DEPARTMENTS = [
  { name: 'Brand & Market Intelligence', description: 'Brand voice, positioning, market research, competitive intelligence, trend analysis' },
  { name: 'Demand Generation', description: 'Content strategy, SEO, algorithm optimization, reach, hashtag strategy, amplification' },
  { name: 'Conversion', description: 'CTA optimization, landing pages, WhatsApp flow, objection handling, sales routing' },
  { name: 'Customer Growth & Retention', description: 'Upsell, re-engagement, community, loyalty, nurturing, retention campaigns' },
  { name: 'Revenue Operations', description: 'CRM management, reporting, attribution, dashboards, analytics, pipeline visibility' },
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
    { email: 'brand.head@tanaghum.com', name: 'Brand Head', role: 'department_head' as const, deptName: 'Brand & Market Intelligence' },
    { email: 'demand.specialist@tanaghum.com', name: 'Demand Specialist', role: 'specialist' as const, deptName: 'Demand Generation' },
    { email: 'conversion.reviewer@tanaghum.com', name: 'Conversion Reviewer', role: 'reviewer' as const, deptName: 'Conversion' },
    { email: 'growth.viewer@tanaghum.com', name: 'Growth Viewer', role: 'viewer' as const, deptName: 'Customer Growth & Retention' },
    { email: 'revops.head@tanaghum.com', name: 'RevOps Head', role: 'department_head' as const, deptName: 'Revenue Operations' },
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
