/**
 * Idempotently configure the LK Sneakers production workspace.
 *
 * Run inside the Railway core container after migrations:
 *   pnpm exec tsx scripts/seed-lk-production.ts
 */

import process from "node:process";
import { getPlatformProxy } from "wrangler";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
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
  "nike moon shoe jacquemus",
  "on running loewe",
  "adidas wales bonner",
  "nike vomero premium",
  "onitsuka tiger",

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

const SALES_PRIORITY_KEYWORDS = [
  "onitsuka tiger mexico 66",
  "onitsuka tiger kill bill",
  "onitsuka tiger",
  "nike moon shoe jacquemus",
  "new balance 204l",
  "on running loewe",
  "new balance 9060",
  "nike vomero premium",
  "nike mind 001",
  "nike mind 002",
  "travis scott jordan 1",
  "adidas sl 72 og",
  "alo yoga brasil",
] as const;

const REPLACED_BASELINE_KEYWORDS = [
  "nike jacquemus",
  "nike x nocta",
  "timberland premium boot",
] as const;

const SALES_PRIORITY_TAG = {
  name: "Prioridade vendas 50/30/20",
  normalizedName: "prioridade-vendas-50-30-20",
  color: "emerald",
} as const;

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
- Dentro do conjunto, priorizar produtos e coleções por vendas líquidas reais da Shopify: 50% para os últimos 30 dias, 30% para os últimos 90 dias e 20% para os últimos 180 dias. Recalcular os três recortes antes de recomendações estratégicas; não perpetuar uma fotografia antiga.
- Baseline comercial de 2026-08-02: Onitsuka Tiger/Mexico 66, Nike x Jacquemus Moon Shoe, New Balance 204L/9060, Loewe x On Running, Nike Vomero Premium, Nike Mind 001/002, Travis Scott x Air Jordan 1, adidas SL 72 OG e Alo Yoga têm precedência entre clusters comparáveis.
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
    const savedRemoved = await removeReplacedSavedKeywords(db, projectId);
    const savedAdded = await seedSavedKeywords(db, projectId);
    const salesPriority = await syncSalesPriorityTag(db, projectId);
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
        savedRemoved,
        salesPriority,
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

async function removeReplacedSavedKeywords(db: SeedDb, projectId: string) {
  const removed = await db
    .delete(schema.savedKeywords)
    .where(
      and(
        eq(schema.savedKeywords.projectId, projectId),
        inArray(schema.savedKeywords.keyword, REPLACED_BASELINE_KEYWORDS),
      ),
    )
    .returning({ id: schema.savedKeywords.id });
  return removed.length;
}

async function syncSalesPriorityTag(db: SeedDb, projectId: string) {
  await db
    .insert(schema.savedKeywordTags)
    .values({ id: crypto.randomUUID(), projectId, ...SALES_PRIORITY_TAG })
    .onConflictDoNothing();

  const tag = await db.query.savedKeywordTags.findFirst({
    where: and(
      eq(schema.savedKeywordTags.projectId, projectId),
      eq(
        schema.savedKeywordTags.normalizedName,
        SALES_PRIORITY_TAG.normalizedName,
      ),
    ),
  });
  if (!tag) throw new Error("Could not create sales-priority tag");

  const keywordRows = await db
    .select({ id: schema.savedKeywords.id })
    .from(schema.savedKeywords)
    .where(
      and(
        eq(schema.savedKeywords.projectId, projectId),
        inArray(schema.savedKeywords.keyword, SALES_PRIORITY_KEYWORDS),
      ),
    );
  const savedKeywordIds = keywordRows.map((row) => row.id);
  if (savedKeywordIds.length !== SALES_PRIORITY_KEYWORDS.length) {
    throw new Error("Sales-priority keywords are missing from the saved set");
  }

  const inserted = await db
    .insert(schema.savedKeywordTagAssignments)
    .values(
      savedKeywordIds.map((savedKeywordId) => ({
        savedKeywordId,
        tagId: tag.id,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: schema.savedKeywordTagAssignments.savedKeywordId });
  const removed = await db
    .delete(schema.savedKeywordTagAssignments)
    .where(
      and(
        eq(schema.savedKeywordTagAssignments.tagId, tag.id),
        notInArray(
          schema.savedKeywordTagAssignments.savedKeywordId,
          savedKeywordIds,
        ),
      ),
    )
    .returning({ id: schema.savedKeywordTagAssignments.savedKeywordId });

  return {
    keywordCount: savedKeywordIds.length,
    assignmentsAdded: inserted.length,
    assignmentsRemoved: removed.length,
  };
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
  await db
    .delete(schema.rankTrackingKeywords)
    .where(
      and(
        eq(schema.rankTrackingKeywords.configId, configId),
        inArray(
          schema.rankTrackingKeywords.keyword,
          REPLACED_BASELINE_KEYWORDS,
        ),
      ),
    );

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
