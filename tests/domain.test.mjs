import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registrationSchema,
  computeTotal,
  normalizeMobile,
  safeRegistration,
} from "../server/domain.mjs";
import { initialState } from "../server/seed.mjs";
test("family fee calculation: friend + optional spouse + per-child fee", () => {
  assert.equal(
    computeTotal({ friend: 1499, spouse: 500, child: 200 }, 0, 0),
    1499,
  );
  assert.equal(
    computeTotal({ friend: 1499, spouse: 500, child: 200 }, 1, 2),
    2399,
  );
});
test("mobile normalization supports local and +880 format", () => {
  assert.equal(normalizeMobile("+880 1773 539721"), "01773539721");
  assert.equal(normalizeMobile("01773539721"), "01773539721");
  assert.equal(normalizeMobile("০১৭৭৩৫৩৯৭২১"), "01773539721");
});
test("public projections never leak receipt recovery hash or QR secrets", () => {
  const r = initialState().registrations[0];
  const output = safeRegistration(r);
  assert.equal(output.trackingHash, undefined);
  assert.equal(output.qrSecret, undefined);
  assert.equal(output.qrPayload, null);
  assert.ok(safeRegistration(r, { ticket: true }).qrPayload.startsWith("R96:"));
  r.status = "pending";
  assert.equal(safeRegistration(r, { ticket: true }).qrPayload, null);
});
test("registration rejects negative counts and never accepts an approval status from a client", () => {
  const state = initialState();
  const r = state.registrations[0];
  const input = {
    participant: r.participant,
    spouse: 1,
    children: 2,
    food: "সাধারণ",
    notes: "",
    payment: {
      provider: "bkash",
      accountId: state.accounts[0].id,
      senderMobile: r.participant.mobile,
      transactionId: "DEMO-ABC123",
      amount: 2399,
    },
    consent: true,
    status: "approved",
  };
  const validated = registrationSchema.parse(input);
  assert.equal(validated.status, undefined);
  assert.throws(() => registrationSchema.parse({ ...input, children: -1 }));
  assert.throws(() => registrationSchema.parse({ ...input, spouse: 2 }));
});
