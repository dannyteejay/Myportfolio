import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@portfolio.dev";
  const password = process.env.ADMIN_PASSWORD ?? "Admin123!";

  // Admin user
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: hash, name: "Site Admin", role: "ADMIN" },
  });

  // Profile
  await prisma.profile.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "Alex Morgan",
      title: "Full-Stack Engineer & Web Designer",
      tagline: "I build fast, elegant software and design interfaces people love.",
      bio: "I'm a full-stack developer and designer with 6+ years crafting production web apps and polished digital products. I specialize in React, TypeScript, and Node.js, with a strong eye for clean, accessible UI. I turn complex problems into simple, delightful experiences â€” from architecture to the final pixel.",
      email: "hello@alexmorgan.dev",
      location: "Lagos, Nigeria",
      githubUrl: "https://github.com/",
      linkedinUrl: "https://linkedin.com/",
      twitterUrl: "https://twitter.com/",
      websiteUrl: "https://example.com",
    },
  });

  // Skills
  const skills = [
    { name: "React", category: "frontend", level: 95, order: 1 },
    { name: "TypeScript", category: "frontend", level: 92, order: 2 },
    { name: "Tailwind CSS", category: "frontend", level: 90, order: 3 },
    { name: "Node.js", category: "backend", level: 88, order: 4 },
    { name: "PostgreSQL", category: "backend", level: 85, order: 5 },
    { name: "Prisma", category: "backend", level: 84, order: 6 },
    { name: "Figma", category: "design", level: 90, order: 7 },
    { name: "UI/UX Design", category: "design", level: 88, order: 8 },
  ];
  await prisma.skill.deleteMany();
  await prisma.skill.createMany({ data: skills });

  // Projects
  const projects = [
    {
      title: "Nimbus Analytics Dashboard",
      category: "software",
      summary: "Real-time SaaS analytics platform with live charts and team workspaces.",
      description:
        "Nimbus is a real-time analytics SaaS built with React, TypeScript and a Node.js backend streaming metrics over WebSockets. It features role-based team workspaces, customizable dashboards, exportable reports, and sub-second query performance on millions of events. I designed the entire UI system and built the full stack, including the billing flow.",
      tags: ["React", "TypeScript", "Node.js", "PostgreSQL", "Socket.IO"],
      liveUrl: "https://example.com",
      repoUrl: "https://github.com/",
      featured: true,
      order: 1,
      coverImage: "/media/project-nimbus.svg",
    },
    {
      title: "Payflow Checkout SDK",
      category: "software",
      summary: "Drop-in payments SDK with a beautiful, conversion-optimized checkout.",
      description:
        "Payflow is a lightweight JavaScript SDK that lets any site add a polished checkout in minutes. It handles card and bank payments via Paystack, retries, and receipts. I built the SDK, the merchant dashboard, and the developer docs. The checkout increased partner conversion rates by an average of 18%.",
      tags: ["TypeScript", "Paystack", "Express", "Prisma"],
      liveUrl: "https://example.com",
      repoUrl: "https://github.com/",
      featured: true,
      order: 2,
      coverImage: "/media/project-payflow.svg",
    },
    {
      title: "Aurora Design System",
      category: "webdesign",
      summary: "A comprehensive design system and component library for a fintech brand.",
      description:
        "Aurora is a complete design system I created in Figma and implemented in React + Tailwind. It includes 60+ accessible components, design tokens, dark mode, and thorough documentation. It cut the client's feature delivery time nearly in half and unified their product suite under one visual language.",
      tags: ["Figma", "Design System", "Tailwind CSS", "Accessibility"],
      liveUrl: "https://example.com",
      featured: true,
      order: 3,
      coverImage: "/media/project-aurora.svg",
    },
    {
      title: "Verdant â€” Sustainable Store",
      category: "webdesign",
      summary: "Award-worthy e-commerce concept for an eco-friendly lifestyle brand.",
      description:
        "Verdant is an end-to-end web design and build for a sustainability-focused e-commerce brand. I led brand direction, art direction, and front-end development, delivering a warm, editorial storefront with buttery animations and a 98 Lighthouse performance score.",
      tags: ["Web Design", "E-commerce", "React", "Framer Motion"],
      liveUrl: "https://example.com",
      order: 4,
      coverImage: "/media/project-verdant.svg",
    },
    {
      title: "Orbit Task Manager",
      category: "software",
      summary: "Collaborative kanban app with offline support and real-time sync.",
      description:
        "Orbit is a collaborative task manager featuring drag-and-drop kanban boards, real-time multiplayer editing, offline-first sync, and keyboard-driven navigation. Built with React, a Node/Express API, and PostgreSQL, it demonstrates robust state management and conflict resolution.",
      tags: ["React", "Node.js", "PostgreSQL", "Socket.IO"],
      repoUrl: "https://github.com/",
      order: 5,
      coverImage: "/media/project-orbit.svg",
    },
    {
      title: "Lumen Agency Site",
      category: "webdesign",
      summary: "High-end marketing site with immersive scroll storytelling.",
      description:
        "A marketing site for a creative agency featuring immersive scroll-based storytelling, custom cursor interactions, and a bespoke type system. Designed and developed end-to-end with a focus on motion and performance.",
      tags: ["Web Design", "Animation", "React", "GSAP"],
      liveUrl: "https://example.com",
      order: 6,
      coverImage: "/media/project-lumen.svg",
    },
  ];
  await prisma.project.deleteMany();
  for (const p of projects) {
    await prisma.project.create({
      data: { ...p, slug: slugify(p.title), published: true },
    });
  }

  // Products (digital products / templates for sale)
  const products = [
    {
      title: "SaaS Landing Page Kit",
      description:
        "A premium, fully responsive SaaS landing page template built with React, TypeScript and Tailwind. Includes 12 sections, dark mode, and Framer Motion animations. Clean, documented code ready to ship.",
      price: 1500000, // NGN 15,000.00 in kobo
      currency: "NGN",
      tags: ["React", "Tailwind", "Template"],
      order: 1,
      coverImage: "/media/product-saaskit.svg",
    },
    {
      title: "Admin Dashboard UI Pack",
      description:
        "A polished admin dashboard UI kit with 40+ components, charts, tables, and forms. Figma source + React implementation included. Perfect starting point for internal tools.",
      price: 2500000, // NGN 25,000.00
      currency: "NGN",
      tags: ["Dashboard", "Figma", "React"],
      order: 2,
      coverImage: "/media/product-admin.svg",
    },
    {
      title: "Portfolio Starter Template",
      description:
        "The very template powering sites like this one. A full-stack portfolio with admin dashboard, auth, and CMS. Deploy in minutes and make it yours.",
      price: 1000000, // NGN 10,000.00
      currency: "NGN",
      tags: ["Portfolio", "Full-Stack", "Template"],
      order: 3,
      coverImage: "/media/product-portfolio.svg",
    },
  ];
  await prisma.product.deleteMany();
  for (const p of products) {
    await prisma.product.create({
      data: { ...p, slug: slugify(p.title), published: true },
    });
  }

  // Payment settings (singleton) â€” configure the rest in the admin dashboard
  await prisma.paymentSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      paystackEnabled: true,
      flutterwaveEnabled: true,
      cryptoEnabled: true,
      bankEnabled: true,
      bankName: "GTBank",
      bankAccountName: "Alex Morgan",
      bankAccountNumber: "0123456789",
      bankInstructions:
        "Use your order reference as the transfer narration, then email your receipt. Access is granted once payment is confirmed.",
      cryptoNote:
        "Pay with BTC, ETH, USDT and more. You'll be redirected to a secure crypto invoice.",
    },
  });

  console.log("Seed complete. Admin user ready for:", email);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


