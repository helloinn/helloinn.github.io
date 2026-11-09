import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("A2U payout routing explicitly supports only Pi Mainnet and Testnet", async () => {
  const source = await readFile(new URL("../server/pi.ts", import.meta.url), "utf8");
  assert.match(source, /payment\.network === "Pi Network"/);
  assert.match(source, /https:\/\/api\.mainnet\.minepi\.com/);
  assert.match(source, /payment\.network === "Pi Testnet"/);
  assert.match(source, /https:\/\/api\.testnet\.minepi\.com/);
  assert.match(source, /if \(!networkConfig\)/);
  assert.match(source, /networkPassphrase: networkConfig\.networkPassphrase/);
});
