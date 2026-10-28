import assert from "node:assert/strict";
import test from "node:test";
import { planRedemption, type RedemptionReward } from "./redemption.ts";

type MemoryStore = {
  reward: RedemptionReward;
  nivel: "Bronce" | "Plata" | "Oro";
  puntosDisponibles: number;
  claims: number;
  rewardVersion: number;
  snapshotVersion: number;
  claimsVersion: number;
  movements: number;
  coupons: number;
  redemptions: number;
};

function createStore(reward: Partial<RedemptionReward> = {}, puntosDisponibles = 1000): MemoryStore {
  return {
    reward: {
      tipo: "descuento",
      activo: true,
      puntosRequeridos: 100,
      stock: 1,
      nivelMinimo: "Bronce",
      limitePorCliente: null,
      ...reward,
    },
    nivel: "Plata",
    puntosDisponibles,
    claims: 0,
    rewardVersion: 0,
    snapshotVersion: 0,
    claimsVersion: 0,
    movements: 0,
    coupons: 0,
    redemptions: 0,
  };
}

function createLock() {
  let tail = Promise.resolve();

  return function exclusive<T>(action: () => T) {
    const run = tail.then(action);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

function createBarrier(parties: number) {
  let arrived = 0;
  let open = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });

  return {
    arrive() {
      arrived += 1;
      if (arrived >= parties) {
        open();
      }

      return gate;
    },
  };
}

// Imita runTransaction: lee, y si otra escritura cambió la versión, relee.
async function commitRedeem(
  store: MemoryStore,
  lock: ReturnType<typeof createLock>,
  barrier?: ReturnType<typeof createBarrier>,
) {
  let attempts = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    attempts += 1;
    const seen = {
      rewardVersion: store.rewardVersion,
      snapshotVersion: store.snapshotVersion,
      claimsVersion: store.claimsVersion,
      stock: store.reward.stock,
      puntosDisponibles: store.puntosDisponibles,
      claimsCount: store.claims,
      reward: store.reward,
    };

    if (attempt === 0 && barrier) {
      await barrier.arrive();
    }

    const decision = planRedemption({
      reward: { ...seen.reward, stock: seen.stock },
      nivel: store.nivel,
      puntosDisponibles: seen.puntosDisponibles,
      claims: seen.claimsCount,
    });

    if (!decision.ok) {
      return { attempts, result: decision };
    }

    const committed = await lock(() => {
      if (
        store.rewardVersion !== seen.rewardVersion ||
        store.snapshotVersion !== seen.snapshotVersion ||
        store.claimsVersion !== seen.claimsVersion
      ) {
        return false;
      }

      if (decision.touchStock) {
        store.reward = { ...store.reward, stock: decision.nextStock };
        store.rewardVersion += 1;
      }

      store.puntosDisponibles = decision.nextPuntosDisponibles;
      store.snapshotVersion += 1;
      store.claims = decision.nextClaims;
      store.claimsVersion += 1;
      store.movements += 1;
      store.redemptions += 1;
      if (decision.crearCupon) {
        store.coupons += 1;
      }

      return true;
    });

    if (committed) {
      return { attempts, result: decision };
    }
  }

  return {
    attempts,
    result: { ok: false as const, reason: "No se pudo completar el canje." },
  };
}

test("dos canjes simultáneos de la última unidad dejan un solo movimiento y un cupón", async () => {
  const store = createStore();
  const lock = createLock();
  const barrier = createBarrier(2);
  const [first, second] = await Promise.all([
    commitRedeem(store, lock, barrier),
    commitRedeem(store, lock, barrier),
  ]);
  const results = [first, second];
  const winner = results.find((item) => item.result.ok);
  const loser = results.find((item) => !item.result.ok);

  assert.ok(winner);
  assert.ok(loser);
  assert.equal(winner.attempts, 1);
  assert.ok(loser.attempts >= 2);
  assert.equal(loser.result.ok, false);
  if (!loser.result.ok) {
    assert.equal(loser.result.reason, "Ya no hay stock.");
  }
  assert.equal(store.reward.stock, 0);
  assert.equal(store.movements, 1);
  assert.equal(store.coupons, 1);
  assert.equal(store.redemptions, 1);
  assert.equal(store.puntosDisponibles, 900);
});

test("sin puntos suficientes no escribe movimiento ni cupón", async () => {
  const store = createStore({ puntosRequeridos: 500 }, 100);
  const outcome = await commitRedeem(store, createLock());

  assert.equal(outcome.result.ok, false);
  if (!outcome.result.ok) {
    assert.equal(outcome.result.reason, "No tienes puntos suficientes.");
  }
  assert.equal(store.movements, 0);
  assert.equal(store.coupons, 0);
  assert.equal(store.redemptions, 0);
  assert.equal(store.puntosDisponibles, 100);
  assert.equal(store.reward.stock, 1);
});

test("el tope por cliente rechaza el canje sin escribir", async () => {
  const store = createStore({ limitePorCliente: 1, stock: 4 });
  store.claims = 1;
  const outcome = await commitRedeem(store, createLock());

  assert.equal(outcome.result.ok, false);
  if (!outcome.result.ok) {
    assert.equal(outcome.result.reason, "Ya alcanzaste el límite de canjes de esta recompensa.");
  }
  assert.equal(store.movements, 0);
  assert.equal(store.coupons, 0);
  assert.equal(store.claims, 1);
  assert.equal(store.reward.stock, 4);
});

test("un producto no crea cupón y un descuento ilimitado no toca el stock", () => {
  const product = planRedemption({
    reward: {
      tipo: "producto",
      activo: true,
      puntosRequeridos: 80,
      stock: 2,
      nivelMinimo: "Bronce",
      limitePorCliente: null,
    },
    nivel: "Bronce",
    puntosDisponibles: 80,
    claims: 0,
  });
  const unlimited = planRedemption({
    reward: {
      tipo: "descuento",
      activo: true,
      puntosRequeridos: 10,
      stock: null,
      nivelMinimo: "Oro",
      limitePorCliente: null,
    },
    nivel: "Oro",
    puntosDisponibles: 10,
    claims: 0,
  });

  assert.equal(product.ok, true);
  if (product.ok) {
    assert.equal(product.crearCupon, false);
    assert.equal(product.estado, "pendiente");
    assert.equal(product.nextStock, 1);
  }

  assert.equal(unlimited.ok, true);
  if (unlimited.ok) {
    assert.equal(unlimited.crearCupon, true);
    assert.equal(unlimited.touchStock, false);
    assert.equal(unlimited.estado, "vigente");
  }
});
