/**
 * Idempotently configure the LK Sneakers production workspace.
 *
 * Run inside the Railway core container after migrations:
 *   pnpm exec tsx scripts/seed-lk-production.ts
 */

import process from "node:process";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull } from "drizzle-orm";
import * as schema from "../src/db/schema";

const LOCAL_ADMIN_USER_ID = "local-admin";
const LOCAL_ADMIN_EMAIL = "admin@localhost";
const LOCAL_ORG_ID = `delegated-${LOCAL_ADMIN_USER_ID}`;
const PROJECT_NAME = "LK Sneakers";
const PROJECT_DOMAIN = "lksneakers.com.br";
const BRAZIL_LOCATION_CODE = 2076;
const SAO_PAULO_LOCATION_NAME = "Sao Paulo,State of Sao Paulo,Brazil";
const LANGUAGE_CODE = "pt";
const SERP_DEPTH = 20;

export const LK_KEYWORDS = [
  // 60 model, brand and collection terms grounded in the current LK catalog.
  "new balance 9060",
  "new balance 530",
  "new balance 204l",
  "new balance 1906l",
  "new balance 1906r",
  "new balance 2002r",
  "new balance abzorb 2000",
  "new balance 990v6",
  "new balance 550",
  "new balance 860v2",
  "adidas samba",
  "adidas samba og",
  "adidas samba jane",
  "adidas sambae",
  "adidas campus 00s",
  "adidas gazelle indoor",
  "adidas handball spezial",
  "adidas sl 72 og",
  "adidas sl 72 rs",
  "adidas taekwondo mei",
  "adidas tokyo",
  "adidas bad bunny",
  "yeezy 350",
  "nike air jordan 1 low",
  "air jordan 1 high",
  "air jordan 4",
  "air jordan 5",
  "air jordan 11",
  "nike dunk low",
  "nike sb dunk low",
  "nike air force 1",
  "nike air max 95",
  "nike mind 001",
  "nike mind 002",
  "travis scott jordan 1",
  "asics gel kayano 14",
  "asics gel 1130",
  "asics gel nyc",
  "asics gt 2160",
  "onitsuka tiger mexico 66",
  "onitsuka tiger kill bill",
  "maison mihara yasuhiro",
  "autry medalist",
  "salomon xt 6",
  "alo yoga brasil",
  "alo runner",
  "lululemon brasil",
  "aime leon dore brasil",
  "fear of god essentials brasil",
  "nude project brasil",
  "saint studio",
  "supreme brasil",
  "labubu original",
  "pop mart brasil",
  "crocs relampago mcqueen",
  "nike jacquemus",
  "on running loewe",
  "adidas wales bonner",
  "nike x nocta",
  "timberland premium boot",

  // 20 transactional terms.
  "tênis original",
  "comprar tênis original",
  "loja de sneakers",
  "sneakers originais",
  "tênis importado original",
  "tênis exclusivo",
  "comprar sneakers online",
  "loja de tênis importados",
  "tênis masculino original",
  "tênis feminino original",
  "tênis edição limitada",
  "tênis collab",
  "onde comprar tênis original",
  "site de tênis original",
  "tênis original com nota fiscal",
  "tênis original pronta entrega",
  "sneakers premium",
  "streetwear original",
  "roupa streetwear original",
  "loja de streetwear",

  // 10 local terms for the Jardins flagship.
  "loja de sneakers são paulo",
  "loja de tênis são paulo",
  "sneakers jardins",
  "loja de tênis jardins",
  "loja de tênis oscar freire",
  "sneaker store são paulo",
  "tênis importado são paulo",
  "tênis exclusivo são paulo",
  "loja de streetwear são paulo",
  "loja de sneakers rua melo alves",

  // 10 LK brand and authenticity terms.
  "lk sneakers",
  "lk sneakers é confiável",
  "lk sneakers original",
  "lk sneakers loja física",
  "lk sneakers jardins",
  "lk sneakers avaliações",
  "garantia de autenticidade tênis",
  "como saber se o tênis é original",
  "legit check tênis",
  "tênis fake vs original",
] as const;

const PROJECT_MEMORY = `# LK Sneakers

## Negócio e objetivo
- Boutique premium de sneakers e lifestyle com e-commerce nacional e flagship na Rua Melo Alves, 344, Jardins, São Paulo.
- Objetivo primário de SEO: aumentar vendas orgânicas qualificadas sem diluir a curadoria e a confiança da marca.
- Mercado principal: Brasil, idioma português (pt-BR).

## Concorrentes diretos — resellers
- Juicy Sneakers — juicysneakers.com.br
- Hype Concept — hypeconcept.com.br
- Palmtree48 — palmtree48.com.br
- Droper — droper.app

## Regra de análise competitiva
Nike, Adidas, New Balance, Artwalk, Guadalupe, Your ID e outros retailers ou marcas podem ser referências de SERP, conteúdo e produto, mas não devem ser classificados como concorrentes diretos da LK. A lista de concorrentes diretos contém somente os quatro resellers acima.

## Estratégia inicial
- Monitorar diariamente no mobile o Brasil e semanalmente no desktop a cidade de São Paulo.
- Priorizar 100 termos: 60 de modelos/coleções, 20 transacionais, 10 locais e 10 de marca/autenticidade.
- Usar dados reais de DataForSEO e Search Console; não inventar volume, dificuldade, posição ou tráfego.`;

type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

async function main() {
  validateKeywordSet();
  const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>();
  const db = drizzle(env.DB, { schema });

  try {
    await bootstrapIdentity(db);
    const projectId = await upsertProject(db);
    await upsertOnboarding(db);
    const savedAdded = await seedSavedKeywords(db, projectId);
    const mobileConfigId = await upsertRankConfig(db, projectId, {
      devices: "mobile",
      scheduleInterval: "daily",
      locationName: null,
    });
    const desktopConfigId = await upsertRankConfig(db, projectId, {
      devices: "desktop",
      scheduleInterval: "weekly",
      locationName: SAO_PAULO_LOCATION_NAME,
    });
    const mobileAdded = await seedTrackingKeywords(db, mobileConfigId);
    const desktopAdded = await seedTrackingKeywords(db, desktopConfigId);
    await seedProjectMemory(db, projectId);

    console.log(
      JSON.stringify({
        ok: true,
        projectId,
        keywordCount: LK_KEYWORDS.length,
        savedAdded,
        mobileAdded,
        desktopAdded,
        mobileConfigId,
        desktopConfigId,
      }),
    );
  } finally {
    await dispose();
  }
}

function validateKeywordSet() {
  if (LK_KEYWORDS.length !== 100) {
    throw new Error(`Expected 100 LK keywords, received ${LK_KEYWORDS.length}`);
  }
  if (new Set(LK_KEYWORDS).size !== LK_KEYWORDS.length) {
    throw new Error("LK keyword set contains duplicates");
  }
}

async function bootstrapIdentity(db: SeedDb) {
  await db
    .insert(schema.user)
    .values({
      id: LOCAL_ADMIN_USER_ID,
      name: "LK OpenSEO",
      email: LOCAL_ADMIN_EMAIL,
      emailVerified: true,
    })
    .onConflictDoNothing({ target: schema.user.id });

  await db
    .insert(schema.organization)
    .values({
      id: LOCAL_ORG_ID,
      name: "LK Sneakers",
      slug: "delegated-local-admin",
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: schema.organization.id });
}

async function upsertProject(db: SeedDb) {
  const existing = await db.query.projects.findFirst({
    where: and(
      eq(schema.projects.organizationId, LOCAL_ORG_ID),
      eq(schema.projects.domain, PROJECT_DOMAIN),
      isNull(schema.projects.archivedAt),
    ),
  });

  if (existing) {
    await db
      .update(schema.projects)
      .set({
        name: PROJECT_NAME,
        locationCode: BRAZIL_LOCATION_CODE,
        languageCode: LANGUAGE_CODE,
      })
      .where(eq(schema.projects.id, existing.id));
    return existing.id;
  }

  const projectId = crypto.randomUUID();
  await db.insert(schema.projects).values({
    id: projectId,
    organizationId: LOCAL_ORG_ID,
    name: PROJECT_NAME,
    domain: PROJECT_DOMAIN,
    locationCode: BRAZIL_LOCATION_CODE,
    languageCode: LANGUAGE_CODE,
  });
  return projectId;
}

async function upsertOnboarding(db: SeedDb) {
  const now = new Date().toISOString();
  await db
    .insert(schema.userOnboardingAnswers)
    .values({
      userId: LOCAL_ADMIN_USER_ID,
      organizationId: LOCAL_ORG_ID,
      interestedFeatures: JSON.stringify([
        "rank_tracking",
        "keyword_research",
        "competitor_research",
        "site_audit",
        "gsc",
      ]),
      workFor: "my_business",
      clientWebsiteCount: "1",
      foundVia: "internal",
      mcpSetupIntent: "yes",
      completedAt: now,
      gscNudgeDismissedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.userOnboardingAnswers.userId,
      set: { completedAt: now, updatedAt: now },
    });
}

async function seedSavedKeywords(db: SeedDb, projectId: string) {
  let added = 0;
  for (const keyword of LK_KEYWORDS) {
    const rows = await db
      .insert(schema.savedKeywords)
      .values({
        id: crypto.randomUUID(),
        projectId,
        keyword,
        locationCode: BRAZIL_LOCATION_CODE,
        languageCode: LANGUAGE_CODE,
      })
      .onConflictDoNothing()
      .returning({ id: schema.savedKeywords.id });
    added += rows.length;
  }
  return added;
}

async function upsertRankConfig(
  db: SeedDb,
  projectId: string,
  input: {
    devices: "desktop" | "mobile";
    scheduleInterval: "daily" | "weekly";
    locationName: string | null;
  },
) {
  const locationCondition = input.locationName
    ? eq(schema.rankTrackingConfigs.locationName, input.locationName)
    : isNull(schema.rankTrackingConfigs.locationName);
  const existing = await db.query.rankTrackingConfigs.findFirst({
    where: and(
      eq(schema.rankTrackingConfigs.projectId, projectId),
      eq(schema.rankTrackingConfigs.domain, PROJECT_DOMAIN),
      eq(schema.rankTrackingConfigs.locationCode, BRAZIL_LOCATION_CODE),
      locationCondition,
    ),
  });

  if (existing) {
    await db
      .update(schema.rankTrackingConfigs)
      .set({
        languageCode: LANGUAGE_CODE,
        devices: input.devices,
        serpDepth: SERP_DEPTH,
        scheduleInterval: input.scheduleInterval,
        isActive: true,
        nextCheckAt: existing.nextCheckAt ?? new Date().toISOString(),
      })
      .where(eq(schema.rankTrackingConfigs.id, existing.id));
    return existing.id;
  }

  const configId = crypto.randomUUID();
  await db.insert(schema.rankTrackingConfigs).values({
    id: configId,
    projectId,
    domain: PROJECT_DOMAIN,
    locationCode: BRAZIL_LOCATION_CODE,
    languageCode: LANGUAGE_CODE,
    devices: input.devices,
    serpDepth: SERP_DEPTH,
    scheduleInterval: input.scheduleInterval,
    locationName: input.locationName,
    isActive: true,
    nextCheckAt: new Date().toISOString(),
  });
  return configId;
}

async function seedTrackingKeywords(db: SeedDb, configId: string) {
  let added = 0;
  for (const keyword of LK_KEYWORDS) {
    const rows = await db
      .insert(schema.rankTrackingKeywords)
      .values({ id: crypto.randomUUID(), configId, keyword })
      .onConflictDoNothing()
      .returning({ id: schema.rankTrackingKeywords.id });
    added += rows.length;
  }
  return added;
}

async function seedProjectMemory(db: SeedDb, projectId: string) {
  await db
    .insert(schema.samProjectMemory)
    .values({ projectId, label: "memory", content: PROJECT_MEMORY })
    .onConflictDoUpdate({
      target: [
        schema.samProjectMemory.projectId,
        schema.samProjectMemory.label,
      ],
      set: { content: PROJECT_MEMORY, updatedAt: new Date().toISOString() },
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
