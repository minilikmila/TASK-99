/**
 * Unit tests for tenant isolation logic.
 * Validates that org-scoped resource lookups correctly filter by organizationId.
 */

interface ThreadLike {
  id: string;
  organizationId: string;
  title: string;
  deletedAt: Date | null;
}

// Simulates the where-clause logic used in thread/section/tag repositories
function findThreadInOrg(
  threads: ThreadLike[],
  id: string,
  organizationId: string
): ThreadLike | null {
  return (
    threads.find(
      (t) => t.id === id && t.organizationId === organizationId && t.deletedAt === null
    ) ?? null
  );
}

const ORG_A = "org_a";
const ORG_B = "org_b";

const threads: ThreadLike[] = [
  { id: "t1", organizationId: ORG_A, title: "Thread 1 in Org A", deletedAt: null },
  { id: "t2", organizationId: ORG_B, title: "Thread 2 in Org B", deletedAt: null },
  { id: "t3", organizationId: ORG_A, title: "Deleted thread", deletedAt: new Date() },
];

describe("Tenant isolation — resource lookup", () => {
  test("finds thread that belongs to the requesting org", () => {
    const result = findThreadInOrg(threads, "t1", ORG_A);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("t1");
  });

  test("returns null for thread belonging to a different org", () => {
    // Org B user attempting to access Org A thread
    const result = findThreadInOrg(threads, "t1", ORG_B);
    expect(result).toBeNull();
  });

  test("returns null for thread belonging to Org A when queried from Org B", () => {
    const result = findThreadInOrg(threads, "t2", ORG_A);
    expect(result).toBeNull();
  });

  test("returns null for deleted thread even within same org", () => {
    const result = findThreadInOrg(threads, "t3", ORG_A);
    expect(result).toBeNull();
  });

  test("returns null for non-existent id", () => {
    const result = findThreadInOrg(threads, "t999", ORG_A);
    expect(result).toBeNull();
  });
});

describe("Tenant isolation — recycle bin", () => {
  interface RecycleBinItemLike {
    id: string;
    thread: { organizationId: string } | null;
    reply: { thread: { organizationId: string } } | null;
    expiresAt: Date;
  }

  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  const items: RecycleBinItemLike[] = [
    {
      id: "rb1",
      thread: { organizationId: ORG_A },
      reply: null,
      expiresAt: future,
    },
    {
      id: "rb2",
      thread: { organizationId: ORG_B },
      reply: null,
      expiresAt: future,
    },
    {
      id: "rb3",
      thread: { organizationId: ORG_A },
      reply: null,
      expiresAt: past, // expired
    },
  ];

  function findRecycleBinItemsForOrg(
    allItems: RecycleBinItemLike[],
    organizationId: string,
    now: Date
  ): RecycleBinItemLike[] {
    return allItems.filter((item) => {
      if (item.expiresAt < now) return false;
      const itemOrgId =
        item.thread?.organizationId ??
        item.reply?.thread?.organizationId;
      return itemOrgId === organizationId;
    });
  }

  test("only returns items belonging to requesting org", () => {
    const result = findRecycleBinItemsForOrg(items, ORG_A, new Date());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rb1");
  });

  test("does not leak Org B items to Org A", () => {
    const result = findRecycleBinItemsForOrg(items, ORG_A, new Date());
    expect(result.every((i) => i.thread?.organizationId === ORG_A)).toBe(true);
  });

  test("does not include expired items", () => {
    const result = findRecycleBinItemsForOrg(items, ORG_A, new Date());
    expect(result.every((i) => i.expiresAt > new Date())).toBe(true);
  });
});
