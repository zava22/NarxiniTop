import test from "node:test";
import assert from "node:assert/strict";
import { passwordStrength, safeNext, authErrorKey, validateEmail, validatePhone, withTimeout } from "../../../src/lib/authUtils.js";

test("password strength", () => {
  assert.equal(passwordStrength("").score, 0);
  assert.ok(passwordStrength("abc").score <= 1);
  assert.ok(passwordStrength("password1A").score <= 1);
  assert.equal(passwordStrength("Tr0ub4dor&3xx").score, 4);
  assert.equal(passwordStrength("Kitob7Kitob").ok, true);
  assert.equal(passwordStrength("kitobkitob").ok, false);
});
test("safe redirect blocks open redirects", () => {
  assert.equal(safeNext("/cart"), "/cart");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("/auth?x=1"), "/");
  assert.equal(safeNext(undefined), "/");
});
test("error mapping", () => {
  assert.equal(authErrorKey({ message: "Invalid login credentials" }), "auth.err.invalid");
  assert.equal(authErrorKey({ message: "Email not confirmed" }), "auth.err.notConfirmed");
  assert.equal(authErrorKey({ message: "User already registered" }), "auth.err.exists");
  assert.equal(authErrorKey({ name: "AuthRetryableFetchError", message: "x" }), "auth.err.network");
  assert.equal(authErrorKey({ status: 429, message: "x" }), "auth.err.rate");
  assert.equal(authErrorKey({ name: "TimeoutError", message: "timeout" }), "auth.err.timeout");
  assert.equal(authErrorKey({ message: "???" }), "auth.err.generic");
});
test("validators + timeout", async () => {
  assert.ok(validateEmail("a@b.uz")); assert.ok(!validateEmail("a@b"));
  assert.ok(validatePhone("")); assert.ok(validatePhone("+998 90 123 45 67")); assert.ok(!validatePhone("12"));
  await assert.rejects(withTimeout(new Promise(() => {}), 20), { name: "TimeoutError" });
  assert.equal(await withTimeout(Promise.resolve(5), 50), 5);
});
